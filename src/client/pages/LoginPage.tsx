import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAppContext } from '../lib/app-context';
import { Notice } from '../components/Notice';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAppContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const nextUser = await api.post('/api/auth/login', { username, password });
      setUser(nextUser);
      navigate('/', { replace: true });
    } catch (reason) {
      const message =
        reason instanceof ApiError ? reason.message : '登录失败，请稍后重试';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-copy">
          <img className="login-logo" src="/brand/logo-512.png" alt="日程提醒助手" />
          <h1>让重要日子按你的节奏准时出现</h1>
        </div>

        <form className="card form-grid" onSubmit={handleSubmit}>
          <div className="section-heading">
            <h2>登录后台</h2>
            <p>用户名和密码来自部署环境变量配置。</p>
          </div>
          {error ? <Notice tone="error" message={error} /> : null}
          <label className="field">
            <span>用户名</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="field">
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? '登录中...' : '进入后台'}
          </button>
        </form>
      </div>
    </div>
  );
};
