import { Home } from "@/features/home/Home";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Code Consulting Studio - Engineered software, products & growth";
const description =
  "An engineering-led studio building software, owning products, growing businesses online, and teaching the people behind them.";

export const metadata = buildPageMetadata({ routeKey: "home", locale: "en", title, description });

export default function HomePage() {
  return (
    <>
      <PageStructuredData routeKey="home" locale="en" title={title} description={description} />
      <Home locale="en" />
    </>
  );
}
