import { siteUrl } from "@/lib/seo/metadata";

/**
 * IndexNow (https://www.indexnow.org) — a single shared protocol Bing
 * and Yandex both consume, so one ping covers both instead of two
 * separate submission APIs. Silent no-op until `INDEXNOW_KEY` is set,
 * same "safe without configuration" contract as every other optional
 * integration in this app (CRM, GSC, Bing Webmaster, the AI provider).
 *
 * `keyLocation` points at the domain root — `/{INDEXNOW_KEY}.txt` —
 * which is the protocol's default file location. An earlier version of
 * this hosted the key under `/api/indexnow-key.txt` instead (IndexNow's
 * written spec nominally allows a custom `keyLocation`), but Bing's
 * real verifier rejected that with an HTTP 422
 * ("...URLs are not related to your site verified through the
 * keylocation parameter") — in practice the key must live at the
 * literal domain root. The root file itself is served by a
 * `next.config.mjs` rewrite of the one exact, literal path computed
 * from `INDEXNOW_KEY` to `src/app/api/indexnow-key/route.ts` — not a
 * dynamic `[key].txt` segment, which would otherwise intercept every
 * unmatched single-segment path on the site (and would need to
 * reimplement the app's normal 404 page to avoid a regression there).
 */
export async function pingIndexNow(urls: string[]): Promise<void> {
	const key = process.env.INDEXNOW_KEY;
	if (!key || urls.length === 0) return;

	const host = new URL(siteUrl).host;

	try {
		const res = await fetch("https://api.indexnow.org/indexnow", {
			method: "POST",
			headers: { "Content-Type": "application/json; charset=utf-8" },
			body: JSON.stringify({
				host,
				key,
				keyLocation: new URL(`/${key}.txt`, siteUrl).toString(),
				urlList: urls,
			}),
		});
		if (!res.ok) {
			console.error(`[indexnow] submission failed (${res.status}):`, await res.text().catch(() => ""));
		}
	} catch (err) {
		// Never let an IndexNow outage affect publishing itself — this is
		// a best-effort discovery signal, not a requirement for the
		// article to actually be live.
		console.error("[indexnow] submission request failed:", err instanceof Error ? err.message : String(err));
	}
}
