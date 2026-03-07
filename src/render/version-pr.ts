import type { BumpResult } from '@contractual/cli';
import type { VersionPRData } from '../types.js';

/**
 * Render the Version Contracts PR body.
 */
export function renderVersionPRBody(data: VersionPRData): string {
  let md = '## Version Contracts\n\n';
  md +=
    'This PR was automatically created by Contractual. It contains version bumps from the following changesets:\n\n';

  // Bump summary table
  if (data.bumps.length > 0) {
    md += '### Version Bumps\n\n';
    md += '| Contract | Old Version | New Version | Bump |\n';
    md += '|----------|-------------|-------------|------|\n';
    for (const bump of data.bumps) {
      md += `| ${bump.contract} | ${bump.oldVersion} | ${bump.newVersion} | ${bump.bumpType} |\n`;
    }
    md += '\n';

    // Detailed changes per contract
    md += '### Changes\n\n';
    for (const bump of data.bumps) {
      if (bump.changes) {
        md += `<details><summary><b>${bump.contract}</b> (${bump.oldVersion} → ${bump.newVersion})</summary>\n\n`;
        md += bump.changes;
        md += '\n</details>\n\n';
      }
    }
  } else {
    md += '### Version Bumps\n\nNo version bumps in this release.\n\n';
  }

  // Consumed changesets
  if (data.consumedChangesets.length > 0) {
    md += '### Consumed Changesets\n\n';
    for (const cs of data.consumedChangesets) {
      md += `- \`${cs}\`\n`;
    }
    md += '\n';
  }

  md += '---\n\n';
  md +=
    '_Merge this PR to release these versions. After merge, Contractual will run post-release hooks (if configured)._\n';

  return md;
}
