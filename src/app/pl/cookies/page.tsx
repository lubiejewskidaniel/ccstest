import { CookiePolicy } from "@/features/legal/CookiePolicy";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Polityka cookies";
const description = "Jak Code Consulting Studio wykorzystuje cookies i przechowywanie w przeglądarce.";

export const metadata = buildPageMetadata({ routeKey: "cookies", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="cookies" locale="pl" title={title} description={description} />
      <CookiePolicy locale="pl" />
    </>
  );
}
