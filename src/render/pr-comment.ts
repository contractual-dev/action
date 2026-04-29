import type { LintResult, DiffResult, Change } from '@contractual/cli';
import type { PRCommentData } from '../types.js';

/**
 * Decode JSON Pointer to readable path
 * Converts ~1 to / and ~0 to ~
 */
function decodeJsonPointer(pointer: string): string {
  if (!pointer) return '';
  return pointer.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Render the full PR comment from lint and diff results.
 */
export function renderPRComment(data: PRCommentData): string {
  const sections: string[] = [];

  sections.push('## Contract Check Results\n');

  // Lint section
  sections.push(renderLintSection(data.lintResults));

  // Diff section
  if (data.diffResults.some(r => r.changes.length > 0)) {
    sections.push(renderDiffSection(data.diffResults));
  } else {
    sections.push('### Changes\n\nNo spec changes detected.\n');
  }

  // Changeset status
  sections.push(renderChangesetSection(data.hasChangeset, data.changesetCreated));

  // AI explanation (if available)
  if (data.aiExplanation) {
    sections.push(renderAISection(data.aiExplanation));
  }

  return sections.join('\n---\n\n');
}

/**
 * Render lint results section
 */
function renderLintSection(results: LintResult[]): string {
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  if (totalErrors === 0 && totalWarnings === 0) {
    return '### Lint\n\nAll contracts pass validation.\n';
  }

  let md = `### ${totalErrors > 0 ? 'Lint' : 'Lint'}\n\n`;
  md += `${totalErrors} error(s), ${totalWarnings} warning(s)\n\n`;

  for (const result of results.filter(
    r => r.errors.length > 0 || r.warnings.length > 0
  )) {
    md += `<details><summary><b>${result.contract}</b> — ${result.errors.length} error(s), ${result.warnings.length} warning(s)</summary>\n\n`;
    for (const issue of [...result.errors, ...result.warnings]) {
      const icon = issue.severity === 'error' ? 'x' : '!';
      md += `- [${icon}] \`${issue.path}\` ${issue.message}`;
      if (issue.rule) md += ` _(${issue.rule})_`;
      md += '\n';
    }
    md += '\n</details>\n\n';
  }

  return md;
}

/**
 * Render diff results section
 */
function renderDiffSection(results: DiffResult[]): string {
  let md = '### Changes\n\n';

  // Summary table
  md += '| Contract | Breaking | Non-breaking | Patch | Suggested Bump |\n';
  md += '|----------|----------|--------------|-------|----------------|\n';

  for (const result of results) {
    if (result.changes.length === 0) continue;
    const bumpBadge =
      result.suggestedBump === 'major'
        ? 'major'
        : result.suggestedBump === 'minor'
          ? 'minor'
          : result.suggestedBump === 'patch'
            ? 'patch'
            : 'none';
    md += `| ${result.contract} | ${result.summary.breaking} | ${result.summary.nonBreaking} | ${result.summary.patch} | ${bumpBadge} |\n`;
  }
  md += '\n';

  // Detailed changes per contract
  for (const result of results.filter(r => r.changes.length > 0)) {
    md += `<details><summary><b>${result.contract}</b> — ${result.changes.length} change(s)</summary>\n\n`;

    const breaking = result.changes.filter(
      (c: Change) => c.severity === 'breaking'
    );
    const nonBreaking = result.changes.filter(
      (c: Change) => c.severity === 'non-breaking'
    );
    const patch = result.changes.filter(
      (c: Change) => c.severity === 'patch'
    );
    const unknown = result.changes.filter(
      (c: Change) => c.severity === 'unknown'
    );

    if (breaking.length > 0) {
      md += '**Breaking Changes:**\n';
      for (const c of breaking) {
        const path = c.path ? ` (${decodeJsonPointer(c.path)})` : '';
        md += `- ${c.message}${path}\n`;
      }
      md += '\n';
    }
    if (nonBreaking.length > 0) {
      md += '**Non-breaking Changes:**\n';
      for (const c of nonBreaking) {
        const path = c.path ? ` (${decodeJsonPointer(c.path)})` : '';
        md += `- ${c.message}${path}\n`;
      }
      md += '\n';
    }
    if (patch.length > 0) {
      md += '**Patch Changes:**\n';
      for (const c of patch) {
        const path = c.path ? ` (${decodeJsonPointer(c.path)})` : '';
        md += `- ${c.message}${path}\n`;
      }
      md += '\n';
    }
    if (unknown.length > 0) {
      md += '**Needs Review:**\n';
      for (const c of unknown) {
        const path = c.path ? ` (${decodeJsonPointer(c.path)})` : '';
        md += `- ${c.message}${path}\n`;
      }
      md += '\n';
    }

    md += '</details>\n\n';
  }

  return md;
}

/**
 * Render changeset status section
 */
function renderChangesetSection(hasChangeset: boolean, created: boolean): string {
  if (created) {
    return '### Changeset\n\n✅ A changeset was automatically generated and committed to this PR.\n\nReview the changeset file in `.contractual/changesets/` and edit if needed before merging.\n';
  }
  if (hasChangeset) {
    return '### Changeset\n\n✅ Changeset found in this PR.\n\nThe changeset will be consumed when this PR is merged, and a Version PR will be created automatically.\n';
  }
  return '### Changeset\n\n⚠️ No changeset found.\n\nIf this PR changes contracts, a changeset will be auto-generated on the next push.\n';
}

/**
 * Render AI explanation section
 */
function renderAISection(explanation: string): string {
  return `### AI Analysis\n\n${explanation}\n`;
}
