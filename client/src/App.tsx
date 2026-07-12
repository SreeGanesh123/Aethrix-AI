import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import AIBackground from "./components/AIBackground";
import SessionExpiredModal from "./components/SessionExpiredModal";
import SessionWarningBanner from "./components/SessionWarningBanner";
import ChatBot from "./components/ChatBot";
import { clearStoredUser, getRoleHomeRoute, getStoredUser, isSessionExpired, loadStoredUser, type Role } from "./utils/auth";

const Home = lazy(() => import("./pages/home"));
const Landing = lazy(() => import("./pages/landing"));
const Login = lazy(() => import("./pages/login"));
const Register = lazy(() => import("./pages/register"));
const CandidateDashboard = lazy(() => import("./pages/CandidateDashboard"));
const RecruiterDashboard = lazy(() => import("./pages/RecruiterDashboard"));
const TrainerDashboard = lazy(() => import("./pages/TrainerDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminSection = lazy(() => import("./pages/AdminSection"));
const AssessmentHub = lazy(() => import("./pages/AssessmentHub"));
const AssessmentStart = lazy(() => import("./pages/AssessmentStart"));
const AssessmentTest = lazy(() => import("./pages/AssessmentTest"));
const AssessmentMCQ = lazy(() => import("./pages/AssessmentMCQ"));
const AssessmentCoding = lazy(() => import("./pages/AssessmentCoding"));
const AssessmentAptitudeCommunication = lazy(() => import("./pages/AssessmentAptitudeCommunication"));
const AssessmentInterview = lazy(() => import("./pages/AssessmentInterview"));
const ProfileComplete = lazy(() => import("./pages/ProfileComplete"));
const VerifyCertificate = lazy(() => import("./pages/VerifyCertificate"));
const Contact = lazy(() => import("./pages/Contact"));
const NotFound = lazy(() => import("./pages/NotFound"));

function SessionWatcher({ onSessionExpired }: { onSessionExpired: () => void }) {
  const navigate = useNavigate();

  useEffect(() => {
    const interval = window.setInterval(() => {
      const user = getStoredUser();
      if (!user) return;
      if (isSessionExpired(user)) {
        onSessionExpired();
        clearStoredUser();
        navigate("/login");
      }
    }, 60 * 1000); // Check every minute

    return () => window.clearInterval(interval);
  }, [navigate, onSessionExpired]);

  return null;
}

function ProtectedRoute({ element, allowedRoles }: { element: ReactNode; allowedRoles: Role[] }) {
  const user = getStoredUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHomeRoute(user.role)} replace />;
  }
  return <>{element}</>;
}

export default function App() {
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    void loadStoredUser();
  }, []);

  return (
    <BrowserRouter>
      <SessionWatcher onSessionExpired={() => setSessionExpired(true)} />
      <SessionExpiredModal
        isOpen={sessionExpired}
        onClose={() => setSessionExpired(false)}
      />
      <SessionWarningBanner />
      <AIBackground />
      <main id="main-content" role="main" tabIndex={-1}>
        <Suspense fallback={<div className="app-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading experience...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/candidate" element={<ProtectedRoute element={<CandidateDashboard />} allowedRoles={["candidate", "recruiter", "trainer", "super-admin"]} />} />
            <Route path="/assessment" element={<ProtectedRoute element={<AssessmentHub />} allowedRoles={["candidate", "recruiter", "trainer", "super-admin"]} />} />
            <Route path="/assessment/start/:assessmentType" element={<ProtectedRoute element={<AssessmentStart />} allowedRoles={["candidate", "recruiter", "trainer", "super-admin"]} />} />
            <Route path="/assessment/test" element={<ProtectedRoute element={<AssessmentTest />} allowedRoles={["candidate", "recruiter", "trainer", "super-admin"]} />} />
            <Route path="/assessment/mcq" element={<ProtectedRoute element={<AssessmentMCQ />} allowedRoles={["candidate", "recruiter", "trainer", "super-admin"]} />} />
            <Route path="/assessment/coding" element={<ProtectedRoute element={<AssessmentCoding />} allowedRoles={["candidate", "recruiter", "trainer", "super-admin"]} />} />
            <Route path="/assessment/aptitude-communication" element={<ProtectedRoute element={<AssessmentAptitudeCommunication />} allowedRoles={["candidate", "recruiter", "trainer", "super-admin"]} />} />
            <Route path="/assessment/interview" element={<ProtectedRoute element={<AssessmentInterview />} allowedRoles={["candidate", "recruiter", "trainer", "super-admin"]} />} />
            <Route path="/profile/complete" element={<ProtectedRoute element={<ProfileComplete />} allowedRoles={["candidate", "recruiter", "trainer", "super-admin"]} />} />
            <Route path="/verify-certificate" element={<ProtectedRoute element={<VerifyCertificate />} allowedRoles={["candidate", "recruiter", "trainer", "super-admin"]} />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/admin/interviews" element={<ProtectedRoute element={<AdminDashboard />} allowedRoles={["recruiter", "trainer", "super-admin"]} />} />
            <Route path="/admin/:section" element={<ProtectedRoute element={<AdminSection />} allowedRoles={["super-admin"]} />} />
            <Route path="/recruiter" element={<ProtectedRoute element={<RecruiterDashboard />} allowedRoles={["recruiter", "super-admin"]} />} />
            <Route path="/trainer" element={<ProtectedRoute element={<TrainerDashboard />} allowedRoles={["trainer", "super-admin"]} />} />
            <Route path="/admin" element={<ProtectedRoute element={<AdminDashboard />} allowedRoles={["super-admin"]} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <ChatBot />
    </BrowserRouter>
  );
}
