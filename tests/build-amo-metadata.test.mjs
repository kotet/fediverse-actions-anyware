import { describe, expect, it } from "vitest";
import { fillPlaceholders } from "../scripts/build-amo-metadata.mjs";

describe("fillPlaceholders", () => {
  it.each([
    ["Email: {{EMAIL}}", { EMAIL: "a@example.com" }, "Email: a@example.com"],
    ["{{A}} and {{A}}, {{B_2}}", { A: "x", B_2: "y" }, "x and x, y"],
    ["no placeholders", {}, "no placeholders"],
    // Only upper-case names are placeholders.
    ["{{lower}}", {}, "{{lower}}"],
  ])("%j -> %j", (template, values, expected) => {
    expect(fillPlaceholders(template, values)).toBe(expected);
  });

  it.each([
    ["{{EMAIL}}", {}],
    ["{{EMAIL}}", { EMAIL: "" }],
  ])("%j with %j throws", (template, values) => {
    expect(() => fillPlaceholders(template, values)).toThrow("Set the environment variable EMAIL");
  });
});
