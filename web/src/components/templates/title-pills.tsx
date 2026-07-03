"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

// Multi-select chips over the user's own title vocabulary (portals + profile).
// Toggling writes a comma-joined string into the same meta.titles the editor's
// freeform field edits, so arbitrary titles still work alongside the pills.
export function TitlePills({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [all, setAll] = useState<string[]>([]);
  const selected = new Set(
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  useEffect(() => {
    fetch("/api/templates/titles")
      .then((r) => r.json())
      .then((b) => setAll(b.titles ?? []))
      .catch(() => setAll([]));
  }, []);

  const toggle = (t: string) => {
    const next = new Set(selected);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    onChange(Array.from(next).join(", "));
  };

  if (all.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Target titles">
      {all.map((t) => {
        const on = selected.has(t);
        return (
          <button
            key={t}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(t)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
              on
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-surface text-muted hover:bg-surface-hover",
            )}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
