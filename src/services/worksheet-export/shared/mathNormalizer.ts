import { normalizeMathText, splitMathSegments } from '../../../utils/mathText';

interface BalancedGroup {
    content: string;
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

const formatOperand = (value: string): string => {
    const trimmed = value.trim();
    return /^[\p{L}\p{N}.,]+$/u.test(trimmed) ? trimmed : `(${trimmed})`;
};

const readScript = (value: string, start: number): { text: string; end: number } => {
    const cursor = skipWhitespace(value, start);
    const group = readBalancedGroup(value, cursor);
    if (group) return { text: readableMathExpression(group.content), end: group.end };

    if (value[cursor] === '\\') {
        const command = readCommand(value, cursor);
        if (command) return command;
    }

    return { text: value[cursor] || '', end: Math.min(value.length, cursor + 1) };
};

const readCommand = (value: string, start: number): { text: string; end: number } | null => {
    if (value[start] !== '\\') return null;

    if (value[start + 1] === '\\') return { text: ' ', end: start + 2 };
    if (value[start + 1] && !/[A-Za-z]/.test(value[start + 1])) {
        return { text: value[start + 1], end: start + 2 };
    }

    const match = value.slice(start).match(/^\\([A-Za-z]+)/);
    if (!match) return null;
    const name = match[1];
    const commandEnd = start + match[0].length;
    let cursor = skipWhitespace(value, commandEnd);

    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const numerator = readBalancedGroup(value, cursor);
        if (!numerator) return { text: name, end: cursor };
        cursor = skipWhitespace(value, numerator.end);
        const denominator = readBalancedGroup(value, cursor);
        if (!denominator) return { text: `${name}${numerator.content}`, end: cursor };
        const top = readableMathExpression(numerator.content);
        const bottom = readableMathExpression(denominator.content);
        return {
            text: `${formatOperand(top)}/${formatOperand(bottom)}`,
            end: denominator.end,
        };
    }

    if (name === 'sqrt') {
        let degree = '';
        if (value[cursor] === '[') {
            const degreeGroup = readBalancedGroup(value, cursor, '[', ']');
            if (degreeGroup) {
                degree = readableMathExpression(degreeGroup.content);
                cursor = skipWhitespace(value, degreeGroup.end);
            }
        }
        const radicand = readBalancedGroup(value, cursor);
        if (!radicand) return { text: '√', end: cursor };
        const inner = readableMathExpression(radicand.content);
        const root = degree ? `√[${degree}]` : '√';
        return { text: `${root}${formatOperand(inner)}`, end: radicand.end };
    }

    if (WRAPPER_COMMANDS.has(name)) {
        const group = readBalancedGroup(value, cursor);
        if (!group) return { text: name, end: cursor };
        return { text: readableMathExpression(group.content), end: group.end };
    }

    if (name === 'left' || name === 'right') return { text: '', end: commandEnd };
    if (name === 'begin' || name === 'end') {
        const environment = readBalancedGroup(value, cursor);
        return { text: '', end: environment?.end ?? cursor };
    }

    return { text: SYMBOLS[name] ?? name, end: commandEnd };
};

export const readableMathExpression = (value: string): string => {
    let output = '';
    let cursor = 0;

    while (cursor < value.length) {
        const character = value[cursor];

        if (character === '\\') {
            const command = readCommand(value, cursor);
            if (command) {
                output += command.text;
                cursor = command.end;
                continue;
            }
        }

        if (character === '^' || character === '_') {
            const script = readScript(value, cursor + 1);
            output += `${character}${formatOperand(script.text)}`;
            cursor = script.end;
            continue;
        }

        if (character === '{') {
            const group = readBalancedGroup(value, cursor);
            if (group) {
                output += readableMathExpression(group.content);
                cursor = group.end;
                continue;
            }
        }

        if (character === '&') {
            output += ' ';
            cursor++;
            continue;
        }

        output += character;
        cursor++;
    }

    return output
        .replace(/[ \t]+/g, ' ')
        .replace(/\s*\n\s*/g, ' ')
        .trim();
};

/** Convert mixed prose/TeX to a readable linear representation for PDF/plain exports. */
export function normalizeWorksheetMath(text: string, wrapForWord = false): string {
    if (!text) return '';
    const normalized = normalizeMathText(text);

    // Kept for compatibility with older callers. DOCX now parses this normalized
    // source into Office Math instead of placing the delimiters in a TextRun.
    if (wrapForWord) return normalized.trim();

    const segments = splitMathSegments(normalized);
    const readable = segments.length > 0
        ? segments.map(segment => (
            segment.type === 'math'
                ? readableMathExpression(segment.inner)
                : segment.raw
        )).join('')
        : readableMathExpression(normalized);

    return readable
        .replace(/\$+/g, '')
        .replace(/\\[A-Za-z]+/g, command => command.slice(1))
        .replace(/[{}]/g, '')
        .trim();
}
