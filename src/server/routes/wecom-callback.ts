import { Router } from 'express';
import { getNotificationSettings, getSystemSettings } from '../services/settings';
import {
  WecomCallbackError,
  decryptWecomCallbackPayload,
  extractEncryptedWecomMessage,
  parseWecomIncomingMessage,
  verifyWecomCallbackSignature
} from '../services/wecom-callback';
import { acknowledgeLatestWecomReminder } from '../services/wecom-acknowledgements';
import { getReminder } from '../services/reminders';
import { getReminderPreview } from '../services/date-calculator';
import { sendWecomTextToUser } from '../services/notifications';
import { dayjs } from '../utils/time';

const getQueryValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return String(value[0] ?? '');
  }
  return String(value ?? '');
};

const getCallbackConfig = () => {
  const settings = getNotificationSettings();
  if (!settings.wecomToken.trim()) {
    throw new WecomCallbackError('请先填写企业微信 Token');
  }
  if (!settings.wecomEncodingAesKey.trim()) {
    throw new WecomCallbackError('请先填写企业微信 Encoding_AES');
  }
  return settings;
};

const verifySignatureOrThrow = (input: {
  token: string;
  timestamp: string;
  nonce: string;
  encryptedText: string;
  signature: string;
}) => {
  if (!verifyWecomCallbackSignature(input)) {
    throw new WecomCallbackError('企业微信回调签名校验失败', 403);
  }
};

const buildAcknowledgementReply = (
  reminderId: number,
  occurrenceDate: string
) => {
  const reminder = getReminder(reminderId);
  if (!reminder) {
    return '已确认提醒，本周期不再提醒。';
  }

  const systemSettings = getSystemSettings();
  const nextCycleReference = dayjs
    .tz(`${occurrenceDate} 23:59:59`, 'YYYY-MM-DD HH:mm:ss', systemSettings.timezone)
    .add(1, 'second');
  const nextPreview = getReminderPreview(
    reminder,
    systemSettings.timezone,
    nextCycleReference
  );

  if (!nextPreview) {
    return `已确认「${reminder.title}」提醒，本提醒没有下个周期。`;
  }

  return `已跳转「${reminder.title}」提醒到下个周期（${nextPreview.nextRemindDate} ${nextPreview.nextRemindTime}）`;
};

export const wecomCallbackRouter = Router();

wecomCallbackRouter.get('/', (req, res, next) => {
  try {
    const settings = getCallbackConfig();
    const encryptedText = getQueryValue(req.query.echostr);
    verifySignatureOrThrow({
      token: settings.wecomToken,
      timestamp: getQueryValue(req.query.timestamp),
      nonce: getQueryValue(req.query.nonce),
      encryptedText,
      signature: getQueryValue(req.query.msg_signature)
    });

    const decrypted = decryptWecomCallbackPayload(
      encryptedText,
      settings.wecomEncodingAesKey,
      settings.wecomCorpId
    );
    res.type('text/plain').send(decrypted.message);
  } catch (error) {
    next(error);
  }
});

wecomCallbackRouter.post('/', (req, res, next) => {
  void (async () => {
    const settings = getCallbackConfig();
    const xml = typeof req.body === 'string' ? req.body : '';
    const encryptedText = extractEncryptedWecomMessage(xml);
    verifySignatureOrThrow({
      token: settings.wecomToken,
      timestamp: getQueryValue(req.query.timestamp),
      nonce: getQueryValue(req.query.nonce),
      encryptedText,
      signature: getQueryValue(req.query.msg_signature)
    });

    const decrypted = decryptWecomCallbackPayload(
      encryptedText,
      settings.wecomEncodingAesKey,
      settings.wecomCorpId
    );
    const message = parseWecomIncomingMessage(decrypted.message);

    if (message.msgType === 'text') {
      const acknowledgement = acknowledgeLatestWecomReminder(
        message.fromUserName,
        message.content
      );
      if (
        acknowledgement.acknowledged &&
        typeof acknowledgement.reminderId === 'number' &&
        acknowledgement.occurrenceDate
      ) {
        try {
          const reply = buildAcknowledgementReply(
            acknowledgement.reminderId,
            acknowledgement.occurrenceDate
          );
          await sendWecomTextToUser(settings, message.fromUserName, reply);
        } catch (error) {
          console.error('企业微信确认回执发送失败', error);
        }
      } else if (acknowledgement.accepted) {
        try {
          await sendWecomTextToUser(
            settings,
            message.fromUserName,
            '已收到回复，但当前没有待跳转的提醒。'
          );
        } catch (error) {
          console.error('企业微信确认回执发送失败', error);
        }
      }
    }

    res.type('text/plain').send('success');
  })().catch((error) => {
    next(error);
  });
});
