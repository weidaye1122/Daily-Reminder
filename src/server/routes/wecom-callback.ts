import { Router } from 'express';
import { getNotificationSettings } from '../services/settings';
import {
  WecomCallbackError,
  decryptWecomCallbackPayload,
  extractEncryptedWecomMessage,
  parseWecomIncomingMessage,
  verifyWecomCallbackSignature
} from '../services/wecom-callback';
import { acknowledgeLatestWecomReminder } from '../services/wecom-acknowledgements';

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
  try {
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
      acknowledgeLatestWecomReminder(message.fromUserName, message.content);
    }

    res.type('text/plain').send('success');
  } catch (error) {
    next(error);
  }
});
