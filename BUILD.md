# Build instructions for AMO reviewers

The extension is bundled with [esbuild](https://esbuild.github.io/). The bundler only concatenates
and transpiles the TypeScript sources; no minifier, obfuscator, or other preprocessor is used.

## Environment

| Requirement | Version used to produce the submitted build |
|-------------|---------------------------------------------|
| Operating system | Ubuntu 24.04 (x86_64) |
| Node.js | 24.18.0 (https://nodejs.org/) |
| npm | 11.16.0 (bundled with Node.js) |

Node.js and npm are the only system-level requirements. Every build tool, including esbuild and
web-ext, is a development dependency pinned to an exact version in the `package-lock.json` file
shipped with the source archive, so `npm ci` reproduces the toolchain exactly.

## Steps

```sh
npm ci
node build.mjs --release
npx web-ext build --source-dir dist-release --artifacts-dir web-ext-artifacts/release --overwrite-dest
```

1. `npm ci` installs the exact dependency versions recorded in `package-lock.json`.
2. `node build.mjs --release` produces the complete extension directory in `dist-release/`. This is
   the step that generates every JavaScript file in the submitted package. It bundles the entry
   points `src/background/service_worker.ts`, `src/content/content.ts`, `src/popup/popup.ts`, and
   `src/popup/oauth-callback.ts`, then copies `manifest.json`, the HTML and CSS files under `src/`,
   the icons, and the locale files into `dist-release/`.
3. `npx web-ext build` only packs the contents of `dist-release/` into a ZIP archive under
   `web-ext-artifacts/release/`. It does not transform any file, so the output of step 2 can be
   compared against the submitted package directly.

The same sequence is available as `make build-release`.

The `--release` flag leaves out the mock implementations under `src/mocks/`, which exist only to
check the extension during development. It sets the build-time constant `FAA_INCLUDE_MOCKS` to
`false` through esbuild's `define` option, so the code that offers a mock account is left behind in
branches that never run, and the mock classes themselves are not bundled. Without the flag
(`make build`), the build goes to `dist/` and keeps the mocks.

## Verifying the result

```sh
npm test        # unit tests (vitest)
npx tsc --noEmit  # type check
make lint       # locale consistency check + web-ext lint of both builds
```
