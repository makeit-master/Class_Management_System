import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronRight,
  Menu,
  Search,
  ChevronDown,
  Settings,
  UserRound,
  LogOut,
  CheckCheck,
} from "lucide-react";

import { canAccessPage } from "../../auth/permissions";
import type { AuthUser } from "../../auth/auth-api";
import "./Header.css";

type HeaderProps = {
  pageTitle: string;
  onOpenNavigation?: () => void;
  onNavigate?: (page: string) => void;
  onLogout: () => void;
  user: AuthUser | null;
};

const subtitles: Record<string, string> = {
  Dashboard: "Here's what's happening at your school today.",
  Classes: "A little structure. A world of possibilities.",
  Students: "Every student, every milestone, all in one place.",
  "Student Detail": "A closer look at your student’s learning journey.",
  Teachers: "Meet the people making a difference.",
  Attendance: "Every day counts. Keep track of who’s here.",
  Reports: "Monthly attendance and tuition at a glance.",
  Grades: "Turn progress into possibility.",
  Schedule: "A clear view of the week ahead.",
  Settings: "Make ClassFlow work your way.",
  Login: "Welcome back to ClassFlow.",
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

export default function Header({
  pageTitle,
  onOpenNavigation,
  onNavigate,
  onLogout,
  user,
}: HeaderProps) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const matches = Object.keys(subtitles).filter(
    (name) =>
      name !== "Login" &&
      name !== "Student Detail" &&
      canAccessPage(user, name) &&
      name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [notifications, setNotifications] = useState(initialNotifications);

  const popoverRef = useRef<HTMLDivElement>(null);
  const unread = notifications.length;

  const userName = user?.fullName?.trim() || "Teacher";
  const userInitial = Array.from(userName)[0]?.toUpperCase() || "T";
  const userRole = user?.role === "ADMIN" ? "Administrator" : "Teacher account";

  useEffect(() => {
    if (!openMenu) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const goTo = (page: string) => {
    setQuery("");
    onNavigate?.(page);
    setOpenMenu(null);
  };

  const handleLogout = () => {
    setOpenMenu(null);
    onLogout();
  };

  return (
    <header className="app-header">
      <div className="header-leading">
        {onOpenNavigation && (
          <button
            type="button"
            className="header-menu-button"
            aria-label="Open navigation"
            onClick={onOpenNavigation}
          >
            <Menu size={22} />
          </button>
        )}
        <div className="header-title">
          <div className="header-breadcrumb">
            Workspace <ChevronRight size={12} /> {pageTitle}
          </div>
          <h1>{pageTitle}</h1>
          <p>{subtitles[pageTitle]}</p>
        </div>
      </div>

      <div className="header-actions">
        <div
          className="search-box"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setQuery("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
        >
          <Search size={18} aria-hidden="true" />
          <input
            ref={search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && query.trim() && matches.length)
                goTo(matches[0]);
            }}
            type="search"
            aria-label="Search"
            placeholder="Search anything..."
          />
          <kbd className="search-shortcut">Ctrl K</kbd>
          {query.trim() && (
            <section className="search-pages" aria-label="Matching pages">
              {matches.length ? (
                matches.map((name) => (
                  <button type="button" key={name} onClick={() => goTo(name)}>
                    {name}
                  </button>
                ))
              ) : (
                <p>No matching pages</p>
              )}
            </section>
          )}
        </div>

        <div className="header-popovers" ref={popoverRef}>
          {/* Notifications */}
          <div className="header-popover-anchor">
            <button
              type="button"
              className="header-icon-button"
              aria-label="Notifications"
              aria-haspopup="true"
              aria-expanded={openMenu === "notifications"}
              onClick={() =>
                setOpenMenu((previous) =>
                  previous === "notifications" ? null : "notifications",
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

                {notifications.length > 0 ? (
                  notifications.map((item) => (
                    <button
                      type="button"
                      className="header-notification"
                      key={item.id}
                      onClick={() => {
                        setNotifications((previous) =>
                          previous.filter(
                            (notification) => notification.id !== item.id,
                          ),
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

                {notifications.length > 0 && (
                  <button
                    type="button"
                    className="header-clear"
                    onClick={() => setNotifications([])}
                  >
                    <CheckCheck size={15} />
                    Mark all as read
                  </button>
                )}

                <p className="header-demo-caption">
                  Demo notifications, not connected to the API yet.
                </p>
              </section>
            )}
          </div>

          {/* User menu */}
          <div className="header-popover-anchor">
            <button
              type="button"
              className="header-user"
              aria-label="Open user menu"
              aria-haspopup="true"
              aria-expanded={openMenu === "user"}
              onClick={() =>
                setOpenMenu((previous) => (previous === "user" ? null : "user"))
              }
            >
              <span className="header-avatar">{userInitial}</span>
              <span className="header-user-name">{userName}</span>
              <ChevronDown size={16} />
            </button>

            {openMenu === "user" && (
              <section
                className="header-dropdown header-user-menu"
                aria-label="User menu"
              >
                <div className="header-user-heading">
                  <strong>{userName}</strong>
                  <small>{userRole}</small>
                </div>

                <button type="button" onClick={() => goTo("Settings")}>
                  <UserRound size={16} />
                  My profile
                </button>

                <button type="button" onClick={() => goTo("Settings")}>
                  <Settings size={16} />
                  Settings
                </button>

                <button type="button" onClick={handleLogout}>
                  <LogOut size={16} />
                  Sign out
                </button>
              </section>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
