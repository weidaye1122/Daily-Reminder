import { Router } from 'express';
import { z } from 'zod';
import { getNotificationSettings, getSystemSettings, updateNotificationSettings, updateSystemSettings } from '../services/settings';
import { sendTestNotification } from '../services/notifications';

const notificationSchema = z.object({
  barkEnabled: z.boolean(),
  barkServerUrl: z.string(),
  barkDeviceKey: z.string(),
  barkDefaultTitle: z.string(),
  barkSound: z.string(),
  barkGroup: z.string(),
  barkIconUrl: z.string(),
  barkAutoCopy: z.boolean(),
  wecomEnabled: z.boolean(),
  wecomCorpId: z.string(),
  wecomAgentId: z.string(),
  wecomSecret: z.string(),
  wecomApiBaseUrl: z.string(),
  wecomToken: z.string(),
  wecomEncodingAesKey: z.string(),
  wecomToUser: z.string()
});

const systemSchema = z.object({
  timezone: z.string().min(1),
  defaultAdvanceDays: z.number().int().min(0).max(365),
  defaultTimesPerDay: z.number().int().min(1).max(6),
  defaultRemindTimes: z.array(z.string()).min(1),
  logRetentionDays: z.number().int().min(1).max(3650),
  debugLogging: z.boolean()
});

export const settingsRouter = Router();

settingsRouter.get('/notifications', (_req, res) => {
  res.json(getNotificationSettings());
});

settingsRouter.put('/notifications', (req, res, next) => {
  try {
    const payload = notificationSchema.parse(req.body);
    res.json(updateNotificationSettings(payload));
  } catch (error) {
    next(error);
  }
});

settingsRouter.post('/notifications/bark/test', async (_req, res, next) => {
  try {
    const result = await sendTestNotification('bark');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

settingsRouter.post('/notifications/wecom/test', async (_req, res, next) => {
  try {
    const result = await sendTestNotification('wecom');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

settingsRouter.get('/system', (_req, res) => {
  res.json(getSystemSettings());
});

settingsRouter.put('/system', (req, res, next) => {
  try {
    const payload = systemSchema.parse(req.body);
    res.json(updateSystemSettings(payload));
  } catch (error) {
    next(error);
  }
});
