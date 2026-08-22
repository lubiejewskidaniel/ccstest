import { MentoringPage } from "@/features/pages/MentoringPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Mentoring";
const description = "Personalized 1:1 mentoring in programming, engineering and career growth - Code Consulting Studio's TEACH programme.";

export const metadata = buildPageMetadata({ routeKey: "mentoring", locale: "en", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData
        routeKey="mentoring"
        locale="en"
        title={title}
        description={description}
        service={{ name: "1:1 Mentoring", description }}
      />
      <MentoringPage locale="en" />
    </>
  );
}
