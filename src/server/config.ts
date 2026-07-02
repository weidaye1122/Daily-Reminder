import path from 'node:path';

const resolveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  port: resolveNumber(process.env.PORT, 3000),
  databaseUrl:
    process.env.DATABASE_URL ?? path.resolve(process.cwd(), 'data/reminder.db'),
  timezone: process.env.TZ ?? 'Asia/Shanghai',
  defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME ?? 'admin',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD ?? 'admin123456',
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
  sessionDays: 14
};
