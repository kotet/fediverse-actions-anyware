/**
 * Writes the metadata JSON submitted to AMO with a new version.
 *
 * Usage: node scripts/build-amo-metadata.mjs <output path>
 *
 * The output is amo/metadata.json with the notes to reviewer from amo/approval-notes.txt added as
 * version.approval_notes. The notes carry the credentials of the test account, so the template in
 * the repository holds `{{NAME}}` placeholders that are filled from the environment variables of
 * the same name (set from repository secrets in .github/workflows/release.yml). The output holds
 * the credentials and must not be committed or uploaded anywhere but AMO.
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";

const PLACEHOLDER_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;

/**
 * Replaces every `{{NAME}}` in template with values[NAME].
 *
 * Throws when a placeholder has no value or an empty one, so that notes with a missing credential
 * are never submitted.
 */
export function fillPlaceholders(template, values) {
  return template.replace(PLACEHOLDER_PATTERN, (placeholder, name) => {
    const value = values[name];
    if (value === undefined || value === "") {
      throw new Error(`No value for ${placeholder}. Set the environment variable ${name}.`);
    }
    return value;
  });
}

if (import.meta.main) {
  const outputPath = process.argv[2];
  if (outputPath === undefined) {
    throw new Error("Usage: node scripts/build-amo-metadata.mjs <output path>");
  }
  const metadata = JSON.parse(await readFile("amo/metadata.json", "utf-8"));
  const notesTemplate = await readFile("amo/approval-notes.txt", "utf-8");
  metadata.version = {
    ...metadata.version,
    approval_notes: fillPlaceholders(notesTemplate, process.env),
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`AMO metadata written to ${outputPath}.`);
}
