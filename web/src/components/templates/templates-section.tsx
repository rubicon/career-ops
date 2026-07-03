"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateCard } from "./template-card";
import { TemplateEditor } from "./template-editor";
import type { TemplateDto } from "@/lib/templates";

export function TemplatesSection({ kind }: { kind: "cv" | "cover" }) {
  const [items, setItems] = useState<TemplateDto[] | null>(null);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch(`/api/templates?kind=${kind}`)
      .then((r) => r.json())
      .then((b) => setItems(b.templates ?? []))
      .catch(() => setItems([]));
  }, [kind]);

  useEffect(load, [load]);

  const setDefault = useCallback(
    (name: string) => {
      fetch("/api/templates/default", { method: "POST", body: JSON.stringify({ kind, name }) })
        .then((r) => r.json())
        .then(() => {
          setMsg(`Default set to ${name}`);
          load();
        })
        .catch(() => setMsg("Could not set default"));
    },
    [kind, load],
  );

  const upload = useCallback(
    (file: File) => {
      const name = uploadName.trim();
      if (!name) {
        setMsg("Enter a name for the uploaded template");
        return;
      }
      setBusy(true);
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("name", name);
      fd.set("file", file);
      fetch("/api/templates/upload", { method: "POST", body: fd })
        .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
        .then(({ ok, b }) => {
          if (ok) {
            setMsg(`Uploaded ${b.name}`);
            setUploadName("");
            load();
          } else {
            setMsg(b.missing?.length ? `Missing placeholders: ${b.missing.join(", ")}` : b.error || "Upload failed");
          }
        })
        .catch(() => setMsg("Upload failed"))
        .finally(() => {
          setBusy(false);
          if (fileRef.current) fileRef.current.value = "";
        });
    },
    [kind, uploadName, load],
  );

  const label = kind === "cv" ? "CV templates" : "Cover-letter templates";
  const uploadId = `template-upload-${kind}`;
  return (
    <section>
      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </label>
      {msg && (
        <p className="mb-2 text-xs text-brand" role="status" aria-live="polite">
          {msg}
        </p>
      )}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">
          New template name
          <input
            className="mt-1 block w-52 rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground"
            value={uploadName}
            placeholder="e.g. Executive Authority"
            onChange={(e) => setUploadName(e.target.value)}
          />
        </label>
        <input
          ref={fileRef}
          id={uploadId}
          type="file"
          accept=".html"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" aria-hidden="true" /> {busy ? "Uploading…" : "Upload template"}
        </Button>
      </div>
      {items === null ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" /> Loading templates…
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((t) => (
            <TemplateCard key={t.name} t={t} onSetDefault={setDefault} onEdit={setEditing} onDelete={() => {}} />
          ))}
        </div>
      )}
      {editing && (
        <TemplateEditor
          kind={kind}
          name={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setMsg("Template saved");
            load();
          }}
        />
      )}
    </section>
  );
}
