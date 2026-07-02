import crypto from 'node:crypto';

export class WecomCallbackError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface WecomIncomingMessage {
  toUserName: string;
  fromUserName: string;
  createTime: string;
  msgType: string;
  content: string;
  msgId: string;
  agentId: string;
}

const parseXmlTag = (xml: string, tagName: string) => {
  const pattern = new RegExp(
    `<${tagName}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tagName}>`
  );
  const match = xml.match(pattern);
  return (match?.[1] ?? match?.[2] ?? '').trim();
};

const buildSignature = (
  token: string,
  timestamp: string,
  nonce: string,
  encryptedText: string
) =>
  crypto
    .createHash('sha1')
    .update([token, timestamp, nonce, encryptedText].sort().join(''))
    .digest('hex');

export const verifyWecomCallbackSignature = (input: {
  token: string;
  timestamp: string;
  nonce: string;
  encryptedText: string;
  signature: string;
}) => {
  if (
    !input.token ||
    !input.timestamp ||
    !input.nonce ||
    !input.encryptedText ||
    !input.signature
  ) {
    return false;
  }

  const expected = buildSignature(
    input.token,
    input.timestamp,
    input.nonce,
    input.encryptedText
  );
  const received = input.signature.toLowerCase();
  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  );
};

const resolveAesKey = (encodingAesKey: string) => {
  const value = encodingAesKey.trim();
  if (!value) {
    throw new WecomCallbackError('请先填写企业微信 Encoding_AES');
  }
  const padded = value.endsWith('=') ? value : `${value}=`;
  const key = Buffer.from(padded, 'base64');
  if (key.length !== 32) {
    throw new WecomCallbackError('企业微信 Encoding_AES 格式不正确');
  }
  return key;
};

const removePkcs7Padding = (buffer: Buffer) => {
  const padding = buffer.at(-1) ?? 0;
  if (padding < 1 || padding > 32) {
    throw new WecomCallbackError('企业微信回调解密失败');
  }
  return buffer.subarray(0, buffer.length - padding);
};

export const decryptWecomCallbackPayload = (
  encryptedText: string,
  encodingAesKey: string,
  expectedReceiveId: string
) => {
  const aesKey = resolveAesKey(encodingAesKey);
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    aesKey,
    aesKey.subarray(0, 16)
  );
  decipher.setAutoPadding(false);

  let decrypted: Buffer;
  try {
    decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64')),
      decipher.final()
    ]);
  } catch {
    throw new WecomCallbackError('企业微信回调解密失败');
  }

  const plain = removePkcs7Padding(decrypted);
  if (plain.length < 20) {
    throw new WecomCallbackError('企业微信回调内容不完整');
  }

  const messageLength = plain.readUInt32BE(16);
  const messageStart = 20;
  const messageEnd = messageStart + messageLength;
  if (messageEnd > plain.length) {
    throw new WecomCallbackError('企业微信回调内容长度不正确');
  }

  const message = plain.subarray(messageStart, messageEnd).toString('utf8');
  const receiveId = plain.subarray(messageEnd).toString('utf8');
  const expected = expectedReceiveId.trim();
  if (expected && receiveId && receiveId !== expected) {
    throw new WecomCallbackError('企业微信回调企业 ID 不匹配', 403);
  }

  return { message, receiveId };
};

export const extractEncryptedWecomMessage = (xml: string) =>
  parseXmlTag(xml, 'Encrypt');

export const parseWecomIncomingMessage = (xml: string): WecomIncomingMessage => ({
  toUserName: parseXmlTag(xml, 'ToUserName'),
  fromUserName: parseXmlTag(xml, 'FromUserName'),
  createTime: parseXmlTag(xml, 'CreateTime'),
  msgType: parseXmlTag(xml, 'MsgType'),
  content: parseXmlTag(xml, 'Content'),
  msgId: parseXmlTag(xml, 'MsgId'),
  agentId: parseXmlTag(xml, 'AgentID')
});
