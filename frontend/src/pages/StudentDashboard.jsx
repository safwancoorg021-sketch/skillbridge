import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { StudentPortalHeader } from "../components/StudentPortalHeader.jsx";
import { navigate } from "../services/navigation.js";
import "./StudentDashboard.css";

const iconPaths = {
  cap: <><path d="m2 10 10-6 10 6-10 6-10-6Z" /><path d="M6 12v5c2.4 2 9.6 2 12 0v-5M22 10v6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h6" /></>,
  chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /><path d="M16 7h3v3" /></>,
  tag: <><path d="M20 13 13 20a2 2 0 0 1-2.8 0L3 12.8V4h8.8L19 11.2a2.5 2.5 0 0 1 1 1.8Z" /><circle cx="7.5" cy="8" r="1" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  award: <><circle cx="12" cy="8" r="6" /><path d="m8.2 13-1 8 4.8-2.8 4.8 2.8-1-8M10 8l1.3 1.3L14 6.8" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  bookmark: <path d="M6 4h12v17l-6-4-6 4V4Z" />,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.5-4.5m-7.5 7.4 7.5 4.5" /></>,
  cart: <><circle cx="9" cy="20" r="1" /><circle cx="19" cy="20" r="1" /><path d="M2 3h2l2.5 12.2a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 1.9-1.4L22 8H5" /></>,
  sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  exit: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};

function Icon({ name, size = 18, strokeWidth = 1.8, className = "" }) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name]}
    </svg>
  );
}

function SectionTitle({ children, action, onAction }) {
  return (
    <div className="student-section-title">
      <h2>{children}</h2>
      {action && <button type="button" className="student-text-link" onClick={onAction}>{action}<Icon name="arrow" size={15} /></button>}
    </div>
  );
}

export function StudentPage({ logout, onAuthFailure }) {
  const { user: account, signOut } = useAuth();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [notice, setNotice] = useState("");
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [popularCourses, setPopularCourses] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [enrollmentLoadError, setEnrollmentLoadError] = useState("");
  const [catalogLoadError, setCatalogLoadError] = useState("");
  const [dashboardRetry, setDashboardRetry] = useState(0);
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError, setOffersError] = useState("");

  useEffect(() => {
    api("/auth/me", { method: "GET", auth: true }).catch((error) => {
      onAuthFailure(error.message);
      signOut();
      navigate("/login");
    });
  }, []);

  const loadOffers = useCallback(async () => {
    setOffersLoading(true);
    setOffersError("");
    try {
      const data = await api("/offers", { method: "GET", auth: true });
      setOffers(data.offers || []);
    } catch (error) {
      setOffers([]);
      setOffersError(error.message || "Unable to load current offers.");
    } finally {
      setOffersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
    window.addEventListener("focus", loadOffers);
    return () => window.removeEventListener("focus", loadOffers);
  }, [loadOffers]);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchError("");
      setSearchLoading(false);
      return undefined;
    }
    setSearchResults([]);
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const data = await api(`/courses?limit=6&search=${encodeURIComponent(query)}`, { method: "GET", auth: true });
        if (active) setSearchResults(data.courses || []);
      } catch (error) {
        if (active) { setSearchResults([]); setSearchError(error.message || "Unable to search courses."); }
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search]);

  useEffect(() => {
    let active = true;
    setDashboardLoading(true);
    Promise.allSettled([
      api("/enrollments", { method: "GET", auth: true }),
      api("/courses?limit=40", { method: "GET", auth: true }),
    ]).then(([enrollmentResult, courseResult]) => {
      if (!active) return;
      if (enrollmentResult.status === "fulfilled") {
        setEnrollmentLoadError("");
        setEnrolledCourses((enrollmentResult.value.enrollments || []).map((item) => ({
          ...item.course,
          completedLessonCount: item.completedLessons?.length || 0,
          quizPassedAt: item.quizPassedAt || null,
          certificateCode: item.certificateCode || "",
        })));
      } else {
        setEnrollmentLoadError(enrollmentResult.reason?.message || "Unable to load learning progress.");
        setEnrolledCourses([]);
      }
      if (courseResult.status === "fulfilled") {
        setCatalogLoadError("");
        setPopularCourses(courseResult.value.courses || []);
      } else {
        setCatalogLoadError(courseResult.reason?.message || "Unable to load published courses.");
        setPopularCourses([]);
      }
      setDashboardLoading(false);
    });
    return () => { active = false; };
  }, [dashboardRetry]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const firstName = (account?.name || "Student").trim().split(/\s+/)[0];
  const completedCourseCount = enrolledCourses.filter((course) => Number(course.lessonCount) > 0 && course.completedLessonCount >= Number(course.lessonCount) && Boolean(course.quizPassedAt)).length;
  const certificateCount = enrolledCourses.filter((course) => Boolean(course.certificateCode)).length;
  const inProgressCount = enrolledCourses.filter((course) => Number(course.lessonCount) > 0 && !(course.completedLessonCount >= Number(course.lessonCount) && course.quizPassedAt)).length;
  const totalLessons = enrolledCourses.reduce((total, course) => total + (Number(course.lessonCount) || 0), 0);
  const completedLessons = enrolledCourses.reduce((total, course) => total + (Number(course.completedLessonCount) || 0), 0);
  const lessonProgress = totalLessons ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 0;
  const displayedCourses = (search.trim().length >= 2 ? searchResults : popularCourses).slice(0, 3);
  const enrolledCourseIds = new Set(enrolledCourses.map((course) => String(course.id || course._id)));
  const recommendedCourses = popularCourses.filter((course) => !enrolledCourseIds.has(String(course.id || course._id))).slice(0, 3);
  const openAllSearchResults = () => {
    const query = search.trim();
    if (query) navigate(`/courses?search=${encodeURIComponent(query)}`);
  };

  const enrollmentDataReady = !dashboardLoading && !enrollmentLoadError;

  return (
    <div className="student-app">
      <StudentPortalHeader
        active="dashboard"
        onLogout={logout}
        searchValue={search}
        onSearchChange={setSearch}
        searchResults={searchResults}
        searchLoading={searchLoading}
        searchError={searchError}
      />

      <main className="student-main">
        <section className="student-welcome">
          <div className="student-welcome-copy">
            <div className="student-welcome-badges">
              <span className="student-streak">✓ {dashboardLoading || enrollmentLoadError ? "—" : completedLessons} LESSONS COMPLETE</span>
              <span className="student-mentorship"><i />{dashboardLoading || enrollmentLoadError ? "Learning data unavailable" : `${enrolledCourses.length} course${enrolledCourses.length === 1 ? "" : "s"} in your learning plan`}</span>
            </div>
            <h1>Welcome back, {firstName}! <span aria-hidden="true"></span></h1>
            <p>{enrollmentLoadError ? "Your learning progress could not be loaded." : totalLessons ? `You have completed ${completedLessons} of ${totalLessons} lessons across your courses. Keep up the momentum!` : "Enroll in a course to start tracking your learning progress."}</p>
          </div>
          <div className="student-welcome-actions">
            <button className="student-primary-button" type="button" onClick={() => navigate("/courses")}>Browse Courses <Icon name="arrow" size={16} /></button>
            <button className="student-secondary-button" type="button" onClick={() => navigate("/my-courses")}><Icon name="cap" size={16} />My Courses</button>
          </div>
        </section>

        <section className="student-stats" aria-label="Learning summary">
          <article className="student-stat-card">
            <div><span>ENROLLED</span><strong>{enrollmentDataReady ? enrolledCourses.length : "—"}</strong><small>courses in your account</small></div>
            <span className="student-stat-icon lavender"><Icon name="cap" size={21} /></span>
          </article>
          <article className="student-stat-card">
            <div><span>IN PROGRESS</span><strong>{enrollmentDataReady ? inProgressCount : "—"}</strong><small className="text-amber">Based on lesson completion</small></div>
            <span className="student-stat-icon amber"><Icon name="clock" size={21} /></span>
          </article>
          <article className="student-stat-card">
            <div><span>COMPLETED</span><strong>{enrollmentDataReady ? completedCourseCount : "—"}</strong><small className="text-green">Lessons complete and quiz passed</small></div>
            <span className="student-stat-icon mint"><Icon name="check" size={21} /></span>
          </article>
          <article className="student-stat-card">
            <div><span>CERTIFICATES</span><strong>{enrollmentDataReady ? certificateCount : "—"}</strong><small>Issued after lessons and quiz</small><button type="button" className="student-stat-link" onClick={() => navigate("/progress")}>View certificates</button></div>
            <span className="student-stat-icon periwinkle"><Icon name="award" size={21} /></span>
          </article>
        </section>

        <section className="student-offer" id="student-offers" aria-labelledby="student-offers-title">
          <span className="student-offer-label">✨ STUDENT OFFERS</span>
          <h2 id="student-offers-title">Offers for your next course</h2>
          {offersLoading ? <p role="status">Loading current offers…</p> : offersError ? <p className="student-offer-error" role="alert">{offersError}</p> : !offers.length ? <p>No active offers right now. Published offers will appear here.</p> : <div className="student-offers-grid">{offers.map((offer) => <article className="student-live-offer" key={offer._id}>
            <strong>{offer.discountLabel} · {offer.title}</strong>
            <p>{offer.description}</p>
            <small>Valid until {new Date(offer.endsAt).toLocaleDateString("en-IN")}</small>
            {offer.couponCode && <div className="student-promo-code"><span>Code: {offer.couponCode}</span><button type="button" onClick={async () => {
              try { await navigator.clipboard.writeText(offer.couponCode); setNotice("Coupon code copied."); }
              catch { setNotice("Coupon code: " + offer.couponCode); }
            }}>Copy</button></div>}
          </article>)}</div>}
          <button type="button" className="student-offer-button" onClick={() => navigate("/courses")}>Browse courses <Icon name="arrow" size={15} /></button>
        </section>

        <div className="student-columns">
          <div className="student-left-column">
            <section className="student-section student-continue" aria-labelledby="continue-title">
              <SectionTitle action="View all courses" onAction={() => navigate("/my-courses")}><span id="continue-title">Continue Learning</span></SectionTitle>
              {dashboardLoading ? <div className="student-dashboard-empty" role="status">Loading your learning data…</div> : enrollmentLoadError ? <div className="student-dashboard-empty" role="alert">{enrollmentLoadError} <button type="button" onClick={() => setDashboardRetry((value) => value + 1)}>Try again</button></div> : enrolledCourses.length ? <div className="student-learning-list">
                {enrolledCourses.slice(0, 2).map((course) => {
                  const progress = course.lessonCount ? Math.min(100, Math.round((course.completedLessonCount / course.lessonCount) * 100)) : 0;
                  return <article key={course.id} className="student-learning-card blue">
                    <div className="student-learning-topline"><span className="student-course-label">{course.category || "COURSE"}</span><span className="student-time">{course.lessonCount || 0} lessons</span></div>
                    <h3>{course.title}</h3>
                    <p className="student-instructor">Instructor: {course.instructor || "SkillBridge Instructor"}</p>
                    <div className="student-progress-heading"><span>Course Progress</span><strong>{progress}% Completed</strong></div>
                    <div className="student-progress-track"><span style={{ width: progress + "%" }} /></div>
                    <div className="student-learning-actions"><button type="button" className="student-resume-button" onClick={() => navigate(`/courses/${course.id}`)}><Icon name="play" size={15} />Open course</button></div>
                  </article>;
                })}
              </div> : <div className="student-dashboard-empty">You haven’t enrolled in a course yet. <button type="button" onClick={() => navigate("/courses")}>Browse courses</button></div>}
            </section>

            <section className="student-section student-enrolled" id="student-enrolled">
              <SectionTitle action="View all" onAction={() => navigate("/my-courses")}>My Enrolled Courses</SectionTitle>
              <div className="student-enrolled-grid">
                {enrolledCourses.slice(0, 3).map((course) => {
                  const progress = course.lessonCount ? Math.min(100, Math.round((course.completedLessonCount / course.lessonCount) * 100)) : 0;
                  return <article className="student-enrolled-card" key={course.id}>
                    <div className="student-enrolled-top"><span className="student-status-pill lavender">Enrolled</span><span>{course.lessonCount || 0} lessons</span></div>
                    <h3>{course.title}</h3>
                    <div className="student-course-progress-row"><span>{progress}%</span><span>{course.completedLessonCount} completed</span></div>
                    <div className="student-mini-progress"><span className={progress === 100 ? "mint" : "lavender"} style={{ width: progress + "%" }} /></div>
                    <p className="student-course-next">{course.instructor || "SkillBridge Instructor"}</p>
                    {course.certificateCode && <button type="button" className="student-certificate-link" onClick={() => navigate(`/certificate/${course.certificateCode}`)}>View certificate</button>}
                  </article>;
                })}
                {!enrolledCourses.length && <div className="student-dashboard-empty">No courses enrolled yet. <button type="button" onClick={() => navigate("/courses")}>Browse the catalog</button></div>}
              </div>
            </section>

            <section className="student-section student-explore" id="student-explore">
              <SectionTitle action={search.trim().length >= 2 ? "View all results" : "View Catalog"} onAction={() => search.trim().length >= 2 ? openAllSearchResults() : navigate("/courses")}><span>{search.trim().length >= 2 ? "Search results" : "Explore Popular Courses"}</span></SectionTitle>
              <p className="student-section-subtitle">{search.trim().length >= 2 ? "Matches from the full published course catalog" : "Browse the complete course catalog"}</p>
              {search.trim().length >= 2 && <p className="student-search-result">{searchLoading ? "Searching all courses…" : searchError ? searchError : searchResults.length ? `Showing ${searchResults.length} matches from the full catalog` : `No courses match “${search.trim()}”`}</p>}
              {catalogLoadError ? <div className="student-dashboard-empty" role="alert">{catalogLoadError} <button type="button" onClick={() => setDashboardRetry((value) => value + 1)}>Try again</button></div> : <div className="student-popular-grid">
                {displayedCourses.map((course) => (
                  <article className="student-popular-card" key={course.id || course._id}>
                    <div className="student-course-art cloud">
                      {course.thumbnail ? <img src={course.thumbnail} alt="" /> : <span className="student-art-symbol">{(course.category || "S").slice(0, 1)}</span>}
                      <span className="student-course-art-label">{course.category || "COURSE"}</span>
                    </div>
                    <div className="student-popular-body">
                      <p className="student-rating"><span>{course.level || "Course"}</span><small>{course.lessonCount || 0} lessons</small></p>
                      <h3>{course.title}</h3>
                      <div className="student-popular-bottom">
                        <strong className={course.isFree || Number(course.price) === 0 ? "free" : ""}>{course.isFree || Number(course.price) === 0 ? "Free" : `₹${Number(course.price).toLocaleString("en-IN")}`}</strong>
                        <button type="button" className={course.isFree || Number(course.price) === 0 ? "student-join-button" : "student-enroll-button"} onClick={() => navigate(`/courses/${course.id}`)}>View course</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>}
              {!catalogLoadError && !displayedCourses.length && !searchLoading && <div className="student-dashboard-empty">{search.trim().length >= 2 ? "No courses match your search. Try another keyword or open the full catalog." : "No published courses yet. Check back after the admin publishes a course."}</div>}
            </section>
          </div>

          <aside className="student-right-column">
            <section className="student-widget student-activity" id="student-activity">
              <div className="student-widget-heading"><div><h2>Learning progress</h2><p>Based on your enrolled course lessons</p></div><span className="student-growth">{lessonProgress}%</span></div>
              <p className="student-hours"><strong>{enrollmentDataReady ? completedLessons : "—"}</strong><span>{enrollmentDataReady ? `of ${totalLessons} lessons complete` : "Progress data unavailable"}</span></p>
              <div className="student-goal-row"><span>{enrollmentDataReady ? `${completedCourseCount} course${completedCourseCount === 1 ? "" : "s"} completed` : "Course completion unavailable"}</span><strong>{enrollmentDataReady ? `${lessonProgress}% overall` : "—"}</strong></div>
              <div className="student-goal-track"><span style={{ width: enrollmentDataReady ? lessonProgress + "%" : "0%" }} /></div>
              {enrollmentDataReady && !totalLessons && <p className="student-progress-empty">Enroll in a course to start tracking your learning progress.</p>}
              {enrollmentLoadError && <p className="student-progress-empty" role="alert">{enrollmentLoadError} <button type="button" onClick={() => setDashboardRetry((value) => value + 1)}>Try again</button></p>}
            </section>

            <section className="student-widget student-recommendations">
              <div className="student-widget-heading"><h2>More courses to explore</h2><Icon name="sparkle" size={18} /></div>
              {dashboardLoading ? <p className="student-progress-empty" role="status">Loading published courses…</p> : catalogLoadError ? <p className="student-progress-empty" role="alert">{catalogLoadError}</p> : recommendedCourses.length ? recommendedCourses.map((course) => <button key={course.id || course._id} className="student-recommendation" type="button" onClick={() => navigate(`/courses/${course.id || course._id}`)}><span><strong>{course.title}</strong><small>{course.category || course.level || "Course"}<i>•</i>{course.lessonCount || 0} lessons<i>•</i>{course.isFree || Number(course.price) === 0 ? "Free" : `₹${Number(course.price).toLocaleString("en-IN")}`}</small></span><span className="student-save"><Icon name="arrow" size={16} /></span></button>) : <p className="student-progress-empty">{popularCourses.length ? "You’re enrolled in all published courses." : "No published courses are available yet."}</p>}
              <button className="student-career-link" type="button" onClick={() => navigate("/courses")}>Browse all courses ›</button>
            </section>
          </aside>
        </div>
      </main>

      <footer className="student-footer">
        <span>© {new Date().getFullYear()} SkillBridge Inc. Technical Learning & Upskilling Platform.</span>
        <div><span className="student-system-status"><i />{dashboardLoading ? "Syncing dashboard data" : enrollmentLoadError || catalogLoadError ? "Some dashboard data unavailable" : "Dashboard data connected"}</span></div>
      </footer>
      {notice && <div role="status" className="student-toast">{notice}</div>}
    </div>
  );
}




