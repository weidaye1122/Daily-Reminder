import { Router } from 'express';
import { z } from 'zod';
import { createReminder, deleteReminder, getReminder, getReminderLogs, listReminders, normalizeReminderInput, setReminderEnabled, updateReminder } from '../services/reminders';
import { getSystemSettings } from '../services/settings';
import {
  getCurrentLunarYear,
  getLunarDateValidation,
  getReminderPreview
} from '../services/date-calculator';
import { sendReminderThroughChannel } from '../services/notifications';
import { insertLog } from '../services/logs';
import { dayjs, formatDateKey } from '../utils/time';

const reminderSchema = z.object({
  title: z.string(),
  dateType: z.enum(['solar', 'lunar']),
  repeatType: z.enum(['yearly', 'monthly', 'weekly', 'once']),
  solarDate: z.string().nullable(),
  lunarMonth: z.number().int().nullable(),
  lunarDay: z.number().int().nullable(),
  isLeapMonth: z.boolean(),
  advanceDays: z.number().int(),
  timesPerDay: z.number().int(),
  remindTimes: z.array(z.string()),
  channels: z.array(z.enum(['bark', 'wecom'])),
  remark: z.string(),
  enabled: z.boolean()
});

const enabledSchema = z.object({
  enabled: z.boolean()
});

const lunarPreviewSchema = z.object({
  lunarMonth: z.number().int(),
  lunarDay: z.number().int(),
  isLeapMonth: z.boolean()
});

export const remindersRouter = Router();

remindersRouter.get('/', (_req, res) => {
  const systemSettings = getSystemSettings();
  res.json(listReminders(systemSettings.timezone));
});

remindersRouter.post('/lunar-preview', (req, res, next) => {
  try {
    const systemSettings = getSystemSettings();
    const payload = lunarPreviewSchema.parse(req.body);
    res.json(
      getLunarDateValidation(
        payload,
        getCurrentLunarYear(systemSettings.timezone)
      )
    );
  } catch (error) {
    next(error);
  }
});

remindersRouter.get('/:id', (req, res) => {
  const reminder = getReminder(Number(req.params.id));
  if (!reminder) {
    return res.status(404).json({ error: '提醒不存在' });
  }
  const systemSettings = getSystemSettings();
  res.json({
    ...reminder,
    preview: getReminderPreview(
      reminder,
      systemSettings.timezone,
      dayjs().tz(systemSettings.timezone)
    )
  });
});

remindersRouter.post('/', (req, res, next) => {
  try {
    const systemSettings = getSystemSettings();
    const payload = normalizeReminderInput(
      reminderSchema.parse(req.body),
      systemSettings.timezone
    );
    const reminder = createReminder(payload, systemSettings.timezone);
    res.status(201).json(reminder);
  } catch (error) {
    next(error);
  }
});

remindersRouter.put('/:id', (req, res, next) => {
  try {
    const systemSettings = getSystemSettings();
    const payload = normalizeReminderInput(
      reminderSchema.parse(req.body),
      systemSettings.timezone
    );
    const reminder = updateReminder(
      Number(req.params.id),
      payload,
      systemSettings.timezone
    );
    if (!reminder) {
      return res.status(404).json({ error: '提醒不存在' });
    }
    res.json(reminder);
  } catch (error) {
    next(error);
  }
});

remindersRouter.delete('/:id', (req, res) => {
  deleteReminder(Number(req.params.id));
  res.json({ success: true });
});

remindersRouter.patch('/:id/enabled', (req, res, next) => {
  try {
    const payload = enabledSchema.parse(req.body);
    const reminder = setReminderEnabled(Number(req.params.id), payload.enabled);
    if (!reminder) {
      return res.status(404).json({ error: '提醒不存在' });
    }
    res.json(reminder);
  } catch (error) {
    next(error);
  }
});

remindersRouter.post('/:id/test', async (req, res, next) => {
  try {
    const reminder = getReminder(Number(req.params.id));
    if (!reminder) {
      return res.status(404).json({ error: '提醒不存在' });
    }
    const systemSettings = getSystemSettings();
    const preview =
      getReminderPreview(
        reminder,
        systemSettings.timezone,
        dayjs().tz(systemSettings.timezone)
      ) ?? {
        occurrenceDate: formatDateKey(dayjs().tz(systemSettings.timezone)),
        nextRemindDate: formatDateKey(dayjs().tz(systemSettings.timezone)),
        nextRemindTime: dayjs().tz(systemSettings.timezone).format('HH:mm'),
        nextRemindDateTime: dayjs()
          .tz(systemSettings.timezone)
          .format('YYYY-MM-DD HH:mm:ss'),
        daysUntilNextRemind: 0,
        daysLeft: 0,
        displayLabel: '测试提醒'
      };

    const results = [];
    for (const channel of reminder.channels) {
      try {
        const response = await sendReminderThroughChannel(
          reminder,
          preview,
          channel,
          systemSettings.timezone
        );
        insertLog({
          reminderId: reminder.id,
          reminderTitle: reminder.title,
          channel,
          status: 'success',
          message: response.message,
          occurrenceDate: preview.occurrenceDate,
          scheduledDate: preview.nextRemindDate,
          scheduledTime: dayjs().tz(systemSettings.timezone).format('HH:mm'),
          response: response.responseText
        });
        results.push({ channel, status: 'success' });
      } catch (error) {
        insertLog({
          reminderId: reminder.id,
          reminderTitle: reminder.title,
          channel,
          status: 'failed',
          message: `【${reminder.title}】测试发送失败`,
          occurrenceDate: preview.occurrenceDate,
          scheduledDate: preview.nextRemindDate,
          scheduledTime: dayjs().tz(systemSettings.timezone).format('HH:mm'),
          error: error instanceof Error ? error.message : '未知错误'
        });
        results.push({
          channel,
          status: 'failed',
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

remindersRouter.get('/:id/logs', (req, res) => {
  res.json(getReminderLogs(Number(req.params.id)));
});
