import type { ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export const Drawer = ({ open, title, onClose, children }: DrawerProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer-panel" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-header">
          <div>
            <h2>{title}</h2>
            <p>保存后会立即回到提醒列表。</p>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
};
