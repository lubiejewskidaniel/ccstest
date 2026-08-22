import { TermsPage } from "@/features/legal/TermsPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Website Terms";
const description = "Terms of use for the Code Consulting Studio website.";

export const metadata = buildPageMetadata({ routeKey: "terms", locale: "en", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="terms" locale="en" title={title} description={description} />
      <TermsPage locale="en" />
    </>
  );
}
