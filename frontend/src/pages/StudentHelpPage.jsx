import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";
import { StudentPortalHeader } from "../components/StudentPortalHeader.jsx";
import { formatDate } from "../services/formatters.js";
import "./StudentCoursesPage.css";
import "./StudentPages.css";
import "./StudentHelpPage.css";

const categoryLabels = { account: "Account", course: "Course", payment: "Payment", technical: "Technical issue", other: "Other" };
const statusLabels = { open: "Open", in_progress: "In progress", resolved: "Resolved" };

export function StudentHelpPage({ logout }) {
  const [tickets, setTickets] = useState([]);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("other");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/support", { method: "GET", auth: true });
      setTickets(data.tickets || []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load your support requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
    window.addEventListener("focus", loadTickets);
    return () => window.removeEventListener("focus", loadTickets);
  }, [loadTickets]);

  async function submitRequest(event) {
    event.preventDefault();
    setSending(true);
    setError("");
    setNotice("");
    try {
      const data = await api("/support", { method: "POST", auth: true, body: { subject, category, message } });
      setTickets((current) => [data.ticket, ...current]);
      setSubject("");
      setCategory("other");
      setMessage("");
      setNotice(data.message || "Your support request was sent.");
    } catch (sendError) {
      setError(sendError.message || "Unable to send your support request.");
    } finally {
      setSending(false);
    }
  }

  return <div className="learning-portal">
    <StudentPortalHeader active="help" onLogout={logout} />
    <main className="learning-content student-help-content">
      <section className="learning-page-title"><div><span>STUDENT SUPPORT</span><h1>Help & support</h1><p>Send us a question and follow replies from the SkillBridge team.</p></div></section>
      {error && <p className="student-help-message error" role="alert">{error}</p>}
      {notice && <p className="student-help-message success" role="status">{notice}</p>}
      <div className="student-help-layout">
        <form className="student-help-form" onSubmit={submitRequest}>
          <div><h2>Send a support request</h2><p>Include enough detail so our team can help you.</p></div>
          <label><span>Subject</span><input required minLength="3" maxLength="120" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What do you need help with?" /></label>
          <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="account">Account</option><option value="course">Course</option><option value="payment">Payment</option><option value="technical">Technical issue</option><option value="other">Other</option></select></label>
          <label><span>Details</span><textarea required minLength="10" maxLength="2000" rows="6" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe what happened and what you need help with." /><small>{message.length}/2000 characters</small></label>
          <button type="submit" disabled={sending || subject.trim().length < 3 || message.trim().length < 10}>{sending ? "Sending request…" : "Send request"}</button>
        </form>
        <section className="student-help-requests" aria-label="Your support requests">
          <div className="student-help-requests-heading"><div><h2>Your requests</h2><p>Replies and status updates appear here.</p></div><span>{tickets.length}</span></div>
          {loading ? <div className="student-help-empty" role="status">Loading your requests…</div> : !tickets.length ? <div className="student-help-empty">You haven’t sent a support request yet.</div> : <div className="student-help-ticket-list">{tickets.map((ticket) => <article className="student-help-ticket" key={ticket._id}>
            <div className="student-help-ticket-head"><div><span>{categoryLabels[ticket.category] || "Other"} · {formatDate(ticket.createdAt)}</span><h3>{ticket.subject}</h3></div><span className={`student-help-status ${ticket.status}`}>{statusLabels[ticket.status] || "Open"}</span></div>
            <p className="student-help-ticket-message">{ticket.message}</p>
            {ticket.adminReply && <div className="student-help-reply"><strong>SkillBridge support replied</strong><small>{ticket.adminRespondedAt ? formatDate(ticket.adminRespondedAt) : ""}</small><p>{ticket.adminReply}</p></div>}
          </article>)}</div>}
        </section>
      </div>
    </main>
  </div>;
}
