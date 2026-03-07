import * as core from '@actions/core';
import { execSync, ExecSyncOptions } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { ChangesetToCommit } from '../types.js';

/** Options for git commands - capture output for debugging */
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
 * Commit a changeset file to the current PR branch.
 * Assumes we're already on the PR branch (checkout action with ref: github.head_ref).
 */
export async function commitChangeset(changeset: ChangesetToCommit): Promise<void> {
  const filePath = `.contractual/changesets/${changeset.filename}`;

  core.debug(`Committing changeset: ${filePath}`);

  // Configure git identity
  git('config user.name "contractual[bot]"');
  git('config user.email "contractual[bot]@users.noreply.github.com"');

  // Ensure directory exists
  mkdirSync(dirname(filePath), { recursive: true });

  // Write the changeset file
  writeFileSync(filePath, changeset.content, 'utf-8');
  core.debug(`Wrote changeset file: ${filePath}`);

  // Stage the file
  git(`add "${filePath}"`);

  // Commit
  const commitMessage = `chore: add changeset ${changeset.filename}`;
  git(`commit -m "${commitMessage}"`);
  core.debug('Committed changeset');

  // Push with retry
  await pushWithRetry(3);
  core.info(`Committed and pushed changeset: ${changeset.filename}`);
}

/**
 * Push with retry logic for transient failures
 */
async function pushWithRetry(maxAttempts: number): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      git('push');
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      core.warning(`Push attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);

      if (attempt < maxAttempts) {
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000;
        core.debug(`Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to push after ${maxAttempts} attempts: ${lastError?.message}`);
}
