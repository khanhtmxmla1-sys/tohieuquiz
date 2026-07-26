import {
    Math as OfficeMath,
    MathFraction,
    MathRadical,
    MathRun,
    MathSubScript,
    MathSubSuperScript,
    MathSuperScript,
    TextRun,
    type MathComponent,
    type ParagraphChild,
} from 'docx';
import { normalizeMathText, splitMathSegments } from '../../../utils/mathText';
import { normalizeWorksheetMath } from '../shared/mathNormalizer';

interface DocxTextStyle {
    size?: number;
    bold?: boolean;
    color?: string;
}

interface BalancedGroup {
    content: string;
    end: number;
}

interface ParsedBase {
    children: MathComponent[];
    end: number;
}

const SYMBOLS: Record<string, string> = {
    times: '×',
    div: '÷',
    cdot: '·',
    pm: '±',
    le: '≤',
    leq: '≤',
    ge: '≥',
    geq: '≥',
    neq: '≠',
    pi: 'π',
    angle: '∠',
    dots: '…',
    ldots: '…',
    alpha: 'α',
    beta: 'β',
    gamma: 'γ',
    delta: 'δ',
    theta: 'θ',
    lambda: 'λ',
    mu: 'μ',
    sigma: 'σ',
    phi: 'φ',
    omega: 'ω',
    infty: '∞',
};

const WRAPPER_COMMANDS = new Set([
    'text', 'textbf', 'mathrm', 'mathbf', 'operatorname', 'overline', 'underline',
]);

const isEscaped = (value: string, index: number): boolean => {
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor--) slashes++;
    return slashes % 2 === 1;
};

const skipWhitespace = (value: string, start: number): number => {
    let cursor = start;
    while (cursor < value.length && /\s/.test(value[cursor])) cursor++;
    return cursor;
};

const readBalancedGroup = (
    value: string,
    start: number,
    open = '{',
    close = '}',
): BalancedGroup | null => {
    if (value[start] !== open) return null;
    let depth = 0;
    for (let cursor = start; cursor < value.length; cursor++) {
        if (isEscaped(value, cursor)) continue;
        if (value[cursor] === open) depth++;
        if (value[cursor] === close) {
            depth--;
            if (depth === 0) {
                return { content: value.slice(start + 1, cursor), end: cursor + 1 };
            }
        }
    }
    return null;
};

const mathRun = (value: string): MathRun => new MathRun(value || ' ');

const readCommand = (value: string, start: number): ParsedBase | null => {
    if (value[start] !== '\\') return null;

    if (value[start + 1] === '\\') {
        return { children: [mathRun(' ')], end: start + 2 };
    }

    if (value[start + 1] && !/[A-Za-z]/.test(value[start + 1])) {
        return { children: [mathRun(value[start + 1])], end: start + 2 };
    }

    const match = value.slice(start).match(/^\\([A-Za-z]+)/);
    if (!match) return null;
    const name = match[1];
    const commandEnd = start + match[0].length;
    let cursor = skipWhitespace(value, commandEnd);

    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const numerator = readBalancedGroup(value, cursor);
        if (!numerator) return { children: [mathRun(name)], end: cursor };
        cursor = skipWhitespace(value, numerator.end);
        const denominator = readBalancedGroup(value, cursor);
        if (!denominator) {
            return { children: [mathRun(normalizeWorksheetMath(value.slice(start, cursor)))], end: cursor };
        }
        return {
            children: [new MathFraction({
                numerator: parseMathExpression(numerator.content),
                denominator: parseMathExpression(denominator.content),
            })],
            end: denominator.end,
        };
    }

    if (name === 'sqrt') {
        let degree: MathComponent[] | undefined;
        if (value[cursor] === '[') {
            const degreeGroup = readBalancedGroup(value, cursor, '[', ']');
            if (degreeGroup) {
                degree = parseMathExpression(degreeGroup.content);
                cursor = skipWhitespace(value, degreeGroup.end);
            }
        }
        const radicand = readBalancedGroup(value, cursor);
        if (!radicand) return { children: [mathRun('√')], end: cursor };
        return {
            children: [new MathRadical({
                children: parseMathExpression(radicand.content),
                degree,
            })],
            end: radicand.end,
        };
    }

    if (WRAPPER_COMMANDS.has(name)) {
        const group = readBalancedGroup(value, cursor);
        if (!group) return { children: [mathRun(name)], end: cursor };
        return { children: parseMathExpression(group.content), end: group.end };
    }

    if (name === 'left' || name === 'right') return { children: [], end: commandEnd };
    if (name === 'begin' || name === 'end') {
        const environment = readBalancedGroup(value, cursor);
        return { children: [], end: environment?.end ?? cursor };
    }

    return { children: [mathRun(SYMBOLS[name] ?? name)], end: commandEnd };
};

const readBase = (value: string, start: number): ParsedBase => {
    const character = value[start];

    if (character === '\\') {
        const command = readCommand(value, start);
        if (command) return command;
    }

    if (character === '{') {
        const group = readBalancedGroup(value, start);
        if (group) return { children: parseMathExpression(group.content), end: group.end };
    }

    if (character === '&') return { children: [mathRun(' ')], end: start + 1 };
    return { children: [mathRun(character || ' ')], end: Math.min(value.length, start + 1) };
};

const readScript = (value: string, start: number): { children: MathComponent[]; end: number } => {
    const cursor = skipWhitespace(value, start);
    const group = readBalancedGroup(value, cursor);
    if (group) return { children: parseMathExpression(group.content), end: group.end };
    const base = readBase(value, cursor);
    return { children: base.children, end: base.end };
};

export const parseMathExpression = (value: string): MathComponent[] => {
    const output: MathComponent[] = [];
    let cursor = 0;

    while (cursor < value.length) {
        if (value[cursor] === '^' || value[cursor] === '_') {
            output.push(mathRun(value[cursor]));
            cursor++;
            continue;
        }

        const base = readBase(value, cursor);
        cursor = base.end;
        if (base.children.length === 0) continue;

        let subScript: MathComponent[] | undefined;
        let superScript: MathComponent[] | undefined;
        let scriptCursor = skipWhitespace(value, cursor);

        while (scriptCursor < value.length && (value[scriptCursor] === '^' || value[scriptCursor] === '_')) {
            const marker = value[scriptCursor];
            const script = readScript(value, scriptCursor + 1);
            if (marker === '^') superScript = script.children;
            else subScript = script.children;
            cursor = script.end;
            scriptCursor = skipWhitespace(value, cursor);
        }

        if (subScript && superScript) {
            output.push(new MathSubSuperScript({
                children: base.children,
                subScript,
                superScript,
            }));
        } else if (subScript) {
            output.push(new MathSubScript({ children: base.children, subScript }));
        } else if (superScript) {
            output.push(new MathSuperScript({ children: base.children, superScript }));
        } else {
            output.push(...base.children);
        }
    }

    return output.length > 0 ? output : [mathRun(normalizeWorksheetMath(value))];
};

/** Build mixed prose + native Office Math children for a DOCX paragraph. */
export const createDocxMathChildren = (
    content: unknown,
    style: DocxTextStyle = {},
): ParagraphChild[] => {
    const source = normalizeMathText(content);
    if (!source) return [new TextRun({ text: '', ...style })];

    const segments = splitMathSegments(source);
    const hasMath = segments.some(segment => segment.type === 'math');
    if (!hasMath) {
        return [new TextRun({ text: normalizeWorksheetMath(source), ...style })];
    }

    return segments.flatMap<ParagraphChild>((segment) => {
        if (segment.type === 'text') {
            const text = segment.raw.replace(/\n/g, ' ');
            return text ? [new TextRun({ text, ...style })] : [];
        }

        const parsed = parseMathExpression(segment.inner);
        return [new OfficeMath({ children: parsed })];
    });
};
