import { AccessibilityStatement } from "@/features/legal/AccessibilityStatement";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Deklaracja dostępności";
const description = "Cel dostępności Code Consulting Studio i co zostało wdrożone.";

export const metadata = buildPageMetadata({ routeKey: "accessibility", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="accessibility" locale="pl" title={title} description={description} />
      <AccessibilityStatement locale="pl" />
    </>
  );
}
