import { createSign } from "crypto";
import type { SearchPerformanceProvider, RawSearchMetricRow } from "../types/searchProvider";

/**
 * Google Search Console Search Analytics API, authenticated via a
 * service-account JWT exchanged for an OAuth2 access token — raw
 * `fetch`, no `googleapis` SDK dependency, consistent with how
 * `src/lib/crm/HubSpotProvider.ts` calls HubSpot directly. Uses Node's
 * built-in `crypto` for RS256 signing rather than adding a JWT library.
 *
 * Requires a Google Cloud service account with access granted to the
 * target property in Search Console (Settings → Users and permissions →
 * add the service account's email as a user) — this is a manual setup
 * step outside this codebase, not something `isConfigured()` can verify
 * beyond "are the env vars present".
 *
 * Silent no-op until `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
 * `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` and
 * `GOOGLE_SEARCH_CONSOLE_SITE_URL` are all set — same contract as the
 * HubSpot CRM adapter.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function base64url(input: Buffer | string): string {
	return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
	const header = { alg: "RS256", typ: "JWT" };
	const now = Math.floor(Date.now() / 1000);
	const claims = {
		iss: clientEmail,
		scope: SCOPE,
		aud: TOKEN_URL,
		iat: now,
		exp: now + 3600,
	};

	const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
	const signer = createSign("RSA-SHA256");
	signer.update(unsigned);
	signer.end();
	const signature = base64url(signer.sign(privateKey));
	const jwt = `${unsigned}.${signature}`;

	const res = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion: jwt,
		}),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Google token exchange failed (${res.status}): ${body.slice(0, 300)}`);
	}

	const data = (await res.json()) as { access_token?: string };
	if (!data.access_token) throw new Error("Google token exchange returned no access_token.");
	return data.access_token;
}

type GscRow = { keys: [string, string, string]; clicks: number; impressions: number; ctr: number; position: number };

export function createGoogleSearchConsoleProvider(): SearchPerformanceProvider {
	const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
	// Service-account private keys are usually stored with literal `\n`
	// sequences in an env var (real newlines break most .env formats) -
	// unescape them the same way most Google-service-account guides do.
	const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
	const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;

	function isConfigured() {
		return Boolean(clientEmail && privateKey && siteUrl);
	}

	return {
		id: "google",
		isConfigured,

		async fetchQueries({ startDate, endDate }): Promise<RawSearchMetricRow[]> {
			if (!clientEmail || !privateKey || !siteUrl) return [];

			const accessToken = await getAccessToken(clientEmail, privateKey);

			const res = await fetch(
				`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
				{
					method: "POST",
					headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
					body: JSON.stringify({
						startDate,
						endDate,
						dimensions: ["query", "page", "date"],
						rowLimit: 1000,
					}),
				},
			);

			if (!res.ok) {
				const body = await res.text().catch(() => "");
				throw new Error(`Google Search Console query failed (${res.status}): ${body.slice(0, 300)}`);
			}

			const data = (await res.json()) as { rows?: GscRow[] };

			return (data.rows ?? []).map((row) => ({
				source: "google" as const,
				query: row.keys[0],
				pageUrl: row.keys[1],
				date: row.keys[2],
				clicks: row.clicks,
				impressions: row.impressions,
				ctr: row.ctr,
				position: row.position,
			}));
		},
	};
}
