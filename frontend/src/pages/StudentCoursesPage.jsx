import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";
import { navigate } from "../services/navigation.js";
import { useAuth } from "../context/AuthContext.jsx";
import { StudentPortalHeader } from "../components/StudentPortalHeader.jsx";
import "./StudentCoursesPage.css";

const routeFor = (path) => {
  const [pathname, query = ""] = path.split("?");
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "cart") return { mode: "cart" };
  if (parts[0] === "wishlist") return { mode: "wishlist" };
  if (parts[0] === "my-courses") return { mode: "enrolled" };
  if (parts[0] === "learn") return { mode: "lesson", courseId: parts[1], lessonId: parts[2] };
  if (parts[0] === "courses" && parts[1]) return { mode: "detail", courseId: parts[1] };
  return { mode: "catalog", search: new URLSearchParams(query).get("search") || "" };
};

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.querySelector("script[data-skillbridge-razorpay]");
    if (!script) {
      script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.dataset.skillbridgeRazorpay = "true";
      document.body.appendChild(script);
    }
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Unable to load secure checkout. Check your internet connection and try again.")), { once: true });
  });
}

function CourseCard({ course, enrolled = false, onSelect, wishlisted = false, onToggleWishlist, wishlistBusy = false }) {
  return <article className="learning-course-card">
    <button type="button" className="learning-course-art" onClick={onSelect} aria-label={`View ${course.title}`}>
      {course.thumbnail ? <img src={course.thumbnail} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span>{(course.category || "Course").slice(0, 1).toUpperCase()}</span>}
      <small>{course.category || "General"}</small>
    </button>
    <div className="learning-course-body">
      <div className="learning-course-meta"><span>{course.level}</span><span>{course.lessonCount || 0} lessons</span></div>
      <h2><button type="button" onClick={onSelect}>{course.title}</button></h2>
      <p>{course.description}</p>
      <div className="learning-course-bottom"><span>{course.instructor || "SkillBridge Instructor"}</span><strong>{course.isFree || Number(course.price) === 0 ? "Free" : `₹${Number(course.price).toLocaleString("en-IN")}`}</strong></div>
      <div className="learning-card-actions"><button type="button" className="learning-card-action" onClick={onSelect}>{enrolled ? "Continue learning" : "View course"}</button>{onToggleWishlist && <button type="button" className={`learning-card-wishlist${wishlisted ? " is-saved" : ""}`} onClick={onToggleWishlist} disabled={wishlistBusy} aria-pressed={wishlisted}>{wishlistBusy ? "Saving…" : wishlisted ? "♥ Saved" : "♡ Wishlist"}</button>}</div>
    </div>
  </article>;
}

export function StudentCoursesPage({ path, logout }) {
  const { user } = useAuth();
  const route = useMemo(() => routeFor(path), [path]);
  const [courses, setCourses] = useState([]);
  const [wishlistIds, setWishlistIds] = useState(() => new Set());
  const [wishlistBusyIds, setWishlistBusyIds] = useState(() => new Set());
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponMessage, setCouponMessage] = useState("");
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [lesson, setLesson] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [search, setSearch] = useState(route.search || "");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        if (route.mode === "catalog") {
          const params = new URLSearchParams({ limit: "40", page: String(page) });
          if (search.trim()) params.set("search", search.trim());
          const data = await api(`/courses?${params}`, { method: "GET", auth: true });
          let wishlistData = { courses: [] };
          try { wishlistData = await api("/wishlist", { method: "GET", auth: true }); } catch { /* Keep course browsing available if the optional saved-list request fails. */ }
          if (active) { setCourses(data.courses || []); setTotalPages(data.pagination?.totalPages || 1); setWishlistIds(new Set((wishlistData.courses || []).map((item) => item.id || item._id))); }
        } else if (route.mode === "wishlist") {
          const data = await api("/wishlist", { method: "GET", auth: true });
          if (active) { const saved = data.courses || []; setCourses(saved); setWishlistIds(new Set(saved.map((item) => item.id || item._id))); }
        } else if (route.mode === "cart") {
          const data = await api("/cart", { method: "GET", auth: true });
          if (active) setCart({ items: data.items || [], total: Number(data.total) || 0 });
        } else if (route.mode === "enrolled") {
          const data = await api("/enrollments", { method: "GET", auth: true });
          if (active) setCourses((data.enrollments || []).map((item) => ({ ...item.course, isEnrolled: true, progressCount: item.completedLessons?.length || 0 })));
        } else if (route.mode === "detail") {
          const data = await api(`/courses/${encodeURIComponent(route.courseId)}`, { method: "GET", auth: true });
          if (active) { setCourse({ ...data.course, quizAvailable: data.quizAvailable, enrollment: data.enrollment }); setModules(data.modules || []); setEnrolled(Boolean(data.isEnrolled)); }
        } else if (route.mode === "lesson") {
          const data = await api(`/lessons/${encodeURIComponent(route.lessonId)}`, { method: "GET", auth: true });
          if (active) { setLesson(data.lesson); setEnrolled(Boolean(data.isEnrolled)); }
        }
      } catch (loadError) {
        if (active) setError(loadError.message || "Unable to load courses.");
      } finally {
        if (active) setLoading(false);
      }
    }, route.mode === "catalog" ? 180 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [route.mode, route.courseId, route.lessonId, search, page]);

  const categories = useMemo(() => ["all", ...new Set(courses.map((item) => item.category).filter(Boolean))], [courses]);
  const visibleCourses = filter === "all" ? courses : courses.filter((item) => item.category === filter);
  const courseLessons = modules.flatMap((module) => module.lessons || []);
  const nextLesson = courseLessons.find((item) => !item.isCompleted);

  async function addToCart(courseId) {
    setBusy(true);
    setError("");
    try {
      const data = await api("/cart/items", { method: "POST", auth: true, body: { courseId } });
      setNotice(data.message || "Course added to your cart.");
    } catch (cartError) {
      setError(cartError.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeFromCart(courseId) {
    setBusy(true);
    setError("");
    try {
      await api(`/cart/items/${encodeURIComponent(courseId)}`, { method: "DELETE", auth: true });
      setCart((current) => {
        const items = current.items.filter((item) => item.id !== courseId);
        return { items, total: items.reduce((sum, item) => sum + (item.isFree ? 0 : Number(item.price) || 0), 0) };
      });
      setAppliedCoupon(null);
      setCouponCode("");
      setCouponMessage("Cart changed. Apply your coupon again if you still want to use it.");
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleWishlist(courseId) {
    const isSaved = wishlistIds.has(courseId);
    setWishlistBusyIds((current) => new Set(current).add(courseId));
    setError("");
    try {
      const result = await api(`/wishlist/${encodeURIComponent(courseId)}`, { method: isSaved ? "DELETE" : "POST", auth: true });
      setWishlistIds((current) => { const next = new Set(current); if (isSaved) next.delete(courseId); else next.add(courseId); return next; });
      if (route.mode === "wishlist" && isSaved) setCourses((current) => current.filter((item) => (item.id || item._id) !== courseId));
      setNotice(result.message || (isSaved ? "Course removed from your wishlist." : "Course added to your wishlist."));
    } catch (wishlistError) {
      setError(wishlistError.message || "Unable to update your wishlist.");
    } finally {
      setWishlistBusyIds((current) => { const next = new Set(current); next.delete(courseId); return next; });
    }
  }

  async function applyCoupon(event) {
    event.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) { setCouponMessage("Enter a coupon code."); return; }
    setCouponBusy(true);
    setCouponMessage("");
    try {
      const data = await api("/payments/coupons/validate", { method: "POST", auth: true, body: { code } });
      setAppliedCoupon(data);
      setCouponCode(data.coupon?.code || code);
      setCouponMessage(data.message || "Coupon applied.");
    } catch (couponError) {
      setAppliedCoupon(null);
      setCouponMessage(couponError.message || "Unable to apply this coupon.");
    } finally { setCouponBusy(false); }
  }

  async function checkout() {
    if (busy || !cart.items.length) return;
    setBusy(true);
    setError("");
    try {
      const currentTotalPaise = appliedCoupon?.totalPaise ?? Math.round(cart.total * 100);
      if (currentTotalPaise > 0) await loadRazorpayCheckout();
      const order = await api("/payments/orders", { method: "POST", auth: true, body: { couponCode: appliedCoupon?.coupon?.code || "" } });
      if (order.free) {
        setNotice(order.message || "You are enrolled in your free course(s).");
        navigate("/my-courses");
        return;
      }
      const checkoutWindow = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "SkillBridge",
        description: (order.courseNames || []).join(", ").slice(0, 255),
        order_id: order.orderId,
        prefill: { name: user?.name || "", email: user?.email || "" },
        theme: { color: "#5145e8" },
        handler: async (paymentResponse) => {
          try {
            const result = await api("/payments/verify", { method: "POST", auth: true, body: paymentResponse });
            setNotice(result.message || "Payment confirmed. Your courses are ready.");
            navigate("/my-courses");
          } catch (verifyError) {
            setError(verifyError.message || "Payment needs confirmation. Refresh My Courses before retrying.");
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkoutWindow.open();
    } catch (checkoutError) {
      setError(checkoutError.message || "Unable to start checkout.");
      setBusy(false);
    }
  }

  async function completeLesson() {
    if (!lesson || !enrolled) return;
    setBusy(true);
    try {
      await api(`/lessons/${encodeURIComponent(lesson.id || lesson._id)}/complete`, { method: "POST", auth: true, body: {} });
      setLesson((current) => current ? { ...current, isCompleted: true } : current);
      setNotice("Lesson marked complete.");
    } catch (completeError) {
      setError(completeError.message);
    } finally {
      setBusy(false);
    }
  }

  let content;
  if (route.mode === "catalog" || route.mode === "enrolled" || route.mode === "wishlist") {
    content = <>
      <section className="learning-page-title"><div><span>SKILLBRIDGE LEARNING</span><h1>{route.mode === "enrolled" ? "My courses" : route.mode === "wishlist" ? "My wishlist" : "Explore courses"}</h1><p>{route.mode === "enrolled" ? "Pick up where you left off." : route.mode === "wishlist" ? "Courses you saved to come back to." : "Find a course and start learning at your own pace."}</p></div>{route.mode === "catalog" && <label className="learning-search"><span>⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search courses" aria-label="Search courses" /></label>}</section>
      {route.mode === "catalog" && categories.length > 1 && <div className="learning-filters">{categories.map((category) => <button type="button" key={category} className={filter === category ? "active" : ""} onClick={() => setFilter(category)}>{category === "all" ? "All courses" : category}</button>)}</div>}
      {notice && <p className="learning-notice" role="status">{notice}</p>}{error && <p className="learning-inline-error" role="alert">{error}</p>}
      {loading ? <div className="learning-state">{route.mode === "wishlist" ? "Loading your wishlist…" : "Loading courses…"}</div> : error ? <div className="learning-state error">{error}</div> : visibleCourses.length ? <><div className="learning-course-grid">{visibleCourses.map((item) => { const id = item.id || item._id; return <CourseCard key={id} course={item} enrolled={route.mode === "enrolled"} wishlisted={wishlistIds.has(id)} wishlistBusy={wishlistBusyIds.has(id)} onToggleWishlist={route.mode === "catalog" || route.mode === "wishlist" ? () => toggleWishlist(id) : undefined} onSelect={() => navigate(`/courses/${id}`)} />; })}</div>{route.mode === "catalog" && totalPages > 1 && <div className="learning-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>← Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next →</button></div>}</> : <div className="learning-state">{route.mode === "enrolled" ? <>You are not enrolled in any courses yet. Browse the catalog to get started.<a href="#/courses">Browse courses</a></> : route.mode === "wishlist" ? <>Your wishlist is empty.<a href="#/courses">Browse courses</a></> : "No courses found. Try another search."}</div>}
    </>;
  } else if (route.mode === "detail") {
    content = loading ? <div className="learning-state">Loading course…</div> : error ? <div className="learning-state error">{error}</div> : course && <>
      <button type="button" className="learning-back" onClick={() => navigate("/courses")}>← Back to courses</button>
      <section className="course-detail-hero"><div><span>{course.category} · {course.level}</span><h1>{course.title}</h1><p>{course.description}</p><small>Instructor: {course.instructor || "SkillBridge Instructor"}</small><div className="course-detail-actions">{enrolled ? <button type="button" onClick={() => { if (nextLesson) navigate(`/learn/${course.id || course._id}/${nextLesson.id}`); }} disabled={!nextLesson}>{nextLesson ? "Continue learning" : courseLessons.length ? "Lessons complete" : "Lessons coming soon"}</button> : <button type="button" onClick={() => addToCart(course.id || course._id)} disabled={busy}>{busy ? "Adding…" : "Add to cart"}</button>}{enrolled && course.quizAvailable && <button type="button" onClick={() => navigate(`/quiz/${course.id || course._id}`)}>{course.enrollment?.quizPassedAt ? "Review quiz" : "Take course quiz"}</button>}{enrolled && course.enrollment?.certificateCode && <button type="button" onClick={() => navigate(`/certificate/${course.enrollment.certificateCode}`)}>View certificate</button>}<strong>{course.isFree || Number(course.price) === 0 ? "Free" : `₹${Number(course.price).toLocaleString("en-IN")}`}</strong></div>{notice && <p className="learning-notice" role="status">{notice} <a href="#/cart">View cart</a></p>}{error && <p className="learning-inline-error" role="alert">{error}</p>}</div><div className="course-detail-art">{course.thumbnail ? <img src={course.thumbnail} alt="" /> : <span>{(course.category || "S").slice(0, 1)}</span>}</div></section>
      <section className="course-curriculum"><div className="course-curriculum-head"><div><span>COURSE CONTENT</span><h2>Lessons</h2></div><small>{modules.reduce((total, item) => total + (item.lessons?.length || 0), 0)} lessons</small></div>{modules.length ? modules.map((module) => <article className="course-module" key={module.id}><h3>{module.title}</h3>{module.lessons?.length ? module.lessons.map((item) => <button type="button" className="course-lesson-row" key={item.id} onClick={() => item.isPreview || enrolled ? navigate(`/learn/${course.id || course._id}/${item.id}`) : setError("Enroll in the course to access this lesson.")}><span className="course-lesson-icon">{item.type === "article" ? "▤" : "▶"}</span><span>{item.title}<small>{item.type} · {item.durationMin || 0} min{item.isPreview ? " · Preview" : ""}</small></span><b>{item.isCompleted ? "✓" : item.isPreview || enrolled ? "Open" : "🔒"}</b></button>) : <p className="course-empty-lessons">Lessons will be added to this module.</p>}</article>) : <div className="learning-state">No lessons have been added yet.</div>}</section>
    </>;
  } else if (route.mode === "cart") {
    content = <>
      <section className="learning-page-title"><div><span>SKILLBRIDGE LEARNING</span><h1>Your cart</h1><p>Review your courses and continue to secure checkout.</p></div></section>
      {loading ? <div className="learning-state">Loading your cart…</div> : error && !cart.items.length ? <div className="learning-state error">{error}</div> : !cart.items.length ? <div className="learning-state">Your cart is empty.<a href="#/courses">Browse courses</a></div> : <section className="student-cart-layout">
        <div className="student-cart-items">{cart.items.map((item) => <article className="student-cart-item" key={item.id}><div className="student-cart-image">{item.thumbnail ? <img src={item.thumbnail} alt="" /> : <span>{(item.category || "C").slice(0, 1)}</span>}</div><div className="student-cart-copy"><span>{item.category || "Course"} · {item.level}</span><h2>{item.title}</h2><small>{item.instructor || "SkillBridge Instructor"}</small></div><strong>{item.isFree || Number(item.price) === 0 ? "Free" : "₹" + Number(item.price).toLocaleString("en-IN")}</strong><button type="button" className="student-cart-remove" disabled={busy} onClick={() => removeFromCart(item.id)}>Remove</button></article>)}</div>
        <aside className="student-cart-summary"><h2>Order summary</h2><div><span>Subtotal · {cart.items.length} course{cart.items.length === 1 ? "" : "s"}</span><strong>₹{cart.total.toLocaleString("en-IN")}</strong></div>{appliedCoupon && <div className="student-cart-discount"><span>Coupon {appliedCoupon.coupon?.code}</span><strong>−₹{(appliedCoupon.discountPaise / 100).toLocaleString("en-IN")}</strong></div>}<div className="student-cart-total"><span>Total</span><strong>₹{((appliedCoupon?.totalPaise ?? Math.round(cart.total * 100)) / 100).toLocaleString("en-IN")}</strong></div>
        <form className="student-coupon-form" onSubmit={applyCoupon}><label htmlFor="student-coupon-code">Have a coupon?</label><div><input id="student-coupon-code" value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); setAppliedCoupon(null); setCouponMessage(""); }} placeholder="Enter code" maxLength={32} /><button type="submit" disabled={couponBusy || !couponCode.trim()}>{couponBusy ? "Checking…" : appliedCoupon ? "Apply again" : "Apply"}</button></div></form>
        {couponMessage && <p className={appliedCoupon ? "student-coupon-message success" : "student-coupon-message"} role="status">{couponMessage}</p>}<p>{(appliedCoupon?.totalPaise ?? Math.round(cart.total * 100)) > 0 ? "Payments are securely handled by Razorpay." : "This checkout has no payment due."}</p>{error && <p className="learning-inline-error" role="alert">{error}</p>}<button type="button" disabled={busy} onClick={checkout}>{busy ? "Starting checkout…" : (appliedCoupon?.totalPaise ?? Math.round(cart.total * 100)) > 0 ? "Continue to payment" : "Complete enrollment"}</button></aside>
      </section>}
    </>;
  } else {
    content = loading ? <div className="learning-state">Opening lesson…</div> : error ? <div className="learning-state error">{error}<a href="#/courses">Return to courses</a></div> : lesson && <>
      <button type="button" className="learning-back" onClick={() => navigate(`/courses/${route.courseId}`)}>← Back to {lesson.courseTitle}</button>
      <section className="lesson-player-page"><div className="lesson-player-heading"><span>{lesson.courseTitle}</span><h1>{lesson.title}</h1><small>{lesson.type} · {lesson.durationMin || 0} min</small></div>{lesson.type === "article" ? <article className="lesson-article">{lesson.content}</article> : <div className="lesson-video">{/^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/i.test(lesson.videoUrl || "") ? <iframe src={lesson.videoUrl.includes("youtu.be/") ? `https://www.youtube-nocookie.com/embed/${lesson.videoUrl.split("youtu.be/")[1].split(/[?&]/)[0]}` : `https://www.youtube-nocookie.com/embed/${new URL(lesson.videoUrl).searchParams.get("v")}`} title={lesson.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <video controls src={lesson.videoUrl}>Your browser does not support this video.</video>}</div>}<div className="lesson-player-actions">{lesson.previousLessonId && <button type="button" className="secondary" onClick={() => navigate(`/learn/${route.courseId}/${lesson.previousLessonId}`)}>← Previous lesson</button>}<span />{enrolled && <button type="button" onClick={completeLesson} disabled={busy || lesson.isCompleted}>{busy ? "Saving…" : lesson.isCompleted ? "Completed ✓" : "Mark complete"}</button>}{lesson.nextLessonId && <button type="button" className="secondary" onClick={() => navigate(`/learn/${route.courseId}/${lesson.nextLessonId}`)}>Next lesson →</button>}</div></section>
    </>;
  }

  const activeHeader = route.mode === "wishlist" ? "wishlist" : route.mode === "enrolled" ? "enrolled" : ["catalog", "detail", "lesson"].includes(route.mode) ? "courses" : "";
  return <div className="learning-portal"><StudentPortalHeader active={activeHeader} onLogout={logout}/><main className="learning-content">{content}</main></div>;
}
