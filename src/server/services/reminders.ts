import type { Reminder, ReminderInput, ReminderListItem } from '../../shared/types';
import { db } from '../db';
import {
  getCurrentLunarYear,
  getReminderPreview,
  ReminderValidationError,
  resolveStoredSolarDateForCreate,
  validateLunarSelection
} from './date-calculator';
import { dayjs, formatDateTime, formatDateKey, isTimeString, sortTimeValues } from '../utils/time';
import { listLogs } from './logs';

interface ReminderRow {
  id: number;
  title: string;
  date_type: 'solar' | 'lunar';
  repeat_type: 'yearly' | 'monthly' | 'weekly' | 'once';
  solar_date: string | null;
  lunar_month: number | null;
  lunar_day: number | null;
  is_leap_month: number;
  advance_days: number;
  times_per_day: number;
  remind_times: string;
  channels: string;
  remark: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

const mapReminder = (row: ReminderRow): Reminder => ({
  id: row.id,
  title: row.title,
  dateType: row.date_type,
  repeatType: row.repeat_type,
  solarDate: row.solar_date,
  lunarMonth: row.lunar_month,
  lunarDay: row.lunar_day,
  isLeapMonth: Boolean(row.is_leap_month),
  advanceDays: row.advance_days,
  timesPerDay: row.times_per_day,
  remindTimes: JSON.parse(row.remind_times),
  channels: JSON.parse(row.channels),
  remark: row.remark,
  enabled: Boolean(row.enabled),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const cleanArray = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const normalizeArray = (values: string[]) =>
  values.map((value) => value.trim()).filter(Boolean);

export const normalizeReminderInput = (
  input: ReminderInput,
  timezone: string
): ReminderInput => {
  const rawRemindTimes = normalizeArray(input.remindTimes);
  const remindTimes = sortTimeValues(rawRemindTimes);
  if (!input.title.trim()) {
    throw new ReminderValidationError('提醒名称不能为空');
  }
  if (input.advanceDays < 0 || input.advanceDays > 365) {
    throw new ReminderValidationError('提前天数需要在 0 到 365 之间');
  }
  if (remindTimes.length === 0) {
    throw new ReminderValidationError('请至少保留一个提醒时间点');
  }
  if (new Set(remindTimes).size !== remindTimes.length) {
    throw new ReminderValidationError('同一天内的提醒时间点不能重复');
  }
  if (input.timesPerDay !== remindTimes.length) {
    throw new ReminderValidationError('每日提醒次数需要和提醒时间点数量保持一致');
  }
  for (const time of remindTimes) {
    if (!isTimeString(time)) {
      throw new ReminderValidationError(`提醒时间格式不正确：${time}`);
    }
  }
  const channels = cleanArray(input.channels);
  if (channels.length === 0) {
    throw new ReminderValidationError('请至少选择一个通知渠道');
  }

  if (input.dateType === 'solar') {
    if (!input.solarDate) {
      throw new ReminderValidationError('请选择公历日期');
    }
  } else {
    if (input.repeatType === 'monthly') {
      if (!input.lunarDay || input.lunarDay < 1 || input.lunarDay > 30) {
        throw new ReminderValidationError('农历每月提醒需要选择初一到三十之间的日期');
      }
    } else {
      validateLunarSelection(input, getCurrentLunarYear(timezone));
    }
  }

  return {
    ...input,
    title: input.title.trim(),
    solarDate: input.solarDate,
    lunarMonth:
      input.dateType === 'lunar' && input.repeatType === 'monthly'
        ? null
        : input.lunarMonth,
    isLeapMonth:
      input.dateType === 'lunar' && input.repeatType === 'monthly'
        ? false
        : input.isLeapMonth,
    remindTimes,
    channels: channels as ReminderInput['channels'],
    remark: input.remark.trim(),
    timesPerDay: remindTimes.length,
    enabled: Boolean(input.enabled)
  };
};

export const listReminders = (timezone: string): ReminderListItem[] =>
  (db
    .prepare(
      `SELECT
        id,
        title,
        date_type,
        repeat_type,
        solar_date,
        lunar_month,
        lunar_day,
        is_leap_month,
        advance_days,
        times_per_day,
        remind_times,
        channels,
        remark,
        enabled,
        created_at,
        updated_at
      FROM reminders
      ORDER BY enabled DESC, id DESC`
    )
    .all() as ReminderRow[]).map((row) => {
    const reminder = mapReminder(row);
    try {
      return {
        ...reminder,
        preview: getReminderPreview(reminder, timezone, dayjs().tz(timezone))
      };
    } catch (error) {
      return {
        ...reminder,
        preview: null,
        previewError: error instanceof Error ? error.message : '日期计算失败'
      };
    }
  });

export const listEnabledReminders = () =>
  (db
    .prepare(
      `SELECT
        id,
        title,
        date_type,
        repeat_type,
        solar_date,
        lunar_month,
        lunar_day,
        is_leap_month,
        advance_days,
        times_per_day,
        remind_times,
        channels,
        remark,
        enabled,
        created_at,
        updated_at
      FROM reminders
      WHERE enabled = 1`
    )
    .all() as ReminderRow[]).map(mapReminder);

export const getReminder = (id: number) => {
  const row = db
    .prepare(
      `SELECT
        id,
        title,
        date_type,
        repeat_type,
        solar_date,
        lunar_month,
        lunar_day,
        is_leap_month,
        advance_days,
        times_per_day,
        remind_times,
        channels,
        remark,
        enabled,
        created_at,
        updated_at
      FROM reminders
      WHERE id = ?`
    )
    .get(id) as ReminderRow | undefined;
  return row ? mapReminder(row) : null;
};

export const createReminder = (input: ReminderInput, timezone: string) => {
  const normalized = normalizeReminderInput(input, timezone);
  const now = formatDateTime(dayjs());
  const todayKey = formatDateKey(dayjs().tz(timezone));
  const solarDate = resolveStoredSolarDateForCreate(normalized, timezone, todayKey);
  const result = db.prepare(
    `INSERT INTO reminders (
      title,
      date_type,
      repeat_type,
      solar_date,
      lunar_month,
      lunar_day,
      is_leap_month,
      advance_days,
      times_per_day,
      remind_times,
      channels,
      remark,
      enabled,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    normalized.title,
    normalized.dateType,
    normalized.repeatType,
    solarDate,
    normalized.lunarMonth,
    normalized.lunarDay,
    normalized.isLeapMonth ? 1 : 0,
    normalized.advanceDays,
    normalized.timesPerDay,
    JSON.stringify(normalized.remindTimes),
    JSON.stringify(normalized.channels),
    normalized.remark,
    normalized.enabled ? 1 : 0,
    now,
    now
  );
  return getReminder(Number(result.lastInsertRowid));
};

export const updateReminder = (
  id: number,
  input: ReminderInput,
  timezone: string
) => {
  if (!getReminder(id)) {
    return null;
  }
  const normalized = normalizeReminderInput(input, timezone);
  const todayKey = formatDateKey(dayjs().tz(timezone));
  const solarDate = resolveStoredSolarDateForCreate(normalized, timezone, todayKey);
  db.prepare(
    `UPDATE reminders
     SET title = ?,
         date_type = ?,
         repeat_type = ?,
         solar_date = ?,
         lunar_month = ?,
         lunar_day = ?,
         is_leap_month = ?,
         advance_days = ?,
         times_per_day = ?,
         remind_times = ?,
         channels = ?,
         remark = ?,
         enabled = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(
    normalized.title,
    normalized.dateType,
    normalized.repeatType,
    solarDate,
    normalized.lunarMonth,
    normalized.lunarDay,
    normalized.isLeapMonth ? 1 : 0,
    normalized.advanceDays,
    normalized.timesPerDay,
    JSON.stringify(normalized.remindTimes),
    JSON.stringify(normalized.channels),
    normalized.remark,
    normalized.enabled ? 1 : 0,
    formatDateTime(dayjs()),
    id
  );
  return getReminder(id);
};

export const deleteReminder = (id: number) => {
  db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
};

export const setReminderEnabled = (id: number, enabled: boolean) => {
  db.prepare(
    'UPDATE reminders SET enabled = ?, updated_at = ? WHERE id = ?'
  ).run(enabled ? 1 : 0, formatDateTime(dayjs()), id);
  return getReminder(id);
};

export const getReminderLogs = (id: number) => listLogs(id, 100);

export const disableExpiredOnceReminders = (todayKey: string) => {
  db.prepare(
    `UPDATE reminders
     SET enabled = 0, updated_at = ?
     WHERE repeat_type = 'once'
       AND enabled = 1
       AND solar_date IS NOT NULL
       AND solar_date < ?`
  ).run(formatDateTime(dayjs()), todayKey);
};
