import { ContactPage } from "@/features/forms/ContactPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Kontakt";
const description = "Rozpocznij projekt software'owy lub współpracę growth z Code Consulting Studio.";

export const metadata = buildPageMetadata({ routeKey: "contact", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="contact" locale="pl" title={title} description={description} />
      <ContactPage locale="pl" />
    </>
  );
}
