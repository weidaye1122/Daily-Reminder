import { Router } from 'express';
import { z } from 'zod';
import { changePassword, getSessionCookieOptions, login, logout } from '../services/auth';
import { AuthError } from '../services/auth';
import { config } from '../config';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8)
});

export const authRouter = Router();

authRouter.post('/login', (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = login(payload.username, payload.password);
    res.cookie(
      config.sessionCookieName,
      result.sessionToken,
      getSessionCookieOptions()
    );
    res.json(result.user);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', (req, res) => {
  logout(req.cookies?.[config.sessionCookieName]);
  res.clearCookie(config.sessionCookieName, getSessionCookieOptions());
  res.json({ success: true });
});

authRouter.get('/me', (req, res, next) => {
  if (!req.authUser) {
    return next(new AuthError('未登录', 401));
  }
  res.json(req.authUser);
});

authRouter.post('/change-password', (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new AuthError('未登录', 401);
    }
    const payload = changePasswordSchema.parse(req.body);
    const sessionToken = changePassword(
      req.authUser.id,
      payload.currentPassword,
      payload.newPassword
    );
    res.cookie(
      config.sessionCookieName,
      sessionToken,
      getSessionCookieOptions()
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
