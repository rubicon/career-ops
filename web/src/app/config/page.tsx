import { ConfigForm } from "@/components/config-form";
import { TemplatesSection } from "@/components/templates/templates-section";

export default function ConfigPage() {
  return (
    <>
      <ConfigForm />
      <TemplatesSection kind="cv" />
      <TemplatesSection kind="cover" />
    </>
  );
}
