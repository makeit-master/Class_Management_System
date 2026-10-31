import type { ReactNode } from 'react';

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
};

export default function Button({
  children,
  onClick,
  variant = 'secondary',
  className = '',
  type = 'button',
  disabled = false,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`button ${variant} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}