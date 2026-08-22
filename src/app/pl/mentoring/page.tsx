import { MentoringPage } from "@/features/pages/MentoringPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Mentoring";
const description = "Spersonalizowany mentoring 1:1 w programowaniu, inżynierii i rozwoju kariery - program TEACH Code Consulting Studio.";

export const metadata = buildPageMetadata({ routeKey: "mentoring", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData
        routeKey="mentoring"
        locale="pl"
        title={title}
        description={description}
        service={{ name: "Mentoring 1:1", description }}
      />
      <MentoringPage locale="pl" />
    </>
  );
}
