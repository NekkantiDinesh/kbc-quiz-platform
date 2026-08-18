import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket, emitAck } from '../socket.js';
import Leaderboard from '../components/Leaderboard.jsx';

export default function HostDashboard() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket.connected || !sessionStorage.getItem('kbc_host')) {
      navigate('/host');
      return;
    }

    function onState(s) {
      setState(s);
    }
    socket.on('host:state', onState);

    // Ask for a fresh snapshot by re-emitting nothing — host:state is pushed
    // by the server on every event, so request one explicitly via a no-op.
    return () => {
      socket.off('host:state', onState);
    };
  }, [navigate]);

  async function act(event) {
    setBusy(true);
    const res = await emitAck(event, {});
    setBusy(false);
    if (!res?.success) alert(res?.error || 'Action failed.');
  }

  if (!state) {
    return (
      <div className="screen center">
        <p className="subtitle">Connecting to control room…</p>
      </div>
    );
  }

  const { phase, connectedCount, employees, submissionCount, currentQuestion, currentIndex, totalQuestions, leaderboard } = state;

  return (
    <div className="screen host-screen">
      <header className="host-header">
        <div>
          <div className="eyebrow">CONTROL ROOM</div>
          <h1 className="title small">Mini KBC — Host Dashboard</h1>
        </div>
        <div className="phase-pill">{phase.toUpperCase()}</div>
      </header>

      <div className="host-grid">
        <section className="card">
          <h2 className="section-title">Live Status</h2>
          <div className="stat-row">
            <div className="stat">
              <div className="stat-value">{connectedCount}</div>
              <div className="stat-label">Connected now</div>
            </div>
            <div className="stat">
              <div className="stat-value">{employees.length}</div>
              <div className="stat-label">Total joined</div>
            </div>
            {phase === 'question' && (
              <div className="stat">
                <div className="stat-value">{submissionCount}</div>
                <div className="stat-label">Answered</div>
              </div>
            )}
          </div>

          {currentQuestion && (
            <p className="current-q">
              Q{currentIndex + 1}/{totalQuestions}: {currentQuestion.text}
            </p>
          )}

          <div className="host-actions">
            {phase === 'lobby' && (
              <button className="btn btn-gold" disabled={busy} onClick={() => act('host:startQuiz')}>
                Start Quiz
              </button>
            )}
            {phase === 'question' && (
              <button className="btn btn-gold" disabled={busy} onClick={() => act('host:revealAnswer')}>
                Reveal Answer
              </button>
            )}
            {phase === 'reveal' && (
              <button className="btn btn-gold" disabled={busy} onClick={() => act('host:nextQuestion')}>
                Next Question
              </button>
            )}
            {(phase === 'question' || phase === 'reveal') && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => act('host:endQuiz')}>
                End Quiz Now
              </button>
            )}
            {phase === 'finished' && (
              <button className="btn btn-gold" disabled={busy} onClick={() => act('host:resetToLobby')}>
                Reset for New Round
              </button>
            )}
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Leaderboard</h2>
          <Leaderboard entries={leaderboard} />
        </section>

        <section className="card employee-list-card">
          <h2 className="section-title">Employees ({employees.length})</h2>
          <div className="employee-list">
            {employees.map((e) => (
              <div key={e.employeeId} className={`employee-row ${e.connected ? '' : 'offline'}`}>
                <span className="dot" />
                <span className="emp-name">{e.name}</span>
                <span className="emp-id">{e.employeeId}</span>
                <span className="emp-score">{e.score}</span>
              </div>
            ))}
            {employees.length === 0 && <p className="muted">No one has joined yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
