import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppContext } from './lib/app-context';
import { api, ApiError } from './lib/api';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RemindersPage } from './pages/RemindersPage';
import { RulesPage } from './pages/RulesPage';
import { ChannelsPage } from './pages/ChannelsPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import type { AuthUser } from '@shared/types';

const LoadingScreen = () => (
  <div className="loading-screen">
    <div className="card">正在检查登录状态...</div>
  </div>
);

export const App = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const nextUser = await api.me();
      setUser(nextUser);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setUser(null);
        return;
      }
      throw reason;
    }
  };

  const logout = async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  };

  useEffect(() => {
    void (async () => {
      try {
        await refreshUser();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        refreshUser,
        logout
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={user ? <AppShell /> : <Navigate to="/login" replace />}
          >
            <Route index element={<DashboardPage />} />
            <Route path="reminders" element={<RemindersPage />} />
            <Route path="rules" element={<RulesPage />} />
            <Route path="channels" element={<ChannelsPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route
            path="*"
            element={<Navigate to={user ? '/' : '/login'} replace />}
          />
        </Routes>
      </BrowserRouter>
    </AppContext.Provider>
  );
};
