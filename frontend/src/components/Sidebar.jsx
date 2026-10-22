import { NavLink } from "react-router-dom";
import { LayoutDashboard, Gauge, KeyRound, ArrowLeftRight, Activity, Smartphone, Zap } from "lucide-react";

const links = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/meters", label: "Meters", icon: Gauge },
  { to: "/tokens", label: "Tokens", icon: KeyRound },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/reports", label: "Reports", icon: Activity },
  { to: "/ussd", label: "USSD", icon: Smartphone },
];

export default function Sidebar({ onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-icon">
          <Zap size={20} />
        </span>
        <span className="brand-text">PwaniGrid</span>
      </div>
      <nav className="nav">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            onClick={onNavigate}
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
          >
            <Icon size={20} />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot nav-label">
        Powering Communities.
        <br />
        Securing Every Token.
        <br />
        Even Offline.
      </div>
    </aside>
  );
}
