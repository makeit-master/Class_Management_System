import type { ReactNode } from "react";

type PageToolbarProps = {
  title: ReactNode;
  subtitle: string;
  children?: ReactNode;
};

export default function PageToolbar({
  title,
  subtitle,
  children,
}: PageToolbarProps) {
  return (
    <header className="page-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children && <div className="page-heading-actions">{children}</div>}
    </header>
  );
}
