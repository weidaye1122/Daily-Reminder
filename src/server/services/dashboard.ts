import type {
  DashboardDistributionItem,
  DashboardSummary,
  ReminderListItem
} from '../../shared/types';
import { dayjs, formatDateKey } from '../utils/time';
import { getSystemSettings } from './settings';
import { listEnabledReminders, listReminders } from './reminders';
import { getReminderPreview } from './date-calculator';
import { getNotificationSettings } from './settings';

export const getDashboardSummary = (): DashboardSummary => {
  const settings = getSystemSettings();
  const today = dayjs().tz(settings.timezone);
  const todayKey = formatDateKey(today);
  const reminders = listEnabledReminders();
  const notificationSettings = getNotificationSettings();

  let todayDueCount = 0;
  let weekReminderCount = 0;

  const upcomingReminders = reminders
    .map((reminder) => ({
      reminder,
      preview: getReminderPreview(reminder, settings.timezone, today)
    }))
    .filter(
      (
        entry
      ): entry is {
        reminder: (typeof reminders)[number];
        preview: NonNullable<ReturnType<typeof getReminderPreview>>;
      } => Boolean(entry.preview)
    )
    .sort((left, right) =>
      `${left.preview.nextRemindDateTime}${left.preview.occurrenceDate}`.localeCompare(
        `${right.preview.nextRemindDateTime}${right.preview.occurrenceDate}`
      )
    );

  for (const reminder of reminders) {
    const todayPreview = getReminderPreview(reminder, settings.timezone, today);
    if (todayPreview?.nextRemindDate === todayKey) {
      todayDueCount += 1;
    }
    for (let index = 0; index < 7; index += 1) {
      const cursor = formatDateKey(today.add(index, 'day'));
      const preview = getReminderPreview(reminder, settings.timezone, cursor);
      if (preview?.nextRemindDate === cursor) {
        weekReminderCount += reminder.remindTimes.length;
      }
    }
  }

  return {
    totalReminders: listReminders(settings.timezone).length,
    todayDueCount,
    enabledChannelCount:
      Number(notificationSettings.barkEnabled) + Number(notificationSettings.wecomEnabled),
    weekReminderCount,
    upcomingReminders: upcomingReminders.slice(0, 6).map(({ reminder, preview }) => ({
      id: reminder.id,
      title: reminder.title,
      nextRemindDate: preview.nextRemindDate,
      nextRemindTime: preview.nextRemindTime,
      occurrenceDate: preview.occurrenceDate,
      daysUntilNextRemind: preview.daysUntilNextRemind,
      daysLeft: preview.daysLeft,
      channels: reminder.channels
    }))
  };
};

export const getReminderDistribution = (): DashboardDistributionItem[] => {
  const settings = getSystemSettings();
  const reminders = listReminders(settings.timezone) as ReminderListItem[];
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    label: `${index + 1}月`,
    solar: 0,
    lunar: 0
  }));

  const addToAllMonths = (dateType: ReminderListItem['dateType']) => {
    for (const item of months) {
      item[dateType === 'lunar' ? 'lunar' : 'solar'] += 1;
    }
  };

  const addToMonth = (dateType: ReminderListItem['dateType'], month: number | null) => {
    if (!month || month < 1 || month > 12) {
      return;
    }
    months[month - 1][dateType === 'lunar' ? 'lunar' : 'solar'] += 1;
  };

  for (const reminder of reminders) {
    if (reminder.repeatType === 'monthly' || reminder.repeatType === 'weekly') {
      addToAllMonths(reminder.dateType);
      continue;
    }

    if (reminder.dateType === 'lunar') {
      addToMonth('lunar', reminder.lunarMonth);
      continue;
    }

    const month = reminder.solarDate ? Number(reminder.solarDate.slice(5, 7)) : null;
    addToMonth('solar', month);
  }

  return months;
};
