import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { questions as questionBank, validateQuestions } from './questions.js';
import { QuizSession, PHASES } from './quizSession.js';

validateQuestions(questionBank);

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',');
const HOST_PASSCODE = process.env.HOST_PASSCODE || 'changeme123';
const DEFAULT_TIME_LIMIT_SEC = Number(process.env.DEFAULT_TIME_LIMIT_SEC || 20);

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
  // Keep pings frequent enough to detect drops quickly at scale, but not so
  // frequent they add needless load with ~1000 concurrent sockets.
  pingInterval: 10000,
  pingTimeout: 8000,
});

const session = new QuizSession(questionBank, DEFAULT_TIME_LIMIT_SEC);

const HOST_ROOM = 'host-room';
const EMPLOYEE_ROOM = 'employee-room';

function broadcastHostState() {
  io.to(HOST_ROOM).emit('host:state', session.hostSnapshot());
}

function broadcastLobbyCount() {
  io.to(EMPLOYEE_ROOM).emit('lobby:count', { connectedCount: session.connectedCount() });
}

io.on('connection', (socket) => {
  // ---------------- Host events ----------------

  socket.on('host:login', ({ passcode } = {}, ack) => {
    if (passcode !== HOST_PASSCODE) {
      return ack?.({ success: false, error: 'Incorrect passcode.' });
    }
    socket.data.role = 'host';
    socket.join(HOST_ROOM);
    ack?.({ success: true, state: session.hostSnapshot() });
    // Emit the initial state to the newly connected host
    socket.emit('host:state', session.hostSnapshot());
  });

  socket.on('host:startQuiz', (_payload, ack) => {
    if (socket.data.role !== 'host') return ack?.({ success: false, error: 'Not authorized.' });
    const q = session.startQuiz();
    io.emit('session:phaseChange', { phase: PHASES.QUESTION });
    io.to(EMPLOYEE_ROOM).emit('question:show', q);
    broadcastHostState();
    ack?.({ success: true });
  });

  socket.on('host:revealAnswer', (_payload, ack) => {
    if (socket.data.role !== 'host') return ack?.({ success: false, error: 'Not authorized.' });
    const reveal = session.revealCurrent();
    if (!reveal) return ack?.({ success: false, error: 'No active question.' });
    io.emit('session:phaseChange', { phase: PHASES.REVEAL });
    io.to(EMPLOYEE_ROOM).emit('answer:reveal', {
      ...reveal,
      leaderboard: session.leaderboard(10),
    });
    broadcastHostState();
    ack?.({ success: true });
  });

  socket.on('host:nextQuestion', (_payload, ack) => {
    if (socket.data.role !== 'host') return ack?.({ success: false, error: 'Not authorized.' });
    const q = session.nextQuestion();
    if (!q) {
      session.endQuiz();
      io.emit('session:phaseChange', { phase: PHASES.FINISHED });
      io.to(EMPLOYEE_ROOM).emit('quiz:finished', { leaderboard: session.leaderboard(20) });
      broadcastHostState();
      return ack?.({ success: true, finished: true });
    }
    io.emit('session:phaseChange', { phase: PHASES.QUESTION });
    io.to(EMPLOYEE_ROOM).emit('question:show', q);
    broadcastHostState();
    ack?.({ success: true });
  });

  socket.on('host:endQuiz', (_payload, ack) => {
    if (socket.data.role !== 'host') return ack?.({ success: false, error: 'Not authorized.' });
    session.endQuiz();
    io.emit('session:phaseChange', { phase: PHASES.FINISHED });
    io.to(EMPLOYEE_ROOM).emit('quiz:finished', { leaderboard: session.leaderboard(20) });
    broadcastHostState();
    ack?.({ success: true });
  });

  socket.on('host:resetToLobby', (_payload, ack) => {
    if (socket.data.role !== 'host') return ack?.({ success: false, error: 'Not authorized.' });
    session.resetToLobby();
    io.emit('session:phaseChange', { phase: PHASES.LOBBY });
    broadcastHostState();
    broadcastLobbyCount();
    ack?.({ success: true });
  });

  // ---------------- Employee events ----------------

  socket.on('employee:join', ({ name, employeeId } = {}, ack) => {
    const cleanName = String(name || '').trim().slice(0, 60);
    const cleanId = String(employeeId || '').trim().slice(0, 60);
    if (!cleanName || !cleanId) {
      return ack?.({ success: false, error: 'Name and employee ID are required.' });
    }
    socket.data.role = 'employee';
    socket.data.employeeId = cleanId;
    socket.join(EMPLOYEE_ROOM);

    const emp = session.upsertEmployee(cleanId, cleanName, socket.id);

    ack?.({
      success: true,
      employee: { employeeId: emp.employeeId, name: emp.name, score: emp.score },
      snapshot: session.publicSnapshotForEmployee(cleanId),
    });

    broadcastLobbyCount();
    broadcastHostState();
  });

  socket.on('employee:submitAnswer', ({ questionId, optionIndex } = {}, ack) => {
    if (socket.data.role !== 'employee' || !socket.data.employeeId) {
      return ack?.({ success: false, error: 'Not registered.' });
    }
    const result = session.submitAnswer(socket.data.employeeId, questionId, optionIndex);
    ack?.(result);
    broadcastHostState();
  });

  socket.on('employee:resync', (_payload, ack) => {
    if (socket.data.role !== 'employee' || !socket.data.employeeId) {
      return ack?.({ success: false, error: 'Not registered.' });
    }
    ack?.({ success: true, snapshot: session.publicSnapshotForEmployee(socket.data.employeeId) });
  });

  // ---------------- Disconnect ----------------

  socket.on('disconnect', () => {
    if (socket.data.role === 'employee') {
      session.handleDisconnect(socket.id);
      broadcastLobbyCount();
      broadcastHostState();
    }
  });
});

server.listen(PORT, () => {
  console.log(`KBC quiz server listening on :${PORT}`);
  console.log(`Allowed client origin(s): ${CLIENT_ORIGIN.join(', ')}`);
});
