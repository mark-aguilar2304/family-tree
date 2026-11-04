import "server-only";

export type InvitationEmailResult = "sent" | "not_configured" | "failed";

export async function sendInvitationEmail({
  to,
  familyName,
  inviterName,
  inviteUrl,
  expiresInDays,
}: {
  to: string;
  familyName: string;
  inviterName: string;
  inviteUrl: string;
  expiresInDays: number;
}): Promise<InvitationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITATION_FROM_EMAIL;
  if (!apiKey || !from) return "not_configured";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `${inviterName} invited you to ${familyName} on Kinship`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #2d2a24;">
            <h1 style="font-size: 24px;">Join ${escapeHtml(familyName)}</h1>
            <p>${escapeHtml(inviterName)} invited you to a private family workspace on Kinship.</p>
            <p>This invitation can be used once and expires in ${expiresInDays} ${expiresInDays === 1 ? "day" : "days"}.</p>
            <p style="margin: 28px 0;">
              <a href="${escapeHtml(inviteUrl)}" style="background: #365d4c; color: #fff; padding: 12px 18px; border-radius: 8px; text-decoration: none;">
                Accept invitation
              </a>
            </p>
            <p style="font-size: 13px; color: #6b655c;">If you were not expecting this, you can ignore this email.</p>
          </div>
        `,
      }),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
