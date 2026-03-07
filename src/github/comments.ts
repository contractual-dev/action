import * as github from '@actions/github';

/** Marker to identify our comments for updates */
const COMMENT_MARKER = '<!-- contractual-bot -->';

/**
 * Post or update a PR comment with our marker.
 * If a comment with our marker exists, update it. Otherwise, create new.
 */
export async function postOrUpdateComment(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  prNumber: number,
  body: string
): Promise<void> {
  const markedBody = `${COMMENT_MARKER}\n${body}`;

  // Find existing comment with our marker
  const { data: comments } = await octokit.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
  });

  const existing = comments.find(
    (c: { body?: string }) => c.body?.includes(COMMENT_MARKER)
  );

  if (existing) {
    // Update existing comment
    await octokit.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existing.id,
      body: markedBody,
    });
  } else {
    // Create new comment
    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body: markedBody,
    });
  }
}
