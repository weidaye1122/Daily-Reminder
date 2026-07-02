import { formatDateKey, formatTimeKey, nowInZone } from './utils/time';
import { getSystemSettings } from './services/settings';
import { disableExpiredOnceReminders, listEnabledReminders } from './services/reminders';
import { getReminderPreview } from './services/date-calculator';
import { hasDailyStatusLog, hasDeliveryLog, insertLog, pruneOldLogs } from './services/logs';
import { sendReminderThroughChannel } from './services/notifications';
import {
  hasAcknowledgedWecomReminder,
  openWecomAcknowledgementWindow,
  pruneOldWecomAcknowledgements
} from './services/wecom-acknowledgements';

let intervalHandle: NodeJS.Timeout | null = null;

export const runSchedulerTick = async () => {
  const systemSettings = getSystemSettings();
  const now = nowInZone(systemSettings.timezone);
  const todayKey = formatDateKey(now);
  const timeKey = formatTimeKey(now);

  disableExpiredOnceReminders(todayKey);
  pruneOldLogs(systemSettings.logRetentionDays);
  pruneOldWecomAcknowledgements(systemSettings.logRetentionDays);

  for (const reminder of listEnabledReminders()) {
    let preview: ReturnType<typeof getReminderPreview>;
    try {
      preview = getReminderPreview(reminder, systemSettings.timezone, now);
    } catch (error) {
      for (const channel of reminder.channels) {
        if (hasDailyStatusLog(reminder.id, channel, 'calc_error', todayKey)) {
          continue;
        }
        insertLog({
          reminderId: reminder.id,
          reminderTitle: reminder.title,
          channel,
          status: 'calc_error',
          message: `【${reminder.title}】日期计算失败`,
          occurrenceDate: 'calc_error',
          scheduledDate: todayKey,
          scheduledTime: timeKey,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
      continue;
    }
    if (!preview || preview.nextRemindDate !== todayKey) {
      continue;
    }
    if (preview.nextRemindTime !== timeKey) {
      continue;
    }

    const acknowledgedThisOccurrence = hasAcknowledgedWecomReminder(
      reminder.id,
      preview.occurrenceDate
    );

    for (const channel of reminder.channels) {
      if (acknowledgedThisOccurrence) {
        if (
          !hasDeliveryLog(
            reminder.id,
            channel,
            preview.occurrenceDate,
            todayKey,
            timeKey
          )
        ) {
          insertLog({
            reminderId: reminder.id,
            reminderTitle: reminder.title,
            channel,
            status: 'skipped',
            message: `【${reminder.title}】已收到企业微信确认回复，本周期不再提醒`,
            occurrenceDate: preview.occurrenceDate,
            scheduledDate: todayKey,
            scheduledTime: timeKey,
            response: '企业微信回复确认'
          });
        }
        continue;
      }

      if (
        hasDeliveryLog(
          reminder.id,
          channel,
          preview.occurrenceDate,
          todayKey,
          timeKey
        )
      ) {
        continue;
      }

      try {
        const result = await sendReminderThroughChannel(
          reminder,
          preview,
          channel,
          systemSettings.timezone
        );
        const messageLogId = insertLog({
          reminderId: reminder.id,
          reminderTitle: reminder.title,
          channel,
          status: 'success',
          message: result.message,
          occurrenceDate: preview.occurrenceDate,
          scheduledDate: todayKey,
          scheduledTime: timeKey,
          response: result.responseText
        });
        if (channel === 'wecom') {
          openWecomAcknowledgementWindow(
            reminder.id,
            preview.occurrenceDate,
            messageLogId
          );
        }
      } catch (error) {
        insertLog({
          reminderId: reminder.id,
          reminderTitle: reminder.title,
          channel,
          status: 'failed',
          message: `【${reminder.title}】提醒发送失败`,
          occurrenceDate: preview.occurrenceDate,
          scheduledDate: todayKey,
          scheduledTime: timeKey,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }
  }
};

export const startScheduler = () => {
  if (intervalHandle) {
    return;
  }
  void runSchedulerTick();
  intervalHandle = setInterval(() => {
    void runSchedulerTick();
  }, 60_000);
};
