import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { navigate } from "./services/navigation.js";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";
import { OtpPage } from "./pages/OtpPage.jsx";
import { ForgotPage } from "./pages/ForgotPasswordPage.jsx";
import { ResetPage } from "./pages/ResetPasswordPage.jsx";
import { SuccessPage } from "./pages/SuccessPage.jsx";
import { StudentPage } from "./pages/StudentDashboard.jsx";
import { StudentProfile } from "./pages/StudentProfile.jsx";
import { AdminPage } from "./pages/AdminUsersPage.jsx";
import { AdminDashboard } from "./pages/AdminDashboard.jsx";
import { AdminProfile } from "./pages/AdminProfile.jsx";
import { AdminCoursesPage } from "./pages/AdminCoursesPage.jsx";
import { AdminPaymentsPage } from "./pages/AdminPaymentsPage.jsx";
import { AdminOffersPage } from "./pages/AdminOffersPage.jsx";
import { AdminReportsPage } from "./pages/AdminReportsPage.jsx";
import { AdminSupportPage } from "./pages/AdminSupportPage.jsx";
import { StudentCoursesPage } from "./pages/StudentCoursesPage.jsx";
import { StudentOffersPage } from "./pages/StudentOffersPage.jsx";
import { StudentProgressPage } from "./pages/StudentProgressPage.jsx";
import { StudentHelpPage } from "./pages/StudentHelpPage.jsx";
import { AdminQuizPage } from "./pages/AdminQuizPage.jsx";
import { StudentQuizPage } from "./pages/StudentQuizPage.jsx";
import { StudentCertificatePage } from "./pages/StudentCertificatePage.jsx";

export default function App(){
 const[path,setPath]=useState(location.hash.slice(1)||"/login"),[signupEmail,setSignupEmail]=useState(""),[resetEmail,setResetEmail]=useState(""),[resetToken,setResetToken]=useState(""),[sessionMessage,setSessionMessage]=useState("");
 const { token, user, signOut, sessionReady } = useAuth();
 useEffect(()=>{const f=()=>setPath(location.hash.slice(1)||"/login");window.addEventListener("hashchange",f);return()=>window.removeEventListener("hashchange",f)},[]);
 useEffect(()=>{const expired=e=>setSessionMessage(e.detail?.message||"Your session expired. Please sign in again.");window.addEventListener("skillbridge:session-expired",expired);return()=>window.removeEventListener("skillbridge:session-expired",expired)},[]);
 const logout=()=>{signOut();setSessionMessage("");navigate("/login")};
 const clearSessionMessage=()=>setSessionMessage("");
 if(token&&!sessionReady)return <div className="session-checking" role="status">Checking your session…</div>;
 if(path==="/login")return <LoginPage authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/admin/login")return <LoginPage admin authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/register")return <RegisterPage setEmail={setSignupEmail}/>;
 if(path==="/verify-email")return <OtpPage registration email={signupEmail}/>;
 if(path==="/forgot-password")return <ForgotPage setEmail={setResetEmail}/>;
 if(path==="/verify-reset")return <OtpPage email={resetEmail} setResetToken={setResetToken}/>;
 if(path==="/reset-password")return <ResetPage token={resetToken} clearToken={()=>setResetToken("")}/>;
 if(path==="/verified")return <SuccessPage/>;
 if(path==="/password-reset")return <SuccessPage reset/>;
 if(path==="/dashboard")return token&&user?.role==="student"?<StudentPage logout={logout} onAuthFailure={setSessionMessage}/>:<LoginPage authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/profile")return token&&user?.role==="student"?<StudentProfile logout={logout} onAuthFailure={setSessionMessage}/>:<LoginPage authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/offers")return token&&user?.role==="student"?<StudentOffersPage logout={logout}/>:<LoginPage authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/progress")return token&&user?.role==="student"?<StudentProgressPage logout={logout}/>:<LoginPage authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/help")return token&&user?.role==="student"?<StudentHelpPage logout={logout}/>:<LoginPage authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 const studentQuizMatch=path.match(/^\/quiz\/([^/]+)$/);
 if(studentQuizMatch)return token&&user?.role==="student"?<StudentQuizPage courseId={studentQuizMatch[1]} logout={logout}/>:<LoginPage authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 const certificateMatch=path.match(/^\/certificate\/([^/]+)$/);
 if(certificateMatch)return token&&user?.role==="student"?<StudentCertificatePage code={certificateMatch[1]} logout={logout}/>:<LoginPage authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/admin/dashboard")return token&&user?.role==="admin"?<AdminDashboard logout={logout} onAuthFailure={setSessionMessage}/>:<LoginPage admin authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/admin/profile")return token&&user?.role==="admin"?<AdminProfile logout={logout} onAuthFailure={setSessionMessage}/>:<LoginPage admin authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 const adminQuizMatch=path.match(/^\/admin\/courses\/([^/]+)\/quiz$/);
 if(adminQuizMatch)return token&&user?.role==="admin"?<AdminQuizPage courseId={adminQuizMatch[1]} logout={logout}/>:<LoginPage admin authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/admin/courses")return token&&user?.role==="admin"?<AdminCoursesPage logout={logout} onAuthFailure={setSessionMessage}/>:<LoginPage admin authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/admin/payments")return token&&user?.role==="admin"?<AdminPaymentsPage logout={logout} onAuthFailure={setSessionMessage}/>:<LoginPage admin authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/admin/offers")return token&&user?.role==="admin"?<AdminOffersPage logout={logout}/>:<LoginPage admin authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/admin/reports")return token&&user?.role==="admin"?<AdminReportsPage logout={logout}/>:<LoginPage admin authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/admin/support")return token&&user?.role==="admin"?<AdminSupportPage logout={logout}/>:<LoginPage admin authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/admin/users")return token&&user?.role==="admin"?<AdminPage logout={logout} onAuthFailure={setSessionMessage}/>:<LoginPage admin authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 if(path==="/courses"||path.startsWith("/courses/")||path.startsWith("/courses?")||path==="/cart"||path==="/my-courses"||path==="/wishlist"||path.startsWith("/learn/"))return token&&user?.role==="student"?<StudentCoursesPage key={path} path={path} logout={logout}/>:<LoginPage authMessage={sessionMessage} clearAuthMessage={clearSessionMessage}/>;
 return <LoginPage/>
}


