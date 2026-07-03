import { describe, it, expect } from "vitest";
import { dispatch, type ActionCtx } from "./registry";

// A minimal ctx: the template actions only touch these optional hooks.
const ctx = {
  writeTemplateDefault: () => {},
  assignTemplate: () => {},
  pickTemplate: () => {},
} as unknown as ActionCtx;

describe("template assistant actions", () => {
  it("setDefaultTemplate returns a confirm gate", () => {
    const r = dispatch("setDefaultTemplate", { kind: "cv", name: "executive-authority" }, ctx);
    expect(r.status).toBe("confirm");
  });

  it("assignTemplate ignores a missing application number", () => {
    const r = dispatch("assignTemplate", { kind: "cv", name: "growth" }, ctx);
    expect(r.status).toBe("ignored");
  });

  it("assignTemplate confirms with an application number", () => {
    const r = dispatch("assignTemplate", { n: "42", kind: "cv", name: "growth" }, ctx);
    expect(r.status).toBe("confirm");
  });

  it("pickTemplate is a no-confirm done", () => {
    const r = dispatch("pickTemplate", { kind: "cv", name: "growth" }, ctx);
    expect(r.status).toBe("done");
  });
});
