import { GrowthPage } from "@/features/pages/GrowthPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Digital Growth";
const description = "SEO, social media, treści, strategia rozwoju, analityka i kampanie reklamowe - usługa GROW Code Consulting Studio.";

export const metadata = buildPageMetadata({ routeKey: "growth", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData
        routeKey="growth"
        locale="pl"
        title={title}
        description={description}
        service={{ name: "Digital Growth i marketing", description }}
      />
      <GrowthPage locale="pl" />
    </>
  );
}
