import { Menu, LogOut, UserCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import HealthIndicator from "./HealthIndicator";

export default function Topbar({ onToggle }) {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={onToggle} aria-label="Toggle menu">
        <Menu size={20} />
      </button>
      <div className="topbar-title">Admin Dashboard</div>
      <div className="topbar-right">
        <HealthIndicator />
        <span className="user-chip">
          <UserCircle size={18} />
          <span className="user-name">{user?.username}</span>
        </span>
        <button className="btn btn-ghost btn-sm" onClick={logout}>
          <LogOut size={16} /> Logout
        </button>
      </div>
    </header>
  );
}
