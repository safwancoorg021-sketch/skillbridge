import { useAuth } from "../context/AuthContext.jsx";
import { initials } from "../services/formatters.js";
import { Icon } from "./AuthComponents.jsx";
import { ProfileAvatar } from "./ProfileAvatar.jsx";
import { SkillBridgeLogo } from "./SkillBridgeLogo.jsx";
import "./AdminPages.css";

export function AdminLayout({ children, logout, active = "students" }) {
  const { user } = useAuth();
  const adminName = user?.name || "Admin";

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <SkillBridgeLogo size="small" />
          <span className="admin-pill">ADMIN</span>
        </div>
        <div className="nav-label">Management</div>
        <nav className="side-nav" aria-label="Admin navigation">
          <a className={"side-link" + (active === "dashboard" ? " active" : "")} href="#/admin/dashboard"><Icon name="grid" /><span>Dashboard</span></a>
          <a className={"side-link" + (active === "students" ? " active" : "")} href="#/admin/users"><Icon name="people" /><span>Students</span></a>
          <a className={"side-link" + (active === "courses" ? " active" : "")} href="#/admin/courses"><Icon name="book" /><span>Courses</span></a>
          <a className={"side-link" + (active === "payments" ? " active" : "")} href="#/admin/payments"><Icon name="card" /><span>Payments</span></a>
          <a className={"side-link" + (active === "offers" ? " active" : "")} href="#/admin/offers"><Icon name="tag" /><span>Offers & coupons</span></a>
          <a className={"side-link" + (active === "reports" ? " active" : "")} href="#/admin/reports"><Icon name="chart" /><span>Reports</span></a>
          <a className={"side-link" + (active === "support" ? " active" : "")} href="#/admin/support"><span>◉</span><span>Support</span></a>
          <a className={"side-link" + (active === "profile" ? " active" : "")} href="#/admin/profile"><Icon name="settings" /><span>Profile</span></a>
        </nav>
        <div className="admin-account">
          <a className="admin-account-link" href="#/admin/profile" title="Open admin profile">
            <ProfileAvatar profileImage={user?.profileImage} initials={initials(adminName)} className="avatar" />
            <span className="admin-account-copy"><strong>{adminName}</strong><small>System Admin · Profile</small></span>
          </a>
          <button type="button" className="icon-button" aria-label="Sign out" onClick={logout}><Icon name="logout" /></button>
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar portal-blue-header">
          <span className="breadcrumbs">Admin Portal &gt; <strong>{active === "dashboard" ? "Dashboard" : active === "profile" ? "Profile" : active === "courses" ? "Courses" : active === "payments" ? "Payments" : active === "offers" ? "Offers & coupons" : active === "reports" ? "Reports" : active === "support" ? "Support" : "Students"}</strong></span>
          <span className="top-status">● AP-SOUTH-1 · Operational</span>
          <a className="admin-top-profile" href="#/admin/profile" title={"Open " + adminName + " profile"}><ProfileAvatar profileImage={user?.profileImage} initials={initials(adminName)} className="avatar" /></a>
        </header>
        <div className="admin-content">{children}<footer className="admin-footer">© 2026 SkillBridge Inc. Administrative portal.<span>Security policy · Compliance · System status</span></footer></div>
      </section>
    </main>
  );
}

export function Stat({ label, value, note }) {
  return <article className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}


