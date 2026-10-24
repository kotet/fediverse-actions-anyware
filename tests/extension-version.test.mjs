import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_VERSION,
  selectExtensionVersion,
} from "../scripts/extension-version.mjs";

const UNEXPANDED = "$Format:%(describe:tags)$";

describe("selectExtensionVersion", () => {
  it.each([
    // Source archive of a tagged commit: VERSION is expanded, git is not consulted.
    ["0.2.0", null, "0.2.0"],
    // Git checkout: VERSION stays unexpanded and the tag on HEAD is used.
    [UNEXPANDED, "0.2.0", "0.2.0"],
    [UNEXPANDED, "10.0.12", "10.0.12"],
  ])("VERSION=%s, tag=%s -> %s", (versionFileContent, headTag, expected) => {
    expect(selectExtensionVersion(versionFileContent, headTag, true)).toBe(expected);
    expect(selectExtensionVersion(versionFileContent, headTag, false)).toBe(expected);
  });

  it.each([
    // Archive of a commit after a tag, and of an untagged repository.
    ["0.2.0-1-g1234abc", null],
    ["", null],
    // Checkout without a tag on HEAD, or with a tag that is not a release version.
    [UNEXPANDED, null],
    [UNEXPANDED, "v0.2.0"],
    [UNEXPANDED, "0.2"],
    [UNEXPANDED, "0.02.0"],
  ])(
    "VERSION=%j, tag=%s: release build throws, development build uses the fallback",
    (versionFileContent, headTag) => {
      expect(() => selectExtensionVersion(versionFileContent, headTag, true)).toThrow(
        "No release version found",
      );
      expect(selectExtensionVersion(versionFileContent, headTag, false)).toBe(
        DEVELOPMENT_VERSION,
      );
    },
  );
});
