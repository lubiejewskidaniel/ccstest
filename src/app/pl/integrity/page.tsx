import { AcademicIntegrityPolicy } from "@/features/legal/AcademicIntegrityPolicy";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Polityka rzetelności akademickiej";
const description = "Jak działa mentoring Code Consulting Studio wobec prac zaliczeniowych i egzaminów.";

export const metadata = buildPageMetadata({ routeKey: "academicIntegrity", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="academicIntegrity" locale="pl" title={title} description={description} />
      <AcademicIntegrityPolicy locale="pl" />
    </>
  );
}
