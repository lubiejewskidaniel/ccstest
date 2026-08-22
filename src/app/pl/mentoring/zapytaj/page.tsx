import { MentoringEnquiryPage } from "@/features/forms/MentoringEnquiryPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Zapytanie o mentoring";
const description = "Umów sesję mentoringu 1:1 z Code Consulting Studio.";

export const metadata = buildPageMetadata({ routeKey: "mentoringEnquire", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="mentoringEnquire" locale="pl" title={title} description={description} />
      <MentoringEnquiryPage locale="pl" />
    </>
  );
}
