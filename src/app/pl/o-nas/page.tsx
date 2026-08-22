import { AboutPage } from "@/features/pages/AboutPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "O nas";
const description = "Code Consulting Studio to studio inżynierskie działające w czterech trybach: BUILD, CREATE, GROW i TEACH.";

export const metadata = buildPageMetadata({ routeKey: "about", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="about" locale="pl" title={title} description={description} />
      <AboutPage locale="pl" />
    </>
  );
}
