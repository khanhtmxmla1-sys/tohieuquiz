import { commandMathTemplate, type MathTemplate } from '../mathTemplateTypes';

export const basicMathTemplates: MathTemplate[] = [
    commandMathTemplate('plus', '+', 'Cộng', 'basic', '+'),
    commandMathTemplate('minus', '−', 'Trừ', 'basic', '-'),
    commandMathTemplate('multiply', '×', 'Nhân', 'basic', '\\times'),
    commandMathTemplate('divide', '÷', 'Chia', 'basic', '\\div'),
    commandMathTemplate('equals', '=', 'Bằng', 'basic', '='),
    commandMathTemplate('notEqual', '≠', 'Khác', 'basic', '\\neq'),
    commandMathTemplate('lessThan', '<', 'Nhỏ hơn', 'basic', '<'),
    commandMathTemplate('greaterThan', '>', 'Lớn hơn', 'basic', '>'),
    commandMathTemplate('lessOrEqual', '≤', 'Nhỏ hơn hoặc bằng', 'basic', '\\leq'),
    commandMathTemplate('greaterOrEqual', '≥', 'Lớn hơn hoặc bằng', 'basic', '\\geq'),
];
