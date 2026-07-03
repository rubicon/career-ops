import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { GET, DELETE } from "./route";
import { templatePath } from "@/lib/templates";
import { careerOpsRoot } from "@/lib/career-ops";

describe("GET /api/templates", () => {
  it("returns templates for kind=cv with an isDefault flag", async () => {
    const res = await GET(new Request("http://x/api/templates?kind=cv"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.templates)).toBe(true);
    expect(body.templates.some((t: { name: string }) => t.name === "standard")).toBe(true);
    expect(body.templates.every((t: { isDefault: unknown }) => typeof t.isDefault === "boolean")).toBe(true);
  });

  it("rejects an unknown kind", async () => {
    const res = await GET(new Request("http://x/api/templates?kind=bogus"));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/templates", () => {
  it("refuses to delete standard", async () => {
    const res = await DELETE(
      new Request("http://x", { method: "DELETE", body: JSON.stringify({ kind: "cv", name: "standard" }) }),
    );
    expect(res.status).toBe(400);
  });

  it("deletes a named template", async () => {
    fs.writeFileSync(templatePath("cv", "temp-del"), "{{NAME}}{{EXPERIENCE}}{{EDUCATION}}");
    const res = await DELETE(
      new Request("http://x", { method: "DELETE", body: JSON.stringify({ kind: "cv", name: "temp-del" }) }),
    );
    expect(res.status).toBe(200);
    expect(fs.existsSync(templatePath("cv", "temp-del"))).toBe(false);
  });

  it("clears the profile default when the deleted template was default", async () => {
    fs.writeFileSync(templatePath("cv", "was-default"), "{{NAME}}{{EXPERIENCE}}{{EDUCATION}}");
    const profile = path.join(careerOpsRoot(), "config", "profile.yml");
    fs.mkdirSync(path.dirname(profile), { recursive: true });
    fs.writeFileSync(profile, "cv:\n  template: was-default\n");
    await DELETE(new Request("http://x", { method: "DELETE", body: JSON.stringify({ kind: "cv", name: "was-default" }) }));
    const doc = yaml.load(fs.readFileSync(profile, "utf8")) as { cv?: { template?: string } };
    expect(doc.cv?.template).toBeUndefined();
  });
});
