
import { Bell, Search, ChevronDown } from "lucide-react";

type HeaderProps = {
  pageTitle: string;
};

export default function Header({ pageTitle }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-title">
        <h1>{pageTitle}</h1>
        <p>Welcome back! Here's what's happening today.</p>
      </div>

      <div className="header-actions">
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Search anything..." />
          <span className="search-shortcut">⌘ K</span>
        </div>

        <button className="icon-button" aria-label="Notifications">
          <Bell size={19} />
          <span className="notification-dot" />
        </button>

        <button className="header-user">
          <div className="header-avatar">A</div>
          <ChevronDown size={16} />
        </button>
      </div>
    </header>
  );
}
