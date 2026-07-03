import { describe, it, expect } from "vitest";
import { buildPrompt } from "./run-prompt";

describe("buildPrompt pdf template wiring", () => {
  it("references the resolver with the effective name, not a hardcoded template file", () => {
    const p = buildPrompt("pdf", "42", "", "2026-07-03", "executive-authority");
    expect(p).not.toContain("templates/cv-template.html");
    expect(p).toContain('cv-templates.mjs resolve cv "executive-authority"');
    expect(p).toContain("do not silently fall back");
  });

  it("defaults to the standard template name", () => {
    const p = buildPrompt("pdf", "42", "", "2026-07-03");
    expect(p).toContain('cv-templates.mjs resolve cv "standard"');
  });
});
