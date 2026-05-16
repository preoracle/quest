import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CatalogPage } from "./pages/CatalogPage";
import { MasteryPage } from "./pages/MasteryPage";
import { SessionPage } from "./pages/SessionPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/session/:sessionId" element={<SessionPage />} />
        <Route path="/mastery" element={<MasteryPage />} />
      </Routes>
    </BrowserRouter>
  );
}
