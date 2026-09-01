import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Decision 9's "every 2 days at 18:00" cadence, enforced at *scheduling*
 * time rather than baked into the cron trigger's frequency
 * (`src/app/api/v1/scheduler/publish/route.ts` runs once a day and just
 * publishes whatever is due — see that file's comment for why that
 * split is the more robust design than trying to encode "every 2 days"
 * directly into a cron expression).
 *
 * Both the publish hour and the minimum spacing are env-configurable —
 * an editorial cadence is exactly the kind of thing that changes
 * independently of this codebase, same reasoning as the AI pipeline's
 * env-configurable model/budget in Checkpoint 7.
 */

const DEFAULT_PUBLISH_HOUR_UTC = 18;
const DEFAULT_MIN_INTERVAL_DAYS = 2;

function publishHourUtc(): number {
	const hour = Number(process.env.CONTENT_PUBLISH_HOUR_UTC);
	return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_PUBLISH_HOUR_UTC;
}

function minIntervalDays(): number {
	const days = Number(process.env.CONTENT_PUBLISH_MIN_INTERVAL_DAYS);
	return Number.isFinite(days) && days > 0 ? days : DEFAULT_MIN_INTERVAL_DAYS;
}

function atPublishHour(date: Date): Date {
	const result = new Date(date);
	result.setUTCHours(publishHourUtc(), 0, 0, 0);
	return result;
}

/**
 * The latest timestamp anything is already scheduled or published for —
 * the anchor the next slot is spaced away from. Looks at both columns
 * because a `scheduled` article due in the future should push the next
 * slot out just as much as something already `published` today should.
 */
async function latestAnchor(): Promise<Date | null> {
	const supabase = await createSupabaseServerClient();
	if (!supabase) return null;

	const [{ data: scheduled }, { data: published }] = await Promise.all([
		supabase
			.from("insights_articles")
			.select("scheduled_at")
			.eq("status", "scheduled")
			.order("scheduled_at", { ascending: false })
			.limit(1)
			.maybeSingle(),
		supabase
			.from("insights_articles")
			.select("published_at")
			.eq("status", "published")
			.order("published_at", { ascending: false })
			.limit(1)
			.maybeSingle(),
	]);

	const candidates = [scheduled?.scheduled_at, published?.published_at]
		.filter((v): v is string => Boolean(v))
		.map((v) => new Date(v));

	if (candidates.length === 0) return null;
	return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

/** Returns the next publish slot as an ISO string: the publish-hour
 * timestamp on the day that is at least `minIntervalDays` after the
 * latest scheduled/published article, or today's (or tomorrow's, if
 * today's slot has already passed) publish-hour timestamp when nothing
 * is scheduled or published yet. */
export async function getNextPublishSlot(): Promise<string> {
	const anchor = await latestAnchor();
	const now = new Date();

	if (!anchor) {
		const todaySlot = atPublishHour(now);
		return (todaySlot > now ? todaySlot : atPublishHour(new Date(now.getTime() + 24 * 60 * 60 * 1000))).toISOString();
	}

	const earliestAllowed = new Date(anchor.getTime() + minIntervalDays() * 24 * 60 * 60 * 1000);
	const candidate = atPublishHour(earliestAllowed);
	// If rounding to the publish hour on the earliest-allowed day put the
	// slot before the anchor+interval instant itself, push one more day.
	return (candidate >= earliestAllowed ? candidate : atPublishHour(new Date(candidate.getTime() + 24 * 60 * 60 * 1000))).toISOString();
}
