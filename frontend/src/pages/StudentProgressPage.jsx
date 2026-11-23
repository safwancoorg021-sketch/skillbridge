import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";
import { navigate } from "../services/navigation.js";
import { StudentPortalHeader } from "../components/StudentPortalHeader.jsx";
import "./StudentCoursesPage.css";
import "./StudentPages.css";

export function StudentProgressPage({ logout }) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProgress = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/enrollments", { method: "GET", auth: true });
      setEnrollments(data.enrollments || []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load your learning progress.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgress();
    window.addEventListener("focus", loadProgress);
    return () => window.removeEventListener("focus", loadProgress);
  }, [loadProgress]);

  const progressRows = useMemo(() => enrollments.map((enrollment) => {
    const course = enrollment.course || {};
    const lessonCount = Number(course.lessonCount) || 0;
    const completedCount = Math.min(lessonCount, new Set(enrollment.completedLessons || []).size);
    const percent = lessonCount ? Math.round(completedCount / lessonCount * 100) : 0;
    return { course, lessonCount, completedCount, percent, quizPassed: Boolean(enrollment.quizPassedAt), quizScore: enrollment.quizScore || 0, quizAttemptCount: enrollment.quizAttemptCount || 0, certificateCode: enrollment.certificateCode || "" };
  }), [enrollments]);
  const totalLessons = progressRows.reduce((sum, item) => sum + item.lessonCount, 0);
  const completedLessons = progressRows.reduce((sum, item) => sum + item.completedCount, 0);
  const overallProgress = totalLessons ? Math.round(completedLessons / totalLessons * 100) : 0;
  const completedCourses = progressRows.filter((item) => item.lessonCount > 0 && item.percent === 100 && item.quizPassed).length;

  return <div className="learning-portal">
    <StudentPortalHeader active="progress" onLogout={logout} />
    <main className="learning-content">
      <section className="learning-page-title"><div><span>YOUR LEARNING</span><h1>Learning progress</h1><p>Track completed lessons and continue where you left off.</p></div></section>
      {loading ? <div className="learning-state" role="status">Loading your progress…</div> : error ? <div className="learning-state error" role="alert">{error}<button type="button" onClick={loadProgress}>Try again</button></div> : <>
        <section className="student-progress-overview" aria-label="Progress summary">
          <article><span>OVERALL PROGRESS</span><strong>{overallProgress}%</strong><small>{completedLessons} of {totalLessons} lessons completed</small></article>
          <article><span>ENROLLED COURSES</span><strong>{progressRows.length}</strong><small>Courses in your account</small></article>
          <article><span>COMPLETED COURSES</span><strong>{completedCourses}</strong><small>Lessons finished and quiz passed</small></article>
        </section>
        {!progressRows.length ? <div className="learning-state"><strong>No enrolled courses yet</strong><span>Enroll in a course to start tracking progress.</span><button type="button" onClick={() => navigate("/courses")}>Browse courses</button></div> : <section className="student-progress-list" aria-label="Course progress">
          {progressRows.map(({ course, lessonCount, completedCount, percent, quizPassed, quizScore, quizAttemptCount, certificateCode }) => <article className="student-progress-card" key={course.id || course._id}>
            <div className="student-progress-card-heading"><div><span>{course.category || "COURSE"} · {course.level || "All levels"}</span><h2>{course.title || "Course"}</h2></div><strong className={percent === 100 && lessonCount ? "complete" : ""}>{lessonCount ? `${percent}%` : "—"}</strong></div>
            <div className="student-progress-bar" role="progressbar" aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100" aria-label={`${course.title || "Course"} progress`}><span style={{ width: `${percent}%` }} /></div>
            <div className="student-progress-card-footer"><span>{lessonCount ? `${completedCount} of ${lessonCount} lessons complete${quizPassed ? ` · Quiz passed (${quizScore}%, ${quizAttemptCount} attempt${quizAttemptCount === 1 ? "" : "s"})` : course.quizAvailable ? " · Quiz not passed yet" : ""}` : "Lessons are not available yet"}</span><div>{certificateCode && <button type="button" className="student-progress-certificate" onClick={() => navigate(`/certificate/${certificateCode}`)}>View certificate</button>}{course.quizAvailable && !quizPassed && <button type="button" onClick={() => navigate(`/quiz/${course.id || course._id}`)}>Take quiz</button>}<button type="button" onClick={() => navigate(`/courses/${course.id || course._id}`)}>{percent === 100 ? "Review course" : "Continue learning"}</button></div></div>
          </article>)}
        </section>}
      </>}
    </main>
  </div>;
}
