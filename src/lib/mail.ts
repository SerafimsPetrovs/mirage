import "server-only";

/**
 * Outgoing email.
 * MAIL_PROVIDER=console (default) — prints the message to the server log (dev / demo).
 * MAIL_PROVIDER=resend            — https://resend.com API: RESEND_API_KEY, MAIL_FROM ("MIRAGE <no-reply@your.domain>").
 */
export type Mail = { to: string; subject: string; text: string; html?: string };

export async function sendMail(mail: Mail) {
  const provider = process.env.MAIL_PROVIDER ?? "console";
  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`MAIL_HTTP_${res.status}`);
    return;
  }
  console.log(`\n[mail → ${mail.to}] ${mail.subject}\n${mail.text}\n`);
}

/** Whether emails really leave the server (used to show a dev hint). */
export const mailIsReal = () => (process.env.MAIL_PROVIDER ?? "console") !== "console";
