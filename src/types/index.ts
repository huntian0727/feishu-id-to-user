export type ConversionRange = 'currentView' | 'allRecords';

export type AppStatus = 'loading' | 'ready' | 'converting' | 'completed' | 'error';

export interface FieldOption {
  id: string;
  name: string;
}

export interface ConvertOptions {
  sourceFieldId: string;
  targetFieldId?: string;
  createTargetField: boolean;
  newFieldName: string;
  range: ConversionRange;
  skipExisting: boolean;
}

export interface ConvertStats {
  total: number;
  success: number;
  skipped: number;
  failed: number;
}

export interface FailedRecord {
  recordId: string;
  rawValue: string;
  reason: string;
}

export interface ConvertResult {
  stats: ConvertStats;
  failedRecords: FailedRecord[];
}
