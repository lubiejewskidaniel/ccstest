import { ContactPage } from "@/features/forms/ContactPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Contact";
const description = "Start a software project or a growth engagement with Code Consulting Studio.";

export const metadata = buildPageMetadata({ routeKey: "contact", locale: "en", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="contact" locale="en" title={title} description={description} />
      <ContactPage locale="en" />
    </>
  );
}
