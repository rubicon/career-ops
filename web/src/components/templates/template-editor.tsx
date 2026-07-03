"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TitlePills } from "./title-pills";
import type { TemplateDto } from "@/lib/templates";

export function TemplateEditor({
  kind,
  name,
  onClose,
  onSaved,
}: {
  kind: "cv" | "cover";
  name: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [content, setContent] = useState("");
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Dialog focus management: move focus into the panel on open, restore it to
  // the trigger on close, and close on Escape.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/templates/file?kind=${kind}&name=${name}`)
      .then((r) => r.json())
      .then((b) => setContent(b.content ?? ""));
    fetch(`/api/templates?kind=${kind}`)
      .then((r) => r.json())
      .then((b) => {
        const t = (b.templates ?? []).find((x: TemplateDto) => x.name === name);
        if (t)
          setMeta({
            name: t.displayName,
            description: t.description ?? "",
            version: t.version ?? "",
            date: t.date ?? "",
            titles: (t.titles ?? []).join(", "),
          });
      });
  }, [kind, name]);

  async function save() {
    setErr("");
    setSaving(true);
    try {
      const put = await fetch("/api/templates/file", {
        method: "PUT",
        body: JSON.stringify({ kind, name, content }),
      });
      if (!put.ok) {
        const b = await put.json();
        setErr(b.missing?.length ? `Missing placeholders: ${b.missing.join(", ")}` : b.error || "Could not save");
        return;
      }
      await fetch("/api/templates/meta", { method: "PATCH", body: JSON.stringify({ kind, name, meta }) });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const field = (k: string, label: string, ariaLabel?: string) => (
    <label className="block text-xs text-muted">
      {label}
      <input
        aria-label={ariaLabel}
        className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground"
        value={meta[k] ?? ""}
        onChange={(e) => setMeta((m) => ({ ...m, [k]: e.target.value }))}
      />
    </label>
  );

  const titleId = `template-editor-title-${kind}-${name}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-border bg-surface p-5 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="mb-3 text-sm font-medium">
          Edit template · {name}
        </h3>
        {err && (
          <p role="alert" className="mb-2 rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-600 dark:text-red-400">
            {err}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {field("name", "Name")}
          {field("version", "Version")}
          {field("date", "Release date")}
          {field("description", "Description")}
        </div>
        <p className="mt-3 mb-1 text-xs text-muted" id={`${titleId}-titles`}>
          Target titles (the title-routing key)
        </p>
        <TitlePills value={meta.titles ?? ""} onChange={(v) => setMeta((m) => ({ ...m, titles: v }))} />
        <p className="mt-2 mb-1 text-xs text-muted">Or type titles (comma-separated)</p>
        {field("titles", "", "Target titles, comma-separated")}
        <label className="mt-3 block text-xs text-muted" htmlFor={`${titleId}-body`}>
          Template HTML
          <textarea
            id={`${titleId}-body`}
            className="mt-1 h-64 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
