# Contractual GitHub Action

Schema contract lifecycle management for GitHub — lint, detect breaking changes, auto-generate changesets, and version contracts.

## Usage

```yaml
- uses: contractual-dev/action@v1
  with:
    mode: pr-check
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Modes

### `pr-check`

Runs on pull requests. Detects breaking changes, posts a PR comment with a diff table, and auto-commits a changeset.

```yaml
name: Contract Check

on:
  pull_request:
    paths:
      - 'specs/**'
      - 'schemas/**'

permissions:
  contents: write
  pull-requests: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: ${{ github.head_ref }}

      - uses: contractual-dev/action@v1
        with:
          mode: pr-check
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### `release`

Runs on push to main. Consumes changesets and opens a "Version Contracts" PR.

```yaml
name: Version Contracts

on:
  push:
    branches: [main]
    paths:
      - '.contractual/changesets/**'

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: contractual-dev/action@v1
        with:
          mode: release
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `mode` | Yes | — | `pr-check` or `release` |
| `github-token` | No | `${{ github.token }}` | Token for PR comments and commits |
| `fail-on-breaking` | No | `true` | Fail if breaking changes detected |
| `auto-changeset` | No | `true` | Auto-generate changeset if missing |
| `version-pr-title` | No | `Version Contracts` | Title of the Version PR |
| `version-pr-branch` | No | `contractual/version-contracts` | Branch for the Version PR |
| `anthropic-api-key` | No | — | Anthropic API key for AI features |

## Outputs

| Output | Mode | Description |
|--------|------|-------------|
| `has-breaking` | `pr-check` | `'true'` if breaking changes detected |
| `has-changes` | `pr-check` | `'true'` if any spec changes detected |
| `changeset-created` | `pr-check` | `'true'` if a changeset was committed |
| `version-pr-url` | `release` | URL of the Version Contracts PR |

## Permissions

```yaml
permissions:
  contents: write       # Commit changesets and version bumps
  pull-requests: write  # Post PR comments and create Version PR
```

## Documentation

Full documentation at [contractual.dev](https://contractual.dev)

## License

MIT
