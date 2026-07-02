import type {
  LogStatus,
  MessageLog,
  NotificationChannel
} from '../../shared/types';
import { db } from '../db';
import { dayjs, formatDateTime } from '../utils/time';

interface MessageLogRow {
  id: number;
  reminder_id: number | null;
  reminder_title: string;
  channel: NotificationChannel;
  status: LogStatus;
  message: string;
  occurrence_date: string;
  scheduled_date: string;
  scheduled_time: string;
  send_time: string;
  error: string;
  response: string;
}

const mapMessageLog = (row: MessageLogRow): MessageLog => ({
  id: row.id,
  reminderId: row.reminder_id,
  reminderTitle: row.reminder_title,
  channel: row.channel,
  status: row.status,
  message: row.message,
  occurrenceDate: row.occurrence_date,
  scheduledDate: row.scheduled_date,
  scheduledTime: row.scheduled_time,
  sendTime: row.send_time,
  error: row.error,
  response: row.response
});

export const listLogs = (reminderId?: number | null, limit = 100) => {
  const rows = reminderId
    ? (db
        .prepare(
          `SELECT
            id,
            reminder_id,
            reminder_title,
            channel,
            status,
            message,
            occurrence_date,
            scheduled_date,
            scheduled_time,
            send_time,
            error,
            response
          FROM message_logs
          WHERE reminder_id = ?
          ORDER BY id DESC
          LIMIT ?`
        )
        .all(reminderId, limit) as MessageLogRow[])
    : (db
        .prepare(
          `SELECT
            id,
            reminder_id,
            reminder_title,
            channel,
            status,
            message,
            occurrence_date,
            scheduled_date,
            scheduled_time,
            send_time,
            error,
            response
          FROM message_logs
          ORDER BY id DESC
          LIMIT ?`
        )
        .all(limit) as MessageLogRow[]);
  return rows.map(mapMessageLog);
};

export const insertLog = (entry: {
  reminderId: number | null;
  reminderTitle: string;
  channel: NotificationChannel;
  status: LogStatus;
  message: string;
  occurrenceDate: string;
  scheduledDate: string;
  scheduledTime: string;
  error?: string;
  response?: string;
}) => {
  const result = db.prepare(
    `INSERT INTO message_logs (
      reminder_id,
      reminder_title,
      channel,
      status,
      message,
      occurrence_date,
      scheduled_date,
      scheduled_time,
      send_time,
      error,
      response,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.reminderId,
    entry.reminderTitle,
    entry.channel,
    entry.status,
    entry.message,
    entry.occurrenceDate,
    entry.scheduledDate,
    entry.scheduledTime,
    formatDateTime(dayjs()),
    entry.error ?? '',
    entry.response ?? '',
    formatDateTime(dayjs())
  );
  return Number(result.lastInsertRowid);
};

export const hasDeliveryLog = (
  reminderId: number,
  channel: NotificationChannel,
  occurrenceDate: string,
  scheduledDate: string,
  scheduledTime: string
) => {
  const row = db
    .prepare(
      `SELECT id
       FROM message_logs
       WHERE reminder_id = ?
         AND channel = ?
         AND occurrence_date = ?
         AND scheduled_date = ?
         AND scheduled_time = ?
       LIMIT 1`
    )
    .get(reminderId, channel, occurrenceDate, scheduledDate, scheduledTime);
  return Boolean(row);
};

export const hasDailyStatusLog = (
  reminderId: number,
  channel: NotificationChannel,
  status: LogStatus,
  scheduledDate: string
) => {
  const row = db
    .prepare(
      `SELECT id
       FROM message_logs
       WHERE reminder_id = ?
         AND channel = ?
         AND status = ?
         AND scheduled_date = ?
       LIMIT 1`
    )
    .get(reminderId, channel, status, scheduledDate);
  return Boolean(row);
};

export const pruneOldLogs = (retentionDays: number) => {
  const threshold = dayjs().subtract(retentionDays, 'day').format('YYYY-MM-DD');
  db.prepare('DELETE FROM message_logs WHERE scheduled_date < ?').run(threshold);
};
