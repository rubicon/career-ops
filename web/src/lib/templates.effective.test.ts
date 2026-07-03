import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { effectiveTemplateName, templatePath, assignmentsPath } from "@/lib/templates";
import { careerOpsRoot } from "@/lib/career-ops";

describe("effectiveTemplateName", () => {
  it("returns 'standard' when nothing is configured", async () => {
    expect(await effectiveTemplateName("cv", "999")).toBe("standard");
  });

  it("honors an explicit pick over everything", async () => {
    fs.writeFileSync(templatePath("cv", "picked"), "{{NAME}}{{EXPERIENCE}}{{EDUCATION}}");
    expect(await effectiveTemplateName("cv", "999", "picked")).toBe("picked");
  });

  it("uses the per-job assignment when present", async () => {
    fs.writeFileSync(templatePath("cv", "growth"), "{{NAME}}{{EXPERIENCE}}{{EDUCATION}}");
    fs.writeFileSync(assignmentsPath(), JSON.stringify({ "42": { cv: "growth" } }));
    expect(await effectiveTemplateName("cv", "42")).toBe("growth");
  });

  it("routes by the application's job title", async () => {
    fs.writeFileSync(
      templatePath("cv", "executive-authority"),
      "<!-- career-ops-template\ntitles: CMO, VP Marketing\n-->\n{{NAME}}{{EXPERIENCE}}{{EDUCATION}}",
    );
    const tracker = path.join(careerOpsRoot(), "data", "applications.md");
    fs.writeFileSync(
      tracker,
      "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n" +
        "|---|---|---|---|---|---|---|---|---|\n" +
        "| 7 | 2026-07-03 | Acme | VP of Marketing | 4.5/5 | Evaluated | ❌ | [7](reports/7.md) | note |\n",
    );
    expect(await effectiveTemplateName("cv", "7")).toBe("executive-authority");
  });
});
