import type { ReactNode } from 'react';

type BadgeProps = {
  children: ReactNode;
  tone?: string;
};

export default function Badge({
  children,
  tone = 'green',
}: BadgeProps) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}