import { useEffect, useState } from 'react';
import type { NotificationSettings } from '@shared/types';
import { api, ApiError } from '../lib/api';
import { Notice } from '../components/Notice';

const emptySettings: NotificationSettings = {
  barkEnabled: false,
  barkServerUrl: '',
  barkDeviceKey: '',
  barkDefaultTitle: '日程提醒助手',
  barkSound: '',
  barkGroup: '',
  barkIconUrl: '',
  barkAutoCopy: false,
  wecomEnabled: false,
  wecomCorpId: '',
  wecomAgentId: '',
  wecomSecret: '',
  wecomApiBaseUrl: '',
  wecomToken: '',
  wecomEncodingAesKey: '',
  wecomToUser: '@all'
};

export const ChannelsPage = () => {
  const [form, setForm] = useState<NotificationSettings>(emptySettings);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const wecomCallbackUrl = `${window.location.origin}/api/wecom/callback`;

  const load = async () => {
    try {
      setForm(await api.get<NotificationSettings>('/api/settings/notifications'));
    } catch (reason) {
      setMessage({
        tone: 'error',
        text: reason instanceof ApiError ? reason.message : '通知渠道加载失败'
      });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const next = await api.put<NotificationSettings>('/api/settings/notifications', form);
      setForm(next);
      setMessage({ tone: 'success', text: '通知渠道配置已保存。' });
    } catch (reason) {
      setMessage({
        tone: 'error',
        text: reason instanceof ApiError ? reason.message : '保存失败'
      });
    } finally {
      setSaving(false);
    }
  };

  const runTest = async (channel: 'bark' | 'wecom') => {
    setMessage(null);
    try {
      await api.post(
        channel === 'bark'
          ? '/api/settings/notifications/bark/test'
          : '/api/settings/notifications/wecom/test'
      );
      setMessage({
        tone: 'success',
        text: `${channel === 'bark' ? 'Bark' : '企业微信'} 测试消息已发送。`
      });
    } catch (reason) {
      setMessage({
        tone: 'error',
        text: reason instanceof ApiError ? reason.message : '测试发送失败'
      });
    }
  };

  return (
    <div className="page-stack">
      {message ? <Notice tone={message.tone} message={message.text} /> : null}
      <section className="two-column">
        <div className="card form-grid">
          <div className="section-heading">
            <h2>Bark 推送</h2>
            <p>适合个人设备快速提醒。</p>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.barkEnabled}
              onChange={(event) =>
                setForm((value) => ({ ...value, barkEnabled: event.target.checked }))
              }
            />
            <span>启用 Bark</span>
          </label>
          <label className="field">
            <span>Bark Server 地址</span>
            <input
              value={form.barkServerUrl}
              onChange={(event) =>
                setForm((value) => ({ ...value, barkServerUrl: event.target.value }))
              }
              placeholder="https://api.day.app"
            />
          </label>
          <label className="field">
            <span>Device Key</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.barkDeviceKey}
              onChange={(event) =>
                setForm((value) => ({ ...value, barkDeviceKey: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>默认标题</span>
            <input
              value={form.barkDefaultTitle}
              onChange={(event) =>
                setForm((value) => ({ ...value, barkDefaultTitle: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>默认铃声</span>
            <input
              value={form.barkSound}
              onChange={(event) =>
                setForm((value) => ({ ...value, barkSound: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>分组</span>
            <input
              value={form.barkGroup}
              onChange={(event) =>
                setForm((value) => ({ ...value, barkGroup: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>图标地址</span>
            <input
              value={form.barkIconUrl}
              onChange={(event) =>
                setForm((value) => ({ ...value, barkIconUrl: event.target.value }))
              }
              placeholder="https://example.com/icon.png"
            />
          </label>
          <div className="tip-box">
            可填写一个公网可访问的图片 URL，Bark 会用它替换默认推送图标。
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.barkAutoCopy}
              onChange={(event) =>
                setForm((value) => ({ ...value, barkAutoCopy: event.target.checked }))
              }
            />
            <span>自动复制提醒内容</span>
          </label>
          <button type="button" className="secondary-button" onClick={() => void runTest('bark')}>
            测试 Bark 推送
          </button>
        </div>

        <div className="card form-grid">
          <div className="section-heading">
            <h2>企业微信应用消息</h2>
            <p>适合在企业微信中接收集中提醒。</p>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.wecomEnabled}
              onChange={(event) =>
                setForm((value) => ({ ...value, wecomEnabled: event.target.checked }))
              }
            />
            <span>启用企业微信</span>
          </label>
          <label className="field">
            <span>企业ID</span>
            <input
              value={form.wecomCorpId}
              onChange={(event) =>
                setForm((value) => ({ ...value, wecomCorpId: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>应用AgentId</span>
            <input
              value={form.wecomAgentId}
              onChange={(event) =>
                setForm((value) => ({ ...value, wecomAgentId: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>应用Secret</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.wecomSecret}
              onChange={(event) =>
                setForm((value) => ({ ...value, wecomSecret: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>消息代理地址</span>
            <input
              value={form.wecomApiBaseUrl}
              onChange={(event) =>
                setForm((value) => ({ ...value, wecomApiBaseUrl: event.target.value }))
              }
              placeholder="https://qyapi.weixin.qq.com"
            />
          </label>
          <div className="tip-box">
            不填会使用官方企业微信接口；反向代理地址支持 http:// 和 https://。
          </div>
          <label className="field">
            <span>Token</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.wecomToken}
              onChange={(event) =>
                setForm((value) => ({ ...value, wecomToken: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Encoding_AES</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.wecomEncodingAesKey}
              onChange={(event) =>
                setForm((value) => ({ ...value, wecomEncodingAesKey: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>回调地址</span>
            <input
              value={wecomCallbackUrl}
              readOnly
              onFocus={(event) => event.target.select()}
            />
          </label>
          <label className="field">
            <span>指定接收人</span>
            <input
              value={form.wecomToUser}
              onChange={(event) =>
                setForm((value) => ({ ...value, wecomToUser: event.target.value }))
              }
              placeholder="@all"
            />
          </label>
          <button type="button" className="secondary-button" onClick={() => void runTest('wecom')}>
            测试企业微信推送
          </button>
        </div>
      </section>

      <div className="actions-row">
        <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={saving}>
          {saving ? '保存中...' : '保存通知渠道配置'}
        </button>
      </div>
    </div>
  );
};
