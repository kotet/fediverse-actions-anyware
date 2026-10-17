/**
 * Builds the source code archive submitted to AMO alongside the release package.
 *
 * The archive is made with `git archive` from HEAD, so it contains exactly the tracked files of the
 * current commit. Files that are not committed are never included, which keeps the archive in sync
 * with a commit that the release build can be reproduced from.
 *
 * - Modified or staged tracked files: error (exit 1), because the release build would read them
 *   but the archive would not contain them.
 * - Untracked files: warning only, listed so that a forgotten `git add` is noticed.
 */

import { execFileSync } from "child_process";
import { mkdir, readFile } from "fs/promises";

const OUTPUT_DIRECTORY = "web-ext-artifacts/release";

/** Runs git with the given arguments and returns its stdout. */
function runGit(args) {
  return execFileSync("git", args, { encoding: "utf-8" });
}

const uncommittedChanges = runGit(["status", "--porcelain", "--untracked-files=no"]).trimEnd();
if (uncommittedChanges !== "") {
  throw new Error(
    `Tracked files have uncommitted changes. Commit them before building the source archive:\n${uncommittedChanges}`,
  );
}

const untrackedFiles = runGit(["ls-files", "--others", "--exclude-standard"]).trimEnd();
if (untrackedFiles !== "") {
  console.warn("warning: Untracked files are not included in the source archive:");
  for (const path of untrackedFiles.split("\n")) {
    console.warn(`  - ${path}`);
  }
}

const manifest = JSON.parse(await readFile("manifest.json", "utf-8"));
const version = manifest.version;
const commitHash = runGit(["rev-parse", "HEAD"]).trim();
const archivePath = `${OUTPUT_DIRECTORY}/fediverse_actions_anyware-${version}-source.zip`;

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
runGit([
  "archive",
  "--format=zip",
  `--prefix=fediverse-actions-anyware-${version}/`,
  `--output=${archivePath}`,
  "HEAD",
]);

console.log(`Source archive written to ${archivePath} (commit ${commitHash}).`);
