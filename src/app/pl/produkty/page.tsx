import { ProductsPage } from "@/features/pages/ProductsPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Produkty";
const description = "TakBlisko i inne produkty budowane i rozwijane przez Code Consulting Studio.";

export const metadata = buildPageMetadata({ routeKey: "products", locale: "pl", title, description });

export default function Page() {
  return (
    <>
      <PageStructuredData routeKey="products" locale="pl" title={title} description={description} />
      <ProductsPage locale="pl" />
    </>
  );
}
