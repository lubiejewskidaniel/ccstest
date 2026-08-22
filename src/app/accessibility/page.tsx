import { AccessibilityStatement } from "@/features/legal/AccessibilityStatement";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Accessibility Statement";
const description = "Code Consulting Studio's accessibility target and what's built in.";

export const metadata = buildPageMetadata({ routeKey: "accessibility", locale: "en", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="accessibility" locale="en" title={title} description={description} />
      <AccessibilityStatement locale="en" />
    </>
  );
}
