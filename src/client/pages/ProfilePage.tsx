import { useAppContext } from '../lib/app-context';

export const ProfilePage = () => {
  const { user } = useAppContext();

  return (
    <div className="page-stack">
      <section className="card form-grid">
        <div className="tip-box">当前账号：{user?.username}</div>
        <p className="muted">
          用户名和密码由部署环境变量管理。修改 `DEFAULT_ADMIN_USERNAME` 和
          `DEFAULT_ADMIN_PASSWORD` 后重启服务即可生效。
        </p>
      </section>
    </div>
  );
};
