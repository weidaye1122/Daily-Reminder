import path from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';

const resolveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

export const config = {
  isProduction,
  port: resolveNumber(process.env.PORT, 3000),
  databaseUrl:
    process.env.DATABASE_URL ?? path.resolve(process.cwd(), 'data/reminder.db'),
  timezone: process.env.TZ ?? 'Asia/Shanghai',
  defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME ?? 'admin',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD ?? 'change-me-before-start',
  defaultAdminPasswordConfigured: Boolean(process.env.DEFAULT_ADMIN_PASSWORD?.trim()),
  barkServerUrl: process.env.BARK_SERVER_URL ?? '',
  barkDeviceKey: process.env.BARK_DEVICE_KEY ?? '',
  barkIconUrl: process.env.BARK_ICON_URL ?? '',
  wecomCorpId: process.env.WECOM_CORP_ID ?? '',
  wecomAgentId: process.env.WECOM_AGENT_ID ?? '',
  wecomSecret: process.env.WECOM_SECRET ?? '',
  wecomApiBaseUrl:
    process.env.WECOM_MESSAGE_PROXY_URL ?? process.env.WECOM_API_BASE_URL ?? '',
  wecomToken: process.env.WECOM_TOKEN ?? '',
  wecomEncodingAesKey: process.env.WECOM_ENCODING_AES_KEY ?? '',
  wecomToUser: process.env.WECOM_TO_USER ?? '@all',
  sessionCookieName: 'schedule_reminder_session',
  sessionDays: 14,
  cookieSecure: resolveBoolean(
    process.env.COOKIE_SECURE ?? process.env.SESSION_COOKIE_SECURE,
    isProduction
  ),
  allowPrivateNotificationUrls: resolveBoolean(
    process.env.ALLOW_PRIVATE_NOTIFICATION_URLS,
    false
  ),
  allowInsecureNotificationUrls: resolveBoolean(
    process.env.ALLOW_INSECURE_NOTIFICATION_URLS,
    !isProduction
  ),
  notificationRequestTimeoutMs: resolveNumber(
    process.env.NOTIFICATION_REQUEST_TIMEOUT_MS,
    10_000
  )
};
