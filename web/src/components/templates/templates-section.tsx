"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { TemplateCard } from "./template-card";
import { TemplateEditor } from "./template-editor";
import type { TemplateDto } from "@/lib/templates";

export function TemplatesSection({ kind }: { kind: "cv" | "cover" }) {
  const [items, setItems] = useState<TemplateDto[] | null>(null);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

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

  const label = kind === "cv" ? "CV templates" : "Cover-letter templates";
  return (
    <section>
      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </label>
      {msg && <p className="mb-2 text-xs text-brand">{msg}</p>}
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
