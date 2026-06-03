import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/layouts/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { TopicsPage } from "@/pages/TopicsPage";
import { TopicDetailPage } from "@/pages/TopicDetailPage";
import { DuePage } from "@/pages/DuePage";
import { MasteryPage } from "@/pages/MasteryPage";
import { SessionPage } from "@/pages/SessionPage";
import { BaselinePage } from "@/pages/BaselinePage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { OnboardingPage } from "@/pages/OnboardingPage";

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <HomePage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route element={<AppLayout />}>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics"
            element={
              <ProtectedRoute>
                <TopicsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics/:topicId"
            element={
              <ProtectedRoute>
                <TopicDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/due"
            element={
              <ProtectedRoute>
                <DuePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mastery"
            element={
              <ProtectedRoute>
                <MasteryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/baseline/:topicId"
            element={
              <ProtectedRoute>
                <BaselinePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/session/:sessionId"
            element={
              <ProtectedRoute>
                <SessionPage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
