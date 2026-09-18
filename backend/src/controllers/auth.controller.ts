import type { Request, Response } from 'express';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  UpdateProfileInput,
  VerifyEmailInput,
} from '@car-rental/shared';
import { env } from '../config/env.js';
import { parseDurationMs } from '../utils/parse-duration.js';
import { AppError } from '../utils/app-error.js';
import { AuthService } from '../services/auth.service.js';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function sessionMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: parseDurationMs(env.JWT_REFRESH_EXPIRES_IN),
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  });
}

export const AuthController = {
  async register(req: Request, res: Response) {
    const input = req.body as RegisterInput;
    const { email } = await AuthService.register(input);
    res.status(201).json({ success: true, data: { email } });
  },

  async verifyEmail(req: Request, res: Response) {
    const { token } = req.body as VerifyEmailInput;
    await AuthService.verifyEmail(token);
    res.status(200).json({ success: true, data: { verified: true } });
  },

  async resendVerification(req: Request, res: Response) {
    const { email } = req.body as ResendVerificationInput;
    await AuthService.resendVerification(email);
    res.status(200).json({ success: true, data: { sent: true } });
  },

  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body as ForgotPasswordInput;
    await AuthService.forgotPassword(email);
    res.status(200).json({ success: true, data: { sent: true } });
  },

  async resetPassword(req: Request, res: Response) {
    const { token, newPassword } = req.body as ResetPasswordInput;
    await AuthService.resetPassword(token, newPassword);
    res.status(200).json({ success: true, data: { reset: true } });
  },

  async login(req: Request, res: Response) {
    const { email, password } = req.body as LoginInput;
    const { accessToken, refreshToken, user } = await AuthService.login(
      email,
      password,
      sessionMeta(req),
    );

    setRefreshCookie(res, refreshToken);
    res.status(200).json({ success: true, data: { accessToken, user } });
  },

  async refresh(req: Request, res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Aucune session active.');
    }

    const { accessToken, refreshToken } = await AuthService.refresh(rawToken, sessionMeta(req));

    setRefreshCookie(res, refreshToken);
    res.status(200).json({ success: true, data: { accessToken } });
  },

  async logout(req: Request, res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await AuthService.logout(rawToken, req.user!.id, req.ip);

    clearRefreshCookie(res);
    res.status(200).json({ success: true, data: { loggedOut: true } });
  },

  async me(req: Request, res: Response) {
    const user = await AuthService.getCurrentUser(req.user!.id);
    res.status(200).json({ success: true, data: user });
  },

  async updateProfile(req: Request, res: Response) {
    const input = req.body as UpdateProfileInput;
    const user = await AuthService.updateProfile(req.user!.id, input, sessionMeta(req));
    res.status(200).json({ success: true, data: user });
  },

  async changePassword(req: Request, res: Response) {
    const input = req.body as ChangePasswordInput;
    await AuthService.changePassword(req.user!.id, input, sessionMeta(req));
    res.status(200).json({ success: true, data: { changed: true } });
  },

  async listSessions(req: Request, res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const sessions = await AuthService.listSessions(req.user!.id, rawToken);
    res.status(200).json({ success: true, data: sessions });
  },

  async revokeSession(req: Request, res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await AuthService.revokeSession(req.user!.id, req.params.id!, rawToken, sessionMeta(req));
    res.status(200).json({ success: true, data: { revoked: true } });
  },

  async revokeOtherSessions(req: Request, res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await AuthService.revokeOtherSessions(req.user!.id, rawToken, sessionMeta(req));
    res.status(200).json({ success: true, data: { revoked: true } });
  },
};
