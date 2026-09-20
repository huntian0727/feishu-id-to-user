export type ErrorCode =
  | 'NO_PERMISSION'
  | 'INVALID_SOURCE_FIELD'
  | 'INVALID_TARGET_FIELD'
  | 'NO_OPEN_ID'
  | 'MULTIPLE_USER_NOT_ALLOWED'
  | 'WRITE_FAILED'
  | 'TABLE_CHANGED'
  | 'UNKNOWN_ERROR';

const errorMessages: Record<ErrorCode, string> = {
  NO_PERMISSION: '当前用户没有修改此多维表格的权限。',
  INVALID_SOURCE_FIELD: '请选择有效的文本来源字段。',
  INVALID_TARGET_FIELD: '请选择有效的人员目标字段。',
  NO_OPEN_ID: '未检测到可识别的飞书 User ID。',
  MULTIPLE_USER_NOT_ALLOWED: '该记录包含多个 Open ID，但目标人员字段仅允许单人。',
  WRITE_FAILED: '人员字段写入失败。',
  TABLE_CHANGED: '检测到当前数据表发生变化，请重新选择字段后再转换。',
  UNKNOWN_ERROR: '转换时发生未知错误，请稍后重试。',
};

export function getErrorMessage(code: ErrorCode): string {
  return errorMessages[code];
}

export function isPermissionError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /permission|denied|forbidden|权限/i.test(text);
}
