import { InsightsPage } from "@/features/pages/InsightsPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Wiedza";
const description = "Notatki o inżynierii, growth i mentoringu od zespołu Code Consulting Studio.";

export const metadata = buildPageMetadata({ routeKey: "insights", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="insights" locale="pl" title={title} description={description} />
      <InsightsPage locale="pl" />
    </>
  );
}
