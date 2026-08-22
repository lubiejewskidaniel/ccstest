import { MentoringEnquiryPage } from "@/features/forms/MentoringEnquiryPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Mentoring Enquiry";
const description = "Book a 1:1 mentoring session with Code Consulting Studio.";

export const metadata = buildPageMetadata({ routeKey: "mentoringEnquire", locale: "en", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="mentoringEnquire" locale="en" title={title} description={description} />
      <MentoringEnquiryPage locale="en" />
    </>
  );
}
