import * as core from '@actions/core';
import * as github from '@actions/github';
import { join } from 'node:path';
import { loadConfig, readChangesets } from '@contractual/cli';
import { createOrUpdateVersionPR } from '../github/pull-requests.js';
import { renderVersionPRBody } from '../render/version-pr.js';
import type { ActionInputs, ChangesetFile, ResolvedConfig } from '../types.js';

/** Path to changesets directory */
const CHANGESETS_DIR = '.contractual/changesets';

/**
 * Run the release workflow:
 * - If changesets exist: run version, create/update Version PR
 * - If no changesets + version merge: run post-release hooks
 */
export async function runRelease(inputs: ActionInputs): Promise<void> {
  const octokit = github.getOctokit(inputs.githubToken);
  const context = github.context;

  core.info('Loading contractual config...');
  const config = loadConfig(); // sync function

  core.info('Reading changesets...');
  const changesets = await readChangesets(CHANGESETS_DIR); // async - must await!

  if (changesets.length > 0) {
    core.info(`Found ${changesets.length} changeset(s). Running version workflow...`);
    await handleVersioning(octokit, context, config, changesets, inputs);
  } else {
    core.info('No changesets found. Checking if this is a version merge...');
    const isVersionMerge = await checkIfVersionMerge(octokit, context);
    if (isVersionMerge) {
      core.info('Version merge detected. Running post-release hooks...');
      await handlePostRelease(config);
    } else {
      core.info('Not a version merge. Nothing to do.');
    }
  }
}

/**
 * Handle versioning when changesets exist
 */
async function handleVersioning(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  config: ResolvedConfig,
  changesets: ChangesetFile[],
  inputs: ActionInputs
): Promise<void> {
  // TODO: Run contractual version programmatically
  // For now, we'll create a placeholder version result
  core.warning('Version command not yet fully implemented - creating placeholder PR');

  // Extract consumed changeset filenames
  const consumedChangesets = changesets.map((cs) => cs.filename);

  // Create placeholder bumps from changeset data
  // In the real implementation, this would come from running the version command
  const bumps = changesets.flatMap((cs) =>
    Object.entries(cs.bumps).map(([contract, bumpType]) => ({
      contract,
      oldVersion: '0.0.0', // Placeholder
      newVersion: bumpType === 'major' ? '1.0.0' : bumpType === 'minor' ? '0.1.0' : '0.0.1',
      bumpType,
      changes: cs.body,
    }))
  );

  // Render PR body
  const prBody = renderVersionPRBody({
    bumps,
    consumedChangesets,
  });

  try {
    const prUrl = await createOrUpdateVersionPR(octokit, context, {
      branch: inputs.versionPrBranch,
      title: inputs.versionPrTitle,
      body: prBody,
    });

    core.setOutput('version-pr-url', prUrl);
    core.info(`Version Contracts PR: ${prUrl}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create Version PR: ${message}`);
  }
}

/**
 * Handle post-release when Version PR was merged
 */
async function handlePostRelease(config: ResolvedConfig): Promise<void> {
  // Phase 2: Run generate + publish commands
  core.info('Post-release hooks not yet implemented (Phase 2)');
  // Future:
  // await runGenerateCommand(config);
  // await runPublishCommand(config);
}

/**
 * Check if current commit is a version merge (modified versions.json)
 */
async function checkIfVersionMerge(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context
): Promise<boolean> {
  try {
    const { data: commit } = await octokit.rest.repos.getCommit({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: context.sha,
    });

    const isVersionMerge =
      commit.files?.some((f) => f.filename === '.contractual/versions.json') ?? false;

    if (isVersionMerge) {
      core.debug('Commit modifies versions.json - detected as version merge');
    }

    return isVersionMerge;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.warning(`Failed to check if version merge: ${message}`);
    return false;
  }
}
