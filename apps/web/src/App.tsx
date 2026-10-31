import AppLayout from "./components/layout/AppLayout";
import { useAuth } from "./auth/AuthContext";

function App() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    console.log("Logout button clicked!");
    logout();
  };

  return (
    <AppLayout>
      <div className="dashboard-placeholder">
        <h2>Dashboard</h2>

        <p>Welcome back, {user?.fullName ?? "Teacher"}!</p>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            padding: "12px 24px",
            cursor: "pointer",
            backgroundColor: "#7c3aed",
            color: "white",
            border: "none",
            borderRadius: "8px",
          }}
        >
          Logout
        </button>
      </div>
    </AppLayout>
  );
}

export default App;
