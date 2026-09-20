import {
  bitable,
  FieldType,
  ITable,
  ITextFieldMeta,
  IUserField,
  IUserFieldMeta,
} from '@lark-base-open/js-sdk';
import { ConvertOptions, ConvertResult, ConvertStats, FailedRecord, FieldOption } from '../types';
import { getErrorMessage, isPermissionError } from '../utils/errorHandler';
import { extractUserIds } from '../utils/openIdParser';
import { getAuthSession } from './authService';

const PAGE_SIZE = 200;
const WRITE_BATCH_SIZE = 50;

interface PendingWrite {
  recordId: string;
  rawValue: string;
  userIds: string[];
}

interface BaseApiResponse {
  code?: number | string;
  msg?: string;
  error?: {
    message?: string;
  };
}

function maskIdentifier(value: string): string {
  if (value.length <= 8) {
    return `${value.slice(0, 2)}***${value.slice(-2)} (${value.length})`;
  }
  return `${value.slice(0, 4)}***${value.slice(-4)} (${value.length})`;
}

function getBaseTokenFromUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    const configuredToken = url.searchParams.get('appToken');
    if (configuredToken) {
      return configuredToken;
    }
    return url.pathname.match(/\/(?:base|app)\/([^/?#]+)/)?.[1];
  } catch {
    return undefined;
  }
}

function resolveBaseToken(selectionBaseId: string): string {
  return getBaseTokenFromUrl(window.location.href)
    ?? getBaseTokenFromUrl(document.referrer)
    ?? selectionBaseId;
}

export async function getActiveFieldOptions(): Promise<{
  textFields: FieldOption[];
  userFields: FieldOption[];
}> {
  const table = await bitable.base.getActiveTable();
  const [textFields, userFields] = await Promise.all([
    table.getFieldMetaListByType<ITextFieldMeta>(FieldType.Text),
    table.getFieldMetaListByType<IUserFieldMeta>(FieldType.User),
  ]);

  return {
    textFields: textFields.map(({ id, name }) => ({ id, name })),
    userFields: userFields.map(({ id, name }) => ({ id, name })),
  };
}

export function normalizeTextFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((segment) => {
        if (typeof segment === 'string') {
          return segment;
        }
        if (segment && typeof segment === 'object' && 'text' in segment) {
          return String(segment.text ?? '');
        }
        return '';
      })
      .join('');
  }

  return String(value);
}

async function getAllRecords(table: ITable, viewId?: string) {
  const records = [];
  let pageToken: string | undefined;

  do {
    const response = await table.getRecords({
      pageSize: PAGE_SIZE,
      pageToken,
      viewId,
    });
    records.push(...response.records);
    pageToken = response.hasMore ? response.pageToken : undefined;
  } while (pageToken);

  return records;
}

async function resolveTargetField(table: ITable, options: ConvertOptions): Promise<IUserField> {
  if (options.createTargetField) {
    const name = options.newFieldName.trim();
    if (!name) {
      throw new Error(getErrorMessage('INVALID_TARGET_FIELD'));
    }

    const fieldId = await table.addField({
      type: FieldType.User,
      name,
      property: { multiple: true },
    });
    return table.getField<IUserField>(fieldId);
  }

  if (!options.targetFieldId) {
    throw new Error(getErrorMessage('INVALID_TARGET_FIELD'));
  }
  return table.getField<IUserField>(options.targetFieldId);
}

async function assertTableUnchanged(tableId: string): Promise<void> {
  const activeTable = await bitable.base.getActiveTable();
  const activeMeta = await activeTable.getMeta();
  if (activeMeta.id !== tableId) {
    throw new Error(getErrorMessage('TABLE_CHANGED'));
  }
}

async function writeUserIdBatch(
  baseToken: string,
  authSession: string,
  tableId: string,
  targetFieldName: string,
  writes: PendingWrite[],
): Promise<void> {
  const response = await fetch('/api/base/batch-update', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authSession}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      appToken: baseToken,
      tableId,
      targetFieldName,
      records: writes,
    }),
  });

  const responseText = await response.text();
  let payload: BaseApiResponse;
  try {
    payload = JSON.parse(responseText) as BaseApiResponse;
  } catch {
    payload = {};
  }
  if (!response.ok || payload.code !== 0) {
    const detail = payload.error?.message || payload.msg || responseText || getErrorMessage('WRITE_FAILED');
    throw new Error(
      `HTTP ${response.status} / code ${payload.code ?? '未知'}：${detail}`
      + `；app=${maskIdentifier(baseToken)}，table=${maskIdentifier(tableId)}`,
    );
  }
}

export async function convertRecords(
  options: ConvertOptions,
  onProgress: (stats: ConvertStats) => void,
): Promise<ConvertResult> {
  const table = await bitable.base.getActiveTable();
  const tableMeta = await table.getMeta();
  const selection = await bitable.base.getSelection();
  const editable = await bitable.base.isEditable();
  if (!editable) {
    throw new Error(getErrorMessage('NO_PERMISSION'));
  }
  if (!selection.baseId) {
    throw new Error(getErrorMessage('UNKNOWN_ERROR'));
  }
  const baseToken = resolveBaseToken(selection.baseId);
  const authSession = getAuthSession();
  if (!authSession) {
    throw new Error('请先完成飞书授权。');
  }

  const sourceMeta = await table.getFieldMetaById(options.sourceFieldId);
  if (sourceMeta.type !== FieldType.Text) {
    throw new Error(getErrorMessage('INVALID_SOURCE_FIELD'));
  }

  const view = options.range === 'currentView' ? await table.getActiveView() : undefined;
  const records = await getAllRecords(table, view?.id);
  const targetField = await resolveTargetField(table, options);
  const [targetMultiple, targetFieldName] = await Promise.all([
    targetField.getMultiple(),
    targetField.getName(),
  ]);
  const stats: ConvertStats = { total: records.length, success: 0, skipped: 0, failed: 0 };
  const failedRecords: FailedRecord[] = [];
  const writes: PendingWrite[] = [];

  for (const record of records) {
    const rawValue = normalizeTextFieldValue(record.fields[options.sourceFieldId]);
    const userIds = extractUserIds(rawValue);

    if (!rawValue.trim()) {
      stats.skipped += 1;
      continue;
    }
    if (userIds.length === 0) {
      stats.failed += 1;
      failedRecords.push({
        recordId: record.recordId,
        rawValue,
        reason: '未识别到有效的飞书 User ID。',
      });
      continue;
    }

    const currentUsers = await targetField.getValue(record.recordId);
    const hasExistingUsers = Array.isArray(currentUsers) && currentUsers.length > 0;
    if (options.skipExisting && hasExistingUsers) {
      stats.skipped += 1;
    } else if (!targetMultiple && userIds.length > 1) {
      stats.failed += 1;
      failedRecords.push({
        recordId: record.recordId,
        rawValue,
        reason: `该记录存在 ${userIds.length} 个用户 ID，但目标人员字段仅允许单人。`,
      });
    } else {
      writes.push({ recordId: record.recordId, rawValue, userIds });
    }
  }
  onProgress({ ...stats });

  for (let index = 0; index < writes.length; index += WRITE_BATCH_SIZE) {
    const batch = writes.slice(index, index + WRITE_BATCH_SIZE);
    await assertTableUnchanged(tableMeta.id);

    try {
      await writeUserIdBatch(baseToken, authSession, tableMeta.id, targetFieldName, batch);
      stats.success += batch.length;
    } catch (batchError) {
      console.error('Failed to write user ID batch', batchError);
      for (const write of batch) {
        try {
          await writeUserIdBatch(baseToken, authSession, tableMeta.id, targetFieldName, [write]);
          stats.success += 1;
        } catch (writeError) {
          console.error('Failed to write user ID', { recordId: write.recordId, writeError });
          stats.failed += 1;
          failedRecords.push({
            recordId: write.recordId,
            rawValue: write.rawValue,
            reason: isPermissionError(writeError)
              ? getErrorMessage('NO_PERMISSION')
              : writeError instanceof Error
                ? writeError.message
                : getErrorMessage('WRITE_FAILED'),
          });
        }
      }
    }

    onProgress({ ...stats });
  }

  return { stats, failedRecords };
}
