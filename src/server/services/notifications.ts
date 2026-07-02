import type {
  NotificationChannel,
  NotificationSettings,
  Reminder,
  ReminderSchedulePreview
} from '../../shared/types';
import { buildCompactReminderBody } from './date-calculator';
import { getNotificationSettings, getRawNotificationSettings, updateCachedWecomToken } from './settings';
import { dayjs, formatDateTime } from '../utils/time';

export class NotificationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const assertBarkConfig = (settings: NotificationSettings) => {
  if (!settings.barkServerUrl.trim() || !settings.barkDeviceKey.trim()) {
    throw new NotificationError('请先填写 Bark Server 地址和 Device Key');
  }
};

const assertWecomConfig = (settings: NotificationSettings) => {
  if (!settings.wecomCorpId.trim() || !settings.wecomAgentId.trim() || !settings.wecomSecret.trim()) {
    throw new NotificationError('请先填写企业微信 Corp ID、Agent ID 和 Secret');
  }
};

const toJsonText = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
};

const getWecomApiBaseUrl = (settings: NotificationSettings) =>
  settings.wecomApiBaseUrl.trim().replace(/\/+$/, '') ||
  'https://qyapi.weixin.qq.com';

const buildWecomUrl = (
  settings: NotificationSettings,
  pathname: string,
  searchParams: Record<string, string>
) => {
  const baseUrl = getWecomApiBaseUrl(settings);
  const normalizedPath = pathname.replace(/^\/+/, '');
  let url: URL;
  try {
    url = new URL(`${baseUrl}/${normalizedPath}`);
  } catch {
    throw new NotificationError(
      '企业微信 API 代理地址格式不正确，请填写完整的 http:// 或 https:// 地址'
    );
  }
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return url;
};

const sendBark = async (
  settings: NotificationSettings,
  title: string,
  body: string
) => {
  assertBarkConfig(settings);
  const response = await fetch(
    `${settings.barkServerUrl.replace(/\/$/, '')}/push`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        device_key: settings.barkDeviceKey,
        title,
        body,
        sound: settings.barkSound || undefined,
        group: settings.barkGroup || undefined,
        icon: settings.barkIconUrl || undefined,
        automaticallyCopy: settings.barkAutoCopy ? '1' : undefined
      })
    }
  );
  const text = await toJsonText(response);
  if (!response.ok) {
    throw new NotificationError(`Bark 请求失败：${text}`, response.status);
  }
  return text;
};

const resolveWecomToken = async (settings: NotificationSettings) => {
  assertWecomConfig(settings);
  const raw = getRawNotificationSettings();
  if (
    raw.wecom_cached_token &&
    raw.wecom_token_expires_at &&
    dayjs(raw.wecom_token_expires_at).isAfter(dayjs().add(5, 'minute'))
  ) {
    return raw.wecom_cached_token;
  }
  const response = await fetch(
    buildWecomUrl(settings, '/cgi-bin/gettoken', {
      corpid: settings.wecomCorpId,
      corpsecret: settings.wecomSecret
    })
  );
  const payload = (await response.json()) as {
    errcode?: number;
    errmsg?: string;
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok || payload.errcode) {
    throw new NotificationError(
      `企业微信 token 获取失败：${payload.errmsg ?? response.statusText}`,
      response.status || 500
    );
  }
  const expiresAt = formatDateTime(
    dayjs().add((payload.expires_in ?? 7200) - 300, 'second')
  );
  updateCachedWecomToken(payload.access_token ?? '', expiresAt);
  return payload.access_token ?? '';
};

const sendWecom = async (
  settings: NotificationSettings,
  title: string,
  body: string,
  options: { includeAcknowledgementHint?: boolean; markdown?: boolean } = {}
) => {
  const token = await resolveWecomToken(settings);
  const acknowledgementHint = options.includeAcknowledgementHint
    ? '\n\n回复 1、好、OK 或知道了，本周期不再提醒。'
    : '';
  const requestPayload = options.markdown
    ? {
        touser: settings.wecomToUser || '@all',
        msgtype: 'markdown',
        agentid: Number(settings.wecomAgentId),
        markdown: {
          content: `${body}${acknowledgementHint}`
        },
        safe: 0
      }
    : {
        touser: settings.wecomToUser || '@all',
        msgtype: 'text',
        agentid: Number(settings.wecomAgentId),
        text: {
          content: `【${title}】\n${body}${acknowledgementHint}`
        },
        safe: 0
      };
  const response = await fetch(
    buildWecomUrl(settings, '/cgi-bin/message/send', {
      access_token: token
    }),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    }
  );
  const responsePayload = (await response.json()) as { errcode?: number; errmsg?: string };
  if (!response.ok || responsePayload.errcode) {
    throw new NotificationError(
      `企业微信消息发送失败：${responsePayload.errmsg ?? response.statusText}`,
      response.status || 500
    );
  }
  return JSON.stringify(responsePayload);
};

export const sendChannelMessage = async (
  channel: NotificationChannel,
  settings: NotificationSettings,
  title: string,
  body: string,
  options: { includeAcknowledgementHint?: boolean; markdown?: boolean } = {}
) => {
  if (channel === 'bark') {
    return sendBark(settings, title, body);
  }
  return sendWecom(settings, title, body, options);
};

export const sendTestNotification = async (
  channel: NotificationChannel,
  customMessage?: string
) => {
  const settings = getNotificationSettings();
  const message = customMessage?.trim() || '这是一条来自日程提醒助手的测试消息。';
  const title = settings.barkDefaultTitle || '日程提醒助手';
  const responseText = await sendChannelMessage(channel, settings, title, message);
  return {
    message,
    responseText
  };
};

export const sendReminderThroughChannel = async (
  reminder: Reminder,
  preview: ReminderSchedulePreview,
  channel: NotificationChannel,
  timezone: string
) => {
  const settings = getNotificationSettings();
  const title = reminder.title;
  const message = buildCompactReminderBody(reminder, preview, timezone);
  const responseText = await sendChannelMessage(channel, settings, title, message);
  return {
    message,
    responseText
  };
};
