"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TemplateDto } from "@/lib/templates";

export function TemplateCard({
  t,
  kind,
  onSetDefault,
  onEdit,
  onRename,
  onDelete,
}: {
  t: TemplateDto;
  kind: "cv" | "cover";
  onSetDefault: (name: string) => void;
  onEdit: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  return (
    <Card corner="br">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium">{t.displayName}</h4>
            {t.isDefault && <Badge tone="good">Default</Badge>}
          </div>
          {t.description && <p className="mt-1 text-xs text-muted">{t.description}</p>}
        </div>
        {t.version && <span className="text-xs text-faint tabular-nums">v{t.version}</span>}
      </div>
      {t.titles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {t.titles.map((title) => (
            <Badge key={title}>{title}</Badge>
          ))}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          variant={t.isDefault ? "secondary" : "primary"}
          disabled={t.isDefault}
          onClick={() => onSetDefault(t.name)}
        >
          {t.isDefault ? "Default" : "Set default"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onEdit(t.name)}>
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.open(`/api/templates/preview?kind=${kind}&name=${t.name}`, "_blank", "noopener")}
        >
          Preview
        </Button>
        {t.name !== "standard" && (
          <Button size="sm" variant="ghost" onClick={() => onRename(t.name)}>
            Rename
          </Button>
        )}
        {t.name !== "standard" && (
          <Button size="sm" variant="ghost" onClick={() => onDelete(t.name)}>
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}
