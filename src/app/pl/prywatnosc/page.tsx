import { PrivacyPolicy } from "@/features/legal/PrivacyPolicy";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Informacja o prywatności";
const description = "Jak Code Consulting Studio zbiera, wykorzystuje i chroni Twoje dane.";

export const metadata = buildPageMetadata({ routeKey: "privacy", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="privacy" locale="pl" title={title} description={description} />
      <PrivacyPolicy locale="pl" />
    </>
  );
}
