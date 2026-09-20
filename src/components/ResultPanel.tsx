import { ConvertResult } from '../types';

interface ResultPanelProps {
  result: ConvertResult;
  onCopyFailures: () => void;
}

export function ResultPanel({ result, onCopyFailures }: ResultPanelProps) {
  const { stats, failedRecords } = result;

  return (
    <section className="result-panel" aria-live="polite">
      <h2>转换完成</h2>
      <div className="stats">
        <span>总记录：{stats.total}</span>
        <span>成功：{stats.success}</span>
        <span>跳过：{stats.skipped}</span>
        <span>失败：{stats.failed}</span>
      </div>
      {failedRecords.length > 0 && (
        <div className="failed-records">
          <div className="failed-header">
            <h3>失败记录</h3>
            <button type="button" className="link-button" onClick={onCopyFailures}>
              复制失败记录
            </button>
          </div>
          <ul>
            {failedRecords.slice(0, 20).map((record) => (
              <li key={record.recordId}>
                <strong>记录 {record.recordId}</strong>
                <span>内容：{record.rawValue || '空'}</span>
                <span>原因：{record.reason}</span>
              </li>
            ))}
          </ul>
          {failedRecords.length > 20 && <p>仅显示前 20 条失败记录。</p>}
        </div>
      )}
    </section>
  );
}
