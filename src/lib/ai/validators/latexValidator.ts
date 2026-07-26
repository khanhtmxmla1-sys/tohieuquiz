import { GeneratedQuestionSchema, GeneratedQuestion } from './QuestionSchema';
import { normalizeMathText } from '../../../utils/mathText';
import { normalizeQuestionMath, validateQuestionMath } from '../../../utils/questionMath';

/** Validate all supported delimiters, braces and common TeX command arguments. */
export function validateLatexSyntax(text: string): void {
  const normalized = normalizeMathText(text);
  const issues = validateQuestionMath({ text: normalized });
  if (issues.length > 0) {
    const issue = issues[0];
    throw new Error(`Invalid LaTeX syntax: ${issue.message}`);
  }
}

/** Validate every string field in a question, including options, statements and pairs. */
export function validateQuestionLatex(question: unknown): void {
  const issues = validateQuestionMath(question);
  if (issues.length > 0) {
    const issue = issues[0];
    throw new Error(`Invalid LaTeX syntax in ${issue.field || 'question'}: ${issue.message}`);
  }
}

/** Ensure interactive [N]/[word] placeholders map to supplied blanks. */
export function validateBlankMapping(text: string, blanks: any[]): void {
  const textBlankIds = new Set<string>();
  const regex = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const prefix = text.slice(Math.max(0, match.index - 16), match.index);
    if (/\\sqrt\s*$/.test(prefix)) continue; // \sqrt[3]{8} is not an answer blank.
    if (match.index > 0 && text[match.index - 1] === '\\') continue; // \[ display delimiter.
    textBlankIds.add(match[1].trim());
  }

  const providedBlankIds = new Set(
    blanks.map((blank) => String(typeof blank === 'string' ? blank : blank?.id ?? '')),
  );

  for (const id of textBlankIds) {
    const numericId = Number.parseInt(id, 10);
    if (Number.isFinite(numericId) && numericId > 0 && numericId <= blanks.length) continue;
    if (!providedBlankIds.has(id)) {
      throw new Error(`Text contains blank [${id}] but no corresponding blank was provided in blanks array.`);
    }
  }
}

/** Full AI question validation and normalization. */
export function validateAIQuestion(questionData: any): GeneratedQuestion {
  const parsed = GeneratedQuestionSchema.parse(questionData);
  const normalizedQuestion = normalizeQuestionMath(parsed.question);
  const { text, blanks } = normalizedQuestion;

  validateBlankMapping(text, blanks);
  validateQuestionLatex(normalizedQuestion);

  return { ...parsed, question: normalizedQuestion } as GeneratedQuestion;
}