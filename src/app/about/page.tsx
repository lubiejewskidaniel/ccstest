import { AboutPage } from "@/features/pages/AboutPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "About";
const description = "Code Consulting Studio is an engineering-led studio working across four modes: BUILD, CREATE, GROW and TEACH.";

export const metadata = buildPageMetadata({ routeKey: "about", locale: "en", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="about" locale="en" title={title} description={description} />
      <AboutPage locale="en" />
    </>
  );
}
