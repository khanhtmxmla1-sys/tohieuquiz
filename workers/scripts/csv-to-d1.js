/**
 * CSV → D1 Migration Script
 * Reads CSV files from data/migration/ and generates SQL for D1 import
 * Column mapping: CSV camelCase → D1 snake_case
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'migration');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'seed.local.sql');

// Simple CSV parser (handles quoted fields with commas)
function parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return [];

    const headers = parseCSVLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;
        const row = {};
        headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim(); });
        rows.push(row);
    }
    return rows;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

function esc(val) {
    if (val === null || val === undefined || val === '') return "''";
    return "'" + String(val).replace(/'/g, "''") + "'";
}

function num(val, def = 0) {
    const n = Number(val);
    return isNaN(n) ? def : n;
}

let sql = '-- Auto-generated D1 seed from CSV migration data\n';
sql += '-- Generated: ' + new Date().toISOString() + '\n\n';

// 1. Teachers
console.log('Processing Teachers...');
const teachers = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'Teachers.csv'), 'utf-8'));
sql += '-- Teachers\n';
for (const t of teachers) {
    if (!t.username) continue;
    sql += `INSERT OR REPLACE INTO teachers (username, password, full_name, role, class) VALUES (${esc(t.username)}, ${esc(t.password)}, ${esc(t.fullname || t.fullName)}, ${esc(t.role || 'teacher')}, ${esc(t.class || '')});\n`;
}
console.log(`  → ${teachers.length} teachers`);

// 2. Classes
console.log('Processing Classes...');
const classes = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'Classes.csv'), 'utf-8'));
sql += '\n-- Classes\n';
for (const c of classes) {
    if (!c.id) continue;
    sql += `INSERT OR REPLACE INTO classes (id, name, teacher_username, created_at) VALUES (${esc(c.id)}, ${esc(c.name)}, ${esc(c.teacherUsername)}, ${esc(c.createdAt)});\n`;
}
console.log(`  → ${classes.length} classes`);

// 3. Students
console.log('Processing Students...');
const students = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'Students.csv'), 'utf-8'));
sql += '\n-- Students\n';
for (const s of students) {
    if (!s.id) continue;
    sql += `INSERT OR REPLACE INTO students (id, full_name, username, password_hash, class_id, parent_phone, avatar, coins, created_at) VALUES (${esc(s.id)}, ${esc(s.fullName)}, ${esc(s.username)}, ${esc(s.passwordHash)}, ${esc(s.classId)}, ${esc(s.parentPhone || '')}, ${esc(s.avatar || '')}, ${num(s.coins)}, ${esc(s.createdAt)});\n`;
}
console.log(`  → ${students.length} students`);

// 4. Quizzes
console.log('Processing Quizzes...');
const quizzes = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'Quizzes.csv'), 'utf-8'));
sql += '\n-- Quizzes\n';
for (const q of quizzes) {
    if (!q.id) continue;
    sql += `INSERT OR REPLACE INTO quizzes (id, title, class_level, category, time_limit, created_at, access_code, require_code, created_by, show_on_home) VALUES (${esc(q.id)}, ${esc(q.title)}, ${esc(q.classLevel)}, ${esc(q.category || '')}, ${num(q.timeLimit, 60)}, ${esc(q.createdAt)}, ${esc(q.accessCode || '')}, ${esc(q.requireCode || 'FALSE')}, ${esc(q.createdBy || '')}, ${esc(q.showOnHome || 'TRUE')});\n`;
}
console.log(`  → ${quizzes.length} quizzes`);

// 5. Questions
console.log('Processing Questions...');
const questions = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'Questions.csv'), 'utf-8'));
sql += '\n-- Questions\n';
for (const q of questions) {
    if (!q.id) continue;
    sql += `INSERT OR REPLACE INTO questions (id, quiz_id, type, question, options, correct_answer, items, text_field, blanks, distractors, sentence, words, correct_word_indexes, image) VALUES (${esc(q.id)}, ${esc(q.quizId)}, ${esc(q.type)}, ${esc(q.question)}, ${esc(q.options || '')}, ${esc(q.correctAnswer || '')}, ${esc(q.items || '')}, ${esc(q.text || '')}, ${esc(q.blanks || '')}, ${esc(q.distractors || '')}, ${esc(q.sentence || '')}, ${esc(q.words || '')}, ${esc(q.correctWordIndexes || '')}, ${esc(q.image || '')});\n`;
}
console.log(`  → ${questions.length} questions`);

// 6. Results
console.log('Processing Results...');
const results = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'Results.csv'), 'utf-8'));
sql += '\n-- Results\n';
for (const r of results) {
    // CSV headers: Student Name, Class, Quiz ID, Quiz Title, Score, correctCount, Total Questions, Submitted At, answers
    const studentName = r['Student Name'] || '';
    const className = r['Class'] || '';
    const quizId = r['Quiz ID'] || '';
    const quizTitle = r['Quiz Title'] || '';
    const score = num(r['Score']);
    const correctCount = num(r['correctCount']);
    const totalQuestions = num(r['Total Questions']);
    const submittedAt = r['Submitted At'] || '';
    const answers = r['answers'] || '{}';
    if (!studentName && !quizId) continue;
    sql += `INSERT OR REPLACE INTO results (student_name, class_name, quiz_id, quiz_title, score, correct_count, total_questions, submitted_at, answers) VALUES (${esc(studentName)}, ${esc(className)}, ${esc(quizId)}, ${esc(quizTitle)}, ${score}, ${correctCount}, ${totalQuestions}, ${esc(submittedAt)}, ${esc(answers)});\n`;
}
console.log(`  → ${results.length} results`);

// 7. Assignments
console.log('Processing Assignments...');
const assignments = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'Assignments.csv'), 'utf-8'));
sql += '\n-- Assignments\n';
for (const a of assignments) {
    if (!a.id) continue;
    sql += `INSERT OR REPLACE INTO assignments (id, quiz_id, class_id, student_id, deadline, max_attempts, status, created_at) VALUES (${esc(a.id)}, ${esc(a.quizId)}, ${esc(a.classId)}, ${esc(a.studentId || '')}, ${esc(a.deadline)}, ${num(a.maxAttempts, 1)}, ${esc(a.status || 'OPEN')}, ${esc(a.createdAt)});\n`;
}
console.log(`  → ${assignments.length} assignments`);

// 8. User Pets
console.log('Processing UserPets...');
const userPets = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'UserPets.csv'), 'utf-8'));
sql += '\n-- User Pets\n';
for (const p of userPets) {
    if (!p.username) continue;
    sql += `INSERT OR REPLACE INTO user_pets (username, pet_id, pet_name, level, exp, exp_to_next, mood, items, last_active) VALUES (${esc(p.username)}, ${esc(p.petId || 'cat_01')}, ${esc(p.petName || 'Mèo Con')}, ${num(p.level, 1)}, ${num(p.exp)}, ${num(p.expToNext, 100)}, ${esc(p.mood || 'happy')}, ${esc(p.items || '[]')}, ${esc(p.lastActive || '')});\n`;
}
console.log(`  → ${userPets.length} user pets`);

// 9. Shop Items
console.log('Processing ShopItems...');
const shopItems = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'ShopItems.csv'), 'utf-8'));
sql += '\n-- Shop Items\n';
for (const i of shopItems) {
    if (!i.itemId) continue;
    sql += `INSERT OR REPLACE INTO shop_items (item_id, name, price, type, category, asset_url) VALUES (${esc(i.itemId)}, ${esc(i.name)}, ${num(i.price)}, ${esc(i.type || 'ACCESSORY')}, ${esc(i.category || '')}, ${esc(i.assetUrl || '')});\n`;
}
console.log(`  → ${shopItems.length} shop items`);

// 10. Announcements
console.log('Processing Announcements...');
const announcements = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'Announcements.csv'), 'utf-8'));
sql += '\n-- Announcements\n';
for (const a of announcements) {
    if (!a.id) continue;
    sql += `INSERT OR REPLACE INTO announcements (id, content, is_active, updated_at) VALUES (${esc(a.id)}, ${esc(a.content || '')}, ${esc(a.isActive || 'false')}, ${esc(a.updatedAt || '')});\n`;
}
console.log(`  → ${announcements.length} announcements`);

// Write output
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(OUTPUT_FILE, sql);
console.log(`\n✅ Seed file generated: ${OUTPUT_FILE}`);
console.log(`   Size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB`);
