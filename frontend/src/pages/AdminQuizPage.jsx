import { useEffect, useState } from "react";
import { AdminLayout } from "../components/AdminLayout.jsx";
import { api } from "../services/api.js";
import { navigate } from "../services/navigation.js";
import "./AdminQuizPage.css";

const blankQuestion = () => ({ prompt: "", choices: ["", "", "", ""], correctAnswer: null });

export function AdminQuizPage({ courseId, logout }) {
  const [course, setCourse] = useState(null);
  const [title, setTitle] = useState("Course assessment");
  const [passPercentage, setPassPercentage] = useState("70");
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    api(`/admin/quizzes/courses/${encodeURIComponent(courseId)}`, { method: "GET", auth: true })
      .then((data) => {
        if (!active) return;
        setCourse(data.course);
        if (data.quiz) {
          setTitle(data.quiz.title || "Course assessment");
          setPassPercentage(String(data.quiz.passPercentage || 70));
          setQuestions(data.quiz.questions?.map(({ prompt, choices, correctAnswer }) => ({ prompt, choices: [...choices], correctAnswer })) || [blankQuestion()]);
        }
      })
      .catch((loadError) => { if (active) setError(loadError.message || "Unable to load this course quiz."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId]);

  function updateQuestion(index, update) {
    setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...update } : question));
  }

  function updateChoice(questionIndex, choiceIndex, value) {
    setQuestions((current) => current.map((question, index) => index === questionIndex
      ? { ...question, choices: question.choices.map((choice, optionIndex) => optionIndex === choiceIndex ? value : choice) }
      : question));
  }

  async function saveQuiz(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await api(`/admin/quizzes/courses/${encodeURIComponent(courseId)}`, {
        method: "PUT", auth: true, body: { title, passPercentage: Number(passPercentage), questions },
      });
      setNotice(data.message || "Quiz saved.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save this quiz.");
    } finally { setSaving(false); }
  }

  return <AdminLayout logout={logout} active="courses">
    <div className="admin-quiz-page-head">
      <div><span>COURSE ASSESSMENT</span><h1>{course?.title || "Course quiz"}</h1><p>Students pass this quiz and complete every lesson to earn their certificate.</p></div>
      <button type="button" onClick={() => navigate("/admin/courses")}>← Back to courses</button>
    </div>
    {loading ? <div className="admin-quiz-state">Loading course quiz…</div> : <form className="admin-quiz-form" onSubmit={saveQuiz}>
      {error && <div className="admin-quiz-alert error" role="alert">{error}</div>}
      {notice && <div className="admin-quiz-alert success" role="status">{notice}</div>}
      <section className="admin-quiz-settings">
        <label><span>Quiz title</span><input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Passing score (%)</span><input required type="number" min="1" max="100" step="1" value={passPercentage} onChange={(event) => setPassPercentage(event.target.value)} /></label>
        <p>Each question has four choices. Select the correct answer before saving. Students may retake the quiz.</p>
      </section>
      <div className="admin-quiz-question-list">
        {questions.map((question, index) => <section className="admin-quiz-question" key={index}>
          <div className="admin-quiz-question-head"><h2>Question {index + 1}</h2>{questions.length > 1 && <button type="button" onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))}>Remove</button>}</div>
          <label className="admin-quiz-prompt"><span>Question</span><textarea required minLength={5} maxLength={500} rows="3" value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="Write a question to check what students learned" /></label>
          <div className="admin-quiz-options">{question.choices.map((choice, choiceIndex) => <div className="admin-quiz-choice" key={choiceIndex}><label><span>Option {String.fromCharCode(65 + choiceIndex)}</span><input required maxLength={200} value={choice} onChange={(event) => updateChoice(index, choiceIndex, event.target.value)} /></label><label className="admin-quiz-correct"><input type="radio" name={`correct-${index}`} checked={question.correctAnswer === choiceIndex} onChange={() => updateQuestion(index, { correctAnswer: choiceIndex })} /> Correct answer</label></div>)}</div>
        </section>)}
      </div>
      <div className="admin-quiz-actions"><button type="button" className="admin-quiz-add" disabled={questions.length >= 50} onClick={() => setQuestions((current) => [...current, blankQuestion()])}>＋ Add question</button><button type="submit" className="admin-quiz-save" disabled={saving}>{saving ? "Saving quiz…" : "Save quiz"}</button></div>
    </form>}
  </AdminLayout>;
}
