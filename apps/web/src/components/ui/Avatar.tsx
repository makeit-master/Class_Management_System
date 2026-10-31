import type { ReactNode } from 'react';

type AvatarProps = {
  name?: string;
  color?: string;
  size?: string;
  children?: ReactNode;
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

export default function Avatar({
  name = 'Admin User',
  color = 'violet',
  size = '',
  children,
}: AvatarProps) {
  return (
    <span className={`avatar ${color} ${size}`}>
      {children || getInitials(name)}
    </span>
  );
}