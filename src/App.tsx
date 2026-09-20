import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { ConvertOptions } from './components/ConvertOptions';
import { ConvertProgress } from './components/ConvertProgress';
import { FieldSelector } from './components/FieldSelector';
import { ResultPanel } from './components/ResultPanel';
import { checkAuthSession, startOAuth } from './services/authService';
import { convertRecords, getActiveFieldOptions } from './services/bitableService';
import { AppStatus, ConvertOptions as ConvertOptionsType, ConvertResult, ConvertStats, FieldOption } from './types';

const emptyStats: ConvertStats = { total: 0, success: 0, skipped: 0, failed: 0 };

export default function App() {
  const [status, setStatus] = useState<AppStatus>('loading');
  const [textFields, setTextFields] = useState<FieldOption[]>([]);
  const [userFields, setUserFields] = useState<FieldOption[]>([]);
  const [options, setOptions] = useState<ConvertOptionsType>({
    sourceFieldId: '',
    targetFieldId: '',
    createTargetField: false,
    newFieldName: '人员',
    range: 'currentView',
    skipExisting: true,
  });
  const [stats, setStats] = useState<ConvertStats>(emptyStats);
  const [result, setResult] = useState<ConvertResult>();
  const [message, setMessage] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const isConverting = status === 'converting';
  const canStart = useMemo(
    () => Boolean(authenticated && options.sourceFieldId && (options.createTargetField || options.targetFieldId)),
    [authenticated, options],
  );

  const refreshFields = async () => {
    setStatus('loading');
    setMessage('');
    try {
      const fields = await getActiveFieldOptions();
      setTextFields(fields.textFields);
      setUserFields(fields.userFields);
      setOptions((current) => ({
        ...current,
        sourceFieldId: fields.textFields.some((field) => field.id === current.sourceFieldId)
          ? current.sourceFieldId
          : '',
        targetFieldId: fields.userFields.some((field) => field.id === current.targetFieldId)
          ? current.targetFieldId
          : '',
      }));
      setStatus('ready');
    } catch (error) {
      console.error('Failed to load fields', error);
      setMessage('无法读取当前数据表字段，请确认插件已在多维表格中打开。');
      setStatus('error');
    }
  };

  useEffect(() => {
    void refreshFields();
    void checkAuthSession()
      .then(setAuthenticated)
      .finally(() => setAuthChecking(false));
  }, []);

  const authorize = async () => {
    setMessage('');
    try {
      await startOAuth();
      setAuthenticated(true);
      setMessage('飞书授权成功，可以开始转换。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '飞书授权失败。');
    }
  };

  const updateOption = <K extends keyof ConvertOptionsType>(key: K, value: ConvertOptionsType[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const startConversion = async () => {
    if (!canStart || isConverting) {
      return;
    }
    if (!options.createTargetField && !options.skipExisting) {
      const confirmed = window.confirm('将覆盖目标字段中的已有人员信息。是否继续？');
      if (!confirmed) {
        return;
      }
    }

    setStatus('converting');
    setStats(emptyStats);
    setResult(undefined);
    setMessage('');

    try {
      const conversionResult = await convertRecords(options, setStats);
      setResult(conversionResult);
      setStatus('completed');
      if (options.createTargetField) {
        await refreshFields();
      }
    } catch (error) {
      console.error('Conversion failed', error);
      setMessage(error instanceof Error ? error.message : '转换失败，请稍后重试。');
      setStatus('error');
    }
  };

  const copyFailures = async () => {
    if (!result) {
      return;
    }
    const content = result.failedRecords
      .map((record) => `记录 ${record.recordId}\n内容：${record.rawValue}\n原因：${record.reason}`)
      .join('\n\n');
    await navigator.clipboard.writeText(content);
    setMessage('失败记录已复制到剪贴板。');
  };

  return (
    <main className="app-shell">
      <header>
        <h1>ID 转人员</h1>
        <p>将文本字段中的飞书 User ID 写入真正的人员字段。</p>
      </header>

      {message && <div className="notice" role="alert">{message}</div>}

      <section className={`auth-panel ${authenticated ? 'authenticated' : ''}`}>
        <div>
          <strong>飞书授权</strong>
          <p>{authChecking ? '正在检测...' : authenticated ? '已授权' : '首次使用需要授权'}</p>
        </div>
        {!authenticated && !authChecking && (
          <button type="button" className="primary-button" onClick={() => void authorize()}>
            授权并登录
          </button>
        )}
      </section>

      <FieldSelector
        label="ID 来源字段"
        fields={textFields}
        value={options.sourceFieldId}
        disabled={isConverting || status === 'loading'}
        placeholder={textFields.length ? '请选择文本字段' : '未找到文本字段'}
        onChange={(value) => updateOption('sourceFieldId', value)}
      />

      <section className="target-section">
        <div className="section-label">目标人员字段</div>
        <label className="inline-option">
          <input
            type="radio"
            checked={!options.createTargetField}
            disabled={isConverting}
            onChange={() => updateOption('createTargetField', false)}
          />
          使用已有人员字段
        </label>
        <label className="inline-option">
          <input
            type="radio"
            checked={options.createTargetField}
            disabled={isConverting}
            onChange={() => updateOption('createTargetField', true)}
          />
          新建人员字段
        </label>
        {options.createTargetField ? (
          <label className="form-field compact-field">
            <span>字段名称</span>
            <input
              value={options.newFieldName}
              disabled={isConverting}
              onChange={(event: ChangeEvent<HTMLInputElement>) => updateOption('newFieldName', event.target.value)}
              placeholder="例如：申请人"
            />
          </label>
        ) : (
          <FieldSelector
            label=""
            fields={userFields}
            value={options.targetFieldId}
            disabled={isConverting || status === 'loading'}
            placeholder={userFields.length ? '请选择人员字段' : '未找到人员字段'}
            onChange={(value) => updateOption('targetFieldId', value)}
          />
        )}
      </section>

      <ConvertOptions
        range={options.range}
        skipExisting={options.skipExisting}
        disabled={isConverting}
        onRangeChange={(range) => updateOption('range', range)}
        onSkipExistingChange={(skip) => updateOption('skipExisting', skip)}
      />

      {isConverting && <ConvertProgress stats={stats} />}

      <div className="actions">
        <button type="button" className="secondary-button" onClick={() => void refreshFields()} disabled={isConverting}>
          刷新字段
        </button>
        <button type="button" className="primary-button" onClick={() => void startConversion()} disabled={!canStart || isConverting}>
          {isConverting ? '转换中...' : '开始转换'}
        </button>
      </div>

      {result && <ResultPanel result={result} onCopyFailures={() => void copyFailures()} />}
    </main>
  );
}
