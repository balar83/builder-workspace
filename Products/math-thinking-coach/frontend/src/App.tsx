import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ChapterSelectionPage from "./pages/ChapterSelectionPage";
import ChapterPage from "./pages/ChapterPage";
import QuestionPage from "./pages/QuestionPage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chapters" element={<ChapterSelectionPage />} />
        <Route path="/chapter/:chapterId" element={<ChapterPage />} />
        <Route path="/question/:chapterId" element={<QuestionPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;