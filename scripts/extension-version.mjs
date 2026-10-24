/**
 * Decides the extension version written into the built manifest.
 *
 * The version lives only in git tags such as 0.2.0. The VERSION file holds a `$Format:...$`
 * placeholder that `git archive` replaces with the tag of the archived commit (the file has the
 * `export-subst` attribute in .gitattributes), so a source archive built from a tag carries its
 * version without git history. In a git checkout the placeholder stays as is, and the tag is read
 * with `git describe` instead.
 */

import { execFileSync } from "child_process";
import { readFile } from "fs/promises";

// Firefox accepts more forms, but releases are tagged with three numbers only.
const RELEASE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

// Marks a VERSION file that `git archive` has not expanded.
const UNEXPANDED_PLACEHOLDER_PREFIX = "$Format:";

// Used when there is no release version and the caller does not require one: development builds,
// and the release build that `make lint` checks. Never submitted, because the release build for
// submission requires a release version.
export const DEVELOPMENT_VERSION = "0.0.0";

/**
 * Chooses the version from the content of the VERSION file and the tag on HEAD.
 *
 * versionFileContent is the trimmed content of VERSION. headTag is the tag that
 * `git describe --exact-match` found on HEAD, or null when there is none or git is unavailable; it
 * is consulted only when VERSION is still the unexpanded placeholder. Without a release version,
 * such as in an archive of a commit after a tag ("0.2.0-1-g1234abc") or of an untagged repository
 * (empty), throws if requireReleaseVersion is true and falls back to DEVELOPMENT_VERSION otherwise.
 */
export function selectExtensionVersion(versionFileContent, headTag, requireReleaseVersion) {
  const candidate = versionFileContent.startsWith(UNEXPANDED_PLACEHOLDER_PREFIX)
    ? headTag
    : versionFileContent;
  if (candidate !== null && RELEASE_VERSION_PATTERN.test(candidate)) {
    return candidate;
  }
  if (requireReleaseVersion) {
    throw new Error(
      `No release version found (VERSION: "${versionFileContent}", tag on HEAD: ${headTag === null ? "none" : `"${headTag}"`}). ` +
        "Release builds must be made from a commit tagged like 0.2.0, or from a source archive of one.",
    );
  }
  return DEVELOPMENT_VERSION;
}

/**
 * Returns the tag on HEAD, or null when HEAD has no tag or the directory is not a git checkout.
 *
 * Lightweight tags count as well as annotated ones.
 */
function findTagOnHead() {
  try {
    return execFileSync("git", ["describe", "--tags", "--exact-match", "HEAD"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Resolves the extension version for a build run from the repository root.
 *
 * Reads VERSION and, only when it is unexpanded, runs git. See selectExtensionVersion for the
 * rules and for when it throws.
 */
export async function resolveExtensionVersion(requireReleaseVersion) {
  const versionFileContent = (await readFile("VERSION", "utf-8")).trim();
  const headTag = versionFileContent.startsWith(UNEXPANDED_PLACEHOLDER_PREFIX)
    ? findTagOnHead()
    : null;
  return selectExtensionVersion(versionFileContent, headTag, requireReleaseVersion);
}
