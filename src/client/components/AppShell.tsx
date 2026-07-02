import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../lib/app-context';

const navItems = [
  { to: '/', label: '仪表盘', end: true },
  { to: '/reminders', label: '提醒管理' },
  { to: '/rules', label: '提醒规则' },
  { to: '/channels', label: '通知渠道' },
  { to: '/logs', label: '消息日志' },
  { to: '/settings', label: '系统设置' },
  { to: '/profile', label: '个人设置' }
];

const pageSubtitles: Record<string, string> = {
  '/': '提醒概览、推送状态和最近消息日志',
  '/reminders': '管理提醒事项、日期规则和推送渠道',
  '/rules': '查看公历、农历和重复提醒的计算规则',
  '/channels': '配置 Bark 与企业微信通知渠道',
  '/logs': '查看提醒推送记录和失败原因',
  '/settings': '调整默认提醒时间、时区和日志保留策略',
  '/profile': '修改账号密码和登录安全设置'
};

export const AppShell = () => {
  const { user, logout } = useAppContext();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeNavItem =
    navItems.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    ) ?? navItems[0];

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <img className="brand-logo" src="/brand/logo-512.png" alt="日程提醒助手" />
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <button
            type="button"
            className="ghost-button mobile-only"
            onClick={() => setMobileMenuOpen((value) => !value)}
          >
            菜单
          </button>
          <div className="topbar-title-wrap">
            <div className="topbar-title">
              <h1>{activeNavItem.label}</h1>
              <p>{pageSubtitles[activeNavItem.to]}</p>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="user-pill">
              <strong>{user?.username}</strong>
            </div>
            <button type="button" className="secondary-button" onClick={handleLogout}>
              退出登录
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
