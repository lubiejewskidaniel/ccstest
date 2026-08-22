import { ProductsPage } from "@/features/pages/ProductsPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Products";
const description = "TakBlisko and the other products Code Consulting Studio builds and owns.";

export const metadata = buildPageMetadata({ routeKey: "products", locale: "en", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="products" locale="en" title={title} description={description} />
      <ProductsPage locale="en" />
    </>
  );
}
