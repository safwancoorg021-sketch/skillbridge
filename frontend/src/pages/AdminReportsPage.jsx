import { useEffect, useState } from "react";
import { AdminLayout } from "../components/AdminLayout.jsx";
import { api } from "../services/api.js";
import { formatDate } from "../services/formatters.js";
import "./AdminCommercePages.css";

const formatRupees = (paise) => "₹" + (Number(paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const monthLabel = (value) => new Date(Number(value.year), Number(value.month) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

export function AdminReportsPage({ logout }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api("/admin/commerce/reports", { method: "GET", auth: true })
      .then((data) => { if (active) setReport(data.report || null); })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const monthly = report?.monthlyRevenue || [];
  const maximumRevenue = Math.max(1, ...monthly.map((item) => item.revenuePaise || 0));

  return <AdminLayout logout={logout} active="reports">
    <div className="page-head"><div><div className="crumb-small">Admin Portal &gt; <strong>Reports</strong></div><h1>Reports & analytics</h1><p>Live enrollment, course, and collected payment totals.</p></div></div>
    {error && <div className="admin-course-message error" role="alert">{error}</div>}
    <section className="commerce-report-grid" aria-label="Platform summary">
      <article className="commerce-report-card"><span>Student accounts</span><strong>{loading ? "—" : report?.students ?? 0}</strong><small>Registered students</small></article>
      <article className="commerce-report-card"><span>Course enrollments</span><strong>{loading ? "—" : report?.enrollments ?? 0}</strong><small>Active and completed enrollments</small></article>
      <article className="commerce-report-card"><span>Published courses</span><strong>{loading ? "—" : report?.publishedCourses ?? 0}</strong><small>{report?.totalCourses ?? 0} total courses</small></article>
      <article className="commerce-report-card"><span>Collected revenue</span><strong>{loading ? "—" : formatRupees(report?.revenuePaise)}</strong><small>{report?.paidOrders ?? 0} paid orders</small></article>
    </section>
    <div className="commerce-report-grid-two">
      <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Revenue by month</h2><p>Successful payment records for the last six months.</p></div></div>
        {loading ? <div className="admin-profile-loading">Loading report…</div> : !monthly.length ? <div className="admin-profile-loading">No paid checkouts in this period yet.</div> : monthly.map((item) => <div className="commerce-month-row" key={item._id.year + "-" + item._id.month}><span>{monthLabel(item._id)}</span><div className="commerce-month-track"><span style={{ width: Math.max(3, Math.round((item.revenuePaise / maximumRevenue) * 100)) + "%" }} /></div><strong>{formatRupees(item.revenuePaise)}</strong></div>)}
      </section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Recent successful payments</h2><p>Latest confirmed checkouts.</p></div></div>
        {loading ? <div className="admin-profile-loading">Loading…</div> : !report?.recentPayments?.length ? <div className="admin-profile-loading">No successful payments yet.</div> : <div className="commerce-record-list">{report.recentPayments.map((payment) => <article className="commerce-record" key={payment._id}><div><strong>{payment.student?.name || "Deleted student"}</strong><small>{payment.items?.map((item) => item.title).join(", ") || "Course purchase"}</small><small>{formatDate(payment.paidAt)}</small></div><strong>{formatRupees(payment.amountPaise)}</strong></article>)}</div>}
      </section>
    </div>
  </AdminLayout>;
}
