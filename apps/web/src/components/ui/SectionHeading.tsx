import type { ReactNode } from 'react';

type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export default function SectionHeading({
  title,
  subtitle,
  action,
}: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <div>
        <h3>{title}</h3>

        {subtitle && <p>{subtitle}</p>}
      </div>

      {action}
    </div>
  );
}