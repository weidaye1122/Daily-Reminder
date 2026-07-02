interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export const StatCard = ({ label, value, hint }: StatCardProps) => (
  <section className="stat-card">
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    {hint ? <div className="stat-hint">{hint}</div> : null}
  </section>
);
