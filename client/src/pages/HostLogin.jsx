import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { socket, emitAck } from '../socket.js';

export default function HostLogin() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!socket.connected) socket.connect();

    const res = await emitAck('host:login', { passcode });
    setLoading(false);

    if (!res?.success) {
      setError(res?.error || 'Incorrect passcode.');
      return;
    }
    sessionStorage.setItem('kbc_host', '1');
    navigate('/host/dashboard');
  }

  return (
    <div className="screen center">
      <div className="card login-card">
        <div className="eyebrow">CONTROL ROOM</div>
        <h1 className="title">Host Login</h1>
        <p className="subtitle">Enter the host passcode to open the control room.</p>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Passcode</span>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoComplete="off"
            />
          </label>

          {error && <div className="error-text">{error}</div>}

          <button className="btn btn-gold" type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Enter Control Room'}
          </button>
        </form>

        <Link className="host-link" to="/">
          ← Back to employee login
        </Link>
      </div>
    </div>
  );
}
