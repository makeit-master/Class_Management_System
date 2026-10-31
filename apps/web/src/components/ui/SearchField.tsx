import { Search } from 'lucide-react';

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function SearchField({
  value,
  onChange,
  placeholder = 'Search students...',
}: SearchFieldProps) {
  return (
    <div className="search-field">
      <Search size={17} />

      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}