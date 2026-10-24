/**
 * Whether this build carries the mock implementations, so that a mock home
 * account is registered on install and more can be added from the popup.
 *
 * Replaced with a literal at build time (`define` in `build.mjs` and
 * `vitest.config.ts`): `true` for the development build, `false` for the release
 * build. Branches guarded by it are dropped from the release bundle together with
 * the mock code they reference.
 */
declare const FAA_INCLUDE_MOCKS: boolean;
