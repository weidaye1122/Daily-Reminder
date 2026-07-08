import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { config } from './config';
import { getUserFromSession } from './services/auth';
import { authRouter } from './routes/auth';
import { remindersRouter } from './routes/reminders';
import { settingsRouter } from './routes/settings';
import { logsRouter } from './routes/logs';
import { dashboardRouter } from './routes/dashboard';
import { wecomCallbackRouter } from './routes/wecom-callback';
import { AuthError } from './services/auth';
import { NotificationError } from './services/notifications';
import { ReminderValidationError } from './services/date-calculator';
import { WecomCallbackError } from './services/wecom-callback';
import {
  requireSameOriginUnsafeRequest,
  securityHeaders
} from './security';

export const createApp = () => {
  const app = express();
  const distClient = path.resolve(process.cwd(), 'dist/client');

  app.disable('x-powered-by');
  app.use(securityHeaders);

  app.use(
    '/api/wecom/callback',
    express.text({
      type: ['text/plain', 'text/xml', 'application/xml', 'application/*+xml'],
      limit: '1mb'
    }),
    wecomCallbackRouter
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requireSameOriginUnsafeRequest);

  app.use((req, _res, next) => {
    const token = req.cookies?.[config.sessionCookieName];
    req.sessionToken = token;
    req.authUser = getUserFromSession(token) ?? undefined;
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', (req, _res, next) => {
    if (!req.authUser) {
      return next(new AuthError('请先登录', 401));
    }
    next();
  });
  app.use('/api/reminders', remindersRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/dashboard', dashboardRouter);

  if (fs.existsSync(distClient)) {
    app.use(express.static(distClient));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(distClient, 'index.html'));
    });
  }

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: '接口不存在' });
    }
    return res.status(404).type('text/plain').send('Not found');
  });

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (
        error instanceof AuthError ||
        error instanceof NotificationError ||
        error instanceof ReminderValidationError ||
        error instanceof WecomCallbackError
      ) {
        return res
          .status(error.statusCode)
          .json({ error: error.message });
      }
      if (
        error instanceof Error &&
        typeof error === 'object' &&
        error !== null &&
        'issues' in error
      ) {
        return res.status(400).json({ error: '请求参数不合法', details: error.message });
      }
      console.error(error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  );

  return app;
};
