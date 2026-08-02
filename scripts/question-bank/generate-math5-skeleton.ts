import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMath5Curriculum } from './generate-math5-dataset.ts';

const roles = [
  'MCQ cơ bản', 'MCQ cơ bản', 'MCQ cơ bản', 'MCQ cơ bản',
  'Trả lời ngắn', 'Trả lời ngắn', 'Đúng sai', 'Tương tác',
  'Vận dụng', 'Vận dụng',
] as const;
const difficulties = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3] as const;

export const generateMath5Skeleton = () => {
  const curriculum = readMath5Curriculum();
  return curriculum.topics.map((topic) => ({
    topicCode: topic.code,
    topicTitle: topic.title,
    lessons: topic.lessons.map((lesson) => ({
      lessonCode: lesson.code,
      lessonNumber: lesson.number,
      lessonTitle: lesson.title,
      slots: roles.map((role, index) => ({
        slot: index + 1,
        id: `qb-${lesson.code.toLowerCase()}-q${String(index + 1).padStart(2, '0')}`,
        role,
        difficulty: difficulties[index],
      })),
    })),
  }));
};

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const output = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve('.tmp/question-bank/math5-semester1-skeleton.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(generateMath5Skeleton(), null, 2)}\n`, 'utf8');
  console.log(`Wrote Math 5 skeleton to ${output}`);
}
