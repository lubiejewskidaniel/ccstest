import { ServicesPage } from "@/features/pages/ServicesPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Services";
const description = "Software development, product development, technology consulting, web & digital, digital growth and 1:1 mentoring.";

export const metadata = buildPageMetadata({ routeKey: "services", locale: "en", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="services" locale="en" title={title} description={description} />
      <ServicesPage locale="en" />
    </>
  );
}
