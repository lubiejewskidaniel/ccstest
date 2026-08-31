import { AcademicIntegrityPolicy } from "@/features/legal/AcademicIntegrityPolicy";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PageStructuredData } from "@/components/seo/PageStructuredData";

const title = "Academic Integrity Policy";
const description =
	"How Code Consulting Studio's mentoring works around coursework and assessments.";

export const metadata = buildPageMetadata({
	routeKey: "academicIntegrity",
	locale: "en",
	title,
	description,
});

export default function Page() {
	return (
		<>
			<PageStructuredData
				routeKey="academicIntegrity"
				locale="en"
				title={title}
				description={description}
			/>
			<AcademicIntegrityPolicy locale="en" />
		</>
	);
}
