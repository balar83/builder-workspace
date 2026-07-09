import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <main className="container">
      <h1>🧠 Math Thinking Coach</h1>

      <p className="tagline">
        Learn by Thinking, Not Memorizing.
      </p>

      <div className="button-group">
        <button>Continue Learning</button>

        <button onClick={() => navigate("/chapters")}>
          Select Chapter
        </button>
      </div>
    </main>
  );
}