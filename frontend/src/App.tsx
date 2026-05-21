import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";
import { TopicsPage } from "@/pages/TopicsPage";
import { DuePage } from "@/pages/DuePage";
import { MasteryPage } from "@/pages/MasteryPage";
import { SessionPage } from "@/pages/SessionPage";
import { BaselinePage } from "@/pages/BaselinePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/topics" element={<TopicsPage />} />
        <Route path="/due" element={<DuePage />} />
        <Route path="/mastery" element={<MasteryPage />} />
        <Route path="/baseline/:topicId" element={<BaselinePage />} />
        <Route path="/session/:sessionId" element={<SessionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
