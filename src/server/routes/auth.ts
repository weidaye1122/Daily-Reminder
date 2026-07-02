import { Router } from 'express';
import { z } from 'zod';
import { getSessionCookieOptions, login, logout } from '../services/auth';
import { AuthError } from '../services/auth';
import { config } from '../config';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
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

authRouter.post('/change-password', (_req, _res, next) => {
  next(new AuthError('账号和密码由环境变量管理，请修改部署环境变量后重启服务。', 403));
});
