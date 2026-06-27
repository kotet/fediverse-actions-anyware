/**
 * Validates i18n key consistency across all locales under locales/.
 *
 * - Default locale (en): missing or extra keys are errors (exit 1).
 * - Other locales: missing or extra keys are warnings only.
 */

import { readFile, readdir } from "fs/promises";

const DEFAULT_LOCALE = "en";

const tsSource = await readFile("src/i18n/index.ts", "utf-8");
const keysSection = tsSource.match(/MESSAGE_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? "";
const expectedKeys = new Set([...keysSection.matchAll(/"([^"]+)"/g)].map((m) => m[1]));

const locales = await readdir("locales");
let hasError = false;

for (const locale of locales) {
  const isDefault = locale === DEFAULT_LOCALE;
  const messagesJson = JSON.parse(
    await readFile(`locales/${locale}/messages.json`, "utf-8"),
  );
  const actualKeys = new Set(Object.keys(messagesJson));

  const missingKeys = [...expectedKeys].filter((k) => !actualKeys.has(k));
  const extraKeys = [...actualKeys].filter((k) => !expectedKeys.has(k));

  if (missingKeys.length > 0) {
    const label = isDefault ? "error" : "warning";
    const log = isDefault ? console.error : console.warn;
    log(`[${locale}] ${label}: Keys missing from messages.json:`);
    for (const key of missingKeys) {
      log(`  - ${key}`);
    }
    if (isDefault) hasError = true;
  }

  if (extraKeys.length > 0) {
    const label = isDefault ? "error" : "warning";
    const log = isDefault ? console.error : console.warn;
    log(`[${locale}] ${label}: Keys in messages.json not defined in src/i18n/index.ts:`);
    for (const key of extraKeys) {
      log(`  - ${key}`);
    }
    if (isDefault) hasError = true;
  }
}

if (hasError) {
  process.exit(1);
} else {
  console.log(`i18n check passed: ${expectedKeys.size} keys × ${locales.length} locales (${locales.join(", ")}).`);
}
