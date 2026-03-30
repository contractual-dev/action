import * as core from '@actions/core';
import * as github from '@actions/github';
import { execSync, ExecSyncOptions } from 'child_process';
import type { VersionPROptions } from '../types.js';

/** Options for git commands */
const GIT_OPTIONS: ExecSyncOptions = {
  encoding: 'utf-8',
  stdio: ['pipe', 'pipe', 'pipe'],
};

/**
 * Execute a git command with error handling
 */
function git(command: string): string {
  try {
    const result = execSync(`git ${command}`, GIT_OPTIONS);
    return typeof result === 'string' ? result.trim() : '';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Git command failed: git ${command}\n${message}`);
  }
}

/**
 * Check if there are staged changes
 */
function hasStagedChanges(): boolean {
  try {
    const result = git('diff --cached --quiet');
    return false; // No changes if command succeeds
  } catch {
    return true; // Changes exist if command fails
  }
}

/**
 * Create or update the Version Contracts PR.
 * - Creates a branch from main
 * - Commits version changes
 * - Creates/updates PR
 */
export async function createOrUpdateVersionPR(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  options: VersionPROptions
): Promise<string> {
  const { owner, repo } = context.repo;
  const baseBranch = options.baseBranch || getDefaultBranch(context);

  core.debug(`Base branch: ${baseBranch}, Version branch: ${options.branch}`);

  // Ensure branch exists
  await ensureBranchExists(octokit, owner, repo, options.branch, baseBranch);

  // Fetch the version branch
  git(`fetch origin ${options.branch}`);

  // Use checkout -B to create or reset the branch, keeping uncommitted changes
  // This handles the case where the branch exists with stale state
  git(`checkout -B ${options.branch}`);

  // Merge any remote changes to stay in sync
  try {
    git(`merge origin/${options.branch} --no-edit`);
  } catch {
    core.debug('No remote changes to merge or merge conflict (will be resolved by push)');
  }

  // Configure git identity
  git('config user.name "contractual[bot]"');
  git('config user.email "contractual[bot]@users.noreply.github.com"');

  // Stage all changes
  git('add -A');

  // Only commit if there are changes
  if (hasStagedChanges()) {
    git('commit -m "chore: version contracts"');
    core.debug('Committed version changes');

    // Push changes
    git(`push origin ${options.branch}`);
    core.debug('Pushed changes');
  } else {
    core.info('No changes to commit');
  }

  // Find or create PR
  return await findOrCreatePR(octokit, owner, repo, options, baseBranch);
}

/**
 * Get default branch from context
 */
function getDefaultBranch(context: typeof github.context): string {
  const branch = context.payload.repository?.default_branch;
  if (typeof branch === 'string' && branch.length > 0) {
    return branch;
  }
  return 'main';
}

/**
 * Ensure the version branch exists
 */
async function ensureBranchExists(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  branch: string,
  baseBranch: string
): Promise<void> {
  try {
    await octokit.rest.repos.getBranch({ owner, repo, branch });
    core.debug(`Branch ${branch} exists`);
  } catch {
    // Branch doesn't exist, create it
    core.info(`Creating branch: ${branch}`);
    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: ref.object.sha,
    });
  }
}

/**
 * Find existing PR or create new one
 */
async function findOrCreatePR(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  options: VersionPROptions,
  baseBranch: string
): Promise<string> {
  // Find existing PR
  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${options.branch}`,
    base: baseBranch,
    state: 'open',
  });

  if (prs.length > 0) {
    // Update existing PR body
    const pr = prs[0];
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: pr.number,
      body: options.body,
    });
    core.info(`Updated existing PR #${pr.number}`);
    return pr.html_url;
  }

  // Create new PR
  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: options.title,
    head: options.branch,
    base: baseBranch,
    body: options.body,
  });
  core.info(`Created PR #${pr.number}`);
  return pr.html_url;
}
