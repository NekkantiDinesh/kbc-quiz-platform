export default function Leaderboard({ entries, highlightId }) {
  if (!entries || entries.length === 0) {
    return <p className="muted">No scores yet.</p>;
  }
  return (
    <ol className="leaderboard">
      {entries.map((e) => (
        <li
          key={e.employeeId}
          className={`leaderboard-row ${e.employeeId === highlightId ? 'me' : ''} ${e.rank <= 3 ? `top top-${e.rank}` : ''}`}
        >
          <span className="lb-rank">{e.rank}</span>
          <span className="lb-name">{e.name}</span>
          <span className="lb-score">{e.score}</span>
        </li>
      ))}
    </ol>
  );
}
