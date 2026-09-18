import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export function isEmailConfigured(): boolean {
  return resend !== null;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// Degraded mode (no RESEND_API_KEY — e.g. no domain bought/verified yet):
// logs the email instead of failing, so registration/verification/
// password-reset stay fully testable end-to-end without real email
// infrastructure. Never throws in this mode — callers can always await it.
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  if (!resend) {
    console.log(
      `\n--- EMAIL NOT SENT (RESEND_API_KEY not configured) ---\nTo: ${to}\nSubject: ${subject}\n\n${html}\n--- END EMAIL ---\n`,
    );
    return;
  }

  const { error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, html });
  if (error) {
    throw new Error(`Failed to send email via Resend: ${error.message}`);
  }
}
