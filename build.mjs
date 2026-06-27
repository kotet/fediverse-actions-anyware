import * as esbuild from "esbuild";
import { cp, mkdir, readdir } from "fs/promises";

await mkdir("dist/background", { recursive: true });
await mkdir("dist/content", { recursive: true });
await mkdir("dist/popup", { recursive: true });
await mkdir("dist/icons", { recursive: true });
const locales = await readdir("locales");
await Promise.all(
  locales.map((locale) => mkdir(`dist/_locales/${locale}`, { recursive: true })),
);

await esbuild.build({
  entryPoints: [
    "src/background/service_worker.ts",
    "src/content/content.ts",
    "src/popup/popup.ts",
  ],
  bundle: true,
  outdir: "dist",
  outbase: "src",
  format: "iife",
  target: "firefox128",
});

await Promise.all([
  cp("manifest.json", "dist/manifest.json"),
  cp("src/popup/popup.html", "dist/popup/popup.html"),
  cp("src/popup/popup.css", "dist/popup/popup.css"),
  cp("icons", "dist/icons", { recursive: true }),
  ...locales.map((locale) =>
    cp(`locales/${locale}/messages.json`, `dist/_locales/${locale}/messages.json`),
  ),
]);

console.log("Build complete.");
