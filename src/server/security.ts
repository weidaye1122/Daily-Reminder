import dns from 'node:dns/promises';
import net from 'node:net';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { config } from './config';

export const csrfHeaderName = 'X-Schedule-Reminder-Request';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'self'"],
      'base-uri': ["'self'"],
      'connect-src': ["'self'"],
      'font-src': ["'self'", 'data:'],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'img-src': ["'self'", 'data:'],
      'manifest-src': ["'self'"],
      'object-src': ["'none'"],
      'script-src': ["'self'"],
      'script-src-attr': ["'none'"],
      'style-src': ["'self'"]
    }
  },
  referrerPolicy: {
    policy: 'same-origin'
  },
  strictTransportSecurity: false
});

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const normalizeHost = (value: string) =>
  value.trim().toLowerCase().replace(/\.$/, '');

const requestHost = (req: Request) => normalizeHost(req.get('host') ?? '');

const isSameRequestHost = (req: Request, value: string) => {
  try {
    const url = new URL(value);
    return normalizeHost(url.host) === requestHost(req);
  } catch {
    return false;
  }
};

export const requireSameOriginUnsafeRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!unsafeMethods.has(req.method)) {
    return next();
  }

  if (req.get(csrfHeaderName) !== 'fetch') {
    return res.status(403).json({ error: '请求来源校验失败' });
  }

  const origin = req.get('origin');
  if (origin && !isSameRequestHost(req, origin)) {
    return res.status(403).json({ error: '请求来源校验失败' });
  }

  const referer = req.get('referer');
  if (!origin && referer && !isSameRequestHost(req, referer)) {
    return res.status(403).json({ error: '请求来源校验失败' });
  }

  return next();
};

const stripIpv6Brackets = (hostname: string) =>
  hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();

const isPrivateIpv4 = (ip: string) => {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
};

const isPrivateIpv6 = (ip: string) => {
  const value = ip.toLowerCase();
  return (
    value === '::' ||
    value === '::1' ||
    value.startsWith('fe80:') ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('::ffff:127.') ||
    value.startsWith('::ffff:10.') ||
    value.startsWith('::ffff:192.168.') ||
    /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(value)
  );
};

const isPrivateIp = (ip: string) => {
  const version = net.isIP(stripIpv6Brackets(ip));
  if (version === 4) {
    return isPrivateIpv4(stripIpv6Brackets(ip));
  }
  if (version === 6) {
    return isPrivateIpv6(stripIpv6Brackets(ip));
  }
  return true;
};

const assertPublicHostname = async (url: URL, label: string) => {
  const hostname = stripIpv6Brackets(url.hostname);
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error(`${label} 不能指向 localhost`);
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`${label} 不能指向内网或本机地址`);
    }
    return;
  }

  const records = await dns.lookup(hostname, { all: true });
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new Error(`${label} 不能解析到内网或本机地址`);
  }
};

type SafeNotificationUrlOptions = {
  allowHttp?: boolean;
};

export const assertSafeNotificationUrl = async (
  url: URL,
  label: string,
  options: SafeNotificationUrlOptions = {}
) => {
  const allowHttp = options.allowHttp || config.allowInsecureNotificationUrls;
  if (
    url.protocol !== 'https:' &&
    !(allowHttp && url.protocol === 'http:')
  ) {
    throw new Error(
      allowHttp
        ? `${label} 必须使用 HTTP 或 HTTPS 地址`
        : `${label} 必须使用 HTTPS 地址`
    );
  }

  if (url.username || url.password) {
    throw new Error(`${label} 不能包含用户名或密码`);
  }

  if (!config.allowPrivateNotificationUrls) {
    await assertPublicHostname(url, label);
  }
};
