import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Question } from '../../src/types/domain.types.ts';

const QuestionType = {
  MCQ: 'MCQ',
  TRUE_FALSE: 'TRUE_FALSE',
  SHORT_ANSWER: 'SHORT_ANSWER',
  MATCHING: 'MATCHING',
  MULTIPLE_SELECT: 'MULTIPLE_SELECT',
  ORDERING: 'ORDERING',
  CATEGORIZATION: 'CATEGORIZATION',
} as const;
import type {
  CuratedQuestionBankInput,
  GeneratedMath5Dataset,
  Math5Curriculum,
  Math5CurriculumLesson,
  Math5CurriculumTopic,
  Math5SlotRole,
} from './math5-types';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
const DIFFICULTIES = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3] as const;
const ROLES: Math5SlotRole[] = [
  'MCQ cơ bản',
  'MCQ cơ bản',
  'MCQ cơ bản',
  'MCQ cơ bản',
  'Trả lời ngắn',
  'Trả lời ngắn',
  'Đúng sai',
  'Tương tác',
  'Vận dụng',
  'Vận dụng',
];

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = path.join(projectRoot, 'data', 'question-bank', 'math5-semester1');
const curriculumPath = path.join(dataDir, 'curriculum.json');

const base = (id: string, difficulty: 1 | 2 | 3) => ({
  id,
  difficulty,
  subject: 'MATH',
  points: 1,
});

const mcq = (
  id: string,
  difficulty: 1 | 2 | 3,
  question: string,
  options: string[],
  correctIndex: number,
): Question => ({
  ...base(id, difficulty),
  type: QuestionType.MCQ,
  question,
  options,
  correctAnswer: LETTERS[correctIndex],
} as Question);

const shortAnswer = (
  id: string,
  difficulty: 1 | 2 | 3,
  question: string,
  correctAnswer: string,
): Question => ({
  ...base(id, difficulty),
  type: QuestionType.SHORT_ANSWER,
  question,
  correctAnswer,
} as Question);

const trueFalse = (
  id: string,
  difficulty: 1 | 2 | 3,
  mainQuestion: string,
  items: Array<[string, boolean]>,
): Question => ({
  ...base(id, difficulty),
  type: QuestionType.TRUE_FALSE,
  mainQuestion,
  items: items.map(([statement, isCorrect], index) => ({
    id: `${id}-i${index + 1}`,
    statement,
    isCorrect,
  })),
} as Question);

const matching = (
  id: string,
  difficulty: 1 | 2 | 3,
  question: string,
  pairs: Array<[string, string]>,
): Question => ({
  ...base(id, difficulty),
  type: QuestionType.MATCHING,
  question,
  pairs: pairs.map(([left, right]) => ({ left, right })),
} as Question);

const ordering = (
  id: string,
  difficulty: 1 | 2 | 3,
  question: string,
  items: string[],
  correctOrder: number[],
): Question => ({
  ...base(id, difficulty),
  type: QuestionType.ORDERING,
  question,
  items,
  correctOrder,
} as Question);

const multipleSelect = (
  id: string,
  difficulty: 1 | 2 | 3,
  question: string,
  options: string[],
  correctIndexes: number[],
): Question => ({
  ...base(id, difficulty),
  type: QuestionType.MULTIPLE_SELECT,
  question,
  options,
  correctAnswers: correctIndexes.map((index) => LETTERS[index]),
} as Question);

const categorization = (
  id: string,
  difficulty: 1 | 2 | 3,
  question: string,
  categories: Array<[string, string]>,
  items: Array<[string, string, string]>,
): Question => ({
  ...base(id, difficulty),
  type: QuestionType.CATEGORIZATION,
  question,
  categories: categories.map(([categoryId, name]) => ({ id: categoryId, name })),
  items: items.map(([itemId, content, categoryId]) => ({ id: itemId, content, categoryId })),
} as Question);

const gcd = (left: number, right: number): number => {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
};

const fraction = (numerator: number, denominator: number): string => {
  const divisor = gcd(numerator, denominator);
  const sign = denominator < 0 ? -1 : 1;
  return `${(numerator / divisor) * sign}/${Math.abs(denominator / divisor)}`;
};

const addFraction = (a: number, b: number, c: number, d: number) => fraction(a * d + c * b, b * d);
const subtractFraction = (a: number, b: number, c: number, d: number) => fraction(a * d - c * b, b * d);
const multiplyFraction = (a: number, b: number, c: number, d: number) => fraction(a * c, b * d);
const divideFraction = (a: number, b: number, c: number, d: number) => fraction(a * d, b * c);

const decimal = (integer: number, scale: number): string => {
  const negative = integer < 0 ? '-' : '';
  const absolute = Math.abs(integer);
  if (scale === 0) return `${negative}${absolute}`;
  const raw = String(absolute).padStart(scale + 1, '0');
  const whole = raw.slice(0, -scale);
  const decimals = raw.slice(-scale).replace(/0+$/, '');
  return decimals ? `${negative}${whole},${decimals}` : `${negative}${whole}`;
};

const money = (value: number) => `${value.toLocaleString('vi-VN')} đồng`;
const qid = (lesson: Math5CurriculumLesson, slot: number) => `m5-s1-l${String(lesson.number).padStart(2, '0')}-q${String(slot).padStart(2, '0')}`;

const naturalNumberReview = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const number = 5_000_000 + seed * 10_000 + 372_418;
  const compare = number + 4_082;
  const rounded = Math.round(number / 1000) * 1000;
  return [
    mcq(qid(lesson, 1), 1, `Trong số ${number.toLocaleString('vi-VN')}, chữ số 7 có giá trị là bao nhiêu?`, ['7 000', '70 000', '700 000', '7 000 000'], 1),
    mcq(qid(lesson, 2), 1, 'Số gồm 6 triệu, 4 trăm nghìn, 2 chục nghìn, 5 trăm và 8 đơn vị là số nào?', ['6 420 508', '6 402 580', '6 425 008', '6 420 058'], 0),
    mcq(qid(lesson, 3), 1, `Dấu thích hợp điền vào ${number.toLocaleString('vi-VN')} … ${compare.toLocaleString('vi-VN')} là gì?`, ['>', '<', '=', 'Không so sánh được'], 1),
    mcq(qid(lesson, 4), 1, `Làm tròn số ${number.toLocaleString('vi-VN')} đến hàng nghìn được số nào?`, [(rounded - 1000).toLocaleString('vi-VN'), rounded.toLocaleString('vi-VN'), (rounded + 1000).toLocaleString('vi-VN'), number.toLocaleString('vi-VN')], 1),
    shortAnswer(qid(lesson, 5), 2, `Viết số liền trước của ${compare.toLocaleString('vi-VN')}.`, String(compare - 1)),
    shortAnswer(qid(lesson, 6), 2, 'Viết số tự nhiên gồm 8 triệu, 3 trăm nghìn, 4 nghìn, 6 chục và 2 đơn vị.', '8304062'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai cho mỗi nhận định về số tự nhiên.', [
      ['Mọi số tự nhiên đều có một số liền sau.', true],
      ['Số 0 là số tự nhiên nhỏ nhất.', true],
      ['Có số tự nhiên lớn nhất.', false],
    ]),
    ordering(qid(lesson, 8), 2, 'Sắp xếp các số sau theo thứ tự từ bé đến lớn.', [String(compare), String(number - 10), String(number), String(number + 100)], [1, 2, 3, 0]),
    mcq(qid(lesson, 9), 3, `Một thư viện có ${(12_450 + seed * 10).toLocaleString('vi-VN')} sách thiếu nhi và ${(8_375 + seed * 5).toLocaleString('vi-VN')} sách khoa học. Thư viện có tất cả bao nhiêu cuốn sách?`, ['20 725', String(20_825 + seed * 15), String(21_825 + seed * 15), String(19_825 + seed * 15)], 1),
    shortAnswer(qid(lesson, 10), 3, `Kho có ${(50_000 + seed * 100).toLocaleString('vi-VN')} quyển vở, đã chuyển đi ${(18_765 + seed * 10).toLocaleString('vi-VN')} quyển. Kho còn lại bao nhiêu quyển?`, String(31_235 + seed * 90)),
  ];
};

const naturalOperations = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const a = 24_568 + seed * 31;
  const b = 7_435 + seed * 17;
  const factor = 24 + (seed % 5);
  const divisor = 18 + (seed % 4);
  const quotient = 325 + seed;
  const dividend = divisor * quotient;
  return [
    mcq(qid(lesson, 1), 1, `${a.toLocaleString('vi-VN')} + ${b.toLocaleString('vi-VN')} bằng bao nhiêu?`, [String(a + b - 100), String(a + b), String(a + b + 100), String(a - b)], 1),
    mcq(qid(lesson, 2), 1, `${a.toLocaleString('vi-VN')} - ${b.toLocaleString('vi-VN')} bằng bao nhiêu?`, [String(a - b), String(a + b), String(a - b + 1000), String(b - a)], 0),
    mcq(qid(lesson, 3), 1, `${factor} × 125 bằng bao nhiêu?`, [String(factor * 125), String(factor * 25), String((factor + 1) * 125), String(factor * 100)], 0),
    mcq(qid(lesson, 4), 1, `${dividend} : ${divisor} bằng bao nhiêu?`, [String(quotient - 1), String(quotient), String(quotient + divisor), String(dividend - divisor)], 1),
    shortAnswer(qid(lesson, 5), 2, `Tính giá trị biểu thức ${a} + ${b} × 3.`, String(a + b * 3)),
    shortAnswer(qid(lesson, 6), 2, `Tìm x, biết x - ${b} = ${a}.`, String(a + b)),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về thứ tự thực hiện phép tính.', [
      ['Trong biểu thức chỉ có cộng và trừ, thực hiện từ trái sang phải.', true],
      ['Trong biểu thức có cộng và nhân, luôn thực hiện phép cộng trước.', false],
      ['Biểu thức trong ngoặc được thực hiện trước.', true],
    ]),
    matching(qid(lesson, 8), 2, 'Nối mỗi biểu thức với kết quả đúng.', [
      [`${factor} × 10`, String(factor * 10)],
      [`${factor} × 100`, String(factor * 100)],
      [`${factor * 100} : 10`, String(factor * 10)],
    ]),
    mcq(qid(lesson, 9), 3, `Một trường có ${18 + seed} lớp, mỗi lớp nhận 35 quyển truyện. Nhà trường mua thêm 120 quyển. Có tất cả bao nhiêu quyển truyện?`, [String((18 + seed) * 35 + 120), String((18 + seed) * 35), String((18 + seed) * 120 + 35), String((18 + seed) * 35 - 120)], 0),
    shortAnswer(qid(lesson, 10), 3, `Một xe chở ${divisor} thùng, mỗi thùng có ${quotient} chai nước. Đã phát ${1_500 + seed * 10} chai. Còn lại bao nhiêu chai?`, String(dividend - (1_500 + seed * 10))),
  ];
};

const fractionReview = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const numerator = 3 + (seed % 3);
  const denominator = 8 + (seed % 4);
  const equivalentNumerator = numerator * 3;
  const equivalentDenominator = denominator * 3;
  return [
    mcq(qid(lesson, 1), 1, `Phân số nào bằng ${numerator}/${denominator}?`, [`${numerator + 1}/${denominator + 1}`, `${equivalentNumerator}/${equivalentDenominator}`, `${numerator * 2}/${denominator * 3}`, `${denominator}/${numerator}`], 1),
    mcq(qid(lesson, 2), 1, 'Phân số 18/24 rút gọn được phân số nào?', ['9/12', '6/8', '3/4', '2/3'], 2),
    mcq(qid(lesson, 3), 1, 'Trong hai phân số 5/9 và 7/9, phân số lớn hơn là phân số nào?', ['5/9', '7/9', 'Hai phân số bằng nhau', 'Không so sánh được'], 1),
    mcq(qid(lesson, 4), 1, 'Phân số nào lớn hơn 1?', ['5/8', '7/7', '9/7', '3/10'], 2),
    shortAnswer(qid(lesson, 5), 2, 'Rút gọn phân số 42/56.', '3/4'),
    shortAnswer(qid(lesson, 6), 2, 'Quy đồng mẫu số hai phân số 2/3 và 5/6 với mẫu số chung 6. Viết phân số mới tương ứng với 2/3.', '4/6'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về phân số.', [
      ['Hai phân số có cùng mẫu số, phân số có tử số lớn hơn thì lớn hơn.', true],
      ['Phân số có tử số bằng mẫu số thì bằng 0.', false],
      ['Nhân cả tử số và mẫu số với cùng một số tự nhiên khác 0 được phân số bằng phân số ban đầu.', true],
    ]),
    ordering(qid(lesson, 8), 2, 'Sắp xếp các phân số theo thứ tự từ bé đến lớn.', ['3/8', '7/8', '1/8', '5/8'], [2, 0, 3, 1]),
    mcq(qid(lesson, 9), 3, `Một lớp có ${32 + seed * 4} học sinh, trong đó 3/4 số học sinh tham gia câu lạc bộ. Có bao nhiêu học sinh tham gia?`, [String((32 + seed * 4) * 3 / 4), String((32 + seed * 4) / 4), String((32 + seed * 4) * 4 / 3), String(32 + seed * 4 - 3)], 0),
    shortAnswer(qid(lesson, 10), 3, 'Một bể nước đầy, buổi sáng dùng 2/5 bể và buổi chiều dùng 1/5 bể. Phần bể nước còn lại là bao nhiêu?', '2/5'),
  ];
};

const decimalFractionLesson = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const tenths = 3 + (seed % 5);
  const hundredths = 27 + seed;
  return [
    mcq(qid(lesson, 1), 1, 'Phân số nào là phân số thập phân?', ['3/8', '7/20', '9/100', '11/25'], 2),
    mcq(qid(lesson, 2), 1, `Phân số ${tenths}/10 được viết dưới dạng số thập phân nào?`, [`0,0${tenths}`, `0,${tenths}`, `${tenths},0`, `10,${tenths}`], 1),
    mcq(qid(lesson, 3), 1, `Số thập phân 0,${hundredths} được viết thành phân số thập phân nào?`, [`${hundredths}/10`, `${hundredths}/100`, `${hundredths}/1000`, `100/${hundredths}`], 1),
    mcq(qid(lesson, 4), 1, 'Phân số 3/5 được viết thành phân số thập phân nào?', ['3/10', '6/10', '15/100', '5/3'], 1),
    shortAnswer(qid(lesson, 5), 2, 'Viết phân số 7/20 thành phân số thập phân có mẫu số 100.', '35/100'),
    shortAnswer(qid(lesson, 6), 2, 'Viết số thập phân 0,405 thành phân số thập phân.', '405/1000'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về phân số thập phân.', [
      ['Phân số 17/100 là phân số thập phân.', true],
      ['Mọi phân số đều có mẫu số là 10, 100 hoặc 1000.', false],
      ['Phân số 3/4 có thể viết thành 75/100.', true],
    ]),
    matching(qid(lesson, 8), 2, 'Nối phân số thập phân với số thập phân tương ứng.', [['4/10', '0,4'], ['25/100', '0,25'], ['308/1000', '0,308']]),
    mcq(qid(lesson, 9), 3, 'Một cuộn dây dài 100 m, đã dùng 37 m. Phần dây đã dùng chiếm phân số thập phân nào của cả cuộn?', ['37/10', '37/100', '63/100', '100/37'], 1),
    shortAnswer(qid(lesson, 10), 3, 'Một khu vườn được chia thành 100 phần bằng nhau, 68 phần trồng rau. Viết phần diện tích trồng rau dưới dạng phân số thập phân.', '68/100'),
  ];
};

const fractionOperations = (lesson: Math5CurriculumLesson, seed = 0, unlike = false): Question[] => {
  const a = 2 + (seed % 3);
  const b = unlike ? 5 : 9;
  const c = 1 + (seed % 2);
  const d = unlike ? 6 : 9;
  const sum = addFraction(a, b, c, d);
  const difference = subtractFraction(a + 3, b, c, d);
  return [
    mcq(qid(lesson, 1), 1, `${a}/${b} + ${c}/${d} bằng bao nhiêu?`, [sum, fraction(a + c, b + d), fraction(a * d + c * b + 1, b * d), fraction(a * c, b * d)], 0),
    mcq(qid(lesson, 2), 1, `${a + 3}/${b} - ${c}/${d} bằng bao nhiêu?`, [difference, fraction(a + 3 - c, b + d), fraction(a + 3 + c, b), fraction((a + 3) * c, b * d)], 0),
    mcq(qid(lesson, 3), 1, `2/3 × ${a}/5 bằng bao nhiêu?`, [multiplyFraction(2, 3, a, 5), addFraction(2, 3, a, 5), fraction(2 * 5, 3 * a), fraction(2 + a, 15)], 0),
    mcq(qid(lesson, 4), 1, `3/4 : ${c + 1}/5 bằng bao nhiêu?`, [divideFraction(3, 4, c + 1, 5), multiplyFraction(3, 4, c + 1, 5), fraction(16, 4 * (c + 1)), fraction(3 + c + 1, 9)], 0),
    shortAnswer(qid(lesson, 5), 2, `Tính ${a}/${b} + ${c + 1}/${d}.`, addFraction(a, b, c + 1, d)),
    ...(unlike ? [
      shortAnswer(qid(lesson, 6), 2, 'Tính 7/8 - 2/3.', '5/24'),
      trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai khi cộng, trừ hai phân số khác mẫu số.', [
        ['Cần quy đồng mẫu số trước khi cộng hoặc trừ.', true],
        ['Sau khi quy đồng, cộng cả tử số và mẫu số với nhau.', false],
        ['Kết quả 2/3 + 1/4 bằng 11/12.', true],
      ]),
      matching(qid(lesson, 8), 2, 'Nối phép cộng, trừ khác mẫu với kết quả đúng.', [['1/2 + 1/3', '5/6'], ['3/4 - 1/6', '7/12'], ['2/5 + 3/10', '7/10']]),
      mcq(qid(lesson, 9), 3, 'Một đội làm được 3/5 công việc buổi sáng và 2/7 công việc buổi chiều. Cả ngày đội làm được bao nhiêu phần công việc?', ['5/12', '31/35', '6/35', '1 1/5'], 1),
      shortAnswer(qid(lesson, 10), 3, 'Một thùng có 7/9 lít nước. Người ta rót ra 1/6 lít. Trong thùng còn bao nhiêu lít nước?', '11/18'),
    ] : [
      shortAnswer(qid(lesson, 6), 2, 'Tính 5/6 - 1/4.', '7/12'),
      trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về bốn phép tính với phân số.', [
        ['Muốn cộng hai phân số khác mẫu số, cần quy đồng mẫu số.', true],
        ['Muốn nhân hai phân số, nhân tử với tử và giữ nguyên mẫu.', false],
        ['Chia cho một phân số khác 0 là nhân với phân số đảo ngược.', true],
      ]),
      matching(qid(lesson, 8), 2, 'Nối phép tính phân số với kết quả đúng.', [['1/2 + 1/3', '5/6'], ['3/4 - 1/4', '1/2'], ['2/3 × 3/5', '2/5']]),
      mcq(qid(lesson, 9), 3, 'Một đội làm được 3/8 công việc buổi sáng và 1/4 công việc buổi chiều. Cả ngày đội làm được bao nhiêu phần công việc?', ['4/12', '5/8', '1/2', '7/8'], 1),
      shortAnswer(qid(lesson, 10), 3, 'Một thùng có 5/6 lít nước. Người ta rót ra 1/4 lít. Trong thùng còn bao nhiêu lít nước?', '7/12'),
    ]),
  ];
};

const mixedNumbers = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const whole = 2 + (seed % 3);
  return [
    mcq(qid(lesson, 1), 1, `Hỗn số ${whole} 3/5 gồm phần nguyên và phần phân số nào?`, [`${whole} và 3/5`, `${whole + 3} và 1/5`, `3 và ${whole}/5`, `${whole} và 5/3`], 0),
    mcq(qid(lesson, 2), 1, `Hỗn số ${whole} 1/4 viết thành phân số nào?`, [`${whole * 4 + 1}/4`, `${whole + 1}/4`, `${whole * 4}/5`, `${whole}/4`], 0),
    mcq(qid(lesson, 3), 1, 'Phân số 17/5 viết thành hỗn số nào?', ['2 7/5', '3 2/5', '3 5/2', '4 1/5'], 1),
    mcq(qid(lesson, 4), 1, 'Hỗn số nào lớn hơn 4 nhưng bé hơn 5?', ['3 7/8', '4 3/8', '5 1/8', '4 9/8'], 1),
    shortAnswer(qid(lesson, 5), 2, 'Viết hỗn số 5 2/3 thành phân số.', '17/3'),
    shortAnswer(qid(lesson, 6), 2, 'Viết phân số 29/6 thành hỗn số.', '4 5/6'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về hỗn số.', [
      ['Hỗn số luôn gồm phần nguyên và một phân số bé hơn 1.', true],
      ['Hỗn số 2 1/3 bằng phân số 7/3.', true],
      ['Phân số 9/4 bằng hỗn số 1 5/4.', false],
    ]),
    ordering(qid(lesson, 8), 2, 'Sắp xếp các hỗn số theo thứ tự từ bé đến lớn.', ['2 1/2', '1 3/4', '3 1/5', '2 1/4'], [1, 3, 0, 2]),
    mcq(qid(lesson, 9), 3, 'Một đoạn dây dài 3 1/2 m, cắt đi 1 1/4 m. Đoạn dây còn lại dài bao nhiêu?', ['2 1/4 m', '2 3/4 m', '1 1/4 m', '4 3/4 m'], 0),
    shortAnswer(qid(lesson, 10), 3, 'Một bình có 2 2/5 lít nước, thêm 1 3/10 lít. Bình có tất cả bao nhiêu lít nước?', '3 7/10'),
  ];
};

const geometryMeasurementReview = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const length = 8 + seed;
  const width = 5 + (seed % 3);
  const perimeter = 2 * (length + width);
  const area = length * width;
  return [
    mcq(qid(lesson, 1), 1, `Hình chữ nhật dài ${length} cm, rộng ${width} cm có chu vi bao nhiêu?`, [`${perimeter} cm`, `${area} cm`, `${length + width} cm`, `${perimeter * 2} cm`], 0),
    mcq(qid(lesson, 2), 1, `Hình chữ nhật dài ${length} cm, rộng ${width} cm có diện tích bao nhiêu?`, [`${area} cm²`, `${perimeter} cm²`, `${length + width} cm²`, `${area * 2} cm²`], 0),
    mcq(qid(lesson, 3), 1, '3 m 25 cm bằng bao nhiêu xăng-ti-mét?', ['325 cm', '3025 cm', '35 cm', '3,25 cm'], 0),
    mcq(qid(lesson, 4), 1, '2 kg 350 g bằng bao nhiêu gam?', ['235 g', '2 035 g', '2 350 g', '23 500 g'], 2),
    shortAnswer(qid(lesson, 5), 2, `Một hình vuông có cạnh ${width + 2} cm. Tính chu vi hình vuông.`, `${(width + 2) * 4} cm`),
    shortAnswer(qid(lesson, 6), 2, 'Đổi 4 giờ 15 phút ra phút.', '255 phút'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về hình học và đo lường.', [
      ['Hai đường thẳng vuông góc tạo thành góc vuông.', true],
      ['1 m² = 100 cm².', false],
      ['1 giờ = 60 phút.', true],
    ]),
    matching(qid(lesson, 8), 2, 'Nối đại lượng với đơn vị đo phù hợp.', [['Chiều dài sân trường', 'm'], ['Khối lượng quả dưa', 'kg'], ['Diện tích lớp học', 'm²']]),
    mcq(qid(lesson, 9), 3, `Một khu đất hình chữ nhật dài ${length + 12} m, rộng ${width + 5} m. Người ta làm hàng rào xung quanh, chừa cổng rộng 4 m. Cần bao nhiêu mét hàng rào?`, [`${2 * (length + width + 22) - 4} m`, `${(length + 12) * (width + 5)} m`, `${2 * (length + width + 22)} m`, `${length + width + 13} m`], 0),
    shortAnswer(qid(lesson, 10), 3, `Một nền nhà hình chữ nhật dài ${length + 2} m, rộng ${width + 1} m. Mỗi mét vuông cần 4 viên gạch lớn. Cần bao nhiêu viên?`, String((length + 2) * (width + 1) * 4)),
  ];
};

const decimalConcept = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const value = 345 + seed * 7;
  const text = decimal(value, 2);
  const digit = Math.floor(value / 10) % 10;
  return [
    mcq(qid(lesson, 1), 1, `Trong số ${text}, phần nguyên là số nào?`, [String(Math.floor(value / 100)), String(value % 100), String(digit), String(value)], 0),
    mcq(qid(lesson, 2), 1, `Trong số ${text}, chữ số ${digit} thuộc hàng nào?`, ['Hàng đơn vị', 'Hàng phần mười', 'Hàng phần trăm', 'Hàng chục'], 1),
    mcq(qid(lesson, 3), 1, 'Số gồm 7 đơn vị, 3 phần mười và 5 phần trăm được viết là gì?', ['7,305', '7,35', '73,5', '0,735'], 1),
    mcq(qid(lesson, 4), 1, 'Số thập phân nào biểu thị 46 phần trăm?', ['4,6', '0,46', '46,0', '0,046'], 1),
    shortAnswer(qid(lesson, 5), 2, 'Viết số thập phân gồm 12 đơn vị, 4 phần mười và 8 phần nghìn.', '12,408'),
    shortAnswer(qid(lesson, 6), 2, 'Viết phân số thập phân 725/100 dưới dạng số thập phân.', '7,25'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về số thập phân.', [
      ['Số 5,07 có phần nguyên là 5.', true],
      ['Trong số 3,42, chữ số 2 ở hàng phần mười.', false],
      ['Số 0,8 bằng 8/10.', true],
    ]),
    matching(qid(lesson, 8), 2, 'Nối cách đọc với số thập phân tương ứng.', [['Hai phẩy năm', '2,5'], ['Không phẩy không bảy', '0,07'], ['Mười hai phẩy ba mươi tư', '12,34']]),
    mcq(qid(lesson, 9), 3, 'Một đoạn đường dài 2 km 350 m. Viết độ dài đó theo đơn vị ki-lô-mét dưới dạng số thập phân.', ['2,035 km', '2,35 km', '23,5 km', '2,305 km'], 1),
    shortAnswer(qid(lesson, 10), 3, 'Một can có 3 lít 75 mi-li-lít nước. Viết lượng nước theo đơn vị lít dưới dạng số thập phân.', '3,075 lít'),
  ];
};

const decimalComparison = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const a = 435 + seed;
  const b = 438 + seed;
  return [
    mcq(qid(lesson, 1), 1, `Dấu thích hợp điền vào ${decimal(a, 2)} … ${decimal(b, 2)} là gì?`, ['>', '<', '=', 'Không so sánh được'], 1),
    mcq(qid(lesson, 2), 1, 'Số nào lớn nhất?', ['5,08', '5,8', '5,18', '5,108'], 1),
    mcq(qid(lesson, 3), 1, 'Số nào bé nhất?', ['0,72', '0,702', '0,27', '0,207'], 3),
    mcq(qid(lesson, 4), 1, 'Số thập phân nào bằng 4,500?', ['4,05', '4,5', '4,005', '45'], 1),
    shortAnswer(qid(lesson, 5), 2, 'Điền dấu >, < hoặc =: 7,090 … 7,09.', '='),
    shortAnswer(qid(lesson, 6), 2, 'Viết số lớn nhất trong các số 12,35; 12,305; 12,53; 12,503.', '12,53'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai khi so sánh số thập phân.', [
      ['6,4 > 6,39.', true],
      ['0,75 = 0,750.', true],
      ['8,029 > 8,2.', false],
    ]),
    ordering(qid(lesson, 8), 2, 'Sắp xếp các số theo thứ tự từ bé đến lớn.', ['3,25', '3,205', '3,52', '3,025'], [3, 1, 0, 2]),
    mcq(qid(lesson, 9), 3, 'Bốn bạn chạy được các quãng đường 1,205 km; 1,25 km; 1,052 km; 1,502 km. Bạn chạy xa thứ hai đạt bao nhiêu ki-lô-mét?', ['1,052 km', '1,205 km', '1,25 km', '1,502 km'], 2),
    shortAnswer(qid(lesson, 10), 3, 'Tìm chữ số thích hợp lớn nhất thay vào * để 4,2*7 < 4,257.', '4'),
  ];
};

const decimalMeasurement = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  return [
    mcq(qid(lesson, 1), 1, '3 m 45 cm viết theo đơn vị mét là số nào?', ['3,045 m', '3,45 m', '34,5 m', '345 m'], 1),
    mcq(qid(lesson, 2), 1, '2 kg 75 g viết theo đơn vị ki-lô-gam là số nào?', ['2,75 kg', '2,075 kg', '2,0075 kg', '2075 kg'], 1),
    mcq(qid(lesson, 3), 1, '5 lít 250 ml viết theo đơn vị lít là số nào?', ['5,25 lít', '5,025 lít', '5,2500 lít', '5250 lít'], 0),
    mcq(qid(lesson, 4), 1, '1 giờ 30 phút viết theo đơn vị giờ là số nào?', ['1,3 giờ', '1,5 giờ', '1,30 giờ', '1,03 giờ'], 1),
    shortAnswer(qid(lesson, 5), 2, `Viết ${4 + seed} m 8 cm theo đơn vị mét.`, `${4 + seed},08 m`),
    shortAnswer(qid(lesson, 6), 2, 'Viết 3 tấn 250 kg theo đơn vị tấn.', '3,25 tấn'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về số đo viết dưới dạng thập phân.', [
      ['4 m 5 cm = 4,05 m.', true],
      ['2 kg 6 g = 2,6 kg.', false],
      ['750 ml = 0,75 lít.', true],
    ]),
    matching(qid(lesson, 8), 2, 'Nối số đo với cách viết thập phân tương ứng.', [['6 m 20 cm', '6,2 m'], ['4 kg 80 g', '4,08 kg'], ['2 lít 5 ml', '2,005 lít']]),
    mcq(qid(lesson, 9), 3, 'Một cuộn dây dài 8 m 35 cm, cuộn khác dài 6 m 8 cm. Tổng độ dài viết theo mét là bao nhiêu?', ['14,43 m', '14,403 m', '14,15 m', '143,5 m'], 0),
    shortAnswer(qid(lesson, 10), 3, 'Một bao gạo nặng 12 kg 500 g, đã dùng 3 kg 750 g. Khối lượng còn lại theo đơn vị ki-lô-gam là bao nhiêu?', '8,75 kg'),
  ];
};

const decimalRounding = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const value = 1267 + seed * 11;
  return [
    mcq(qid(lesson, 1), 1, 'Làm tròn số 7,46 đến hàng đơn vị được số nào?', ['7', '8', '7,5', '7,4'], 0),
    mcq(qid(lesson, 2), 1, 'Làm tròn số 3,784 đến hàng phần mười được số nào?', ['3,7', '3,8', '3,78', '4'], 1),
    mcq(qid(lesson, 3), 1, 'Làm tròn số 9,125 đến hàng phần trăm được số nào?', ['9,12', '9,13', '9,2', '9,125'], 1),
    mcq(qid(lesson, 4), 1, `Làm tròn số ${decimal(value, 2)} đến hàng đơn vị được số nào?`, [String(Math.floor(value / 100)), String(Math.round(value / 100)), decimal(Math.floor(value / 10) * 10, 2), String(Math.ceil(value / 100) + 1)], 1),
    shortAnswer(qid(lesson, 5), 2, 'Làm tròn 15,349 đến hàng phần mười.', '15,3'),
    shortAnswer(qid(lesson, 6), 2, 'Làm tròn 0,995 đến hàng phần trăm.', '1,00'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về làm tròn số.', [
      ['8,65 làm tròn đến hàng phần mười được 8,7.', true],
      ['4,24 làm tròn đến hàng phần mười được 4,3.', false],
      ['12,499 làm tròn đến hàng đơn vị được 12.', true],
    ]),
    matching(qid(lesson, 8), 2, 'Nối số với kết quả làm tròn đến hàng phần mười.', [['2,34', '2,3'], ['5,67', '5,7'], ['9,95', '10,0']]),
    mcq(qid(lesson, 9), 3, 'Một bình chứa 18,746 lít nước. Làm tròn đến lít gần nhất để ước lượng được bao nhiêu lít?', ['18 lít', '19 lít', '18,7 lít', '20 lít'], 1),
    shortAnswer(qid(lesson, 10), 3, 'Một quãng đường dài 6,384 km. Làm tròn đến hàng phần trăm ki-lô-mét.', '6,38 km'),
  ];
};

const decimalReview = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  if (seed >= 30) {
    return [
      mcq(qid(lesson, 1), 1, 'Trong số 12,407, chữ số 0 thuộc hàng nào?', ['Hàng phần mười', 'Hàng phần trăm', 'Hàng phần nghìn', 'Hàng đơn vị'], 1),
      mcq(qid(lesson, 2), 1, 'Số nào bằng 8,300?', ['8,03', '8,3', '8,003', '83'], 1),
      mcq(qid(lesson, 3), 1, 'Số lớn nhất trong 6,09; 6,9; 6,19; 6,901 là số nào?', ['6,09', '6,9', '6,19', '6,901'], 3),
      mcq(qid(lesson, 4), 1, 'Làm tròn 4,956 đến hàng phần trăm được số nào?', ['4,95', '4,96', '5,00', '4,9'], 1),
      shortAnswer(qid(lesson, 5), 2, 'Viết 7 m 45 cm theo đơn vị mét dưới dạng số thập phân.', '7,45 m'),
      shortAnswer(qid(lesson, 6), 2, 'Điền dấu thích hợp: 9,099 … 9,1.', '<'),
      trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai trong phần ôn tập số thập phân học kì I.', [
        ['3,40 = 3,4.', true],
        ['7,018 > 7,18.', false],
        ['5,06 m = 5 m 6 cm.', true],
      ]),
      ordering(qid(lesson, 8), 2, 'Sắp xếp các số ôn tập theo thứ tự từ bé đến lớn.', ['2,07', '2,7', '2,17', '2,007'], [3, 0, 2, 1]),
      mcq(qid(lesson, 9), 3, 'Ba kiện hàng nặng 15,08 kg; 15,8 kg; 15,18 kg. Kiện nặng nhất có khối lượng bao nhiêu?', ['15,08 kg', '15,8 kg', '15,18 kg', '15,018 kg'], 1),
      shortAnswer(qid(lesson, 10), 3, 'Tìm chữ số lớn nhất thay vào * để 6,3*5 < 6,375.', '6'),
    ];
  }
  const value = 2845 + seed * 13;
  return [
    mcq(qid(lesson, 1), 1, `Số ${decimal(value, 3)} có chữ số hàng phần trăm là chữ số nào?`, [String(Math.floor(value / 100) % 10), String(Math.floor(value / 10) % 10), String(value % 10), String(Math.floor(value / 1000))], 1),
    mcq(qid(lesson, 2), 1, 'Số nào bằng 6,70?', ['6,07', '6,7', '6,7001', '67'], 1),
    mcq(qid(lesson, 3), 1, 'Sắp xếp nhanh: số lớn nhất trong 4,08; 4,8; 4,18; 4,081 là số nào?', ['4,08', '4,8', '4,18', '4,081'], 1),
    mcq(qid(lesson, 4), 1, 'Làm tròn 7,846 đến hàng phần mười được số nào?', ['7,8', '7,9', '7,85', '8'], 0),
    shortAnswer(qid(lesson, 5), 2, 'Viết 9 m 6 cm theo đơn vị mét dưới dạng số thập phân.', '9,06 m'),
    shortAnswer(qid(lesson, 6), 2, 'Điền dấu thích hợp: 5,309 … 5,31.', '<'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai trong bài luyện tập số thập phân.', [
      ['0,50 = 0,5.', true],
      ['3,105 > 3,15.', false],
      ['2,75 m = 2 m 75 cm.', true],
    ]),
    ordering(qid(lesson, 8), 2, 'Sắp xếp các số theo thứ tự từ lớn đến bé.', ['8,03', '8,3', '8,13', '8,003'], [1, 2, 0, 3]),
    mcq(qid(lesson, 9), 3, 'Ba kiện hàng nặng 12,5 kg; 12,05 kg; 12,505 kg. Kiện nặng nhất có khối lượng bao nhiêu?', ['12,05 kg', '12,5 kg', '12,505 kg', '12,055 kg'], 2),
    shortAnswer(qid(lesson, 10), 3, 'Tìm chữ số lớn nhất thay vào * để 7,4*8 < 7,458.', '4'),
  ];
};

const largeAreaUnits = (lesson: Math5CurriculumLesson, seed = 0): Question[] => [
  mcq(qid(lesson, 1), 1, '1 km² bằng bao nhiêu mét vuông?', ['1 000 m²', '10 000 m²', '100 000 m²', '1 000 000 m²'], 3),
  mcq(qid(lesson, 2), 1, '1 ha bằng bao nhiêu mét vuông?', ['100 m²', '1 000 m²', '10 000 m²', '100 000 m²'], 2),
  mcq(qid(lesson, 3), 1, '3 km² bằng bao nhiêu héc-ta?', ['30 ha', '300 ha', '3 000 ha', '0,3 ha'], 1),
  mcq(qid(lesson, 4), 1, '45 000 m² bằng bao nhiêu héc-ta?', ['4,5 ha', '45 ha', '450 ha', '0,45 ha'], 0),
  shortAnswer(qid(lesson, 5), 2, `Đổi ${2 + seed} km² ra héc-ta.`, `${(2 + seed) * 100} ha`),
  shortAnswer(qid(lesson, 6), 2, 'Đổi 7,5 ha ra mét vuông.', '75000 m²'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về ki-lô-mét vuông và héc-ta.', [
    ['1 km² = 100 ha.', true],
    ['1 ha = 1 000 m².', false],
    ['250 ha = 2,5 km².', true],
  ]),
  matching(qid(lesson, 8), 2, 'Nối các số đo diện tích bằng nhau.', [['2 km²', '200 ha'], ['3,5 ha', '35 000 m²'], ['80 ha', '0,8 km²']]),
  mcq(qid(lesson, 9), 3, 'Một khu bảo tồn rộng 2,4 km², trong đó 75 ha là mặt nước. Diện tích phần còn lại là bao nhiêu héc-ta?', ['165 ha', '167,5 ha', '240 ha', '315 ha'], 0),
  shortAnswer(qid(lesson, 10), 3, 'Hai cánh đồng rộng 18,5 ha và 125 000 m². Tổng diện tích theo héc-ta là bao nhiêu?', '31 ha'),
];

const areaUnits = (lesson: Math5CurriculumLesson, seed = 0): Question[] => [
  mcq(qid(lesson, 1), 1, '1 m² bằng bao nhiêu đề-xi-mét vuông?', ['10 dm²', '100 dm²', '1 000 dm²', '10 000 dm²'], 1),
  mcq(qid(lesson, 2), 1, '1 dm² bằng bao nhiêu xăng-ti-mét vuông?', ['10 cm²', '100 cm²', '1 000 cm²', '0,01 cm²'], 1),
  mcq(qid(lesson, 3), 1, '6 m² 25 dm² bằng bao nhiêu đề-xi-mét vuông?', ['625 dm²', '6 025 dm²', '85 dm²', '6250 dm²'], 0),
  mcq(qid(lesson, 4), 1, '3 500 cm² bằng bao nhiêu đề-xi-mét vuông?', ['3,5 dm²', '35 dm²', '350 dm²', '0,35 dm²'], 1),
  shortAnswer(qid(lesson, 5), 2, `Đổi ${4 + seed} m² ra xăng-ti-mét vuông.`, `${(4 + seed) * 10_000} cm²`),
  shortAnswer(qid(lesson, 6), 2, 'Đổi 8 m² 7 dm² ra mét vuông dưới dạng số thập phân.', '8,07 m²'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về đơn vị diện tích.', [
    ['Hai đơn vị diện tích liền nhau hơn kém nhau 100 lần.', true],
    ['5 m² = 500 cm².', false],
    ['2,4 dm² = 240 cm².', true],
  ]),
  ordering(qid(lesson, 8), 2, 'Sắp xếp các số đo diện tích từ bé đến lớn.', ['0,8 m²', '75 dm²', '8 500 cm²', '1 m²'], [1, 0, 2, 3]),
  mcq(qid(lesson, 9), 3, 'Một tấm bìa rộng 2,5 m². Cắt đi 4 500 cm². Phần còn lại rộng bao nhiêu mét vuông?', ['2,05 m²', '2,45 m²', '2,95 m²', '1,95 m²'], 0),
  shortAnswer(qid(lesson, 10), 3, 'Một sàn phòng rộng 18 m² 50 dm². Viết diện tích theo mét vuông.', '18,5 m²'),
];

const practicalMeasurement = (lesson: Math5CurriculumLesson, seed = 0): Question[] => [
  mcq(qid(lesson, 1), 1, 'Đơn vị thích hợp để đo chiều dài bút chì là gì?', ['km', 'm', 'cm', 'ha'], 2),
  mcq(qid(lesson, 2), 1, 'Đơn vị thích hợp để đo khối lượng một bao gạo là gì?', ['lít', 'kg', 'm²', 'phút'], 1),
  mcq(qid(lesson, 3), 1, 'Dụng cụ thích hợp để đo chiều dài bàn học là gì?', ['Cân đồng hồ', 'Thước mét', 'Ca đong', 'Đồng hồ bấm giờ'], 1),
  mcq(qid(lesson, 4), 1, 'Ước lượng hợp lí cho chiều cao cửa lớp là bao nhiêu?', ['2 cm', '2 m', '20 m', '200 km'], 1),
  shortAnswer(qid(lesson, 5), 2, `Một bước chân dài khoảng ${60 + seed} cm. Đi 10 bước được khoảng bao nhiêu mét?`, `${decimal((60 + seed) * 10, 2)} m`),
  shortAnswer(qid(lesson, 6), 2, 'Một chai chứa 1,5 lít nước. Rót đều vào 3 cốc. Mỗi cốc có bao nhiêu lít?', '0,5 lít'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về lựa chọn đơn vị đo.', [
    ['Có thể dùng mét để đo chiều dài lớp học.', true],
    ['Có thể dùng ki-lô-gam để đo dung tích can nước.', false],
    ['Có thể dùng phút để đo thời gian làm một bài tập.', true],
  ]),
  categorization(qid(lesson, 8), 2, 'Phân loại đại lượng theo nhóm đo lường.', [['length', 'Độ dài'], ['mass', 'Khối lượng'], ['time', 'Thời gian']], [['i1', 'Chiều dài sân', 'length'], ['i2', 'Khối lượng cặp sách', 'mass'], ['i3', 'Thời gian ra chơi', 'time']]),
  mcq(qid(lesson, 9), 3, 'Một nhóm đo chiều dài sân ba lần được 24,8 m; 25,1 m; 25,0 m. Giá trị nào hợp lí nhất để báo cáo?', ['24,8 m', '25,1 m', '25,0 m', '74,9 m'], 2),
  shortAnswer(qid(lesson, 10), 3, 'Một bình có vạch 2 lít. Đã có 0,65 lít nước, cần thêm bao nhiêu lít để đầy bình?', '1,35 lít'),
];

const measurementReview = (lesson: Math5CurriculumLesson, seed = 0): Question[] => seed >= 30 ? [
  mcq(qid(lesson, 1), 1, '6,32 m bằng bao nhiêu xăng-ti-mét?', ['63,2 cm', '632 cm', '6 320 cm', '0,632 cm'], 1),
  mcq(qid(lesson, 2), 1, '4,125 kg bằng bao nhiêu gam?', ['412,5 g', '4 125 g', '41 250 g', '4 012,5 g'], 1),
  mcq(qid(lesson, 3), 1, '1,75 giờ bằng bao nhiêu phút?', ['75 phút', '105 phút', '115 phút', '175 phút'], 1),
  mcq(qid(lesson, 4), 1, '1,2 ha bằng bao nhiêu mét vuông?', ['1 200 m²', '12 000 m²', '120 000 m²', '0,00012 m²'], 1),
  shortAnswer(qid(lesson, 5), 2, 'Đổi 8 m 6 cm ra mét.', '8,06 m'),
  shortAnswer(qid(lesson, 6), 2, 'Đổi 7 phút 12 giây ra giây.', '432 giây'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai trong phần ôn tập đo lường học kì I.', [
    ['2,35 tấn = 2 350 kg.', true],
    ['4,08 m = 4 m 80 cm.', false],
    ['1 giờ 45 phút = 105 phút.', true],
  ]),
  matching(qid(lesson, 8), 2, 'Nối số đo ôn tập với giá trị tương đương.', [['3,6 m', '360 cm'], ['2,075 kg', '2 075 g'], ['0,8 giờ', '48 phút']]),
  mcq(qid(lesson, 9), 3, 'Một vận động viên chạy 2,4 km buổi sáng và 650 m buổi chiều. Tổng quãng đường là bao nhiêu ki-lô-mét?', ['2,465 km', '3,05 km', '3,65 km', '2,95 km'], 1),
  shortAnswer(qid(lesson, 10), 3, 'Một thùng chứa 15,2 lít dầu. Rót ra 4 chai, mỗi chai 1,35 lít. Thùng còn bao nhiêu lít?', '9,8 lít'),
] : [
  mcq(qid(lesson, 1), 1, '4,25 m bằng bao nhiêu xăng-ti-mét?', ['42,5 cm', '425 cm', '4 250 cm', '0,425 cm'], 1),
  mcq(qid(lesson, 2), 1, '3,08 kg bằng bao nhiêu gam?', ['308 g', '3 080 g', '30 800 g', '3 008 g'], 1),
  mcq(qid(lesson, 3), 1, '2,5 giờ bằng bao nhiêu phút?', ['125 phút', '150 phút', '250 phút', '205 phút'], 1),
  mcq(qid(lesson, 4), 1, '0,75 ha bằng bao nhiêu mét vuông?', ['750 m²', '7 500 m²', '75 000 m²', '0,0075 m²'], 1),
  shortAnswer(qid(lesson, 5), 2, `Đổi ${5 + seed} m 35 cm ra mét.`, `${5 + seed},35 m`),
  shortAnswer(qid(lesson, 6), 2, 'Đổi 4 phút 18 giây ra giây.', '258 giây'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về đổi đơn vị đo.', [
    ['1,2 tấn = 1 200 kg.', true],
    ['3,5 m = 3 m 5 cm.', false],
    ['2 giờ 15 phút = 135 phút.', true],
  ]),
  matching(qid(lesson, 8), 2, 'Nối số đo với giá trị tương đương.', [['2,4 m', '240 cm'], ['1,75 kg', '1 750 g'], ['0,6 giờ', '36 phút']]),
  mcq(qid(lesson, 9), 3, 'Một vận động viên chạy 1,25 km buổi sáng và 850 m buổi chiều. Tổng quãng đường là bao nhiêu ki-lô-mét?', ['1,335 km', '2,1 km', '2,85 km', '1,85 km'], 1),
  shortAnswer(qid(lesson, 10), 3, 'Một thùng chứa 12,5 lít dầu. Rót ra 3 chai, mỗi chai 1,25 lít. Thùng còn bao nhiêu lít?', '8,75 lít'),
];

const decimalAddition = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const a = 1235 + seed * 7;
  const b = 468 + seed * 3;
  return [
    mcq(qid(lesson, 1), 1, `${decimal(a, 2)} + ${decimal(b, 2)} bằng bao nhiêu?`, [decimal(a + b, 2), decimal(a + b + 10, 2), decimal(a + b - 100, 2), decimal(a + b, 1)], 0),
    mcq(qid(lesson, 2), 1, '4,8 + 2,35 bằng bao nhiêu?', ['6,15', '7,15', '7,03', '6,35'], 1),
    mcq(qid(lesson, 3), 1, '0,75 + 1,006 bằng bao nhiêu?', ['1,756', '1,081', '0,851', '1,75'], 0),
    mcq(qid(lesson, 4), 1, '15 + 3,48 bằng bao nhiêu?', ['18,48', '18,53', '15,348', '3,63'], 0),
    shortAnswer(qid(lesson, 5), 2, 'Tính 7,305 + 2,86.', '10,165'),
    shortAnswer(qid(lesson, 6), 2, 'Tính 18,75 + 6,4 + 0,85.', '26'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về cộng số thập phân.', [
      ['Khi đặt tính, các dấu phẩy phải thẳng cột.', true],
      ['5,7 + 0,3 = 6.', true],
      ['2,05 + 1,8 = 3,13.', false],
    ]),
    matching(qid(lesson, 8), 2, 'Nối phép cộng với kết quả đúng.', [['1,2 + 3,4', '4,6'], ['0,75 + 0,25', '1'], ['12,08 + 2,9', '14,98']]),
    mcq(qid(lesson, 9), 3, 'Ngày thứ nhất cửa hàng bán 12,75 kg chè, ngày thứ hai bán 8,6 kg và ngày thứ ba bán 9,25 kg. Cả ba ngày bán bao nhiêu?', ['29,6 kg', '30,6 kg', '31,6 kg', '30,06 kg'], 1),
    shortAnswer(qid(lesson, 10), 3, 'Một xe đi 35,8 km buổi sáng và 27,65 km buổi chiều. Sau đó đi thêm 4,55 km. Tổng quãng đường là bao nhiêu?', '68 km'),
  ];
};

const decimalSubtraction = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const a = 1845 + seed * 9;
  const b = 672 + seed * 3;
  return [
    mcq(qid(lesson, 1), 1, `${decimal(a, 2)} - ${decimal(b, 2)} bằng bao nhiêu?`, [decimal(a - b, 2), decimal(a + b, 2), decimal(a - b + 10, 2), decimal(a - b - 100, 2)], 0),
    mcq(qid(lesson, 2), 1, '9,5 - 3,27 bằng bao nhiêu?', ['6,23', '6,77', '5,23', '12,77'], 0),
    mcq(qid(lesson, 3), 1, '7 - 2,85 bằng bao nhiêu?', ['5,15', '4,15', '4,25', '5,85'], 1),
    mcq(qid(lesson, 4), 1, '10,00 - 0,375 bằng bao nhiêu?', ['9,625', '9,725', '10,375', '0,625'], 0),
    shortAnswer(qid(lesson, 5), 2, 'Tính 24,6 - 8,975.', '15,625'),
    shortAnswer(qid(lesson, 6), 2, 'Tìm x, biết x + 3,75 = 12,4.', '8,65'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về trừ số thập phân.', [
      ['12,5 - 2,5 = 10.', true],
      ['8 - 0,75 = 7,25.', true],
      ['5,06 - 1,4 = 4,92.', false],
    ]),
    matching(qid(lesson, 8), 2, 'Nối phép trừ với kết quả đúng.', [['6,5 - 2,3', '4,2'], ['10 - 3,75', '6,25'], ['8,04 - 0,9', '7,14']]),
    mcq(qid(lesson, 9), 3, 'Một bể có 25,5 lít nước, đã dùng 8,75 lít rồi thêm 3,25 lít. Bể hiện có bao nhiêu lít?', ['13,5 lít', '20 lít', '17,75 lít', '30 lít'], 1),
    shortAnswer(qid(lesson, 10), 3, 'Một cuộn vải dài 42,8 m. May áo dùng 18,65 m, may rèm dùng 7,95 m. Còn lại bao nhiêu mét?', '16,2 m'),
  ];
};

const decimalMultiplication = (lesson: Math5CurriculumLesson, seed = 0): Question[] => [
  mcq(qid(lesson, 1), 1, '3,4 × 5 bằng bao nhiêu?', ['15', '17', '1,7', '170'], 1),
  mcq(qid(lesson, 2), 1, '2,35 × 4 bằng bao nhiêu?', ['8,4', '9,4', '9,04', '94'], 1),
  mcq(qid(lesson, 3), 1, '1,2 × 0,5 bằng bao nhiêu?', ['0,6', '6', '1,7', '0,06'], 0),
  mcq(qid(lesson, 4), 1, '0,75 × 0,8 bằng bao nhiêu?', ['0,06', '0,6', '6', '1,55'], 1),
  shortAnswer(qid(lesson, 5), 2, `Tính ${decimal(125 + seed, 2)} × 6.`, decimal((125 + seed) * 6, 2)),
  shortAnswer(qid(lesson, 6), 2, 'Tính 3,25 × 1,2.', '3,9'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về nhân số thập phân.', [
    ['2,5 × 4 = 10.', true],
    ['0,4 × 0,3 = 1,2.', false],
    ['Nhân một số dương với 0,5 được một nửa số đó.', true],
  ]),
  matching(qid(lesson, 8), 2, 'Nối phép nhân với kết quả đúng.', [['1,5 × 2', '3'], ['0,25 × 4', '1'], ['2,4 × 1,5', '3,6']]),
  mcq(qid(lesson, 9), 3, 'Một mét vải giá 48,5 nghìn đồng. Mua 3,2 m hết bao nhiêu nghìn đồng?', ['145,5', '155,2', '151,7', '152,5'], 1),
  shortAnswer(qid(lesson, 10), 3, 'Một mảnh vườn hình chữ nhật dài 12,5 m, rộng 8,4 m. Diện tích mảnh vườn là bao nhiêu?', '105 m²'),
];

const decimalDivision = (lesson: Math5CurriculumLesson, seed = 0): Question[] => [
  mcq(qid(lesson, 1), 1, '8,4 : 4 bằng bao nhiêu?', ['2,1', '21', '3,1', '1,2'], 0),
  mcq(qid(lesson, 2), 1, '15,75 : 5 bằng bao nhiêu?', ['3,15', '31,5', '2,15', '3,5'], 0),
  mcq(qid(lesson, 3), 1, '7,2 : 0,8 bằng bao nhiêu?', ['0,9', '9', '90', '5,76'], 1),
  mcq(qid(lesson, 4), 1, '2,4 : 1,5 bằng bao nhiêu?', ['1,6', '0,16', '3,9', '1,9'], 0),
  shortAnswer(qid(lesson, 5), 2, `Tính ${decimal((36 + seed) * 25, 2)} : ${36 + seed}.`, '0,25'),
  shortAnswer(qid(lesson, 6), 2, 'Tính 18,9 : 1,4.', '13,5'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về chia số thập phân.', [
    ['9,6 : 3 = 3,2.', true],
    ['5 : 0,5 = 2,5.', false],
    ['Chia một số dương cho 0,1 được số gấp 10 lần.', true],
  ]),
  matching(qid(lesson, 8), 2, 'Nối phép chia với kết quả đúng.', [['6,3 : 3', '2,1'], ['4,8 : 0,6', '8'], ['7,5 : 2,5', '3']]),
  mcq(qid(lesson, 9), 3, 'Có 18,6 lít nước rót đều vào 12 chai. Mỗi chai có bao nhiêu lít?', ['1,45 lít', '1,55 lít', '1,65 lít', '2,55 lít'], 1),
  shortAnswer(qid(lesson, 10), 3, 'Một ô tô đi 157,5 km trong 3,5 giờ. Trung bình mỗi giờ đi bao nhiêu ki-lô-mét?', '45 km'),
];

const decimalScaling = (lesson: Math5CurriculumLesson, seed = 0): Question[] => [
  mcq(qid(lesson, 1), 1, '4,25 × 10 bằng bao nhiêu?', ['4,250', '42,5', '425', '0,425'], 1),
  mcq(qid(lesson, 2), 1, '3,08 × 100 bằng bao nhiêu?', ['30,8', '308', '3 080', '0,0308'], 1),
  mcq(qid(lesson, 3), 1, '56,7 : 10 bằng bao nhiêu?', ['5,67', '0,567', '567', '56,07'], 0),
  mcq(qid(lesson, 4), 1, '8,4 × 0,01 bằng bao nhiêu?', ['0,84', '0,084', '84', '8,04'], 1),
  shortAnswer(qid(lesson, 5), 2, `Tính ${decimal(125 + seed, 2)} × 1000.`, decimal((125 + seed) * 1000, 2)),
  shortAnswer(qid(lesson, 6), 2, 'Tính 735,2 : 100.', '7,352'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về nhân, chia với lũy thừa của 10.', [
    ['6,3 × 100 = 630.', true],
    ['4,5 : 10 = 45.', false],
    ['2,8 × 0,1 = 0,28.', true],
  ]),
  matching(qid(lesson, 8), 2, 'Nối phép tính với kết quả đúng.', [['7,5 × 10', '75'], ['7,5 : 100', '0,075'], ['7,5 × 0,01', '0,075']]),
  mcq(qid(lesson, 9), 3, 'Một gói hạt nặng 0,125 kg. 100 gói như thế nặng bao nhiêu ki-lô-gam?', ['1,25 kg', '12,5 kg', '125 kg', '0,0125 kg'], 1),
  shortAnswer(qid(lesson, 10), 3, 'Một chai chứa 0,75 lít. Lượng nước trong 1 000 chai là bao nhiêu lít?', '750 lít'),
];

const decimalOperationsReview = (lesson: Math5CurriculumLesson, seed = 0): Question[] => seed >= 30 ? [
  mcq(qid(lesson, 1), 1, '7,35 + 2,65 bằng bao nhiêu?', ['9', '10', '10,1', '9,9'], 1),
  mcq(qid(lesson, 2), 1, '20 - 6,875 bằng bao nhiêu?', ['13,125', '13,225', '14,125', '26,875'], 0),
  mcq(qid(lesson, 3), 1, '3,2 × 2,5 bằng bao nhiêu?', ['7', '8', '80', '5,7'], 1),
  mcq(qid(lesson, 4), 1, '14,4 : 1,2 bằng bao nhiêu?', ['1,2', '12', '120', '13,2'], 1),
  shortAnswer(qid(lesson, 5), 2, 'Tính 4,75 + 3,6 - 1,35.', '7'),
  shortAnswer(qid(lesson, 6), 2, 'Tính (12,5 - 2,5) × 0,75.', '7,5'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai khi ôn tập các phép tính số thập phân.', [
    ['3,6 × 2,5 = 9.', true],
    ['18,2 : 1,4 = 12.', false],
    ['5,75 + 4,25 = 10.', true],
  ]),
  ordering(qid(lesson, 8), 2, 'Sắp xếp kết quả các biểu thức ôn tập từ bé đến lớn.', ['1,25 + 2,75', '9,6 : 3', '1,8 × 2', '8 - 3,5'], [1, 2, 0, 3]),
  mcq(qid(lesson, 9), 3, 'Mua 1,5 kg nho giá 52 nghìn đồng/kg và 2,4 kg lê giá 35 nghìn đồng/kg. Hết bao nhiêu nghìn đồng?', ['152', '162', '172', '128'], 1),
  shortAnswer(qid(lesson, 10), 3, 'Một bể có 30,5 lít nước. Thêm 4 can, mỗi can 3,25 lít rồi dùng 9,5 lít. Còn bao nhiêu lít?', '34 lít'),
] : [
  mcq(qid(lesson, 1), 1, '6,25 + 3,8 bằng bao nhiêu?', ['9,05', '10,05', '10,5', '9,15'], 1),
  mcq(qid(lesson, 2), 1, '12 - 4,75 bằng bao nhiêu?', ['7,25', '8,25', '7,75', '16,75'], 0),
  mcq(qid(lesson, 3), 1, '2,4 × 3,5 bằng bao nhiêu?', ['7,4', '8,4', '84', '5,9'], 1),
  mcq(qid(lesson, 4), 1, '9,45 : 1,5 bằng bao nhiêu?', ['6,3', '5,3', '7,3', '0,63'], 0),
  shortAnswer(qid(lesson, 5), 2, `Tính ${decimal(135 + seed, 2)} + 4,65 - 2,5.`, decimal(350 + seed, 2)),
  shortAnswer(qid(lesson, 6), 2, 'Tính (8,4 + 3,6) : 2,5.', '4,8'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về biểu thức số thập phân.', [
    ['2,5 × 4 + 1 = 11.', true],
    ['10 - 3,2 × 2 = 13,6.', false],
    ['(4,5 + 5,5) : 2 = 5.', true],
  ]),
  ordering(qid(lesson, 8), 2, 'Sắp xếp kết quả các phép tính từ bé đến lớn.', ['2,5 + 1,5', '8 : 2', '1,5 × 2', '7 - 2'], [2, 0, 1, 3]),
  mcq(qid(lesson, 9), 3, 'Mua 2,5 kg táo giá 36 nghìn đồng/kg và 1,2 kg cam giá 40 nghìn đồng/kg. Hết bao nhiêu nghìn đồng?', ['128', '138', '148', '90'], 1),
  shortAnswer(qid(lesson, 10), 3, 'Một bể có 24,5 lít nước. Thêm 3 can, mỗi can 5,25 lít rồi dùng 8,75 lít. Còn bao nhiêu lít?', '31,5 lít'),
];

const triangleLesson = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const baseLength = 10 + seed;
  const height = 6 + (seed % 4);
  const areaValue = baseLength * height / 2;
  return [
    mcq(qid(lesson, 1), 1, 'Một hình tam giác có mấy cạnh?', ['2 cạnh', '3 cạnh', '4 cạnh', '5 cạnh'], 1),
    mcq(qid(lesson, 2), 1, 'Công thức tính diện tích hình tam giác là gì?', ['đáy × chiều cao', 'đáy × chiều cao : 2', '(đáy + chiều cao) × 2', 'đáy + chiều cao'], 1),
    mcq(qid(lesson, 3), 1, `Tam giác có đáy ${baseLength} cm, chiều cao ${height} cm. Diện tích là bao nhiêu?`, [`${areaValue} cm²`, `${baseLength * height} cm²`, `${baseLength + height} cm²`, `${2 * (baseLength + height)} cm²`], 0),
    mcq(qid(lesson, 4), 1, 'Chiều cao của tam giác phải như thế nào với đáy tương ứng?', ['Song song', 'Vuông góc', 'Bằng nhau', 'Không liên quan'], 1),
    shortAnswer(qid(lesson, 5), 2, 'Tam giác có đáy 15 m và chiều cao 8 m. Tính diện tích.', '60 m²'),
    shortAnswer(qid(lesson, 6), 2, 'Tam giác có diện tích 42 cm² và đáy 12 cm. Tính chiều cao.', '7 cm'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về hình tam giác.', [
      ['Diện tích tam giác bằng nửa tích đáy và chiều cao.', true],
      ['Mọi tam giác đều có ba góc vuông.', false],
      ['Hai tam giác có cùng đáy và cùng chiều cao thì có diện tích bằng nhau.', true],
    ]),
    matching(qid(lesson, 8), 2, 'Nối đáy và chiều cao với diện tích tam giác.', [['Đáy 10 cm, cao 4 cm', '20 cm²'], ['Đáy 12 cm, cao 5 cm', '30 cm²'], ['Đáy 8 cm, cao 7 cm', '28 cm²']]),
    mcq(qid(lesson, 9), 3, 'Một lá cờ tam giác có đáy 1,2 m, chiều cao 0,8 m. Cần bao nhiêu mét vuông vải cho 5 lá cờ?', ['0,48 m²', '2,4 m²', '4,8 m²', '1,2 m²'], 1),
    shortAnswer(qid(lesson, 10), 3, 'Một mảnh đất tam giác có đáy 24 m, chiều cao bằng 3/4 đáy. Tính diện tích.', '216 m²'),
  ];
};

const trapezoidLesson = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const a = 12 + seed;
  const b = 8 + seed;
  const h = 6;
  const areaValue = (a + b) * h / 2;
  return [
    mcq(qid(lesson, 1), 1, 'Hình thang có bao nhiêu cặp cạnh đối diện song song ít nhất?', ['Không có', 'Một cặp', 'Hai cặp bắt buộc', 'Ba cặp'], 1),
    mcq(qid(lesson, 2), 1, 'Công thức tính diện tích hình thang là gì?', ['(đáy lớn + đáy bé) × chiều cao : 2', 'đáy lớn × đáy bé', '(đáy lớn - đáy bé) × chiều cao', 'chu vi × chiều cao'], 0),
    mcq(qid(lesson, 3), 1, `Hình thang có hai đáy ${a} cm và ${b} cm, chiều cao ${h} cm. Diện tích là bao nhiêu?`, [`${areaValue} cm²`, `${(a + b) * h} cm²`, `${a * b} cm²`, `${a + b + h} cm²`], 0),
    mcq(qid(lesson, 4), 1, 'Đường cao hình thang vuông góc với thành phần nào?', ['Chỉ đáy lớn', 'Cả hai đáy', 'Cạnh bên bất kì', 'Đường chéo'], 1),
    shortAnswer(qid(lesson, 5), 2, 'Hình thang có hai đáy 15 m và 9 m, chiều cao 7 m. Tính diện tích.', '84 m²'),
    shortAnswer(qid(lesson, 6), 2, 'Hình thang có diện tích 90 cm², tổng hai đáy 30 cm. Tính chiều cao.', '6 cm'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về hình thang.', [
      ['Hai đáy hình thang song song với nhau.', true],
      ['Diện tích hình thang bằng tổng hai đáy nhân chiều cao.', false],
      ['Hình bình hành cũng có thể xem là một hình thang có hai cặp cạnh đối song song.', true],
    ]),
    matching(qid(lesson, 8), 2, 'Nối kích thước với diện tích hình thang.', [['Hai đáy 8 cm, 4 cm; cao 5 cm', '30 cm²'], ['Hai đáy 10 cm, 6 cm; cao 4 cm', '32 cm²'], ['Hai đáy 12 cm, 8 cm; cao 3 cm', '30 cm²']]),
    mcq(qid(lesson, 9), 3, 'Một thửa ruộng hình thang có hai đáy 32 m và 18 m, chiều cao 20 m. Mỗi mét vuông thu 0,6 kg thóc. Thu được bao nhiêu ki-lô-gam?', ['300 kg', '500 kg', '600 kg', '1 000 kg'], 0),
    shortAnswer(qid(lesson, 10), 3, 'Một tấm kính hình thang có hai đáy 1,8 m và 1,2 m, chiều cao 0,9 m. Giá kính là 250 000 đồng/m². Tính tiền tấm kính.', '337500 đồng'),
  ];
};

const circleLesson = (lesson: Math5CurriculumLesson, seed = 0): Question[] => {
  const radius = 5 + seed;
  const diameter = radius * 2;
  const circumference = decimal(Math.round(diameter * 314), 2);
  const areaValue = decimal(Math.round(radius * radius * 314), 2);
  return [
    mcq(qid(lesson, 1), 1, `Đường tròn bán kính ${radius} cm có đường kính bao nhiêu?`, [`${radius / 2} cm`, `${diameter} cm`, `${radius * 4} cm`, `${radius + 2} cm`], 1),
    mcq(qid(lesson, 2), 1, 'Công thức tính chu vi hình tròn là gì?', ['bán kính × 3,14', 'đường kính × 3,14', 'bán kính × bán kính', 'đường kính × đường kính'], 1),
    mcq(qid(lesson, 3), 1, `Hình tròn có đường kính ${diameter} cm. Chu vi (lấy π = 3,14) là bao nhiêu?`, [`${circumference} cm`, `${areaValue} cm`, `${diameter * 2} cm`, `${radius * 314} cm`], 0),
    mcq(qid(lesson, 4), 1, `Hình tròn bán kính ${radius} cm. Diện tích là bao nhiêu?`, [`${areaValue} cm²`, `${circumference} cm²`, `${diameter * diameter} cm²`, `${radius * 314} cm²`], 0),
    shortAnswer(qid(lesson, 5), 2, 'Một hình tròn có đường kính 14 cm. Tính chu vi, lấy π = 3,14.', '43,96 cm'),
    shortAnswer(qid(lesson, 6), 2, 'Một hình tròn có bán kính 6 m. Tính diện tích, lấy π = 3,14.', '113,04 m²'),
    trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về đường tròn.', [
      ['Đường kính gấp hai lần bán kính.', true],
      ['Chu vi hình tròn bằng bán kính nhân bán kính nhân 3,14.', false],
      ['Các bán kính của cùng một đường tròn có độ dài bằng nhau.', true],
    ]),
    matching(qid(lesson, 8), 2, 'Nối đại lượng với công thức phù hợp.', [['Đường kính', '2 × bán kính'], ['Chu vi hình tròn', 'đường kính × 3,14'], ['Diện tích hình tròn', 'bán kính × bán kính × 3,14']]),
    mcq(qid(lesson, 9), 3, 'Một bánh xe có bán kính 0,35 m. Bánh xe lăn 100 vòng đi được quãng đường bao nhiêu mét? Lấy π = 3,14.', ['109,9 m', '219,8 m', '384,65 m', '70 m'], 1),
    shortAnswer(qid(lesson, 10), 3, 'Một sân tròn bán kính 10 m, ở giữa có bồn hoa tròn bán kính 4 m. Diện tích phần sân còn lại là bao nhiêu? Lấy π = 3,14.', '263,76 m²'),
  ];
};

const practicalGeometry = (lesson: Math5CurriculumLesson, seed = 0): Question[] => [
  mcq(qid(lesson, 1), 1, 'Dụng cụ phù hợp nhất để vẽ đường tròn là gì?', ['Ê-ke', 'Com-pa', 'Thước đo góc', 'Cân'], 1),
  mcq(qid(lesson, 2), 1, 'Dụng cụ dùng để kiểm tra góc vuông là gì?', ['Com-pa', 'Ê-ke', 'Ca đong', 'Đồng hồ'], 1),
  mcq(qid(lesson, 3), 1, 'Hai tam giác vuông giống nhau có thể ghép thành hình nào?', ['Hình chữ nhật', 'Hình tròn', 'Đường thẳng', 'Hình cầu'], 0),
  mcq(qid(lesson, 4), 1, 'Khi đo độ dài đoạn thẳng, vạch 0 của thước cần đặt ở đâu?', ['Ở trung điểm', 'Trùng một đầu đoạn thẳng', 'Ngoài đoạn thẳng', 'Tùy ý'], 1),
  shortAnswer(qid(lesson, 5), 2, `Một hình vuông cạnh ${5 + seed} cm được cắt theo đường chéo thành hai tam giác bằng nhau. Diện tích mỗi tam giác là bao nhiêu?`, `${(5 + seed) ** 2 / 2} cm²`),
  shortAnswer(qid(lesson, 6), 2, 'Ghép hai hình chữ nhật 3 cm × 5 cm thành một hình chữ nhật lớn 6 cm × 5 cm. Diện tích hình lớn là bao nhiêu?', '30 cm²'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về thao tác đo, vẽ và lắp ghép.', [
    ['Cần giữ thước cố định khi kẻ đoạn thẳng.', true],
    ['Có thể dùng com-pa để đo khối lượng.', false],
    ['Các mảnh ghép không chồng lên nhau khi tính tổng diện tích.', true],
  ]),
  ordering(qid(lesson, 8), 2, 'Sắp xếp các bước vẽ đường tròn theo thứ tự hợp lí.', ['Quay com-pa một vòng', 'Đặt mũi nhọn vào tâm', 'Mở com-pa bằng bán kính cần vẽ', 'Đánh dấu tâm'], [3, 2, 1, 0]),
  mcq(qid(lesson, 9), 3, 'Một tấm bìa hình chữ nhật 20 cm × 12 cm được cắt thành 4 tam giác bằng nhau. Diện tích mỗi tam giác là bao nhiêu?', ['30 cm²', '60 cm²', '120 cm²', '240 cm²'], 1),
  shortAnswer(qid(lesson, 10), 3, 'Một hình vuông cạnh 10 cm được khoét một hình tròn bán kính 3 cm. Diện tích phần còn lại là bao nhiêu? Lấy π = 3,14.', '71,74 cm²'),
];

const geometryReview = (lesson: Math5CurriculumLesson, seed = 0): Question[] => [
  mcq(qid(lesson, 1), 1, 'Tam giác đáy 8 cm, cao 5 cm có diện tích bao nhiêu?', ['20 cm²', '40 cm²', '13 cm²', '26 cm²'], 0),
  mcq(qid(lesson, 2), 1, 'Hình thang hai đáy 10 cm và 6 cm, cao 4 cm có diện tích bao nhiêu?', ['16 cm²', '32 cm²', '64 cm²', '40 cm²'], 1),
  mcq(qid(lesson, 3), 1, 'Hình tròn bán kính 4 cm có chu vi bao nhiêu? Lấy π = 3,14.', ['12,56 cm', '25,12 cm', '50,24 cm', '16 cm'], 1),
  mcq(qid(lesson, 4), 1, 'Hình tròn đường kính 10 cm có diện tích bao nhiêu? Lấy π = 3,14.', ['31,4 cm²', '78,5 cm²', '314 cm²', '157 cm²'], 1),
  shortAnswer(qid(lesson, 5), 2, `Tam giác có đáy ${12 + seed} cm, cao 8 cm. Tính diện tích.`, `${(12 + seed) * 4} cm²`),
  shortAnswer(qid(lesson, 6), 2, 'Hình thang có hai đáy 14 m và 8 m, chiều cao 5 m. Tính diện tích.', '55 m²'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về công thức hình học.', [
    ['Diện tích tam giác bằng đáy nhân chiều cao rồi chia 2.', true],
    ['Diện tích hình tròn bằng đường kính nhân 3,14.', false],
    ['Diện tích hình thang dùng tổng hai đáy.', true],
  ]),
  matching(qid(lesson, 8), 2, 'Nối hình với công thức diện tích.', [['Tam giác', 'đáy × cao : 2'], ['Hình thang', '(đáy lớn + đáy bé) × cao : 2'], ['Hình tròn', 'bán kính × bán kính × 3,14']]),
  mcq(qid(lesson, 9), 3, 'Một khu đất gồm hình chữ nhật 20 m × 12 m và một tam giác đáy 12 m, cao 6 m. Tổng diện tích là bao nhiêu?', ['246 m²', '276 m²', '312 m²', '216 m²'], 1),
  shortAnswer(qid(lesson, 10), 3, 'Một hình tròn bán kính 5 m nằm trong hình vuông cạnh 10 m. Diện tích phần hình vuông ngoài hình tròn là bao nhiêu? Lấy π = 3,14.', '21,5 m²'),
];

const shapesReview = (lesson: Math5CurriculumLesson, seed = 0): Question[] => [
  mcq(qid(lesson, 1), 1, 'Hình nào có đúng ba cạnh?', ['Hình tròn', 'Hình tam giác', 'Hình thang', 'Hình chữ nhật'], 1),
  mcq(qid(lesson, 2), 1, 'Hình nào có một cặp cạnh đối diện song song?', ['Tam giác', 'Hình thang', 'Đường tròn', 'Góc vuông'], 1),
  mcq(qid(lesson, 3), 1, 'Đường kính của đường tròn đi qua điểm nào?', ['Một điểm bất kì ngoài đường tròn', 'Tâm đường tròn', 'Chỉ một đầu bán kính', 'Không qua tâm'], 1),
  mcq(qid(lesson, 4), 1, 'Hình chữ nhật có bao nhiêu góc vuông?', ['1', '2', '3', '4'], 3),
  shortAnswer(qid(lesson, 5), 2, `Một hình vuông cạnh ${7 + seed} cm có chu vi bao nhiêu?`, `${(7 + seed) * 4} cm`),
  shortAnswer(qid(lesson, 6), 2, 'Một đường tròn có đường kính 18 cm. Bán kính là bao nhiêu?', '9 cm'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về các hình phẳng.', [
    ['Hình vuông là một hình chữ nhật đặc biệt.', true],
    ['Mọi hình thang đều có bốn cạnh bằng nhau.', false],
    ['Tam giác có ba đỉnh.', true],
  ]),
  categorization(qid(lesson, 8), 2, 'Phân loại mô tả theo hình phù hợp.', [['triangle', 'Tam giác'], ['trapezoid', 'Hình thang'], ['circle', 'Hình tròn']], [['i1', 'Có ba cạnh', 'triangle'], ['i2', 'Có hai đáy song song', 'trapezoid'], ['i3', 'Mọi điểm trên đường tròn cách tâm bằng nhau', 'circle']]),
  mcq(qid(lesson, 9), 3, 'Một hình chữ nhật có chu vi 46 cm, chiều dài 15 cm. Chiều rộng là bao nhiêu?', ['8 cm', '16 cm', '23 cm', '31 cm'], 0),
  shortAnswer(qid(lesson, 10), 3, 'Một hình vuông và một hình chữ nhật có cùng chu vi 40 cm. Hình chữ nhật dài 12 cm. Chiều rộng hình chữ nhật là bao nhiêu?', '8 cm'),
];

const perimeterAreaReview = (lesson: Math5CurriculumLesson, seed = 0): Question[] => [
  mcq(qid(lesson, 1), 1, 'Hình chữ nhật dài 9 cm, rộng 6 cm có chu vi bao nhiêu?', ['30 cm', '54 cm', '15 cm', '108 cm'], 0),
  mcq(qid(lesson, 2), 1, 'Hình vuông cạnh 7 cm có diện tích bao nhiêu?', ['28 cm²', '49 cm²', '14 cm²', '21 cm²'], 1),
  mcq(qid(lesson, 3), 1, 'Tam giác đáy 12 cm, cao 7 cm có diện tích bao nhiêu?', ['42 cm²', '84 cm²', '38 cm²', '19 cm²'], 0),
  mcq(qid(lesson, 4), 1, 'Hình tròn bán kính 3 cm có diện tích bao nhiêu? Lấy π = 3,14.', ['18,84 cm²', '28,26 cm²', '9,42 cm²', '56,52 cm²'], 1),
  shortAnswer(qid(lesson, 5), 2, `Hình chữ nhật dài ${14 + seed} m, rộng 8 m. Tính diện tích.`, `${(14 + seed) * 8} m²`),
  shortAnswer(qid(lesson, 6), 2, 'Hình thang có hai đáy 18 cm và 10 cm, cao 6 cm. Tính diện tích.', '84 cm²'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về chu vi và diện tích.', [
    ['Chu vi đo độ dài đường bao quanh hình.', true],
    ['Diện tích hình chữ nhật bằng tổng chiều dài và chiều rộng.', false],
    ['Diện tích dùng đơn vị vuông.', true],
  ]),
  matching(qid(lesson, 8), 2, 'Nối hình với kết quả đúng.', [['Vuông cạnh 5 cm', 'Diện tích 25 cm²'], ['Chữ nhật 8 cm × 3 cm', 'Chu vi 22 cm'], ['Tròn bán kính 2 cm', 'Chu vi 12,56 cm']]),
  mcq(qid(lesson, 9), 3, 'Một sân hình chữ nhật dài 25 m, rộng 16 m. Làm lối đi chiếm 1/5 diện tích. Phần còn lại là bao nhiêu?', ['80 m²', '320 m²', '400 m²', '240 m²'], 1),
  shortAnswer(qid(lesson, 10), 3, 'Một thửa ruộng hình thang có hai đáy 30 m và 18 m, cao 15 m. Mỗi 100 m² thu 65 kg thóc. Thu được bao nhiêu ki-lô-gam?', '234 kg'),
];

const comprehensiveReview = (lesson: Math5CurriculumLesson, seed = 0): Question[] => [
  mcq(qid(lesson, 1), 1, 'Số lớn nhất trong 5,07; 5,7; 5,17; 5,701 là số nào?', ['5,07', '5,7', '5,17', '5,701'], 3),
  mcq(qid(lesson, 2), 1, '3/4 + 1/6 bằng bao nhiêu?', ['4/10', '11/12', '5/6', '7/12'], 1),
  mcq(qid(lesson, 3), 1, '12,5 × 0,8 bằng bao nhiêu?', ['1', '10', '100', '13,3'], 1),
  mcq(qid(lesson, 4), 1, 'Tam giác đáy 18 cm, cao 6 cm có diện tích bao nhiêu?', ['54 cm²', '108 cm²', '48 cm²', '24 cm²'], 0),
  shortAnswer(qid(lesson, 5), 2, `Tính ${100 + seed},5 - 28,75.`, `${71 + seed},75`),
  shortAnswer(qid(lesson, 6), 2, 'Đổi 2,35 ha ra mét vuông.', '23500 m²'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai về kiến thức học kì I.', [
    ['0,5 = 1/2.', true],
    ['1 km² = 10 ha.', false],
    ['Diện tích hình tròn bán kính r là r × r × 3,14.', true],
  ]),
  multipleSelect(qid(lesson, 8), 2, 'Chọn tất cả phép tính có kết quả bằng 6.', ['2,5 + 3,5', '12 : 2', '1,5 × 4', '8 - 1,5'], [0, 1, 2]),
  mcq(qid(lesson, 9), 3, 'Một cửa hàng có 48,5 kg gạo, nhập thêm 3 bao mỗi bao 12,75 kg rồi bán 26,25 kg. Còn bao nhiêu ki-lô-gam?', ['60,5 kg', '34,25 kg', '86,5 kg', '22,25 kg'], 0),
  shortAnswer(qid(lesson, 10), 3, 'Một khu đất gồm hình chữ nhật 20 m × 15 m và nửa hình tròn bán kính 5 m. Tính tổng diện tích, lấy π = 3,14.', '339,25 m²'),
];

const mixedPractice = (lesson: Math5CurriculumLesson, seed = 0): Question[] => [
  mcq(qid(lesson, 1), 1, 'Trong bài luyện tập chung, 2/3 + 1/6 bằng bao nhiêu?', ['3/9', '5/6', '1/2', '2/9'], 1),
  mcq(qid(lesson, 2), 1, 'Hỗn số 3 1/4 được viết thành phân số nào?', ['10/4', '12/4', '13/4', '7/4'], 2),
  mcq(qid(lesson, 3), 1, `Hình chữ nhật dài ${12 + seed} cm, rộng 5 cm có diện tích bao nhiêu?`, [`${(12 + seed) * 5} cm²`, `${2 * (17 + seed)} cm²`, `${17 + seed} cm²`, `${(12 + seed) * 10} cm²`], 0),
  mcq(qid(lesson, 4), 1, '2 m 8 cm được viết hoàn toàn theo xăng-ti-mét là bao nhiêu?', ['28 cm', '208 cm', '2 008 cm', '2,08 cm'], 1),
  shortAnswer(qid(lesson, 5), 2, 'Tính 7/10 - 1/4.', '9/20'),
  shortAnswer(qid(lesson, 6), 2, 'Đổi 2 giờ 35 phút ra phút.', '155 phút'),
  trueFalse(qid(lesson, 7), 2, 'Xác định đúng hoặc sai trong bài luyện tập tổng hợp.', [
    ['Hỗn số 2 1/5 bằng phân số 11/5.', true],
    ['1 m² bằng 1 000 cm².', false],
    ['Chu vi hình vuông cạnh 6 cm là 24 cm.', true],
  ]),
  matching(qid(lesson, 8), 2, 'Nối nội dung ôn tập với kết quả phù hợp.', [['3/5 + 1/5', '4/5'], ['Hình vuông cạnh 4 cm', 'Diện tích 16 cm²'], ['1 kg 250 g', '1 250 g']]),
  mcq(qid(lesson, 9), 3, 'Một mảnh vườn hình chữ nhật dài 18 m, rộng 12 m. Dùng 2/3 diện tích để trồng rau. Diện tích trồng rau là bao nhiêu?', ['72 m²', '108 m²', '144 m²', '216 m²'], 2),
  shortAnswer(qid(lesson, 10), 3, 'Một bình có 3 1/2 lít nước, rót ra 3/4 lít rồi thêm 1 1/4 lít. Bình có bao nhiêu lít nước?', '4 lít'),
];

const generateQuestionsForLesson = (lesson: Math5CurriculumLesson): Question[] => {
  const seed = lesson.number - 1;
  switch (lesson.number) {
    case 1: return naturalNumberReview(lesson, seed);
    case 2: return naturalOperations(lesson, seed);
    case 3: return fractionReview(lesson, seed);
    case 4: return decimalFractionLesson(lesson, seed);
    case 5: return fractionOperations(lesson, seed, false);
    case 6: return fractionOperations(lesson, seed, true);
    case 7: return mixedNumbers(lesson, seed);
    case 8: return geometryMeasurementReview(lesson, seed);
    case 9: return mixedPractice(lesson, seed);
    case 10: return decimalConcept(lesson, seed);
    case 11: return decimalComparison(lesson, seed);
    case 12: return decimalMeasurement(lesson, seed);
    case 13: return decimalRounding(lesson, seed);
    case 14: return decimalReview(lesson, seed);
    case 15: return largeAreaUnits(lesson, seed);
    case 16: return areaUnits(lesson, seed);
    case 17: return practicalMeasurement(lesson, seed);
    case 18: return measurementReview(lesson, seed);
    case 19: return decimalAddition(lesson, seed);
    case 20: return decimalSubtraction(lesson, seed);
    case 21: return decimalMultiplication(lesson, seed);
    case 22: return decimalDivision(lesson, seed);
    case 23: return decimalScaling(lesson, seed);
    case 24: return decimalOperationsReview(lesson, seed);
    case 25: return triangleLesson(lesson, seed);
    case 26: return trapezoidLesson(lesson, seed);
    case 27: return circleLesson(lesson, seed);
    case 28: return practicalGeometry(lesson, seed);
    case 29: return geometryReview(lesson, seed);
    case 30: return decimalReview(lesson, seed + 30);
    case 31: return decimalOperationsReview(lesson, seed + 30);
    case 32: return shapesReview(lesson, seed);
    case 33: return perimeterAreaReview(lesson, seed);
    case 34: return measurementReview(lesson, seed + 30);
    case 35: return comprehensiveReview(lesson, seed);
    default: throw new Error(`Unsupported lesson: ${lesson.number}`);
  }
};

const assertLessonShape = (lesson: Math5CurriculumLesson, questions: Question[]) => {
  if (questions.length !== 10) throw new Error(`${lesson.code} must have exactly 10 questions.`);
  const expectedTypes = [
    QuestionType.MCQ,
    QuestionType.MCQ,
    QuestionType.MCQ,
    QuestionType.MCQ,
    QuestionType.SHORT_ANSWER,
    QuestionType.SHORT_ANSWER,
    QuestionType.TRUE_FALSE,
  ];
  expectedTypes.forEach((type, index) => {
    if (questions[index].type !== type) throw new Error(`${lesson.code} slot ${index + 1} must be ${type}.`);
  });
  const interactionTypes = new Set<string>([
    QuestionType.MATCHING,
    QuestionType.MULTIPLE_SELECT,
    QuestionType.ORDERING,
    QuestionType.CATEGORIZATION,
  ]);
  if (!interactionTypes.has(questions[7].type)) {
    throw new Error(`${lesson.code} slot 8 must be an interaction question.`);
  }
  if (questions[8].type !== QuestionType.MCQ || questions[9].type !== QuestionType.SHORT_ANSWER) {
    throw new Error(`${lesson.code} applied slots must be MCQ then SHORT_ANSWER.`);
  }
};

const makeInput = (
  topic: Math5CurriculumTopic,
  lesson: Math5CurriculumLesson,
  question: Question,
  slotIndex: number,
): CuratedQuestionBankInput => ({
  id: `qb-${lesson.code.toLowerCase()}-q${String(slotIndex + 1).padStart(2, '0')}`,
  scope: 'SYSTEM',
  status: 'DRAFT',
  questionData: {
    ...question,
    id: `m5-s1-l${String(lesson.number).padStart(2, '0')}-q${String(slotIndex + 1).padStart(2, '0')}`,
    difficulty: DIFFICULTIES[slotIndex],
    subject: 'MATH',
  } as Question,
  metadata: {
    grade: 5,
    subject: 'MATH',
    semester: 1,
    topicCode: topic.code,
    lessonCode: lesson.code,
    source: 'CURATED_ORIGINAL',
    tags: [
      'Toán',
      'Lớp 5',
      'Học kì 1',
      topic.title,
      `Bài ${lesson.number}`,
      lesson.title,
      `Vai trò: ${ROLES[slotIndex]}`,
      ...lesson.keywords.slice(0, 2),
    ],
  },
});

export const readMath5Curriculum = (): Math5Curriculum => JSON.parse(
  fs.readFileSync(curriculumPath, 'utf8'),
) as Math5Curriculum;

export const generateMath5Semester1Dataset = (): GeneratedMath5Dataset => {
  const curriculum = readMath5Curriculum();
  const topics = curriculum.topics.map((topic) => {
    const items = topic.lessons.flatMap((lesson) => {
      const questions = generateQuestionsForLesson(lesson);
      assertLessonShape(lesson, questions);
      return questions.map((question, index) => makeInput(topic, lesson, question, index));
    });
    return { code: topic.code, title: topic.title, items };
  });
  return { curriculum, topics, items: topics.flatMap((topic) => topic.items) };
};

export const writeMath5Semester1Dataset = (): GeneratedMath5Dataset => {
  const dataset = generateMath5Semester1Dataset();
  fs.mkdirSync(dataDir, { recursive: true });
  dataset.topics.forEach((topic, index) => {
    fs.writeFileSync(
      path.join(dataDir, `topic-${String(index + 1).padStart(2, '0')}.json`),
      `${JSON.stringify(topic.items, null, 2)}\n`,
      'utf8',
    );
  });
  return dataset;
};

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const dataset = writeMath5Semester1Dataset();
  console.log(`Generated ${dataset.items.length} questions across ${dataset.topics.length} topics.`);
}
