import { useEffect, useState } from "react";
import { AdminLayout, Stat } from "../components/AdminLayout.jsx";
import { Icon } from "../components/AuthComponents.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { navigate } from "../services/navigation.js";
import { formatDate, initials } from "../services/formatters.js";


const emptySummary = {
  totalStudents: 0,
  verifiedStudents: 0,
  blockedStudents: 0,
  newStudentsThisMonth: 0,
};

export function AdminDashboard({ logout, onAuthFailure }) {
  const { user: admin, signOut } = useAuth();
  const [summary, setSummary] = useState(emptySummary);
  const [recentStudents, setRecentStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryFallback, setSummaryFallback] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    setSummaryFallback(false);

    async function loadDashboard() {
      try {
        const data = await api("/admin/users/summary", { method: "GET", auth: true });
        if (!active) return;
        setSummary({ ...emptySummary, ...(data.summary || {}) });
        setRecentStudents(data.recentStudents || []);
      } catch (summaryError) {
        if (!active) return;
        // Older backend processes may not have the summary route yet. Keep the
        // registrations list usable while the backend is being restarted.
        if (summaryError.status !== 404 && summaryError.status < 500) throw summaryError;

        const data = await api("/admin/users?page=1&limit=100", { method: "GET", auth: true });
        if (!active) return;
        const allStudents = [...(data.users || [])];
        const totalPages = data.pagination?.totalPages || 1;
        const remainingPages = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 2);
        const remainingData = await Promise.all(remainingPages.map((page) =>
          api(`/admin/users?page=${page}&limit=100`, { method: "GET", auth: true })
        ));
        if (!active) return;
        remainingData.forEach((pageData) => allStudents.push(...(pageData.users || [])));

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        setSummary({
          totalStudents: data.pagination?.totalUsers ?? allStudents.length,
          verifiedStudents: allStudents.filter((student) => student.isEmailVerified).length,
          blockedStudents: allStudents.filter((student) => student.isBlocked).length,
          newStudentsThisMonth: allStudents.filter((student) => new Date(student.createdAt) >= monthStart).length,
        });
        setRecentStudents(allStudents.slice(0, 6));
        setSummaryFallback(true);
      }
    }

    loadDashboard()
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message);
        if (/auth|required|session|token|blocked|permission/i.test(requestError.message)) {
          onAuthFailure(requestError.message);
          signOut();
          navigate("/admin/login");
        }
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [retry]);
  const verifiedPercent = summary.totalStudents
    ? Math.round((summary.verifiedStudents / summary.totalStudents) * 100)
    : 0;
  const displayName = (admin?.name || "Admin").trim().split(/\s+/)[0];

  return (
    <AdminLayout logout={logout} active="dashboard">
      <div className="page-head">
        <div>
          <div className="crumb-small">Admin Portal &gt; <strong>Overview</strong></div>
          <h1>Admin dashboard</h1>
          <p>Welcome back, {displayName}. Here’s the current view of your student community.</p>
        </div>
        <div className="head-actions">
          <a className="secondary-button button-small admin-dashboard-action" href="#/admin/users"><Icon name="people" size={15} />Manage students</a>
        </div>
      </div>

      <section className="stat-grid" aria-label="Student account summary">
        <Stat label="Registered students" value={loading ? "—" : summary.totalStudents} note="All student accounts" />
        <Stat label="Email verified" value={loading ? "—" : summary.verifiedStudents} note={summaryFallback ? "From student directory" : verifiedPercent + "% of registered students"} />
        <Stat label="Blocked accounts" value={loading ? "—" : summary.blockedStudents} note={summaryFallback ? "From student directory" : "Access currently restricted"} />
        <Stat label="New this month" value={loading ? "—" : summary.newStudentsThisMonth} note={summaryFallback ? "From student directory" : "Student registrations"} />
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-panel admin-recent-panel">
          <div className="admin-panel-heading">
            <div><h2>Recent registrations</h2><p>{summaryFallback ? "Loaded from the paginated student directory." : "Newest student accounts"}</p></div>
            <a href="#/admin/users">View directory <Icon name="arrow" size={14} /></a>
          </div>
          {error ? (
            <div className="empty-state admin-dashboard-error">{error}<br /><button type="button" className="inline-action" onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Try again</button></div>
          ) : loading ? (
            <div className="admin-dashboard-loading">Loading student summary…</div>
          ) : recentStudents.length === 0 ? (
            <div className="admin-dashboard-loading">No student accounts found. Admin accounts are excluded; register a student account to see recent registrations.</div>
          ) : (
            <div className="table-wrap">
              <table className="user-table admin-recent-table">
                <thead><tr><th>Student</th><th>Email address</th><th>Joined</th><th>Email status</th><th>Account status</th></tr></thead>
                <tbody>{recentStudents.map((student) => (
                  <tr key={student.id}>
                    <td><div className="student-cell"><span className="avatar">{initials(student.name)}</span><span><strong>{student.name}</strong><small>Student account</small></span></div></td>
                    <td>{student.email}</td>
                    <td>{formatDate(student.createdAt)}</td>
                    <td><span className={"status-badge " + (student.isEmailVerified ? "status-active" : "status-blocked")}>{student.isEmailVerified ? "Verified" : "Pending"}</span></td>
                    <td><span className={"status-badge " + (student.isBlocked ? "status-blocked" : "status-active")}>{student.isBlocked ? "Blocked" : "Active"}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="admin-dashboard-side">
          <section className="admin-panel admin-health-panel">
            <div className="admin-panel-heading"><div><h2>Account health</h2><p>Verification coverage</p></div><span className="admin-health-icon"><Icon name="shield" size={17} /></span></div>
            <div className="admin-health-number"><strong>{loading ? "—" : verifiedPercent + "%"}</strong><span>verified</span></div>
            <div className="admin-health-track"><span style={{ width: verifiedPercent + "%" }} /></div>
            <div className="admin-health-legend"><span><i className="verified" />Verified accounts</span><strong>{loading ? "—" : summary.verifiedStudents}</strong></div>
            <div className="admin-health-legend"><span><i className="blocked" />Blocked accounts</span><strong>{loading ? "—" : summary.blockedStudents}</strong></div>
          </section>

          <section className="admin-panel admin-shortcuts">
            <div className="admin-panel-heading"><div><h2>Quick actions</h2><p>Common admin tasks</p></div></div>
            <a href="#/admin/users"><span><Icon name="people" size={16} /></span><span><strong>Students directory</strong><small>Search and manage accounts</small></span><Icon name="arrow" size={14} /></a>
            <a href="#/admin/profile"><span><Icon name="settings" size={16} /></span><span><strong>Admin profile</strong><small>Update your account details</small></span><Icon name="arrow" size={14} /></a>
          </section>

          <section className="admin-dashboard-note"><span className="admin-dashboard-note-icon"><Icon name="shield" size={17} /></span><div><strong>Protected admin access</strong><p>Only administrator accounts can view student records or change account access.</p></div></section>
        </aside>
      </div>
    </AdminLayout>
  );
}



