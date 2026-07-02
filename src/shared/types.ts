export type DateType = 'solar' | 'lunar';
export type RepeatType = 'yearly' | 'monthly' | 'weekly' | 'once';
export type NotificationChannel = 'bark' | 'wecom';
export type LogStatus =
  | 'success'
  | 'failed'
  | 'skipped'
  | 'config_error'
  | 'calc_error';

export interface AuthUser {
  id: number;
  username: string;
  nickname: string;
  mustChangePassword: boolean;
}

export interface Reminder {
  id: number;
  title: string;
  dateType: DateType;
  repeatType: RepeatType;
  solarDate: string | null;
  lunarMonth: number | null;
  lunarDay: number | null;
  isLeapMonth: boolean;
  advanceDays: number;
  timesPerDay: number;
  remindTimes: string[];
  channels: NotificationChannel[];
  remark: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderInput {
  title: string;
  dateType: DateType;
  repeatType: RepeatType;
  solarDate: string | null;
  lunarMonth: number | null;
  lunarDay: number | null;
  isLeapMonth: boolean;
  advanceDays: number;
  timesPerDay: number;
  remindTimes: string[];
  channels: NotificationChannel[];
  remark: string;
  enabled: boolean;
}

export interface ReminderSchedulePreview {
  occurrenceDate: string;
  nextRemindDate: string;
  nextRemindTime: string;
  nextRemindDateTime: string;
  daysUntilNextRemind: number;
  daysLeft: number;
  displayLabel: string;
  lunarLabel?: string;
}

export interface ReminderListItem extends Reminder {
  preview: ReminderSchedulePreview | null;
  previewError?: string;
}

export interface LunarDateValidation {
  label: string;
  referenceLunarYear: number;
  currentYearValid: boolean;
  nextValidLunarYear: number | null;
  nextSolarDate: string | null;
  message: string;
}

export interface NotificationSettings {
  barkEnabled: boolean;
  barkServerUrl: string;
  barkDeviceKey: string;
  barkDefaultTitle: string;
  barkSound: string;
  barkGroup: string;
  barkIconUrl: string;
  barkAutoCopy: boolean;
  wecomEnabled: boolean;
  wecomCorpId: string;
  wecomAgentId: string;
  wecomSecret: string;
  wecomApiBaseUrl: string;
  wecomToken: string;
  wecomEncodingAesKey: string;
  wecomToUser: string;
}

export interface SystemSettings {
  timezone: string;
  defaultAdvanceDays: number;
  defaultTimesPerDay: number;
  defaultRemindTimes: string[];
  logRetentionDays: number;
  debugLogging: boolean;
}

export interface MessageLog {
  id: number;
  reminderId: number | null;
  reminderTitle: string;
  channel: NotificationChannel;
  status: LogStatus;
  message: string;
  occurrenceDate: string;
  scheduledDate: string;
  scheduledTime: string;
  sendTime: string;
  error: string;
  response: string;
}

export interface DashboardSummary {
  totalReminders: number;
  todayDueCount: number;
  enabledChannelCount: number;
  weekReminderCount: number;
  upcomingReminders: Array<{
    id: number;
    title: string;
    nextRemindDate: string;
    nextRemindTime: string;
    occurrenceDate: string;
    daysUntilNextRemind: number;
    daysLeft: number;
    channels: NotificationChannel[];
  }>;
}

export interface DashboardDistributionItem {
  month: number;
  label: string;
  solar: number;
  lunar: number;
}

export interface ApiErrorShape {
  error: string;
  details?: string;
}
