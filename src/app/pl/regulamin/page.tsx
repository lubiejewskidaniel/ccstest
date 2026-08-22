import { TermsPage } from "@/features/legal/TermsPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Regulamin";
const description = "Regulamin korzystania ze strony Code Consulting Studio.";

export const metadata = buildPageMetadata({ routeKey: "terms", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="terms" locale="pl" title={title} description={description} />
      <TermsPage locale="pl" />
    </>
  );
}
