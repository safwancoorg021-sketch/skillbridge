import { useEffect, useState } from "react";
import { AdminLayout } from "../components/AdminLayout.jsx";
import { api } from "../services/api.js";
import { formatDate } from "../services/formatters.js";
import "./AdminCommercePages.css";

const formatRupees = (paise) => "₹" + (Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function AdminPaymentsPage({ logout, onAuthFailure }) {
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      try {
        const data = await api("/admin/commerce/payments?" + params, { method: "GET", auth: true });
        if (active) { setPayments(data.payments || []); setPagination(data.pagination || { totalPages: 1, total: 0 }); }
      } catch (loadError) {
        if (active) { setError(loadError.message); if ([401, 403].includes(loadError.status)) onAuthFailure(loadError.message); }
      } finally { if (active) setLoading(false); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [page, search, status, onAuthFailure]);

  return <AdminLayout logout={logout} active="payments">
    <div className="page-head"><div><div className="crumb-small">Admin Portal &gt; <strong>Payments</strong></div><h1>Payment records</h1><p>Review course checkouts and payment status.</p></div></div>
    <section className="admin-panel commerce-toolbar"><label><span>Search</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Student, email, order, or coupon" /></label><label><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All payments</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option></select></label><strong>{pagination.total || 0} records</strong></section>
    {error && <div className="admin-course-message error" role="alert">{error}</div>}
    <section className="admin-panel commerce-table-panel"><div className="commerce-table-scroll"><table className="user-table"><thead><tr><th>Student</th><th>Course(s)</th><th>Amount paid</th><th>Coupon</th><th>Provider</th><th>Status</th><th>Date</th></tr></thead><tbody>
      {!loading && payments.map((payment) => <tr key={payment._id}><td><strong>{payment.student?.name || "Deleted student"}</strong><small className="commerce-cell-subtitle">{payment.student?.email || "—"}</small></td><td>{(payment.items || []).map((item) => item.title).join(", ") || "—"}</td><td>{formatRupees(payment.amountPaise)}</td><td>{payment.couponCode || "—"}</td><td>{payment.provider === "razorpay" ? "Razorpay" : "Free"}</td><td><span className={"status-badge " + (payment.status === "paid" ? "status-active" : payment.status === "failed" ? "status-blocked" : "status-pending")}>{payment.status}</span></td><td>{formatDate(payment.paidAt || payment.createdAt)}</td></tr>)}
      </tbody></table></div>
      {loading ? <div className="admin-profile-loading">Loading payments…</div> : !payments.length && !error ? <div className="admin-profile-loading">No payment records match this filter.</div> : null}
    </section>
    {pagination.totalPages > 1 && <div className="learning-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Previous</button><span>Page {page} of {pagination.totalPages}</span><button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next →</button></div>}
  </AdminLayout>;
}
