import { GrowthPage } from "@/features/pages/GrowthPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Digital Growth";
const description = "SEO, social media, content, growth strategy, analytics and ads management - Code Consulting Studio's GROW service.";

export const metadata = buildPageMetadata({ routeKey: "growth", locale: "en", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData
        routeKey="growth"
        locale="en"
        title={title}
        description={description}
        service={{ name: "Digital Growth & Marketing", description }}
      />
      <GrowthPage locale="en" />
    </>
  );
}
