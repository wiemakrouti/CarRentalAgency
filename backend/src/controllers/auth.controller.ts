import type { Request, Response } from 'express';
import type { LoginInput } from '@car-rental/shared';
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
  async login(req: Request, res: Response) {
    const { email, password } = req.body as LoginInput;
    const { accessToken, refreshToken, user } = await AuthService.login(email, password, sessionMeta(req));

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
};
