const PHASES = {
  LOBBY: 'lobby',
  QUESTION: 'question',
  REVEAL: 'reveal',
  FINISHED: 'finished',
};

const BASE_POINTS = 1000;
const MIN_POINTS = 300;
const SPEED_BONUS_SHARE = 0.5; // up to 50% of BASE_POINTS lost to slow answers

export class QuizSession {
  constructor(questions, defaultTimeLimitSec) {
    this.questions = questions;
    this.defaultTimeLimitSec = defaultTimeLimitSec;

    this.phase = PHASES.LOBBY;
    this.currentIndex = -1;
    this.questionStartedAt = null;
    this.questionTimeLimitMs = null;
    this.lockTimer = null;

    // employeeId -> employee record
    this.employees = new Map();
    // socketId -> employeeId (to resolve on disconnect)
    this.socketToEmployee = new Map();

    this.hostSocketId = null;
  }

  // ---------- Employees ----------

  upsertEmployee(employeeId, name, socketId) {
    let emp = this.employees.get(employeeId);
    if (!emp) {
      emp = {
        employeeId,
        name,
        socketId,
        connected: true,
        score: 0,
        history: new Map(), // questionId -> { optionIndex, timeMs, correct, points }
      };
      this.employees.set(employeeId, emp);
    } else {
      emp.name = name || emp.name;
      emp.socketId = socketId;
      emp.connected = true;
    }
    this.socketToEmployee.set(socketId, employeeId);
    return emp;
  }

  handleDisconnect(socketId) {
    const employeeId = this.socketToEmployee.get(socketId);
    if (!employeeId) return null;
    this.socketToEmployee.delete(socketId);
    const emp = this.employees.get(employeeId);
    if (emp && emp.socketId === socketId) {
      emp.connected = false;
    }
    return employeeId;
  }

  connectedCount() {
    let n = 0;
    for (const e of this.employees.values()) if (e.connected) n++;
    return n;
  }

  employeeList() {
    return Array.from(this.employees.values())
      .map((e) => ({
        employeeId: e.employeeId,
        name: e.name,
        connected: e.connected,
        score: e.score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  // ---------- Quiz flow ----------

  get currentQuestion() {
    return this.currentIndex >= 0 ? this.questions[this.currentIndex] : null;
  }

  startQuiz() {
    if (this.questions.length === 0) throw new Error('No questions loaded.');
    this.currentIndex = -1;
    for (const e of this.employees.values()) {
      e.score = 0;
      e.history.clear();
    }
    return this.nextQuestion();
  }

  nextQuestion() {
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.currentIndex += 1;
    if (this.currentIndex >= this.questions.length) {
      this.phase = PHASES.FINISHED;
      this.currentIndex = this.questions.length - 1;
      return null;
    }
    const q = this.currentQuestion;
    this.phase = PHASES.QUESTION;
    this.questionStartedAt = Date.now();
    this.questionTimeLimitMs = (q.timeLimitSec || this.defaultTimeLimitSec) * 1000;
    return this.publicQuestion();
  }

  publicQuestion() {
    const q = this.currentQuestion;
    if (!q) return null;
    return {
      questionId: q.id,
      index: this.currentIndex,
      total: this.questions.length,
      text: q.text,
      options: q.options,
      timeLimitSec: q.timeLimitSec || this.defaultTimeLimitSec,
      startedAt: this.questionStartedAt,
    };
  }

  isSubmissionWindowOpen() {
    if (this.phase !== PHASES.QUESTION) return false;
    return Date.now() - this.questionStartedAt <= this.questionTimeLimitMs;
  }

  submitAnswer(employeeId, questionId, optionIndex) {
    const q = this.currentQuestion;
    if (!q || q.id !== questionId) return { ok: false, reason: 'Question has moved on.' };
    if (!this.isSubmissionWindowOpen()) return { ok: false, reason: 'Time is up.' };
    const emp = this.employees.get(employeeId);
    if (!emp) return { ok: false, reason: 'Not registered.' };
    if (emp.history.has(questionId)) return { ok: false, reason: 'Already answered.' };
    if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex > 3) {
      return { ok: false, reason: 'Invalid option.' };
    }

    const timeMs = Date.now() - this.questionStartedAt;
    const correct = optionIndex === q.correctIndex;
    let points = 0;
    if (correct) {
      const speedFraction = Math.max(0, 1 - timeMs / this.questionTimeLimitMs);
      points = Math.round(
        BASE_POINTS - BASE_POINTS * SPEED_BONUS_SHARE * (1 - speedFraction)
      );
      points = Math.max(MIN_POINTS, points);
    }
    emp.history.set(questionId, { optionIndex, timeMs, correct, points });
    emp.score += points;

    return { ok: true, correct, points };
  }

  submissionCount() {
    const q = this.currentQuestion;
    if (!q) return 0;
    let n = 0;
    for (const e of this.employees.values()) if (e.history.has(q.id)) n++;
    return n;
  }

  revealCurrent() {
    const q = this.currentQuestion;
    if (!q) return null;
    this.phase = PHASES.REVEAL;
    const distribution = [0, 0, 0, 0];
    let correctCount = 0;
    let answeredCount = 0;
    for (const e of this.employees.values()) {
      const h = e.history.get(q.id);
      if (h) {
        answeredCount += 1;
        distribution[h.optionIndex] += 1;
        if (h.correct) correctCount += 1;
      }
    }
    return {
      questionId: q.id,
      correctIndex: q.correctIndex,
      distribution,
      correctCount,
      answeredCount,
      totalPlayers: this.employees.size,
    };
  }

  leaderboard(limit = 10) {
    return Array.from(this.employees.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((e, i) => ({ rank: i + 1, employeeId: e.employeeId, name: e.name, score: e.score }));
  }

  rankOf(employeeId) {
    const sorted = Array.from(this.employees.values()).sort((a, b) => b.score - a.score);
    const idx = sorted.findIndex((e) => e.employeeId === employeeId);
    return idx === -1 ? null : idx + 1;
  }

  endQuiz() {
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.phase = PHASES.FINISHED;
  }

  resetToLobby() {
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.phase = PHASES.LOBBY;
    this.currentIndex = -1;
    for (const e of this.employees.values()) {
      e.score = 0;
      e.history.clear();
    }
  }

  // ---------- Sync state for (re)connecting clients ----------

  publicSnapshotForEmployee(employeeId) {
    const emp = this.employees.get(employeeId);
    const base = {
      phase: this.phase,
      totalQuestions: this.questions.length,
    };
    if (this.phase === PHASES.QUESTION) {
      return { ...base, question: this.publicQuestion(), alreadyAnswered: emp?.history.has(this.currentQuestion.id) || false };
    }
    if (this.phase === PHASES.REVEAL) {
      return { ...base, reveal: this.revealSnapshot(), leaderboard: this.leaderboard(10), yourRank: this.rankOf(employeeId), yourScore: emp?.score ?? 0 };
    }
    if (this.phase === PHASES.FINISHED) {
      return { ...base, leaderboard: this.leaderboard(10), yourRank: this.rankOf(employeeId), yourScore: emp?.score ?? 0 };
    }
    return base;
  }

  revealSnapshot() {
    const q = this.currentQuestion;
    if (!q) return null;
    const distribution = [0, 0, 0, 0];
    let correctCount = 0;
    let answeredCount = 0;
    for (const e of this.employees.values()) {
      const h = e.history.get(q.id);
      if (h) {
        answeredCount += 1;
        distribution[h.optionIndex] += 1;
        if (h.correct) correctCount += 1;
      }
    }
    return {
      questionId: q.id,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      distribution,
      correctCount,
      answeredCount,
      totalPlayers: this.employees.size,
    };
  }

  hostSnapshot() {
    return {
      phase: this.phase,
      currentIndex: this.currentIndex,
      totalQuestions: this.questions.length,
      currentQuestion: this.currentQuestion
        ? { id: this.currentQuestion.id, text: this.currentQuestion.text }
        : null,
      submissionCount: this.submissionCount(),
      connectedCount: this.connectedCount(),
      employees: this.employeeList(),
      leaderboard: this.leaderboard(10),
    };
  }
}

export { PHASES };
