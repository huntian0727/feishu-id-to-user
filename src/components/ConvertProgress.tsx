import { ConvertStats } from '../types';

export function ConvertProgress({ stats }: { stats: ConvertStats }) {
  const completed = stats.success + stats.skipped + stats.failed;
  const percentage = stats.total === 0 ? 0 : Math.round((completed / stats.total) * 100);

  return (
    <section className="progress-panel" aria-live="polite">
      <strong>正在转换</strong>
      <span>{completed} / {stats.total}</span>
      <div className="progress-track">
        <div className="progress-value" style={{ width: `${percentage}%` }} />
      </div>
      <span>{percentage}%</span>
    </section>
  );
}
