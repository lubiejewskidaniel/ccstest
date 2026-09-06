import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { publishDueScheduledArticles } from "@/features/insights/publishing/scheduler";
import { pingIndexNow } from "@/features/insights/seo/indexNow";
import { routes } from "@/lib/routes";
import { articlePath, articleUrl } from "@/features/insights/seo/paths";

/**
 * Insights Checkpoint 8 (Automation) — the scheduler. Triggered by an
 * external cron (Vercel Cron Jobs, or any scheduler that can call a URL
 * with a bearer token) once a day at 18:00, per Decision 9's "every 2
 * days at 18:00" cadence.
 *
 * Deliberately a DAILY trigger, not a cron expression trying to encode
 * "every 2 days" directly (a day-of-month step value of 2 resets at each
 * month boundary and drifts) — the 2-day spacing is enforced once, when
 * an article is scheduled (`src/features/insights/publishing/cadence.ts`'s
 * `getNextPublishSlot()`), not by this trigger's frequency. Running
 * daily and publishing "whatever is due" is simpler and can't drift.
 *
 * Auth: a shared secret (`CRON_SECRET`), checked against the
 * `Authorization: Bearer <secret>` header — the convention Vercel Cron
 * Jobs itself sends automatically when `CRON_SECRET` is set in the
 * project's environment (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
 * Fails closed: if `CRON_SECRET` isn't configured, every request is
 * refused rather than the endpoint running unauthenticated.
 */
export async function GET(request: NextRequest) {
	const secret = process.env.CRON_SECRET;
	const authHeader = request.headers.get("authorization");

	if (!secret || authHeader !== `Bearer ${secret}`) {
		return NextResponse.json({ status: "error", message: "Unauthorized." }, { status: 401 });
	}

	const published = await publishDueScheduledArticles();

	if (published.length > 0) {
		revalidatePath(routes.insights.en);
		revalidatePath(routes.insights.pl);
		revalidatePath("/sitemap.xml");
		for (const item of published) revalidatePath(articlePath(item.slug, item.locale));

		await pingIndexNow(published.map((item) => articleUrl(item.slug, item.locale)));
	}

	return NextResponse.json({ status: "ok", publishedCount: published.length, published });
}
