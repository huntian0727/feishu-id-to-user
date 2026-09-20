import { ConversionRange } from '../types';

interface ConvertOptionsProps {
  range: ConversionRange;
  skipExisting: boolean;
  disabled?: boolean;
  onRangeChange: (range: ConversionRange) => void;
  onSkipExistingChange: (skip: boolean) => void;
}

export function ConvertOptions({
  range,
  skipExisting,
  disabled,
  onRangeChange,
  onSkipExistingChange,
}: ConvertOptionsProps) {
  return (
    <fieldset className="option-group" disabled={disabled}>
      <legend>转换范围</legend>
      <label>
        <input
          type="radio"
          name="conversion-range"
          checked={range === 'currentView'}
          onChange={() => onRangeChange('currentView')}
        />
        当前视图
      </label>
      <label>
        <input
          type="radio"
          name="conversion-range"
          checked={range === 'allRecords'}
          onChange={() => onRangeChange('allRecords')}
        />
        全部记录
      </label>
      <label>
        <input
          type="checkbox"
          checked={skipExisting}
          onChange={(event) => onSkipExistingChange(event.target.checked)}
        />
        目标已有人员时跳过
      </label>
    </fieldset>
  );
}
