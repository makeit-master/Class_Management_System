import { useState, type ReactNode } from "react";
import DashboardPage from "../../features/dashboard/DashboardPage";
import Sidebar from "./Sidebar";
import Header from "./Header";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [activePage, setActivePage] = useState("Dashboard");
  const [isDark, setIsDark] = useState(true);

  const handleNavigate = (page: string) => {
    setActivePage(page);
  };

  const handleToggleTheme = () => {
    setIsDark((previous) => !previous);
  };

  const handleNotify = (message: string) => {
    window.alert(message);
  };

  return (
    <div className={`app-container ${isDark ? "dark-theme" : "light-theme"}`}>
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
      />

      <div className="app-main">
        <Header pageTitle={activePage} />

        <main className="main-content">
          {activePage === "Dashboard" ? (
            <DashboardPage navigate={handleNavigate} notify={handleNotify} />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
