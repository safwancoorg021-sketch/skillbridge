import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../components/AdminLayout.jsx";
import { api } from "../services/api.js";
import { formatDate } from "../services/formatters.js";
import "./AdminCommercePages.css";
import "./AdminSupportPage.css";

export function AdminSupportPage({ logout }) {
  const [tickets, setTickets] = useState([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api(`/admin/support?status=${encodeURIComponent(status)}`, { method: "GET", auth: true });
      setTickets(data.tickets || []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load support requests.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  async function updateTicket(ticket, changes) {
    setSavingId(ticket._id);
    setError("");
    setNotice("");
    try {
      const data = await api(`/admin/support/${encodeURIComponent(ticket._id)}`, { method: "PATCH", auth: true, body: changes });
      setTickets((current) => current.map((item) => item._id === ticket._id ? data.ticket : item));
      if (changes.adminReply !== undefined) setDrafts((current) => ({ ...current, [ticket._id]: data.ticket.adminReply || "" }));
      setNotice(data.message || "Support request updated.");
    } catch (updateError) {
      setError(updateError.message || "Unable to update this support request.");
    } finally {
      setSavingId("");
    }
  }

  const visibleTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((ticket) => [ticket.subject, ticket.message, ticket.student?.name, ticket.student?.email, ticket.category].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [tickets, search]);

  return <AdminLayout logout={logout} active="support">
    <div className="page-head"><div><div className="crumb-small">Admin Portal &gt; <strong>Support</strong></div><h1>Student support</h1><p>Review student requests, update their status, and send replies.</p></div></div>
    <section className="admin-panel admin-support-toolbar">
      <label><span>Search requests</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student, subject, or message" /></label>
      <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All requests</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label>
      <strong>{visibleTickets.length} request{visibleTickets.length === 1 ? "" : "s"}</strong>
    </section>
    {error && <div className="admin-course-message error" role="alert">{error}<button type="button" onClick={loadTickets}>Try again</button></div>}
    {notice && <div className="admin-course-message success" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
    {loading ? <div className="admin-panel admin-support-empty" role="status">Loading support requests…</div> : !visibleTickets.length ? <div className="admin-panel admin-support-empty">No support requests match this view.</div> : <section className="admin-support-list" aria-label="Student support requests">
      {visibleTickets.map((ticket) => <article className="admin-panel admin-support-ticket" key={ticket._id}>
        <div className="admin-support-ticket-head">
          <div><span className="admin-support-category">{ticket.category}</span><h2>{ticket.subject}</h2><p>{ticket.student?.name || "Deleted student"} · {ticket.student?.email || "—"} · {formatDate(ticket.createdAt)}</p></div>
          <label className="admin-support-status"><span>Status</span><select value={ticket.status} disabled={savingId === ticket._id} onChange={(event) => updateTicket(ticket, { status: event.target.value })}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label>
        </div>
        <p className="admin-support-message">{ticket.message}</p>
        <form className="admin-support-reply" onSubmit={(event) => { event.preventDefault(); updateTicket(ticket, { adminReply: drafts[ticket._id] ?? ticket.adminReply ?? "" }); }}>
          <label htmlFor={`support-reply-${ticket._id}`}>Reply to student</label>
          <textarea id={`support-reply-${ticket._id}`} rows="3" maxLength="2000" value={drafts[ticket._id] ?? ticket.adminReply ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [ticket._id]: event.target.value }))} placeholder="Write a response the student can see in Help & support." />
          <div><small>{ticket.adminRespondedAt ? `Last replied ${formatDate(ticket.adminRespondedAt)}` : "No reply sent yet"}</small><button type="submit" className="primary-button button-small" disabled={savingId === ticket._id || !(drafts[ticket._id] ?? ticket.adminReply ?? "").trim()}>{savingId === ticket._id ? "Saving…" : "Save reply"}</button></div>
        </form>
      </article>)}
    </section>}
  </AdminLayout>;
}
