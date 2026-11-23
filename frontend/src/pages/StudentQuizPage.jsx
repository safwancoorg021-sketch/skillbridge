import { useEffect, useState } from "react";
import { StudentPortalHeader } from "../components/StudentPortalHeader.jsx";
import { api } from "../services/api.js";
import { navigate } from "../services/navigation.js";
import "./StudentQuizPage.css";

export function StudentQuizPage({ courseId, logout }) {
  const [course, setCourse] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api(`/quizzes/${encodeURIComponent(courseId)}`, { method: "GET", auth: true })
      .then((data) => {
        if (!active) return;
        setCourse(data.course);
        setQuiz(data.quiz);
        setAnswers(Array(data.quiz.questions.length).fill(null));
        setResult({ ...data.result, score: null, answerReview: null });
      })
      .catch((loadError) => { if (active) setError(loadError.message || "Unable to load this quiz."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId]);

  async function submit(event) {
    event.preventDefault();
    if (!quiz || answers.some((answer) => answer === null)) {
      setError("Answer every question before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const data = await api(`/quizzes/${encodeURIComponent(courseId)}/submit`, { method: "POST", auth: true, body: { answers } });
      setResult((current) => ({ ...current, ...data, passed: data.quizPassed || data.passed, passedThisAttempt: data.passed }));
    } catch (submitError) {
      setError(submitError.message || "Unable to submit this quiz.");
    } finally { setSubmitting(false); }
  }

  const hasSubmitted = Number.isInteger(result?.score);

  return <div className="student-quiz-page">
    <StudentPortalHeader active="courses" onLogout={logout} />
    <main className="student-quiz-content">
      <button className="student-quiz-back" type="button" onClick={() => navigate(`/courses/${courseId}`)}>← Back to course</button>
      {loading ? <div className="student-quiz-state">Loading quiz…</div> : error && !quiz ? <div className="student-quiz-state error" role="alert">{error}<button type="button" onClick={() => navigate(`/courses/${courseId}`)}>Return to course</button></div> : quiz && <>
        <section className="student-quiz-heading"><span>COURSE ASSESSMENT</span><h1>{quiz.title}</h1><p>{course?.title} · {quiz.questions.length} questions · Pass mark {quiz.passPercentage}%</p>{result?.passed && <strong className="student-quiz-passed">✓ Quiz passed</strong>}</section>
        {error && <div className="student-quiz-error" role="alert">{error}</div>}
        {result?.certificateCode && <aside className="student-quiz-certificate" role="status"><div><strong>Your certificate is ready</strong><span>You completed the lessons and passed this quiz.</span></div><button type="button" onClick={() => navigate(`/certificate/${result.certificateCode}`)}>View certificate</button></aside>}
        {result?.passed && !result?.certificateCode && <aside className="student-quiz-info">Quiz passed! Complete every lesson in the course and your certificate will be issued automatically.</aside>}
        {result?.passed && <p className="student-quiz-attempts">Attempts: {result.attemptCount || 0} · Best score: {result.bestScore ?? result.score}%</p>}
        {hasSubmitted && <section className={`student-quiz-result ${result.passedThisAttempt ? "success" : "retry"}`} aria-live="polite"><strong>{result.passedThisAttempt ? "Assessment passed" : result.passed ? "Retake score below pass mark; your earlier pass still counts" : "Keep learning and try again"} · {result.score}%</strong><span>{result.correctCount} of {result.totalQuestions} correct. Passing score: {result.passPercentage}%.</span></section>}
        <form onSubmit={submit} className="student-quiz-form">
          {quiz.questions.map((question, index) => {
            const review = result?.answerReview?.[index];
            return <fieldset className="student-quiz-question" key={question.id}>
              <legend><span>QUESTION {index + 1}</span>{question.prompt}</legend>
              <div className="student-quiz-choices">{question.choices.map((choice, choiceIndex) => {
                const selected = answers[index] === choiceIndex;
                const isCorrect = review && review.correctAnswer === choiceIndex;
                const isWrongSelection = review && review.selectedAnswer === choiceIndex && !isCorrect;
                return <label key={choiceIndex} className={`${selected ? "selected" : ""}${isCorrect ? " correct" : ""}${isWrongSelection ? " wrong" : ""}`}>
                  <input type="radio" name={`question-${index}`} checked={selected} disabled={hasSubmitted} onChange={() => setAnswers((current) => current.map((answer, i) => i === index ? choiceIndex : answer))} />
                  <span>{choice}</span>{isCorrect && <b>Correct answer</b>}{isWrongSelection && <b>Your answer</b>}
                </label>;
              })}</div>
            </fieldset>;
          })}
          <div className="student-quiz-submit-row"><span>Attempt {Number(result?.attemptCount || 0) + (hasSubmitted ? 0 : 1)}</span>{hasSubmitted ? <button type="button" onClick={() => { setAnswers(Array(quiz.questions.length).fill(null)); setResult((current) => ({ ...current, score: null, answerReview: null, passedThisAttempt: null })); setError(""); }}>Try again</button> : <button type="submit" disabled={submitting}>{submitting ? "Checking answers…" : "Submit quiz"}</button>}</div>
        </form>
      </>}
    </main>
  </div>;
}
