import { Home } from "@/features/home/Home";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Code Consulting Studio - Oprogramowanie, produkty i wzrost";
const description =
	"Studio inżynierskie budujące oprogramowanie, tworzące własne produkty, rozwijające firmy online i uczące ludzi, którzy za tym stoją.";

export const metadata = buildPageMetadata({
	routeKey: "home",
	locale: "pl",
	title,
	description,
});

export default function HomePagePl() {
	return (
		<>
			<PageStructuredData
				routeKey="home"
				locale="pl"
				title={title}
				description={description}
			/>
			<Home locale="pl" />
		</>
	);
}
