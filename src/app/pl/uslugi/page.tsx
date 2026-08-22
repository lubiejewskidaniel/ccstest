import { ServicesPage } from "@/features/pages/ServicesPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Usługi";
const description = "Wytwarzanie oprogramowania, rozwój produktów, doradztwo technologiczne, web i digital, digital growth oraz mentoring 1:1.";

export const metadata = buildPageMetadata({ routeKey: "services", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="services" locale="pl" title={title} description={description} />
      <ServicesPage locale="pl" />
    </>
  );
}
