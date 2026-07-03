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
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
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

  const doRename = useCallback(() => {
    if (!renaming) return;
    const to = renameTo.trim();
    if (!to) return;
    fetch("/api/templates/rename", { method: "POST", body: JSON.stringify({ kind, from: renaming, to }) })
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        setMsg(ok ? `Renamed to ${b.name}` : b.error || "Rename failed");
        setRenaming(null);
        setRenameTo("");
        if (ok) load();
      })
      .catch(() => setMsg("Rename failed"));
  }, [kind, renaming, renameTo, load]);

  const doDelete = useCallback(
    (name: string) => {
      fetch("/api/templates", { method: "DELETE", body: JSON.stringify({ kind, name }) })
        .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
        .then(({ ok, b }) => {
          setMsg(ok ? `Deleted ${name}` : b.error || "Delete failed");
          setConfirmDelete(null);
          if (ok) load();
        })
        .catch(() => setMsg("Delete failed"));
    },
    [kind, load],
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
            <TemplateCard
              key={t.name}
              t={t}
              kind={kind}
              onSetDefault={setDefault}
              onEdit={setEditing}
              onRename={(name) => {
                setRenaming(name);
                setRenameTo("");
              }}
              onDelete={setConfirmDelete}
            />
          ))}
        </div>
      )}
      {renaming && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface/50 p-3">
          <label className="text-xs text-muted">
            Rename “{renaming}” to
            <input
              autoFocus
              className="mt-1 block w-52 rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground"
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doRename()}
            />
          </label>
          <Button size="sm" variant="primary" onClick={doRename} disabled={!renameTo.trim()}>
            Rename
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>
            Cancel
          </Button>
        </div>
      )}
      {confirmDelete && (
        <div
          role="alertdialog"
          aria-label={`Delete ${confirmDelete}`}
          className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3"
        >
          <span className="text-sm text-foreground">
            Delete “{confirmDelete}”? This cannot be undone (a backup is kept).
          </span>
          <Button size="sm" variant="primary" onClick={() => doDelete(confirmDelete)}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
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
