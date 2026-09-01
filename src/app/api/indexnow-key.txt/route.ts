/**
 * IndexNow key verification file — see
 * src/features/insights/seo/indexNow.ts for why this lives under /api/
 * instead of the protocol's default domain-root location.
 */
export async function GET() {
	const key = process.env.INDEXNOW_KEY;
	if (!key) return new Response("Not found", { status: 404 });

	return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
