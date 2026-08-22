import { WorkPage } from "@/features/pages/WorkPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Work";
const description = "Products and platforms Code Consulting Studio has built - TakBlisko, PLMS and Dual-Layer Vault.";

export const metadata = buildPageMetadata({ routeKey: "work", locale: "en", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="work" locale="en" title={title} description={description} />
      <WorkPage locale="en" />
    </>
  );
}
