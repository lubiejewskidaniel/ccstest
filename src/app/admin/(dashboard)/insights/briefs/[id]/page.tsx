import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrief } from "@/features/content-intelligence/briefs/service";
import { PipelineControls } from "@/features/content-intelligence/briefs/PipelineControls";
import type { GeneratedDraft } from "@/features/content-intelligence/types/contentAi";

type Params = { id: string };

export const metadata: Metadata = { title: "Brief" };

function DraftPreview({ title, draft }: { title: string; draft: GeneratedDraft }) {
	return (
		<div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: 18, marginBottom: 20 }}>
			<b style={{ display: "block", fontSize: 13, marginBottom: 10, color: "var(--ink-3)" }}>{title}</b>
			<p style={{ fontWeight: 600, marginBottom: 6 }}>{draft.title}</p>
			<p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 12 }}>{draft.excerpt}</p>
			<p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>
				Slug: <code>{draft.slug}</code> · {draft.body.length} block(s)
			</p>
			<div style={{ maxHeight: 300, overflowY: "auto", background: "var(--surface-2)", borderRadius: 8, padding: 12 }}>
				{draft.body.map((block, i) => (
					<p key={i} style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 6 }}>
						<span style={{ fontFamily: "var(--font-mono)", color: "var(--spark)" }}>[{block.type}]</span>{" "}
						{block.type === "paragraph" || block.type === "quote" || block.type === "callout"
							? block.text.slice(0, 140)
							: block.type === "heading"
								? block.text
								: block.type === "list"
									? block.items.join(" · ").slice(0, 140)
									: block.type === "code"
										? `${block.language ?? "code"} (${block.code.length} chars)`
										: ""}
					</p>
				))}
			</div>
		</div>
	);
}

export default async function BriefDetailPage({ params }: { params: Promise<Params> }) {
	const { id } = await params;
	const brief = await getBrief(id);
	if (!brief) notFound();

	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
				<h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>{brief.topic}</h1>
				<Link href="/admin/insights/briefs" className="btn btn-ghost">
					Back to briefs
				</Link>
			</div>
			<p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 24 }}>
				Primary language: {brief.primaryLocale.toUpperCase()} · Status: {brief.status.replace(/_/g, " ")}
			</p>

			<PipelineControls
				briefId={brief.id}
				status={brief.status}
				hasResearch={Boolean(brief.researchNotes)}
				hasGenerated={Boolean(brief.generated)}
			/>

			{brief.errorMessage ? (
				<div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.35)", color: "#ff6b6b", borderRadius: "var(--radius-sm)", padding: "12px 16px", fontSize: 13, marginBottom: 24 }}>
					{brief.errorMessage}
				</div>
			) : null}

			{brief.qualityIssues.length > 0 ? (
				<div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 24 }}>
					<b style={{ display: "block", fontSize: 13, marginBottom: 8 }}>Quality issues</b>
					<ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: "var(--ink-2)" }}>
						{brief.qualityIssues.map((issue, i) => (
							<li key={i}>
								<code>{issue.field}</code>: {issue.message}
							</li>
						))}
					</ul>
				</div>
			) : null}

			{brief.researchNotes ? (
				<div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 24 }}>
					<b style={{ display: "block", fontSize: 13, marginBottom: 8 }}>Research notes</b>
					<p style={{ fontSize: 13, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>{brief.researchNotes}</p>
				</div>
			) : null}

			{brief.generated ? <DraftPreview title={`Generated (${brief.primaryLocale.toUpperCase()})`} draft={brief.generated} /> : null}
			{brief.localized ? (
				<DraftPreview title={`Localized (${(brief.localizedLocale ?? "").toUpperCase()})`} draft={brief.localized} />
			) : null}

			{brief.primaryArticleId ? (
				<p style={{ fontSize: 13 }}>
					Primary draft article:{" "}
					<Link href={`/admin/insights/${brief.primaryArticleId}/edit`} style={{ color: "var(--spark)" }}>
						open in editor
					</Link>
				</p>
			) : null}
			{brief.localizedArticleId ? (
				<p style={{ fontSize: 13 }}>
					Localized draft article:{" "}
					<Link href={`/admin/insights/${brief.localizedArticleId}/edit`} style={{ color: "var(--spark)" }}>
						open in editor
					</Link>
				</p>
			) : null}
		</div>
	);
}
