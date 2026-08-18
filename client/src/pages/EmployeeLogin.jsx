import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { socket, emitAck } from '../socket.js';

export default function EmployeeLogin() {
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !employeeId.trim()) {
      setError('Enter both your name and employee ID.');
      return;
    }
    setLoading(true);
    if (!socket.connected) socket.connect();

    const res = await emitAck('employee:join', {
      name: name.trim(),
      employeeId: employeeId.trim(),
    });
    setLoading(false);

    if (!res?.success) {
      setError(res?.error || 'Could not join. Try again.');
      return;
    }
    localStorage.setItem('kbc_employee', JSON.stringify(res.employee));
    navigate('/play');
  }

  return (
    <div className="screen center">
      <div className="card login-card">
        <div className="eyebrow">MINI KBC · LIVE QUIZ</div>
        <h1 className="title">Kaun Banega Champion?</h1>
        <p className="subtitle">Enter your details to join the live round.</p>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Your Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              autoComplete="name"
              maxLength={60}
            />
          </label>
          <label className="field">
            <span>Employee ID</span>
            <input
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="e.g. EMP1042"
              autoComplete="off"
              maxLength={60}
            />
          </label>

          {error && <div className="error-text">{error}</div>}

          <button className="btn btn-gold" type="submit" disabled={loading}>
            {loading ? 'Joining…' : 'Join the Quiz'}
          </button>
        </form>

        <Link className="host-link" to="/host">
          I'm the host →
        </Link>
      </div>
    </div>
  );
}
