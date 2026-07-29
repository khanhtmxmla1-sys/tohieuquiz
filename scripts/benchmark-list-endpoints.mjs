import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';

const ROWS = Number(process.env.BENCHMARK_ROWS || 10_000);
const ITERATIONS = Number(process.env.BENCHMARK_ITERATIONS || 80);
const TARGET_P95_MS = Number(process.env.BENCHMARK_TARGET_P95_MS || 500);

const database = new DatabaseSync(':memory:');
database.exec('PRAGMA journal_mode = MEMORY; PRAGMA synchronous = OFF;');
database.exec(`
  CREATE TABLE results (id TEXT PRIMARY KEY, quiz_id TEXT, class_name TEXT, submitted_at TEXT);
  CREATE TABLE students (id TEXT PRIMARY KEY, class_id TEXT, archived_at TEXT, full_name TEXT);
  CREATE TABLE teachers (username TEXT PRIMARY KEY, status TEXT, full_name TEXT);
  CREATE TABLE gift_orders (id TEXT PRIMARY KEY, class_id TEXT, student_id TEXT, status TEXT, updated_at TEXT);
  CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT, user_role TEXT, is_read INTEGER, created_at TEXT);
`);

const insertResult = database.prepare('INSERT INTO results VALUES (?, ?, ?, ?)');
const insertStudent = database.prepare('INSERT INTO students VALUES (?, ?, NULL, ?)');
const insertTeacher = database.prepare('INSERT INTO teachers VALUES (?, ?, ?)');
const insertOrder = database.prepare('INSERT INTO gift_orders VALUES (?, ?, ?, ?, ?)');
const insertNotification = database.prepare('INSERT INTO notifications VALUES (?, ?, ?, ?, ?)');
database.exec('BEGIN');
for (let index = 0; index < ROWS; index += 1) {
  const timestamp = new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString();
  insertResult.run(`r-${index}`, `q-${index % 20}`, `4${String.fromCharCode(65 + index % 5)}`, timestamp);
  insertStudent.run(`s-${index}`, `c-${index % 20}`, `Học sinh ${String(index).padStart(5, '0')}`);
  insertTeacher.run(`teacher-${index}`, index % 10 === 0 ? 'DISABLED' : 'ACTIVE', `Giáo viên ${String(index).padStart(5, '0')}`);
  insertOrder.run(`o-${index}`, `c-${index % 20}`, `s-${index}`, index % 3 === 0 ? 'PENDING' : 'DELIVERED', timestamp);
  insertNotification.run(`n-${index}`, `u-${index % 50}`, index % 2 ? 'teacher' : 'student', index % 3 === 0 ? 0 : 1, timestamp);
}
database.exec('COMMIT');
database.exec(readFileSync(new URL('../workers/migrations/0051_pagination_indexes.sql', import.meta.url), 'utf8'));

const queries = {
  results: database.prepare("SELECT id FROM results WHERE quiz_id=? ORDER BY submitted_at DESC, id DESC LIMIT 25"),
  students: database.prepare("SELECT id FROM students WHERE class_id=? AND archived_at IS NULL ORDER BY full_name COLLATE NOCASE, id LIMIT 25"),
  teachers: database.prepare("SELECT username FROM teachers WHERE status=? ORDER BY full_name COLLATE NOCASE, username LIMIT 25"),
  orders: database.prepare("SELECT id FROM gift_orders WHERE class_id=? ORDER BY updated_at DESC, id DESC LIMIT 25"),
  notifications: database.prepare("SELECT id FROM notifications WHERE user_id=? AND user_role=? AND is_read=? ORDER BY created_at DESC, id DESC LIMIT 25"),
};
const argumentsByQuery = {
  results: ['q-1'],
  students: ['c-1'],
  teachers: ['ACTIVE'],
  orders: ['c-1'],
  notifications: ['u-1', 'teacher', 0],
};

const percentile = (values, ratio) => values[Math.min(values.length - 1, Math.floor(values.length * ratio))];
let failed = false;
for (const [name, statement] of Object.entries(queries)) {
  const durations = [];
  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const started = performance.now();
    statement.all(...argumentsByQuery[name]);
    durations.push(performance.now() - started);
  }
  durations.sort((a, b) => a - b);
  const p95 = percentile(durations, 0.95);
  const result = {
    endpoint: name,
    rows: ROWS,
    iterations: ITERATIONS,
    p50Ms: Number(percentile(durations, 0.5).toFixed(3)),
    p95Ms: Number(p95.toFixed(3)),
    targetP95Ms: TARGET_P95_MS,
    passed: p95 < TARGET_P95_MS,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.passed) failed = true;
}
database.close();
if (failed) process.exitCode = 1;
