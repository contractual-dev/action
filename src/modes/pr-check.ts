import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  loadConfig,
  getLinter,
  diffContracts,
  createChangeset as cliCreateChangeset,
} from '@contractual/cli';
import { postOrUpdateComment } from '../github/comments.js';
import { commitChangeset } from '../github/commits.js';
import { renderPRComment } from '../render/pr-comment.js';
import type { ActionInputs, LintResult, DiffResult, ResolvedConfig } from '../types.js';

/**
 * Run the PR check workflow:
 * 1. Load config
 * 2. Run lint
 * 3. Run breaking
 * 4. Check for existing changeset
 * 5. Auto-generate changeset if missing
 * 6. Render and post PR comment
 * 7. Set outputs
 * 8. Fail if breaking + fail-on-breaking
 */
export async function runPRCheck(inputs: ActionInputs): Promise<void> {
  const octokit = github.getOctokit(inputs.githubToken);
  const context = github.context;
  const prNumber = context.payload.pull_request?.number;

  if (!prNumber) {
    throw new Error('This action must run on pull_request events');
  }

  core.info('Loading contractual config...');
  const config = loadConfig();

  // Run lint
  core.info('Running lint...');
  const lintResults = await runLint(config);
  const hasLintErrors = lintResults.some((r) => r.errors.length > 0);
  core.info(`Lint complete: ${lintResults.length} contract(s) checked`);

  // Run diff (includes breaking, non-breaking, and patch changes)
  core.info('Running diff/breaking change detection...');
  const diffResults = await runDiff(config);
  const hasBreaking = diffResults.some((r) => r.summary.breaking > 0);
  const hasChanges = diffResults.some((r) => r.changes.length > 0);
  core.info(`Breaking detection complete: ${hasBreaking ? 'breaking changes found' : 'no breaking changes'}`);

  // Check for existing changeset in PR
  core.info('Checking for existing changeset...');
  const prFiles = await getPRFiles(octokit, context, prNumber);
  const hasChangeset = prFiles.some(
    (f) =>
      f.filename.startsWith('.contractual/changesets/') &&
      f.filename.endsWith('.md')
  );

  // Auto-generate changeset if missing
  let changesetCreated = false;
  if (hasChanges && !hasChangeset && inputs.autoChangeset) {
    core.info('Auto-generating changeset...');
    try {
      const changesetFile = generateChangeset(diffResults);
      if (changesetFile) {
        await commitChangeset(changesetFile);
        changesetCreated = true;
        core.info(`Changeset committed: ${changesetFile.filename}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      core.warning(`Failed to auto-generate changeset: ${message}`);
    }
  }

  // Render and post PR comment
  core.info('Posting PR comment...');
  const commentBody = renderPRComment({
    lintResults,
    diffResults,
    hasChangeset: hasChangeset || changesetCreated,
    changesetCreated,
    aiExplanation: null, // LLM integration deferred
  });

  try {
    await postOrUpdateComment(octokit, context, prNumber, commentBody);
    core.info('PR comment posted');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.warning(`Failed to post PR comment: ${message}`);
  }

  // Set outputs
  core.setOutput('has-breaking', hasBreaking.toString());
  core.setOutput('has-changes', hasChanges.toString());
  core.setOutput('changeset-created', changesetCreated.toString());

  // Fail if configured
  if (hasLintErrors) {
    core.setFailed('Lint errors found. Review the PR comment for details.');
    return;
  }

  if (hasBreaking && inputs.failOnBreaking) {
    core.setFailed('Breaking changes detected. Review the PR comment for details.');
  }
}

/**
 * Run lint for all contracts in config
 */
async function runLint(config: ResolvedConfig): Promise<LintResult[]> {
  const results: LintResult[] = [];

  for (const contract of config.contracts) {
    // Skip if linting disabled
    if (contract.lint === false) {
      core.debug(`Skipping lint for ${contract.name} (disabled)`);
      continue;
    }

    try {
      const linter = getLinter(contract.type, contract.lint);

      if (!linter) {
        core.debug(`No linter available for ${contract.name} (type: ${contract.type})`);
        continue;
      }

      const result = await linter(contract.absolutePath);
      results.push({
        ...result,
        contract: contract.name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Linter failed';
      results.push({
        contract: contract.name,
        errors: [{ path: '', message, severity: 'error' }],
        warnings: [],
      });
    }
  }

  return results;
}

/**
 * Run diff for all contracts - returns ALL classified changes.
 * This is the primitive used by both `diff` and `breaking` CLI commands.
 * The action decides separately whether to fail based on inputs.failOnBreaking.
 */
async function runDiff(config: ResolvedConfig): Promise<DiffResult[]> {
  try {
    const { results } = await diffContracts(config, { includeEmpty: false });
    return results;
  } catch (error) {
    // Handle case where no .contractual directory exists
    if (error instanceof Error && error.message.includes('No .contractual directory')) {
      core.warning('No .contractual directory found - skipping diff');
      return [];
    }
    throw error;
  }
}

/**
 * Generate changeset from diff results
 */
function generateChangeset(
  diffResults: DiffResult[]
): { filename: string; content: string } | null {
  // Filter to only contracts with changes
  const resultsWithChanges = diffResults.filter((r) => r.changes.length > 0);

  if (resultsWithChanges.length === 0) {
    return null;
  }

  return cliCreateChangeset(resultsWithChanges);
}

/**
 * Get list of files changed in PR
 */
async function getPRFiles(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  prNumber: number
): Promise<Array<{ filename: string }>> {
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber,
  });
  return files;
}
