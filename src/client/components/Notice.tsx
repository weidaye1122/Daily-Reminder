interface NoticeProps {
  tone?: 'info' | 'success' | 'error';
  message: string;
}

export const Notice = ({ tone = 'info', message }: NoticeProps) => (
  <div className={`notice notice-${tone}`}>{message}</div>
);
