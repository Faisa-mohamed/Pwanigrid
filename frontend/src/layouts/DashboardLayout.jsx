import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false); // desktop: narrow sidebar
  const [mobileOpen, setMobileOpen] = useState(false); // phone: slide-in menu

  const toggle = () => {
    if (window.matchMedia("(max-width: 768px)").matches) setMobileOpen((o) => !o);
    else setCollapsed((c) => !c);
  };

  return (
    <div className={`app${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
      <Sidebar onNavigate={() => setMobileOpen(false)} />
      {mobileOpen && <div className="overlay" onClick={() => setMobileOpen(false)} />}
      <div className="main">
        <Topbar onToggle={toggle} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
