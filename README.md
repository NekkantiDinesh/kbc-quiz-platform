# Mini KBC — Live Multiplayer Quiz Platform

A real-time, host-controlled quiz for 500–1000 employees on their own devices.
Built with **Node.js + Socket.IO** (backend) and **React + Vite** (frontend).
No database — everything lives in memory for the duration of one live event,
as you requested.

```
kbc-quiz-platform/
  server/     Node.js + Express + Socket.IO backend
  client/     React (Vite) frontend — employee portal + host dashboard
```

## 1. How it works

- **One shared quiz session** lives in the server's memory (`quizSession.js`).
  There's no login/password for employees — just **name + employee ID**,
  entered once, used to identify them for scoring and reconnection.
- The **host** authenticates with a single shared passcode (set in
  `server/.env`) and drives the quiz: Start → Show Question → Reveal Answer
  → Next Question → ... → Finish.
- Everything is pushed to clients over Socket.IO — nobody polls.
- If an employee's wifi drops mid-quiz, reopening the page automatically
  rejoins them with the same employee ID and **resyncs them to whatever
  phase the quiz is currently in** (question / reveal / leaderboard), so
  they don't get stuck or lose their score.
- Scoring: correct answers score 1000 points minus a speed penalty (faster
  = more points, floor of 300), wrong/no answer = 0. Tune this in
  `server/src/quizSession.js` (`BASE_POINTS`, `MIN_POINTS`,
  `SPEED_BONUS_SHARE`).

## 2. Run it locally

Requires **Node.js 18+**.

```bash
# Terminal 1 — backend
cd server
cp .env.example .env      # edit HOST_PASSCODE at least
npm install
npm run dev                # starts on http://localhost:4000

# Terminal 2 — frontend
cd client
cp .env.example .env       # VITE_SERVER_URL=http://localhost:4000
npm install
npm run dev                # starts on http://localhost:5173
```

Open `http://localhost:5173` in one tab to join as an employee, and
`http://localhost:5173/host` in another to run the control room. Open
several more tabs/incognito windows to simulate multiple employees.

## 3. Add your own questions

Edit `server/src/questions.js`. Each question needs an `id`, `text`, exactly
4 `options`, a `correctIndex` (0–3), and an optional `timeLimitSec`. The
server validates this file on startup and will refuse to boot if a question
is malformed — so mistakes are caught immediately, not mid-event.

## 4. Deploying for the real event

You need to host two things: the **server** (a long-running Node process,
NOT a serverless function — Socket.IO needs persistent connections) and the
**client** (a static build).

**Backend** — any VM/container host that keeps a process alive works:
Railway, Render, an EC2/Lightsail box, Fly.io, etc.
```bash
cd server
npm install
npm start                     # or use pm2 for production: pm2 start src/index.js
```
Set these environment variables on the host:
- `PORT` — usually assigned by the platform
- `CLIENT_ORIGIN` — the exact URL your client will be served from (e.g.
  `https://quiz.yourcompany.com`)
- `HOST_PASSCODE` — change this from the default before the event
- `DEFAULT_TIME_LIMIT_SEC` — fallback per-question timer

**Frontend** — build a static bundle and serve it from Vercel, Netlify,
S3+CloudFront, or Nginx:
```bash
cd client
# set VITE_SERVER_URL to your deployed backend's public URL in .env
npm install
npm run build        # outputs to client/dist
```
Deploy the `dist/` folder anywhere that serves static files.

**Capacity for 500–1000 concurrent users:** a single Node process handling
Socket.IO comfortably supports this range on a modest instance (1–2 vCPU,
1–2GB RAM) because the server only broadcasts on host actions (question
shown, answer revealed) rather than constant chatter. Two things matter
most in practice:
1. **Use a real HTTPS domain**, not a raw IP — corporate wifi/proxies are
   much friendlier to secure WebSocket upgrades on port 443.
2. **Do a dry run** with ~50–100 people (or simulated connections) before
   the real event to confirm your hosting platform doesn't idle-timeout
   WebSocket connections (some serverless/proxy setups do — avoid those).

If you ever need to run the backend across *multiple* server instances
(e.g. for redundancy well beyond 1000 users), you'd add the
[`@socket.io/redis-adapter`](https://socket.io/docs/v4/redis-adapter/) and a
Redis instance so broadcasts reach clients connected to any instance — not
needed for a single-instance deployment like this one.

## 5. Known limits (by design, given your requirements)

- **No database** — if the server process restarts mid-quiz, all scores and
  progress are lost. Since this is for a single live event, that's the
  accepted trade-off. (If you later want a results export/history, the
  natural next step is swapping the in-memory `Map`s in `quizSession.js`
  for a Postgres/MongoDB-backed store — the rest of the app doesn't need to
  change.)
- **One host passcode, no per-host accounts** — fine for one host running
  the event; anyone with the passcode can control the quiz.
- **No employee password** — anyone who knows/guesses an employee ID could
  submit answers as them. Acceptable for an internal, trust-based team
  event; swap in real SSO later if needed.
