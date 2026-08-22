import { InsightsPage } from "@/features/pages/InsightsPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Insights";
const description = "Notes on engineering, growth and mentoring from the Code Consulting Studio team.";

export const metadata = buildPageMetadata({ routeKey: "insights", locale: "en", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="insights" locale="en" title={title} description={description} />
      <InsightsPage locale="en" />
    </>
  );
}
