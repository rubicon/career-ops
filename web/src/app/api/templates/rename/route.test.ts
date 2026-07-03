import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { POST } from "./route";
import { templatePath } from "@/lib/templates";
import { careerOpsRoot } from "@/lib/career-ops";

const profile = () => path.join(careerOpsRoot(), "config", "profile.yml");

describe("POST /api/templates/rename", () => {
  beforeEach(() => fs.writeFileSync(templatePath("cv", "old-name"), "{{NAME}}{{EXPERIENCE}}{{EDUCATION}}"));

  it("renames the file", async () => {
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ kind: "cv", from: "old-name", to: "New Name" }) }),
    );
    expect(res.status).toBe(200);
    expect(fs.existsSync(templatePath("cv", "new-name"))).toBe(true);
    expect(fs.existsSync(templatePath("cv", "old-name"))).toBe(false);
  });

  it("follows the rename in profile.yml when it was the default", async () => {
    fs.mkdirSync(path.dirname(profile()), { recursive: true });
    fs.writeFileSync(profile(), "cv:\n  template: old-name\n");
    await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ kind: "cv", from: "old-name", to: "New Name" }) }));
    const doc = yaml.load(fs.readFileSync(profile(), "utf8")) as { cv: { template: string } };
    expect(doc.cv.template).toBe("new-name");
  });

  it("refuses to rename standard", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ kind: "cv", from: "standard", to: "x" }) }));
    expect(res.status).toBe(400);
  });
});
