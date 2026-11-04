import { confirmAttendanceNavigation } from "../../lib/unsaved-changes";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import DashboardPage from "../../features/dashboard/DashboardPage";
import ClassesPage from "../../features/classes/ClassesPage";
import StudentsPage from "../../features/students/StudentsPage";
import TeachersPage from "../../features/teachers/TeachersPage";
import SessionListPage from "../../features/attendance/SessionListPage";
import SchedulePage from "../../features/schedule/SchedulePage";
import GradesPage from "../../features/grades/GradesPage";
import SettingsPage from "../../features/settings/SettingsPage";

import { canAccessPage } from "../../auth/permissions";
import { useAuth } from "../../auth/auth-context";

import Sidebar from "./Sidebar";
import Header from "./Header";

const mobileLayout = window.matchMedia("(max-width: 760px)");
function subscribeToLayout(listener: () => void) {
  mobileLayout.addEventListener("change", listener);
  return () => mobileLayout.removeEventListener("change", listener);
}

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [activePage, setActivePage] = useState("Dashboard");
  const [studentDetail, setStudentDetail] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const mobile = useSyncExternalStore(
    subscribeToLayout,
    () => mobileLayout.matches,
  );
  const drawer = useRef<HTMLDialogElement>(null);
  const { user, logout } = useAuth();

  const handleNavigate = (page: string) => {
    if (!canAccessPage(user, page)) {
      window.alert("You do not have permission to access this page.");
      return;
    }

    if (page !== activePage && !confirmAttendanceNavigation()) return;
    drawer.current?.close();
    if (page !== activePage) setStudentDetail(false);
    setActivePage(page);
  };

  const handleToggleTheme = () => {
    setIsDark((previous) => !previous);
  };

  const handleNotify = (message: string) => {
    window.alert(message);
  };

  const handleLogout = () => {
    if (!confirmAttendanceNavigation()) return;
    logout();
  };

  const renderPage = () => {
    if (!canAccessPage(user, activePage)) {
      return (
        <section role="alert" className="dashboard-placeholder">
          <h2>Access denied</h2>
          <p>You do not have permission to view this page.</p>
        </section>
      );
    }

    switch (activePage) {
      case "Dashboard":
        return (
          <DashboardPage navigate={handleNavigate} notify={handleNotify} />
        );

      case "Classes":
        return <ClassesPage />;

      case "Students":
        return <StudentsPage onDetailChange={setStudentDetail} />;

      case "Teachers":
        return <TeachersPage />;

      case "Attendance":
        return <SessionListPage />;

      case "Grades":
        return <GradesPage />;

      case "Schedule":
        return <SchedulePage />;

      case "Settings":
        return (
          <SettingsPage isDark={isDark} onToggleTheme={handleToggleTheme} />
        );

      default:
        return children;
    }
  };

  const sidebar = (
    <Sidebar
      onClose={mobile ? () => drawer.current?.close() : undefined}
      activePage={activePage}
      onNavigate={handleNavigate}
      isDark={isDark}
      onToggleTheme={handleToggleTheme}
      onLogout={handleLogout}
      user={user}
    />
  );
  return (
    <div className={`app-container ${isDark ? "dark-theme" : "light-theme"}`}>
      {mobile ? (
        <dialog
          ref={drawer}
          className="navigation-drawer"
          aria-label="Workspace navigation"
          onClick={(event) => {
            if (event.target === event.currentTarget) drawer.current?.close();
          }}
        >
          {sidebar}
        </dialog>
      ) : (
        sidebar
      )}

      <div className="app-main">
        <Header
          onOpenNavigation={
            mobile ? () => drawer.current?.showModal() : undefined
          }
          pageTitle={
            activePage === "Students" && studentDetail
              ? "Student Detail"
              : activePage
          }
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          user={user}
        />

        <main className="main-content">{renderPage()}</main>
      </div>
    </div>
  );
}
