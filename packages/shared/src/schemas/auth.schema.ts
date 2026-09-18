import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Le nom complet doit contenir au moins 2 caractères').max(100),
  email: z.string().trim().toLowerCase().email('Adresse email invalide'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
    newPassword: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string().min(1, 'La confirmation est requise'),
  })
  // Attached to confirmPassword, not the object root — the form field that
  // should show the error is the confirmation input, not a banner with no
  // obvious field to anchor to.
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Creates a brand new agency (tenant) plus its first admin — always
// available, not gated on any "first run" state (see AuthService.register):
// this app is sold to multiple agencies, each isolated from the others, so
// signing up is a normal, repeatable action like any SaaS registration form.
export const registerSchema = z
  .object({
    agencyName: z
      .string()
      .trim()
      .min(2, "Le nom de l'agence doit contenir au moins 2 caractères")
      .max(100),
    fullName: z
      .string()
      .trim()
      .min(2, 'Le nom complet doit contenir au moins 2 caractères')
      .max(100),
    email: z.string().trim().toLowerCase().email('Adresse email invalide'),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string().min(1, 'La confirmation est requise'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Jeton de vérification manquant'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse email invalide'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// Same shape as forgotPasswordSchema — public (no auth), since a just-
// registered admin who hasn't verified yet cannot log in to request this
// (see AuthService.register/login: verification is now blocking).
export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse email invalide'),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Jeton de réinitialisation manquant'),
    newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string().min(1, 'La confirmation est requise'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
