import { useState } from 'react';
import { ApiError, api } from '../lib/api';
import { Notice } from '../components/Notice';
import { useAppContext } from '../lib/app-context';

export const ProfilePage = () => {
  const { user, setUser } = useAppContext();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ tone: 'error', text: '两次输入的新密码不一致。' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword
      });
      const nextUser = await api.me();
      setUser(nextUser);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ tone: 'success', text: '密码已更新。' });
    } catch (reason) {
      setMessage({
        tone: 'error',
        text: reason instanceof ApiError ? reason.message : '修改密码失败'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      {message ? <Notice tone={message.tone} message={message.text} /> : null}
      {user?.mustChangePassword ? (
        <Notice tone="info" message="当前账号仍标记为首次登录，建议现在就修改默认密码。" />
      ) : null}
      <section className="card form-grid">
        <div className="tip-box">账号：{user?.username}</div>
        <label className="field">
          <span>当前密码</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label className="field">
          <span>新密码</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <label className="field">
          <span>确认新密码</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
        <button type="button" className="primary-button" onClick={() => void changePassword()} disabled={saving}>
          {saving ? '保存中...' : '修改密码'}
        </button>
      </section>
    </div>
  );
};
