# fediverse-actions-anyware

[日本語](README.ja.md)

A Firefox extension that adds fediverse action buttons (favourite, boost, bookmark, reply) to
Mastodon pages hosted on instances you are not signed in to, so the action runs on your own home
instance instead.

Licensed under the Mozilla Public License 2.0. See [LICENSE](LICENSE).

## Build instructions for AMO reviewers

See [BUILD.md](BUILD.md) for the environment, the exact build commands, and how to verify the
result.

## Development

Firefox is driven through the firefox-devtools MCP server:

```sh
claude mcp add firefox-devtools npx @mozilla/firefox-devtools-mcp@latest
```

The development workflow, the directory layout, and the split between checks that run in unit tests
and checks that need a real browser are documented in `docs/development.md` (in Japanese).
