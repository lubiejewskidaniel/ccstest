import type { Metadata } from "next";
import { CreateBriefForm } from "@/features/content-intelligence/briefs/CreateBriefForm";
import { listCategories } from "@/features/insights/data/queries";

export const metadata: Metadata = { title: "New brief" };

export default async function NewBriefPage({
	searchParams,
}: {
	searchParams: Promise<{ opportunityId?: string; topic?: string; locale?: string }>;
}) {
	const { opportunityId, topic, locale } = await searchParams;
	const categories = await listCategories("en");

	return (
		<div>
			<h1 style={{ fontSize: "1.6rem", fontWeight: 600, marginBottom: 24 }}>New AI editorial brief</h1>
			<CreateBriefForm
				categories={categories}
				defaultTopic={topic}
				defaultOpportunityId={opportunityId}
				defaultLocale={locale === "pl" ? "pl" : "en"}
			/>
		</div>
	);
}
