import * as core from '@actions/core';
import { runPRCheck } from './modes/pr-check.js';
import { runRelease } from './modes/release.js';
import type { ActionInputs } from './types.js';

/**
 * Parse and validate action inputs
 */
function getInputs(): ActionInputs {
  const mode = core.getInput('mode', { required: true });

  if (mode !== 'pr-check' && mode !== 'release') {
    throw new Error(`Invalid mode: "${mode}". Must be 'pr-check' or 'release'.`);
  }

  const githubToken = core.getInput('github-token');
  if (!githubToken) {
    throw new Error('github-token is required');
  }

  return {
    mode,
    githubToken,
    anthropicApiKey: core.getInput('anthropic-api-key') || undefined,
    failOnBreaking: core.getInput('fail-on-breaking') === 'true',
    autoChangeset: core.getInput('auto-changeset') === 'true',
    versionPrTitle: core.getInput('version-pr-title') || 'Version Contracts',
    versionPrBranch: core.getInput('version-pr-branch') || 'contractual/version-contracts',
  };
}

async function run(): Promise<void> {
  try {
    const inputs = getInputs();

    core.debug(`Running in ${inputs.mode} mode`);

    switch (inputs.mode) {
      case 'pr-check':
        await runPRCheck(inputs);
        break;
      case 'release':
        await runRelease(inputs);
        break;
    }
  } catch (error) {
    if (error instanceof Error) {
      core.error(error.stack || error.message);
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

// Run and handle unhandled rejections
run().catch((error) => {
  core.setFailed(`Unhandled error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
