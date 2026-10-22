import * as esbuild from "esbuild";
import { cp, mkdir, readdir, rm } from "fs/promises";

// The release build is the one submitted to AMO. It leaves out the mock
// implementations, which exist only to check the extension during development,
// and goes to its own directory so that it is never mistaken for the
// development build installed while working.
const isRelease = process.argv.includes("--release");
const outputDirectory = isRelease ? "dist-release" : "dist";

// Starts from an empty directory so that a file removed from the sources does
// not linger in the output and end up in the package submitted to AMO.
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(`${outputDirectory}/background`, { recursive: true });
await mkdir(`${outputDirectory}/content`, { recursive: true });
await mkdir(`${outputDirectory}/popup`, { recursive: true });
await mkdir(`${outputDirectory}/icons`, { recursive: true });
const locales = await readdir("locales");
await Promise.all(
  locales.map((locale) =>
    mkdir(`${outputDirectory}/_locales/${locale}`, { recursive: true }),
  ),
);

await esbuild.build({
  entryPoints: [
    "src/background/service_worker.ts",
    "src/content/content.ts",
    "src/popup/popup.ts",
    "src/popup/oauth-callback.ts",
  ],
  bundle: true,
  outdir: outputDirectory,
  outbase: "src",
  format: "iife",
  // Matches `strict_min_version` in manifest.json.
  target: "firefox140",
  define: { FAA_INCLUDE_MOCKS: String(!isRelease) },
});

await Promise.all([
  cp("manifest.json", `${outputDirectory}/manifest.json`),
  cp("src/content/content.css", `${outputDirectory}/content/content.css`),
  cp("src/popup/popup.html", `${outputDirectory}/popup/popup.html`),
  cp("src/popup/popup.css", `${outputDirectory}/popup/popup.css`),
  cp(
    "src/popup/oauth-callback.html",
    `${outputDirectory}/popup/oauth-callback.html`,
  ),
  cp("icons", `${outputDirectory}/icons`, { recursive: true }),
  ...locales.map((locale) =>
    cp(
      `locales/${locale}/messages.json`,
      `${outputDirectory}/_locales/${locale}/messages.json`,
    ),
  ),
]);

console.log(`Build complete: ${outputDirectory}/`);
