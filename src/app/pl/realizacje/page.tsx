import { WorkPage } from "@/features/pages/WorkPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Realizacje";
const description = "Produkty i platformy zbudowane przez Code Consulting Studio - TakBlisko, PLMS i Dual-Layer Vault.";

export const metadata = buildPageMetadata({ routeKey: "work", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="work" locale="pl" title={title} description={description} />
      <WorkPage locale="pl" />
    </>
  );
}
