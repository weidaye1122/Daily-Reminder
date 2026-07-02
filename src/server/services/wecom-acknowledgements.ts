import { db } from '../db';
import { dayjs, formatDateTime } from '../utils/time';

const acknowledgementReplies = new Set(['1', '好', 'ok', '知道了']);

interface PendingAcknowledgementRow {
  id: number;
  reminder_id: number;
  occurrence_date: string;
  message_log_id: number | null;
}

export const isWecomAcknowledgementReply = (content: string) =>
  acknowledgementReplies.has(content.trim().toLowerCase());

export const openWecomAcknowledgementWindow = (
  reminderId: number,
  occurrenceDate: string,
  messageLogId: number
) => {
  const now = formatDateTime(dayjs());
  db.prepare(
    `INSERT INTO wecom_reminder_acknowledgements (
      reminder_id,
      occurrence_date,
      message_log_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(reminder_id, occurrence_date) DO UPDATE SET
      message_log_id = CASE
        WHEN acknowledged_at IS NULL THEN excluded.message_log_id
        ELSE message_log_id
      END,
      updated_at = CASE
        WHEN acknowledged_at IS NULL THEN excluded.updated_at
        ELSE updated_at
      END`
  ).run(reminderId, occurrenceDate, messageLogId, now, now);
};

export const hasAcknowledgedWecomReminder = (
  reminderId: number,
  occurrenceDate: string
) => {
  const row = db
    .prepare(
      `SELECT id
       FROM wecom_reminder_acknowledgements
       WHERE reminder_id = ?
         AND occurrence_date = ?
         AND acknowledged_at IS NOT NULL
       LIMIT 1`
    )
    .get(reminderId, occurrenceDate);
  return Boolean(row);
};

const findLatestPendingWecomAcknowledgement = () =>
  db
    .prepare(
      `SELECT
        id,
        reminder_id,
        occurrence_date,
        message_log_id
       FROM wecom_reminder_acknowledgements
       WHERE acknowledged_at IS NULL
       ORDER BY
        COALESCE(message_log_id, 0) DESC,
        id DESC
       LIMIT 1`
    )
    .get() as PendingAcknowledgementRow | undefined;

export const acknowledgeLatestWecomReminder = (
  acknowledgedBy: string,
  replyContent: string
) => {
  if (!isWecomAcknowledgementReply(replyContent)) {
    return { accepted: false, acknowledged: false };
  }

  const pending = findLatestPendingWecomAcknowledgement();
  if (!pending) {
    return { accepted: true, acknowledged: false };
  }

  const now = formatDateTime(dayjs());
  db.prepare(
    `UPDATE wecom_reminder_acknowledgements
     SET acknowledged_by = ?,
         reply_content = ?,
         acknowledged_at = ?,
         updated_at = ?
     WHERE id = ?
       AND acknowledged_at IS NULL`
  ).run(
    acknowledgedBy.trim(),
    replyContent.trim(),
    now,
    now,
    pending.id
  );

  return {
    accepted: true,
    acknowledged: true,
    reminderId: pending.reminder_id,
    occurrenceDate: pending.occurrence_date,
    messageLogId: pending.message_log_id
  };
};

export const pruneOldWecomAcknowledgements = (retentionDays: number) => {
  const threshold = dayjs().subtract(retentionDays, 'day').format('YYYY-MM-DD');
  db.prepare(
    `DELETE FROM wecom_reminder_acknowledgements
     WHERE occurrence_date < ?`
  ).run(threshold);
};
