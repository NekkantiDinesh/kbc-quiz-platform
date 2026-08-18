const LETTERS = ['A', 'B', 'C', 'D'];

export default function AnswerBar({ index, label, count, total, isCorrect, isSelected }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`answer-bar ${isCorrect ? 'correct' : ''} ${isSelected ? 'selected' : ''}`}>
      <div className="answer-bar-label">
        <span className="answer-letter">{LETTERS[index]}</span>
        <span>{label}</span>
        {isCorrect && <span className="tag-correct">Correct</span>}
        {isSelected && !isCorrect && <span className="tag-selected">Your answer</span>}
      </div>
      <div className="answer-bar-track">
        <div className="answer-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="answer-bar-count">
        {count} · {pct}%
      </div>
    </div>
  );
}
