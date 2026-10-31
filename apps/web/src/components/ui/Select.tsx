import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

type SelectProps = {
  children: ReactNode;
  value?: string;
  onChange?: (value: string) => void;
};

export default function Select({
  children,
  value,
  onChange,
}: SelectProps) {
  return (
    <div className="select-wrap">
      <select
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {children}
      </select>

      <ChevronDown size={14} />
    </div>
  );
}