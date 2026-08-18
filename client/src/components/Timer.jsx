import { useEffect, useState } from 'react';

export default function Timer({ startedAt, timeLimitSec }) {
  const [remaining, setRemaining] = useState(timeLimitSec);

  useEffect(() => {
    function tick() {
      const elapsed = (Date.now() - startedAt) / 1000;
      setRemaining(Math.max(0, Math.ceil(timeLimitSec - elapsed)));
    }
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [startedAt, timeLimitSec]);

  const pct = Math.max(0, Math.min(100, (remaining / timeLimitSec) * 100));
  const low = remaining <= 5;

  return (
    <div className="timer">
      <div className="timer-track">
        <div
          className={`timer-fill ${low ? 'low' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`timer-text ${low ? 'low' : ''}`}>{remaining}s</span>
    </div>
  );
}
