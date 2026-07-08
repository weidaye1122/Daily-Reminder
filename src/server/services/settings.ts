import type { NotificationSettings, SystemSettings } from '../../shared/types';
import { db } from '../db';
import { dayjs, formatDateTime } from '../utils/time';

interface NotificationSettingsRow {
  bark_enabled: number;
  bark_server_url: string;
  bark_device_key: string;
  bark_default_title: string;
  bark_sound: string;
  bark_group_name: string;
  bark_icon_url: string;
  bark_auto_copy: number;
  wecom_enabled: number;
  wecom_corp_id: string;
  wecom_agent_id: string;
  wecom_secret: string;
  wecom_api_base_url: string;
  wecom_token: string;
  wecom_encoding_aes_key: string;
  wecom_to_user: string;
  wecom_to_party: string;
  wecom_to_tag: string;
  wecom_cached_token: string;
  wecom_token_expires_at: string | null;
}

interface SystemSettingsRow {
  timezone: string;
  default_advance_days: number;
  default_times_per_day: number;
  default_remind_times: string;
  log_retention_days: number;
  debug_logging: number;
}

const maskedSecret = '********';

const mapNotificationSettings = (
  row: NotificationSettingsRow
): NotificationSettings => ({
  barkEnabled: Boolean(row.bark_enabled),
  barkServerUrl: row.bark_server_url,
  barkDeviceKey: row.bark_device_key,
  barkDefaultTitle: row.bark_default_title,
  barkSound: row.bark_sound,
  barkGroup: row.bark_group_name,
  barkIconUrl: row.bark_icon_url,
  barkAutoCopy: Boolean(row.bark_auto_copy),
  wecomEnabled: Boolean(row.wecom_enabled),
  wecomCorpId: row.wecom_corp_id,
  wecomAgentId: row.wecom_agent_id,
  wecomSecret: row.wecom_secret,
  wecomApiBaseUrl: row.wecom_api_base_url,
  wecomToken: row.wecom_token,
  wecomEncodingAesKey: row.wecom_encoding_aes_key,
  wecomToUser: row.wecom_to_user
});

const maskSecret = (value: string) => (value ? maskedSecret : '');

export const maskNotificationSettings = (
  settings: NotificationSettings
): NotificationSettings => ({
  ...settings,
  barkDeviceKey: maskSecret(settings.barkDeviceKey),
  wecomSecret: maskSecret(settings.wecomSecret),
  wecomToken: maskSecret(settings.wecomToken),
  wecomEncodingAesKey: maskSecret(settings.wecomEncodingAesKey)
});

const mapSystemSettings = (row: SystemSettingsRow): SystemSettings => ({
  timezone: row.timezone,
  defaultAdvanceDays: row.default_advance_days,
  defaultTimesPerDay: row.default_times_per_day,
  defaultRemindTimes: JSON.parse(row.default_remind_times),
  logRetentionDays: row.log_retention_days,
  debugLogging: Boolean(row.debug_logging)
});

const resolveSecretUpdate = (nextValue: string, currentValue: string) => {
  const trimmed = nextValue.trim();
  return trimmed === maskedSecret ? currentValue : trimmed;
};

export const getNotificationSettings = () =>
  mapNotificationSettings(
    db
      .prepare(
        `SELECT
          bark_enabled,
          bark_server_url,
          bark_device_key,
          bark_default_title,
          bark_sound,
          bark_group_name,
          bark_icon_url,
          bark_auto_copy,
          wecom_enabled,
          wecom_corp_id,
          wecom_agent_id,
          wecom_secret,
          wecom_api_base_url,
          wecom_token,
          wecom_encoding_aes_key,
          wecom_to_user,
          wecom_to_party,
          wecom_to_tag,
          wecom_cached_token,
          wecom_token_expires_at
        FROM notification_settings
        WHERE id = 1`
      )
      .get() as NotificationSettingsRow
  );

export const updateNotificationSettings = (input: NotificationSettings) => {
  const now = formatDateTime(dayjs());
  const current = getNotificationSettings();
  db.prepare(
    `UPDATE notification_settings
     SET bark_enabled = ?,
         bark_server_url = ?,
         bark_device_key = ?,
         bark_default_title = ?,
         bark_sound = ?,
         bark_group_name = ?,
         bark_icon_url = ?,
         bark_auto_copy = ?,
         wecom_enabled = ?,
         wecom_corp_id = ?,
         wecom_agent_id = ?,
         wecom_secret = ?,
         wecom_api_base_url = ?,
         wecom_token = ?,
         wecom_encoding_aes_key = ?,
         wecom_to_user = ?,
         wecom_to_party = '',
         wecom_to_tag = '',
         wecom_cached_token = '',
         wecom_token_expires_at = NULL,
         updated_at = ?
     WHERE id = 1`
  ).run(
    input.barkEnabled ? 1 : 0,
    input.barkServerUrl.trim(),
    resolveSecretUpdate(input.barkDeviceKey, current.barkDeviceKey),
    input.barkDefaultTitle.trim() || '日程提醒助手',
    input.barkSound.trim(),
    input.barkGroup.trim(),
    input.barkIconUrl.trim(),
    input.barkAutoCopy ? 1 : 0,
    input.wecomEnabled ? 1 : 0,
    input.wecomCorpId.trim(),
    input.wecomAgentId.trim(),
    resolveSecretUpdate(input.wecomSecret, current.wecomSecret),
    input.wecomApiBaseUrl.trim(),
    resolveSecretUpdate(input.wecomToken, current.wecomToken),
    resolveSecretUpdate(input.wecomEncodingAesKey, current.wecomEncodingAesKey),
    input.wecomToUser.trim() || '@all',
    now
  );
  return getNotificationSettings();
};

export const getSystemSettings = () =>
  mapSystemSettings(
    db
      .prepare(
        `SELECT
          timezone,
          default_advance_days,
          default_times_per_day,
          default_remind_times,
          log_retention_days,
          debug_logging
        FROM system_settings
        WHERE id = 1`
      )
      .get() as SystemSettingsRow
  );

export const updateSystemSettings = (input: SystemSettings) => {
  const now = formatDateTime(dayjs());
  db.prepare(
    `UPDATE system_settings
     SET timezone = ?,
         default_advance_days = ?,
         default_times_per_day = ?,
         default_remind_times = ?,
         log_retention_days = ?,
         debug_logging = ?,
         updated_at = ?
     WHERE id = 1`
  ).run(
    input.timezone.trim() || 'Asia/Shanghai',
    input.defaultAdvanceDays,
    input.defaultTimesPerDay,
    JSON.stringify(input.defaultRemindTimes),
    input.logRetentionDays,
    input.debugLogging ? 1 : 0,
    now
  );
  return getSystemSettings();
};

export const updateCachedWecomToken = (token: string, expiresAt: string | null) => {
  db.prepare(
    `UPDATE notification_settings
     SET wecom_cached_token = ?, wecom_token_expires_at = ?, updated_at = ?
     WHERE id = 1`
  ).run(token, expiresAt, formatDateTime(dayjs()));
};

export const getRawNotificationSettings = () =>
  db
    .prepare(
      `SELECT
        bark_enabled,
        bark_server_url,
        bark_device_key,
        bark_default_title,
        bark_sound,
        bark_group_name,
        bark_icon_url,
        bark_auto_copy,
        wecom_enabled,
        wecom_corp_id,
        wecom_agent_id,
        wecom_secret,
        wecom_api_base_url,
        wecom_token,
        wecom_encoding_aes_key,
        wecom_to_user,
        wecom_to_party,
        wecom_to_tag,
        wecom_cached_token,
        wecom_token_expires_at
      FROM notification_settings
      WHERE id = 1`
    )
    .get() as NotificationSettingsRow;
