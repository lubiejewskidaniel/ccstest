/**
 * Best-effort internal notification email on a new lead, using the Resend
 * HTTP API directly (no SDK dependency - one fetch call). Optional per doc
 * 16 §2 ("server secret if transactional email is enabled"): if
 * RESEND_API_KEY isn't set, this silently no-ops. A failure here must
 * never fail the lead submission itself - the lead is already safely
 * written to the database by the time this runs, so every call site
 * treats this as fire-and-forget with its own try/catch.
 */
export async function notifyNewLead(subject: string, lines: string[]) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.LEAD_NOTIFY_EMAIL;
  if (!apiKey || !notifyTo) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CCS Website <notifications@codeconsultingstudio.com>",
        to: [notifyTo],
        subject,
        text: lines.join("\n"),
      }),
    });
  } catch (err) {
    console.error("[email] Resend notification failed:", err);
  }
}
