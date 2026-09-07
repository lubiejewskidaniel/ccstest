import type { Metadata } from "next";
import { CreateBriefForm } from "@/features/content-intelligence/briefs/CreateBriefForm";
import { listCategories } from "@/features/insights/data/queries";

export const metadata: Metadata = { title: "New brief" };

export default async function NewBriefPage({
	searchParams,
}: {
	// `keyPoints` added in Phase 3C.3 so a Market Opportunity
	// recommendation handoff (recommendationHandoff.ts) can prefill a
	// short, human-readable context note the same way `topic`/`locale`/
	// `opportunityId` already do — categoryId is deliberately never a
	// param here; the human always chooses it on this form.
	searchParams: Promise<{ opportunityId?: string; topic?: string; locale?: string; keyPoints?: string }>;
}) {
	const { opportunityId, topic, locale, keyPoints } = await searchParams;
	const categories = await listCategories("en");

	return (
		<div>
			<h1 style={{ fontSize: "1.6rem", fontWeight: 600, marginBottom: 24 }}>New AI editorial brief</h1>
			<CreateBriefForm
				categories={categories}
				defaultTopic={topic}
				defaultOpportunityId={opportunityId}
				defaultLocale={locale === "pl" ? "pl" : "en"}
				defaultKeyPoints={keyPoints}
			/>
		</div>
	);
}
