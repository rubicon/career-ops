import { describe, it, expect } from "vitest";
import { GET } from "./route";

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
