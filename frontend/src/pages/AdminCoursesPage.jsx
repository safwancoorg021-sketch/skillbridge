import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { AdminLayout } from "../components/AdminLayout.jsx";
import { Icon } from "../components/AuthComponents.jsx";
import { api, apiForm } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { navigate } from "../services/navigation.js";
import "./AdminCoursesPage.css";

const emptyCourse = { title: "", description: "", thumbnail: "", category: "General", level: "Beginner", price: "0", isFree: true, discountPrice: "0", instructor: "", requirements: "" };
const emptyLesson = { title: "", type: "video", videoUrl: "", content: "", durationMin: "0", isPreview: false };
const hasStoredLessonVideo = (url) => /^\/uploads\/course-videos\/[a-f0-9-]{36}\.mp4$/i.test(url || "") || /^cloudinary:\/\/[a-f0-9-]{36}$/i.test(url || "");
const MAX_THUMBNAIL_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 900 * 1024;

async function prepareThumbnailImage(imageUrl, cropPixels) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("Unable to open the selected image."));
    image.src = imageUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to process this image.");
  context.fillStyle = "#f4f3f9";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height, 0, 0, canvas.width, canvas.height);

  let blob = null;
  for (const quality of [0.86, 0.72, 0.58, 0.44, 0.32]) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_THUMBNAIL_BYTES) break;
  }
  if (!blob || blob.size > MAX_THUMBNAIL_BYTES) throw new Error("Unable to compress this image. Choose another photo.");
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read this image."));
    reader.readAsDataURL(blob);
  });
}

export function AdminCoursesPage({ logout, onAuthFailure }) {
  const { signOut } = useAuth();
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [thumbnailProcessing, setThumbnailProcessing] = useState(false);
  const [thumbnailCropSource, setThumbnailCropSource] = useState("");
  const [thumbnailCrop, setThumbnailCrop] = useState({ x: 0, y: 0 });
  const [thumbnailZoom, setThumbnailZoom] = useState(1);
  const [thumbnailCropPixels, setThumbnailCropPixels] = useState(null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [moduleTitle, setModuleTitle] = useState("");
  const [activeModule, setActiveModule] = useState("");
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [lessonVideoFile, setLessonVideoFile] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [curriculumFeedback, setCurriculumFeedback] = useState({ type: "", message: "" });
  const lessonFormRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!thumbnailCropSource) return undefined;
    return () => URL.revokeObjectURL(thumbnailCropSource);
  }, [thumbnailCropSource]);

  const loadCourses = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50", page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      const data = await api(`/admin/courses?${params}`, { method: "GET", auth: true });
      setCourses(data.courses || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (loadError) {
      setError(loadError.message);
      if (loadError.status === 401 || loadError.status === 403) {
        onAuthFailure(loadError.message);
        signOut();
        navigate("/admin/login");
      }
    } finally {
      setLoading(false);
    }
  }, [search, page, onAuthFailure, signOut]);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  async function loadCurriculum(course) {
    setSelectedCourse(course);
    setShowCourseForm(false);
    setEditingLesson(null);
    setLessonForm(emptyLesson);
    setActiveModule("");
    setModules([]);
    setCurriculumLoading(true);
    setCurriculumFeedback({ type: "", message: "" });
    setError("");
    try {
      const data = await api(`/admin/lessons/courses/${encodeURIComponent(course.id || course._id)}/curriculum`, { method: "GET", auth: true });
      setModules(data.modules || []);
    } catch (loadError) {
      setModules([]);
      setError(loadError.message);
    } finally {
      setCurriculumLoading(false);
    }
  }

  function startCreateCourse() {
    setEditingCourse(null);
    setCourseForm(emptyCourse);
    setThumbnailDataUrl("");
    setThumbnailPreview("");
    setThumbnailProcessing(false);
    setRemoveThumbnail(false);
    setShowCourseForm(true);
    setError("");
  }

  function startEditCourse(course) {
    setEditingCourse(course);
    setCourseForm({ ...course, price: String(course.price || 0), discountPrice: String(course.discountPrice || 0), isFree: Boolean(course.isFree), requirements: Array.isArray(course.requirements) ? course.requirements.join("\n") : "" });
    setThumbnailDataUrl("");
    setThumbnailPreview(course.thumbnail || "");
    setThumbnailProcessing(false);
    setRemoveThumbnail(false);
    setShowCourseForm(true);
    setError("");
  }

  async function chooseThumbnail(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    if (file.size > MAX_THUMBNAIL_SOURCE_BYTES) return setError("Choose an image smaller than 10 MB.");
    try {
      const bitmap = await createImageBitmap(file);
      const tooLarge = bitmap.width * bitmap.height > 60_000_000;
      bitmap.close();
      if (tooLarge) return setError("Choose an image with smaller dimensions.");
    } catch {
      return setError("Choose a valid image file.");
    }
    setThumbnailCrop({ x: 0, y: 0 });
    setThumbnailZoom(1);
    setThumbnailCropPixels(null);
    setThumbnailCropSource(URL.createObjectURL(file));
  }

  async function applyThumbnailCrop() {
    if (!thumbnailCropSource || !thumbnailCropPixels) return;
    setThumbnailProcessing(true);
    setError("");
    try {
      const dataUrl = await prepareThumbnailImage(thumbnailCropSource, thumbnailCropPixels);
      setThumbnailDataUrl(dataUrl);
      setThumbnailPreview(dataUrl);
      setRemoveThumbnail(false);
      setThumbnailCropSource("");
      setThumbnailCropPixels(null);
    } catch (thumbnailError) {
      setError(thumbnailError.message || "Unable to use this image.");
    } finally {
      setThumbnailProcessing(false);
    }
  }

  function clearThumbnail() {
    setThumbnailDataUrl("");
    setThumbnailPreview("");
    setRemoveThumbnail(Boolean(editingCourse?.thumbnail));
  }

  async function saveCourse(event) {
    event.preventDefault();
    setError("");
    if (thumbnailProcessing) return setError("Wait for the thumbnail image to finish preparing.");
    const title = courseForm.title.trim();
    const description = courseForm.description.trim();
    if (title.length < 3) return setError("Course title must be at least 3 characters.");
    if (description.length < 10) return setError("Description must be at least 10 characters.");
    const body = { ...courseForm, title, description, price: courseForm.isFree ? 0 : Number(courseForm.price), discountPrice: Number(courseForm.discountPrice) || 0, requirements: courseForm.requirements.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), thumbnailDataUrl, removeThumbnail };
    delete body.thumbnail;
    setSaving(true);
    try {
      const data = await api(editingCourse ? `/admin/courses/${editingCourse.id || editingCourse._id}` : "/admin/courses", { method: editingCourse ? "PUT" : "POST", auth: true, body });
      if (thumbnailDataUrl && (data.thumbnailUploadSupported !== true || !data.course?.thumbnail?.startsWith("/uploads/course-thumbnails/"))) {
        await loadCourses();
        setEditingCourse(data.course);
        setShowCourseForm(true);
        setError(data.thumbnailUploadSupported === true
          ? "The updated backend received this request but did not return the saved thumbnail. Check the backend terminal for its upload error."
          : "This app is connected to a backend without the thumbnail upload update. Open http://127.0.0.1:5001/api/health; it should show courseThumbnailUpload: true. Then restart the backend from this SkillBridge folder and save this draft again.");
        return;
      }
      setNotice(data.message || "Course saved.");
      setShowCourseForm(false);
      setThumbnailDataUrl("");
      setThumbnailPreview("");
      setRemoveThumbnail(false);
      await loadCourses();
      if (editingCourse && selectedCourse && String(selectedCourse.id || selectedCourse._id) === String(editingCourse.id || editingCourse._id)) {
        const refreshed = (data.course || editingCourse);
        setSelectedCourse(refreshed);
      }
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(course) {
    const shouldPublish = !course.isPublished;
    if (!window.confirm(`${shouldPublish ? "Publish" : "Unpublish"} “${course.title}”?`)) return;
    try {
      const data = await api(`/admin/courses/${course.id || course._id}/publish`, { method: "PATCH", auth: true, body: { isPublished: shouldPublish } });
      setNotice(data.message || "Publishing status updated.");
      await loadCourses();
      if (selectedCourse && String(selectedCourse.id || selectedCourse._id) === String(course.id || course._id)) setSelectedCourse(data.course);
    } catch (actionError) { setError(actionError.message); }
  }

  async function deleteCourse(course) {
    if (!window.confirm(`Delete “${course.title}” and all its lessons and enrollments? This cannot be undone.`)) return;
    try {
      const data = await api(`/admin/courses/${course.id || course._id}`, { method: "DELETE", auth: true });
      setNotice(data.message || "Course deleted.");
      if (selectedCourse && String(selectedCourse.id || selectedCourse._id) === String(course.id || course._id)) { setSelectedCourse(null); setModules([]); }
      await loadCourses();
    } catch (actionError) { setError(actionError.message); }
  }

  async function addModule(event) {
    event.preventDefault();
    if (!moduleTitle.trim() || !selectedCourse) return;
    setCurriculumFeedback({ type: "", message: "" });
    setSaving(true);
    try {
      const data = await api(`/admin/lessons/courses/${selectedCourse.id || selectedCourse._id}/modules`, { method: "POST", auth: true, body: { title: moduleTitle.trim() } });
      setModuleTitle("");
      await loadCurriculum(selectedCourse);
      setCurriculumFeedback({ type: "success", message: data.message || "Module added. Choose Add lesson to add content." });
      await loadCourses();
    } catch (actionError) { setCurriculumFeedback({ type: "error", message: actionError.message }); }
    finally { setSaving(false); }
  }

  function editLesson(module, lesson) {
    setActiveModule(module.id);
    setEditingLesson(lesson);
    setCurriculumFeedback({ type: "", message: "" });
    setLessonVideoFile(null);
    setLessonForm({ title: lesson.title, type: lesson.type, videoUrl: lesson.videoUrl || "", content: lesson.content || "", durationMin: String(lesson.durationMin || 0), isPreview: Boolean(lesson.isPreview) });
    requestAnimationFrame(() => lessonFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function resetLessonForm(moduleId = "") {
    setEditingLesson(null);
    setLessonForm(emptyLesson);
    setLessonVideoFile(null);
    setActiveModule(moduleId);
    setCurriculumFeedback({ type: "", message: "" });
  }

  function toggleLessonForm(moduleId) {
    if (activeModule === moduleId && !editingLesson) {
      resetLessonForm();
      return;
    }
    resetLessonForm(moduleId);
    requestAnimationFrame(() => lessonFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  async function saveLesson(event) {
    event.preventDefault();
    if (!activeModule) return setCurriculumFeedback({ type: "error", message: "Choose a module before adding a lesson." });
    if (!lessonForm.title.trim()) return setCurriculumFeedback({ type: "error", message: "Enter a lesson title.", moduleId: activeModule });
    if (lessonForm.type === "video" && !lessonVideoFile && !hasStoredLessonVideo(lessonForm.videoUrl)) return setCurriculumFeedback({ type: "error", message: "Upload a video file for this lesson.", moduleId: activeModule });
    if (lessonForm.type === "article" && !lessonForm.content.trim()) return setCurriculumFeedback({ type: "error", message: "Enter the lesson article content.", moduleId: activeModule });
    setSaving(true);
    setCurriculumFeedback({ type: "", message: "" });
    const body = { ...lessonForm, title: lessonForm.title.trim(), durationMin: Number(lessonForm.durationMin) || 0 };
    const moduleId = activeModule;
    try {
      const endpoint = editingLesson ? `/admin/lessons/lessons/${editingLesson.id || editingLesson._id}` : `/admin/lessons/modules/${moduleId}/lessons`;
      let data;
      if (lessonVideoFile && lessonForm.type === "video") {
        const formData = new FormData();
        Object.entries(body).forEach(([key, value]) => formData.append(key, String(value)));
        formData.set("video", lessonVideoFile);
        data = await apiForm(endpoint, { method: editingLesson ? "PUT" : "POST", auth: true, body: formData });
      } else {
        data = await api(endpoint, { method: editingLesson ? "PUT" : "POST", auth: true, body });
      }
      const successMessage = data.message || (editingLesson ? "Lesson updated." : "Lesson added.");
      await loadCurriculum(selectedCourse);
      resetLessonForm(moduleId);
      setCurriculumFeedback({ type: "success", message: successMessage, moduleId });
      await loadCourses();
    } catch (actionError) { setCurriculumFeedback({ type: "error", message: actionError.message, moduleId }); }
    finally { setSaving(false); }
  }

  async function deleteModule(module) {
    if (!window.confirm(`Delete module “${module.title}” and its lessons?`)) return;
    try {
      await api(`/admin/lessons/modules/${module.id}`, { method: "DELETE", auth: true });
      await loadCurriculum(selectedCourse);
      setCurriculumFeedback({ type: "success", message: "Module and its lessons deleted." });
      await loadCourses();
    } catch (actionError) { setCurriculumFeedback({ type: "error", message: actionError.message }); }
  }

  async function deleteLesson(module, lesson) {
    if (!window.confirm(`Delete lesson “${lesson.title}”?`)) return;
    try {
      await api(`/admin/lessons/lessons/${lesson.id || lesson._id}`, { method: "DELETE", auth: true });
      await loadCurriculum(selectedCourse);
      setCurriculumFeedback({ type: "success", message: "Lesson deleted.", moduleId: module.id });
      await loadCourses();
    } catch (actionError) { setCurriculumFeedback({ type: "error", message: actionError.message, moduleId: module.id }); }
  }

  return <AdminLayout logout={logout} active="courses">
    <div className="page-head admin-course-page-head">{selectedCourse ? <><div><div className="crumb-small">Admin Portal &gt; Course management &gt; <strong>Manage course</strong></div><h1>Manage course</h1><p>Update the modules and lessons in {selectedCourse.title}.</p></div><div className="head-actions"><button className="primary-button button-small" type="button" onClick={() => navigate(`/admin/courses/${selectedCourse.id || selectedCourse._id}/quiz`)}>Manage quiz</button><button className="secondary-button button-small" type="button" onClick={() => { setSelectedCourse(null); setModules([]); setCurriculumFeedback({ type: "", message: "" }); }}>← Back to all courses</button></div></> : <><div><div className="crumb-small">Admin Portal &gt; <strong>Course management</strong></div><h1>Courses & lessons</h1><p>Create and maintain course content for the student catalog.</p></div><div className="head-actions"><button className="primary-button button-small" type="button" onClick={startCreateCourse}>＋ Create course</button></div></>}</div>
    {error && <div className="admin-course-message error" role="alert">{error}<button type="button" onClick={() => setError("")}>×</button></div>}
    {notice && <div className="admin-course-message success" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
    {!selectedCourse && <>
    <div className="admin-course-toolbar"><label><Icon name="search"/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search courses by title or category" /></label><span>{courses.length} courses · page {page} of {totalPages}</span></div>
    {showCourseForm && <section className="admin-panel admin-course-form-panel"><div className="admin-panel-heading"><div><h2>{editingCourse ? "Edit course" : "Create a course"}</h2><p>Courses start as drafts. Add a lesson before publishing.</p></div><button type="button" className="admin-course-close" onClick={() => setShowCourseForm(false)} aria-label="Close course form">×</button></div><form className="admin-course-form" onSubmit={saveCourse}>
      <label className="wide-field"><span>Course title</span><input maxLength={120} required value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} /></label>
      <label className="wide-field"><span>Description</span><textarea rows="4" maxLength={10000} required value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} /></label>
      <label><span>Category</span><input maxLength={80} value={courseForm.category} onChange={(event) => setCourseForm({ ...courseForm, category: event.target.value })} /></label>
      <label><span>Level</span><select value={courseForm.level} onChange={(event) => setCourseForm({ ...courseForm, level: event.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
      <label><span>Instructor</span><input maxLength={120} value={courseForm.instructor} onChange={(event) => setCourseForm({ ...courseForm, instructor: event.target.value })} /></label>
      <div className="admin-thumbnail-field"><span>Course thumbnail</span>{thumbnailPreview ? <img className="admin-thumbnail-preview" src={thumbnailPreview} alt="Course thumbnail preview" /> : <div className="admin-thumbnail-placeholder">Choose an image to show on the course card</div>}<div className="admin-thumbnail-actions"><label className="admin-thumbnail-pick">{thumbnailProcessing ? "Preparing image…" : thumbnailPreview ? "Change image" : "Choose image"}<input type="file" accept="image/*" onChange={chooseThumbnail} /></label>{thumbnailPreview && <button type="button" className="admin-thumbnail-remove" onClick={clearThumbnail} disabled={thumbnailProcessing}>Remove image</button>}</div><small>{thumbnailProcessing ? "Preparing cropped image… wait until complete before saving." : "Images up to 10 MB. Crop to 16:9; saved thumbnails are compressed."}</small></div>
      <label className="admin-course-free-check"><input type="checkbox" checked={courseForm.isFree} onChange={(event) => setCourseForm({ ...courseForm, isFree: event.target.checked })} /><span>Free course</span></label>
      {!courseForm.isFree && <label><span>Price (₹)</span><input type="number" min="0" max="1000000" step="1" value={courseForm.price} onChange={(event) => setCourseForm({ ...courseForm, price: event.target.value })} /></label>}
      <label className="wide-field"><span>Requirements (one per line)</span><textarea rows="3" value={courseForm.requirements} onChange={(event) => setCourseForm({ ...courseForm, requirements: event.target.value })} /></label>
      <div className="admin-course-form-actions"><button type="button" className="secondary-button button-small" onClick={() => setShowCourseForm(false)}>Cancel</button><button type="submit" className="primary-button button-small" disabled={saving || thumbnailProcessing}>{thumbnailProcessing ? "Preparing image…" : saving ? "Saving…" : editingCourse ? "Save course" : "Create draft"}</button></div>
    </form></section>}

    {loading ? <div className="admin-profile-loading">Loading courses…</div> : courses.length ? <><div className="admin-course-list">{courses.map((course) => <article className={`admin-course-item${selectedCourse && (selectedCourse.id || selectedCourse._id) === (course.id || course._id) ? " selected" : ""}`} key={course.id || course._id}>
      <div className="admin-course-item-main"><div className="admin-course-thumb">{course.thumbnail ? <img src={course.thumbnail} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : (course.category || "C").slice(0,1)}</div><div className="admin-course-item-copy"><h2>{course.title}</h2><p>{course.category} · {course.level} · {course.instructor || "No instructor"}</p><small>{course.moduleCount || 0} modules · {course.lessonCount || 0} lessons · {course.enrollmentCount || 0} enrolled</small></div></div>
      <span className={`admin-course-status ${course.isPublished ? "published" : "draft"}`}>{course.isPublished ? "Published" : "Draft"}</span><strong className="admin-course-price">{course.isFree || Number(course.price) === 0 ? "Free" : `₹${Number(course.price).toLocaleString("en-IN")}`}</strong>
      <div className="admin-course-item-actions"><button type="button" onClick={() => loadCurriculum(course)}>Manage lessons</button><button type="button" onClick={() => navigate(`/admin/courses/${course.id || course._id}/quiz`)}>Manage quiz</button><button type="button" onClick={() => startEditCourse(course)}>Edit</button><button type="button" onClick={() => togglePublish(course)}>{course.isPublished ? "Unpublish" : "Publish"}</button><button type="button" className="delete" onClick={() => deleteCourse(course)}>Delete</button></div>
    </article>)}</div>{totalPages > 1 && <div className="learning-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next →</button></div>}</> : <div className="learning-state">No courses yet. Create your first course to get started.</div>}
    </>}

    {selectedCourse && <section className="admin-panel admin-curriculum-panel"><div className="admin-panel-heading"><div><div className="crumb-small">Course curriculum</div><h2>{selectedCourse.title}</h2><p>Add modules and organize lessons. Uploaded videos are compressed and stored in Cloudinary.</p></div><button type="button" className="admin-course-close" onClick={() => { setSelectedCourse(null); setModules([]); }}>×</button></div>
      <form className="admin-add-module" onSubmit={addModule}><input aria-label="New module title" value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} placeholder="New module title" maxLength={120} /><button type="submit" disabled={saving || moduleTitle.trim().length < 2} aria-busy={saving}>{saving ? "Adding module…" : "＋ Add module"}</button></form>
      {curriculumFeedback.message && !curriculumFeedback.moduleId && <div className={`admin-curriculum-feedback ${curriculumFeedback.type}`} role={curriculumFeedback.type === "error" ? "alert" : "status"}>{curriculumFeedback.message}</div>}
      {curriculumLoading ? <div className="admin-empty-curriculum">Loading this course’s modules and lessons…</div> : !modules.length ? <div className="admin-empty-curriculum">No modules yet. Add a module to start building the course.</div> : modules.map((module) => <article className={`admin-module-card${activeModule === module.id ? " lesson-form-open" : ""}`} key={module.id}><div className="admin-module-heading"><div><span>MODULE {module.order}</span><h3>{module.title}</h3></div><button type="button" className="delete" onClick={() => deleteModule(module)}>Delete module</button></div>
        <div className="admin-lesson-list">{module.lessons?.map((lesson) => <div className="admin-lesson-item" key={lesson.id || lesson._id}><span className="admin-lesson-type">{lesson.type === "article" ? "ARTICLE" : "VIDEO"}{lesson.isPreview ? " · PREVIEW" : ""}</span><strong>{lesson.title}</strong><small>{lesson.durationMin || 0} min</small><button type="button" onClick={() => editLesson(module, lesson)}>Edit</button><button type="button" className="delete" onClick={() => deleteLesson(module, lesson)}>Delete</button></div>)}</div>
        {curriculumFeedback.message && curriculumFeedback.moduleId === module.id && <div className={`admin-curriculum-feedback ${curriculumFeedback.type}`} role={curriculumFeedback.type === "error" ? "alert" : "status"}>{curriculumFeedback.message}</div>}
        <button type="button" className={`admin-add-lesson-toggle${activeModule === module.id ? " is-open" : ""}`} onClick={() => toggleLessonForm(module.id)} disabled={saving} aria-expanded={activeModule === module.id} aria-controls={activeModule === module.id ? `lesson-form-${module.id}` : undefined}>{activeModule === module.id ? editingLesson ? "＋ Add another lesson" : "− Close lesson form" : "＋ Add lesson to this module"}</button>
        {activeModule === module.id && <form id={`lesson-form-${module.id}`} ref={lessonFormRef} className="admin-lesson-form" onSubmit={saveLesson}><div className="admin-lesson-form-heading"><div><span>{editingLesson ? "UPDATE CONTENT" : "NEW CONTENT"}</span><h3>{editingLesson ? "Edit lesson" : `Add a lesson to ${module.title}`}</h3></div><button type="button" className="admin-lesson-form-close" onClick={() => resetLessonForm()} disabled={saving} aria-label="Close lesson form">×</button></div><div className="admin-lesson-form-grid"><label><span>Lesson title</span><input required maxLength={160} value={lessonForm.title} onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })} /></label><label><span>Lesson type</span><select value={lessonForm.type} onChange={(event) => setLessonForm({ ...lessonForm, type: event.target.value })}><option value="video">Video</option><option value="article">Article</option></select></label><label><span>Duration (minutes)</span><input type="number" min="0" max="10000" value={lessonForm.durationMin} onChange={(event) => setLessonForm({ ...lessonForm, durationMin: event.target.value })} /></label>{lessonForm.type === "article" && <label className="wide-field"><span>Article content</span><textarea rows="7" required maxLength={50000} value={lessonForm.content} onChange={(event) => setLessonForm({ ...lessonForm, content: event.target.value })} /></label>}{lessonForm.type === "video" && <label className="wide-field"><span>Upload course video</span><input key={`${activeModule}-${lessonVideoFile?.name || "empty"}`} type="file" required={!hasStoredLessonVideo(lessonForm.videoUrl)} accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo,video/ogg" onChange={(event) => { const file = event.target.files?.[0] || null; const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/x-msvideo", "video/ogg"]; if (file && !allowed.includes(file.type)) { setLessonVideoFile(null); setCurriculumFeedback({ type: "error", message: "Choose an MP4, WebM, MOV, AVI, MKV, or OGG video.", moduleId: activeModule }); event.target.value = ""; return; } if (file && file.size > 250 * 1024 * 1024) { setLessonVideoFile(null); setCurriculumFeedback({ type: "error", message: "Choose a video smaller than 250 MB.", moduleId: activeModule }); event.target.value = ""; return; } setLessonVideoFile(file); }} /><small>{lessonVideoFile ? `${lessonVideoFile.name} · compressed before permanent storage` : hasStoredLessonVideo(lessonForm.videoUrl) ? "A compressed course video is stored in Cloudinary. Choose another file to replace it." : "Required: MP4, WebM, MOV, AVI, MKV, or OGG · max 250 MB. The video is compressed before it is saved."}</small></label>}<label className="admin-course-free-check"><input type="checkbox" checked={lessonForm.isPreview} onChange={(event) => setLessonForm({ ...lessonForm, isPreview: event.target.checked })} /><span>Allow as free preview</span></label></div><div className="admin-course-form-actions"><button type="button" className="secondary-button button-small" onClick={() => resetLessonForm()} disabled={saving}>Cancel</button><button type="submit" className="primary-button button-small" disabled={saving} aria-busy={saving}>{saving ? editingLesson ? "Compressing and saving…" : "Compressing and adding…" : editingLesson ? "Save lesson" : "Add lesson"}</button></div></form>}
      </article>)}
    </section>}
    {thumbnailCropSource && createPortal(
      <div className="course-thumbnail-crop-overlay" onClick={(event) => { if (event.target === event.currentTarget && !thumbnailProcessing) setThumbnailCropSource(""); }}>
        <section className="course-thumbnail-crop-modal" role="dialog" aria-modal="true" aria-labelledby="course-thumbnail-crop-title">
          <h2 id="course-thumbnail-crop-title">Crop course thumbnail</h2>
          <p>Drag the image to reposition it, then adjust the zoom. Course thumbnails use a 16:9 frame.</p>
          <div className="course-thumbnail-crop-area">
            <Cropper
              image={thumbnailCropSource}
              crop={thumbnailCrop}
              zoom={thumbnailZoom}
              aspect={16 / 9}
              showGrid
              onCropChange={setThumbnailCrop}
              onZoomChange={setThumbnailZoom}
              onCropComplete={(_, pixels) => setThumbnailCropPixels(pixels)}
              minZoom={1}
              maxZoom={4}
            />
          </div>
          <label className="course-thumbnail-zoom"><span>Zoom</span><input type="range" min="1" max="4" step="0.05" value={thumbnailZoom} onChange={(event) => setThumbnailZoom(Number(event.target.value))} /><strong>{thumbnailZoom.toFixed(2)}×</strong></label>
          <div className="course-thumbnail-crop-actions">
            <button type="button" className="secondary-button button-small" onClick={() => { setThumbnailCrop({ x: 0, y: 0 }); setThumbnailZoom(1); }} disabled={thumbnailProcessing}>Reset</button>
            <button type="button" className="secondary-button button-small" onClick={() => setThumbnailCropSource("")} disabled={thumbnailProcessing}>Cancel</button>
            <button type="button" className="primary-button button-small" onClick={applyThumbnailCrop} disabled={thumbnailProcessing || !thumbnailCropPixels}>{thumbnailProcessing ? "Preparing…" : "Use this crop"}</button>
          </div>
        </section>
      </div>,
      document.body
    )}
  </AdminLayout>;
}
