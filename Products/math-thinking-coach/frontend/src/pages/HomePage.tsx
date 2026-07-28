import { useNavigate } from "react-router-dom";
import { progressService } from "../services/progressService";

export default function HomePage() {
  const navigate = useNavigate();

  const handleContinueLearning = () => {
    const lastActiveChapterId = progressService.getLastActiveChapter();
    navigate(lastActiveChapterId ? `/chapter/${lastActiveChapterId}` : "/chapters");
  };

  return (
    <main className="container">
      <h1>🧠 Math Thinking Coach</h1>

      <p className="tagline">
        Learn by Thinking, Not Memorizing.
      </p>

      <div className="button-group">
        <button onClick={handleContinueLearning}>Continue Learning</button>

        <button onClick={() => navigate("/chapters")}>
          Select Chapter
        </button>
      </div>
    </main>
  );
}