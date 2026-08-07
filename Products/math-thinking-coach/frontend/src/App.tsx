import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ChapterSelectionPage from "./pages/ChapterSelectionPage";
import ChapterPage from "./pages/ChapterPage";
import TopicPage from "./pages/TopicPage";
import QuestionPage from "./pages/QuestionPage";
import TeacherAuthPage from "./pages/TeacherAuthPage";
import StudentJoinPage from "./pages/StudentJoinPage";
import DashboardPage from "./pages/DashboardPage";
import StartPracticePage from "./pages/StartPracticePage";
import SessionQuestionPage from "./pages/SessionQuestionPage";
import NotFoundPage from "./pages/NotFoundPage";
import RequireStudent from "./components/RequireStudent";
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
        <Route
          path="/dashboard"
          element={
            <RequireStudent>
              <DashboardPage />
            </RequireStudent>
          }
        />
        <Route
          path="/practice/:chapterId"
          element={
            <RequireStudent>
              <StartPracticePage />
            </RequireStudent>
          }
        />
        <Route
          path="/session/:sessionId"
          element={
            <RequireStudent>
              <SessionQuestionPage />
            </RequireStudent>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;