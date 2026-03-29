import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Extract changelog section for a specific contract version
 *
 * @param contractName - Name of the contract
 * @param version - Version to extract (e.g., "2.1.0")
 * @param changelogPath - Path to CHANGELOG.md (defaults to ./CHANGELOG.md)
 * @returns Changelog content for this version, or empty string if not found
 */
export function extractChangelogSection(
  contractName: string,
  version: string,
  changelogPath: string = join(process.cwd(), 'CHANGELOG.md')
): string {
  // Check if changelog exists
  if (!existsSync(changelogPath)) {
    return '';
  }

  try {
    const content = readFileSync(changelogPath, 'utf-8');

    // Find the section header for this version
    // Format: ## [contractName] v{version} - {date}
    const headerRegex = new RegExp(
      `^## \\[${escapeRegex(contractName)}\\] v${escapeRegex(version)} - .*$`,
      'gm'
    );

    const match = headerRegex.exec(content);
    if (!match) {
      return '';
    }

    // Extract content from after the header until the next ## header
    const startIndex = match.index + match[0].length;
    const restOfContent = content.slice(startIndex);

    // Find next section (starts with ##)
    const nextSectionMatch = /^##\s/m.exec(restOfContent);
    const endIndex = nextSectionMatch ? nextSectionMatch.index : restOfContent.length;

    // Extract and clean the section content
    const section = restOfContent.slice(0, endIndex).trim();

    return section;
  } catch (error) {
    // If reading fails, return empty string
    return '';
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
