import type { LucideIcon } from 'lucide-react';

type IconButtonProps = {
  icon: LucideIcon;
  onClick?: () => void;
  label: string;
  className?: string;
};

export default function IconButton({
  icon: Icon,
  onClick,
  label,
  className = '',
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon size={19} strokeWidth={1.6} />
    </button>
  );
}