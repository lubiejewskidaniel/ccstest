/**
 * IndexNow key verification content — reached ONLY via the exact-path
 * rewrite in `next.config.mjs` (`/{INDEXNOW_KEY}.txt` -> this route),
 * never linked to or requested at this route's own path directly.
 *
 * Moved here from `/api/indexnow-key.txt` (removed): Bing's real
 * IndexNow verifier requires the key file at the literal domain-root
 * location the protocol's default describes, not an arbitrary
 * `keyLocation` path — see `src/features/insights/seo/indexNow.ts`.
 */
export async function GET() {
	const key = process.env.INDEXNOW_KEY;
	if (!key) return new Response("Not found", { status: 404 });

	return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
