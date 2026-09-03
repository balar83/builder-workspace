import type { DailyActivityDay } from '../services/dailyActivity';
import './DailyActivityChart.css';

export interface DailyActivityChartProps {
  days: DailyActivityDay[];
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Parses a local calendar-date key (YYYY-MM-DD, already computed against the
// browser's own timezone by buildDailyActivity) using the local Date
// constructor - never new Date(dateKey) directly, which the spec parses as
// UTC midnight and could shift the weekday by one under a negative offset.
function weekdayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
}

// Activity is the primary visual signal (bar height, bold count); questions
// eventually solved correctly is shown only as small, muted secondary text
// below each bar - deliberately not a second bar, a fill colour, or
// anything that would read as a conventional score/grade chart.
export default function DailyActivityChart({ days }: DailyActivityChartProps) {
  const maxAttempted = Math.max(1, ...days.map((day) => day.questionsAttempted));
  const hasAnyActivity = days.some((day) => day.questionsAttempted > 0);
  const today = days[days.length - 1]?.date;

  return (
    <div className="daily-activity-chart">
      {!hasAnyActivity && (
        <p className="daily-activity-empty">No practice recorded in the last 7 days yet.</p>
      )}
      <div className="daily-activity-bars" role="img" aria-label="Questions practiced over the last 7 days">
        {days.map((day) => {
          const heightPercent = hasAnyActivity
            ? Math.max(6, Math.round((day.questionsAttempted / maxAttempted) * 100))
            : 4;

          return (
            <div className="daily-activity-day" key={day.date}>
              <div className="daily-activity-track">
                <div
                  className="daily-activity-bar"
                  style={{ height: `${heightPercent}%` }}
                  title={`${day.questionsAttempted} question${day.questionsAttempted === 1 ? '' : 's'} practiced`}
                />
              </div>
              <span className="daily-activity-count">{day.questionsAttempted}</span>
              <span className="daily-activity-correct">
                {day.questionsCorrect > 0 ? `${day.questionsCorrect} solved` : ''}
              </span>
              <span className="daily-activity-weekday">
                {day.date === today ? 'Today' : weekdayLabel(day.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
