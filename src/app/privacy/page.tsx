import { PrivacyPolicy } from "@/features/legal/PrivacyPolicy";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Privacy Notice";
const description =
	"How Code Consulting Studio collects, uses and protects your data.";

export const metadata = buildPageMetadata({
	routeKey: "privacy",
	locale: "en",
	title,
	description,
});

export default function Page() {
	return (
		<>
			<PageStructuredData
				routeKey="privacy"
				locale="en"
				title={title}
				description={description}
			/>
			<PrivacyPolicy locale="en" />
		</>
	);
}
