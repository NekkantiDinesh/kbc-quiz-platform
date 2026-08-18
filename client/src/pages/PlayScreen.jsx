import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket, emitAck } from '../socket.js';
import Timer from '../components/Timer.jsx';
import AnswerBar from '../components/AnswerBar.jsx';
import Leaderboard from '../components/Leaderboard.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function PlayScreen() {
  const navigate = useNavigate();
  const employeeRef = useRef(null);

  const [phase, setPhase] = useState('lobby');
  const [lobbyCount, setLobbyCount] = useState(0);
  const [question, setQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState(null);
  const [yourScore, setYourScore] = useState(0);
  const [yourRank, setYourRank] = useState(null);
  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('kbc_employee');
    if (!stored) {
      navigate('/');
      return;
    }
    const employee = JSON.parse(stored);
    employeeRef.current = employee;
    setYourScore(employee.score || 0);

    async function join() {
      if (!socket.connected) socket.connect();
      const res = await emitAck('employee:join', {
        name: employee.name,
        employeeId: employee.employeeId,
      });
      if (!res?.success) {
        navigate('/');
        return;
      }
      applySnapshot(res.snapshot);
      setConnecting(false);
    }

    function applySnapshot(snap) {
      if (!snap) return;
      setPhase(snap.phase);
      if (snap.phase === 'question' && snap.question) {
        setQuestion(snap.question);
        setHasAnswered(!!snap.alreadyAnswered);
      }
      if (snap.phase === 'reveal' && snap.reveal) {
        setReveal(snap.reveal);
        setYourScore(snap.yourScore ?? 0);
        setYourRank(snap.yourRank ?? null);
      }
      if (snap.phase === 'finished' && snap.leaderboard) {
        setFinalLeaderboard(snap.leaderboard);
        setYourScore(snap.yourScore ?? 0);
        setYourRank(snap.yourRank ?? null);
      }
    }

    function onLobbyCount({ connectedCount }) {
      setLobbyCount(connectedCount);
    }
    function onQuestionShow(q) {
      setPhase('question');
      setQuestion(q);
      setSelectedOption(null);
      setHasAnswered(false);
      setReveal(null);
    }
    function onAnswerReveal(data) {
      setPhase('reveal');
      setReveal(data);
      const me = data.leaderboard?.find((e) => e.employeeId === employeeRef.current.employeeId);
      if (me) {
        setYourScore(me.score);
        setYourRank(me.rank);
      }
    }
    function onQuizFinished(data) {
      setPhase('finished');
      setFinalLeaderboard(data.leaderboard);
      const me = data.leaderboard?.find((e) => e.employeeId === employeeRef.current.employeeId);
      if (me) {
        setYourScore(me.score);
        setYourRank(me.rank);
      }
    }
    function onPhaseChange({ phase: p }) {
      if (p === 'lobby') {
        setPhase('lobby');
        setQuestion(null);
        setReveal(null);
        setFinalLeaderboard(null);
      }
    }

    socket.on('lobby:count', onLobbyCount);
    socket.on('question:show', onQuestionShow);
    socket.on('answer:reveal', onAnswerReveal);
    socket.on('quiz:finished', onQuizFinished);
    socket.on('session:phaseChange', onPhaseChange);
    socket.on('connect', join);

    join();

    return () => {
      socket.off('lobby:count', onLobbyCount);
      socket.off('question:show', onQuestionShow);
      socket.off('answer:reveal', onAnswerReveal);
      socket.off('quiz:finished', onQuizFinished);
      socket.off('session:phaseChange', onPhaseChange);
      socket.off('connect', join);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pickOption(i) {
    if (hasAnswered || !question) return;
    setSelectedOption(i);
    setHasAnswered(true); // lock immediately so a slow network doesn't allow double taps
    const res = await emitAck('employee:submitAnswer', {
      questionId: question.questionId,
      optionIndex: i,
    });
    if (!res?.ok) {
      // couldn't record it (time ran out etc.) — keep UI locked, just note it
      console.warn('Answer not recorded:', res?.reason);
    }
  }

  if (connecting) {
    return (
      <div className="screen center">
        <p className="subtitle">Connecting…</p>
      </div>
    );
  }

  return (
    <div className="screen play-screen">
      <div className="play-topbar">
        <span className="eyebrow">MINI KBC</span>
        <span className="score-chip">Score: {yourScore}</span>
      </div>

      {phase === 'lobby' && (
        <div className="center-fill">
          <div className="card lobby-card">
            <div className="pulse-dot" />
            <h1 className="title small">You're in!</h1>
            <p className="subtitle">Waiting for the host to start the quiz…</p>
            <p className="muted">{lobbyCount} players connected</p>
          </div>
        </div>
      )}

      {phase === 'question' && question && (
        <div className="question-view">
          <div className="q-meta">
            Question {question.index + 1} / {question.total}
          </div>
          <Timer startedAt={question.startedAt} timeLimitSec={question.timeLimitSec} />
          <h2 className="q-text">{question.text}</h2>
          <div className="options-grid">
            {question.options.map((opt, i) => (
              <button
                key={i}
                className={`option-btn ${selectedOption === i ? 'selected' : ''} ${hasAnswered && selectedOption !== i ? 'dimmed' : ''}`}
                onClick={() => pickOption(i)}
                disabled={hasAnswered}
              >
                <span className="option-letter">{LETTERS[i]}</span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
          {hasAnswered && <p className="locked-in">Answer locked in — waiting for the host…</p>}
        </div>
      )}

      {phase === 'reveal' && reveal && (
        <div className="reveal-view">
          <h2 className="q-text">{reveal.text || question?.text || 'Answer'}</h2>
          <div className="answer-bars">
            {(reveal.options || question?.options || []).map((opt, i) => (
              <AnswerBar
                key={i}
                index={i}
                label={opt}
                count={reveal.distribution[i]}
                total={reveal.answeredCount}
                isCorrect={i === reveal.correctIndex}
                isSelected={i === selectedOption}
              />
            ))}
          </div>
          {yourRank && (
            <p className="your-rank">
              You're rank #{yourRank} with {yourScore} points
            </p>
          )}
          <h3 className="mini-heading">Leaderboard</h3>
          <Leaderboard entries={reveal.leaderboard} highlightId={employeeRef.current?.employeeId} />
        </div>
      )}

      {phase === 'finished' && finalLeaderboard && (
        <div className="center-fill">
          <div className="card lobby-card">
            <h1 className="title small">Quiz Finished 🏆</h1>
            {yourRank && (
              <p className="subtitle">
                You finished rank #{yourRank} with {yourScore} points
              </p>
            )}
            <h3 className="mini-heading">Final Leaderboard</h3>
            <Leaderboard entries={finalLeaderboard} highlightId={employeeRef.current?.employeeId} />
          </div>
        </div>
      )}
    </div>
  );
}
