import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Search,
  ChevronDown,
  Settings,
  UserRound,
  LogOut,
  CheckCheck,
} from "lucide-react";
import "./Header.css";

type HeaderProps = {
  pageTitle: string;
  onNavigate?: (page: string) => void;
};

type OpenMenu = "notifications" | "user" | null;
const initialNotifications = [
  {
    id: 1,
    title: "Attendance report is ready",
    detail: "Review today's attendance summary",
    page: "Attendance",
  },
  {
    id: 2,
    title: "Grades need review",
    detail: "Check recent grade updates",
    page: "Grades",
  },
  {
    id: 3,
    title: "Class schedule",
    detail: "View your upcoming lessons",
    page: "Schedule",
  },
];

export default function Header({ pageTitle, onNavigate }: HeaderProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [notifications, setNotifications] = useState(initialNotifications);
  const popoverRef = useRef<HTMLDivElement>(null);
  const unread = notifications.length;

  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node))
        setOpenMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  const goTo = (page: string) => {
    onNavigate?.(page);
    setOpenMenu(null);
  };

  return (
    <header className="app-header">
      <div className="header-title">
        <h1>{pageTitle}</h1>
        <p>Welcome back! Here's what's happening today.</p>
      </div>
      <div className="header-actions">
        <div className="search-box">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search"
            placeholder="Search anything..."
          />
          <span className="search-shortcut">Search</span>
        </div>
        <div className="header-popovers" ref={popoverRef}>
          <div className="header-popover-anchor">
            <button
              type="button"
              className="header-icon-button"
              aria-label="Notifications"
              aria-haspopup="true"
              aria-expanded={openMenu === "notifications"}
              onClick={() =>
                setOpenMenu((p) =>
                  p === "notifications" ? null : "notifications",
                )
              }
            >
              <Bell size={19} />
              {unread > 0 && <span className="notification-dot" />}
            </button>
            {openMenu === "notifications" && (
              <section
                className="header-dropdown notifications-menu"
                aria-label="Notifications"
              >
                <div className="header-dropdown-heading">
                  <strong>Notifications</strong>
                  <span>{unread} new</span>
                </div>
                {notifications.length ? (
                  notifications.map((item) => (
                    <button
                      type="button"
                      className="header-notification"
                      key={item.id}
                      onClick={() => {
                        setNotifications((p) =>
                          p.filter((n) => n.id !== item.id),
                        );
                        goTo(item.page);
                      }}
                    >
                      <span className="header-unread-dot" />
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="header-empty">You're all caught up.</p>
                )}
                {!!notifications.length && (
                  <button
                    type="button"
                    className="header-clear"
                    onClick={() => setNotifications([])}
                  >
                    <CheckCheck size={15} /> Mark all as read
                  </button>
                )}
                <p className="header-demo-caption">
                  Demo notifications, not connected to the API yet.
                </p>
              </section>
            )}
          </div>
          <div className="header-popover-anchor">
            <button
              type="button"
              className="header-user"
              aria-label="Open user menu"
              aria-haspopup="true"
              aria-expanded={openMenu === "user"}
              onClick={() => setOpenMenu((p) => (p === "user" ? null : "user"))}
            >
              <span className="header-avatar">A</span>
              <ChevronDown size={16} />
            </button>
            {openMenu === "user" && (
              <section
                className="header-dropdown header-user-menu"
                aria-label="User menu"
              >
                <div className="header-user-heading">
                  <strong>Admin User</strong>
                  <small>Teacher account · Demo</small>
                </div>
                <button type="button" onClick={() => goTo("Settings")}>
                  <UserRound size={16} /> My profile
                </button>
                <button type="button" onClick={() => goTo("Settings")}>
                  <Settings size={16} /> Settings
                </button>
                <button
                  type="button"
                  disabled
                  title="Authentication not implemented yet"
                >
                  <LogOut size={16} /> Sign out (coming soon)
                </button>
              </section>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
