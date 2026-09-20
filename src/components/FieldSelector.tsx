import { FieldOption } from '../types';

interface FieldSelectorProps {
  label: string;
  fields: FieldOption[];
  value?: string;
  disabled?: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}

export function FieldSelector({
  label,
  fields,
  value,
  disabled,
  placeholder,
  onChange,
}: FieldSelectorProps) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {fields.map((field) => (
          <option key={field.id} value={field.id}>
            {field.name}
          </option>
        ))}
      </select>
    </label>
  );
}
