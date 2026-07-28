import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ChapterSelectionPage from "./pages/ChapterSelectionPage";
import ChapterPage from "./pages/ChapterPage";
import TopicPage from "./pages/TopicPage";
import QuestionPage from "./pages/QuestionPage";
import TeacherAuthPage from "./pages/TeacherAuthPage";
import StudentJoinPage from "./pages/StudentJoinPage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chapters" element={<ChapterSelectionPage />} />
        <Route path="/chapter/:chapterId" element={<ChapterPage />} />
        <Route path="/topic/:topicId" element={<TopicPage />} />
        <Route path="/question/:chapterId" element={<QuestionPage />} />
        <Route path="/teacher" element={<TeacherAuthPage />} />
        <Route path="/student/join" element={<StudentJoinPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;