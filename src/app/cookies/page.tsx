import { CookiePolicy } from "@/features/legal/CookiePolicy";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Cookie Policy";
const description = "How Code Consulting Studio uses cookies and browser storage.";

export const metadata = buildPageMetadata({ routeKey: "cookies", locale: "en", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="cookies" locale="en" title={title} description={description} />
      <CookiePolicy locale="en" />
    </>
  );
}
