# fediverse-actions-anyware

A Firefox extension that adds fediverse action buttons (favourite, boost, bookmark, reply) to
Mastodon pages hosted on instances you are not signed in to, so the action runs on your own home
instance instead.

Licensed under the MIT License. See [LICENSE](LICENSE).

## Build instructions for AMO reviewers

The extension is bundled with [esbuild](https://esbuild.github.io/). The bundler only concatenates
and transpiles the TypeScript sources; no minifier, obfuscator, or other preprocessor is used.

### Environment

| Requirement | Version used to produce the submitted build |
|-------------|---------------------------------------------|
| Operating system | Ubuntu 24.04 (x86_64) |
| Node.js | 24.18.0 (https://nodejs.org/) |
| npm | 11.16.0 (bundled with Node.js) |

Node.js and npm are the only system-level requirements. Every build tool, including esbuild and
web-ext, is a development dependency pinned to an exact version in the `package-lock.json` file
shipped with the source archive, so `npm ci` reproduces the toolchain exactly.

### Steps

```sh
npm ci
node build.mjs
npx web-ext build --source-dir dist --overwrite-dest
```

1. `npm ci` installs the exact dependency versions recorded in `package-lock.json`.
2. `node build.mjs` produces the complete extension directory in `dist/`. This is the step that
   generates every JavaScript file in the submitted package. It bundles the entry points
   `src/background/service_worker.ts`, `src/content/content.ts`, `src/popup/popup.ts`, and
   `src/popup/oauth-callback.ts`, then copies `manifest.json`, the HTML and CSS files under `src/`,
   the icons, and the locale files into `dist/`.
3. `npx web-ext build` only packs the contents of `dist/` into a ZIP archive under
   `web-ext-artifacts/`. It does not transform any file, so the output of step 2 can be compared
   against the submitted package directly.

The same sequence is available as `make build`.

### Verifying the result

```sh
npm test        # unit tests (vitest)
npx tsc --noEmit  # type check
make lint       # locale consistency check + web-ext lint
```

## Development

Firefox is driven through the firefox-devtools MCP server:

```sh
claude mcp add firefox-devtools npx @mozilla/firefox-devtools-mcp@latest
```

The development workflow, the directory layout, and the split between checks that run in unit tests
and checks that need a real browser are documented in `docs/development.md` (in Japanese).
