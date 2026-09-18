// Minimal inline-styled HTML — no build step/MJML for two one-off
// transactional emails. Kept deliberately plain (no logo/branding assets)
// since Setting.logoUrl is per-agency and these are sent before/around
// account setup.

function layout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #131722;">
      <h1 style="font-size: 18px; margin: 0 0 16px;">${title}</h1>
      ${bodyHtml}
      <p style="margin-top: 32px; font-size: 12px; color: #6b7488;">
        Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.
      </p>
    </div>
  `;
}

function button(url: string, label: string): string {
  return `
    <a href="${url}" style="display: inline-block; margin: 16px 0; padding: 10px 20px; background: #3366e8; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
      ${label}
    </a>
  `;
}

export function verificationEmail(verifyUrl: string): { subject: string; html: string } {
  return {
    subject: 'Confirmez votre adresse email',
    html: layout(
      'Confirmez votre adresse email',
      `
        <p style="font-size: 14px; line-height: 1.6;">
          Merci d'avoir créé votre agence. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email.
        </p>
        ${button(verifyUrl, 'Confirmer mon email')}
        <p style="font-size: 12px; color: #6b7488;">Ce lien expire dans 24 heures.</p>
      `,
    ),
  };
}

export function passwordResetEmail(resetUrl: string): { subject: string; html: string } {
  return {
    subject: 'Réinitialisation de votre mot de passe',
    html: layout(
      'Réinitialisation de votre mot de passe',
      `
        <p style="font-size: 14px; line-height: 1.6;">
          Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
        </p>
        ${button(resetUrl, 'Réinitialiser mon mot de passe')}
        <p style="font-size: 12px; color: #6b7488;">Ce lien expire dans 1 heure.</p>
      `,
    ),
  };
}
