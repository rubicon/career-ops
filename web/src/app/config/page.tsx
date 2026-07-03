import { ConfigForm } from "@/components/config-form";
import { TemplatesSection } from "@/components/templates/templates-section";

export default function ConfigPage() {
  return (
    <>
      <ConfigForm />
      {/* Match ConfigForm's centered, padded column so the Templates sections
          align with the rest of Config instead of sprawling full-bleed. */}
      <div className="mx-auto max-w-2xl px-6 pb-10">
        <TemplatesSection kind="cv" />
        <TemplatesSection kind="cover" />
      </div>
    </>
  );
}
