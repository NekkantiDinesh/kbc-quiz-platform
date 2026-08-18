import { Routes, Route, Navigate } from 'react-router-dom';
import EmployeeLogin from './pages/EmployeeLogin.jsx';
import PlayScreen from './pages/PlayScreen.jsx';
import HostLogin from './pages/HostLogin.jsx';
import HostDashboard from './pages/HostDashboard.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<EmployeeLogin />} />
      <Route path="/play" element={<PlayScreen />} />
      <Route path="/host" element={<HostLogin />} />
      <Route path="/host/dashboard" element={<HostDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
