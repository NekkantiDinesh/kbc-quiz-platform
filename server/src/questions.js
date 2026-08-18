// Question bank
// -----------------------------------------------------------------------
// Edit this array to write your own quiz. Each question needs:
//   id            - unique string (keep it stable, don't reuse across quizzes)
//   text          - the question shown on screen
//   options       - exactly 4 strings, in order (index 0-3)
//   correctIndex  - index (0-3) of the correct option
//   timeLimitSec  - optional, overrides DEFAULT_TIME_LIMIT_SEC from .env
// -----------------------------------------------------------------------

export const questions = [
  {
    id: 'q1',
    text: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correctIndex: 1,
    timeLimitSec: 15,
  },
  {
    id: 'q2',
    text: 'What does "HTTP" stand for?',
    options: [
      'HyperText Transfer Protocol',
      'High Transfer Text Protocol',
      'HyperText Technical Protocol',
      'Home Tool Transfer Protocol',
    ],
    correctIndex: 0,
    timeLimitSec: 20,
  },
  {
    id: 'q3',
    text: 'Our company was founded in which decade?',
    options: ['1980s', '1990s', '2000s', '2010s'],
    correctIndex: 2,
    timeLimitSec: 15,
  },
  {
    id: 'q4',
    text: 'Which of these is NOT one of our core values?',
    options: ['Integrity', 'Customer First', 'Complacency', 'Ownership'],
    correctIndex: 2,
    timeLimitSec: 15,
  },
  {
    id: 'q5',
    text: 'What is the capital of Japan?',
    options: ['Seoul', 'Beijing', 'Tokyo', 'Bangkok'],
    correctIndex: 2,
    timeLimitSec: 15,
  },
];

export function validateQuestions(list) {
  list.forEach((q, i) => {
    if (!q.id || !q.text || !Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question at index ${i} is malformed (need id, text, 4 options).`);
    }
    if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
      throw new Error(`Question "${q.id}" has an invalid correctIndex.`);
    }
  });
  const ids = new Set(list.map((q) => q.id));
  if (ids.size !== list.length) {
    throw new Error('Duplicate question ids found in questions.js');
  }
}
