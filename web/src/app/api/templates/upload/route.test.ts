import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { POST } from "./route";
import { templatePath } from "@/lib/templates";

function form(content: string, name: string) {
  const fd = new FormData();
  fd.set("kind", "cv");
  fd.set("name", name);
  fd.set("file", new File([content], "up.html", { type: "text/html" }));
  return new Request("http://x", { method: "POST", body: fd });
}

describe("POST /api/templates/upload", () => {
  it("accepts a valid template and installs it under the kebab name", async () => {
    const res = await POST(form("{{NAME}}{{EXPERIENCE}}{{EDUCATION}}", "Modern Deck"));
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("modern-deck");
    expect(fs.existsSync(templatePath("cv", "modern-deck"))).toBe(true);
  });

  it("rejects one missing placeholders", async () => {
    const res = await POST(form("{{NAME}} only", "Broken"));
    expect(res.status).toBe(422);
    expect((await res.json()).missing).toContain("EXPERIENCE");
  });

  it("refuses the reserved name 'standard'", async () => {
    const res = await POST(form("{{NAME}}{{EXPERIENCE}}{{EDUCATION}}", "standard"));
    expect(res.status).toBe(400);
  });
});
