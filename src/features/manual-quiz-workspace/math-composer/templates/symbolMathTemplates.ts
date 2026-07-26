import { commandMathTemplate, type MathTemplate } from '../mathTemplateTypes';

export const symbolMathTemplates: MathTemplate[] = [
    commandMathTemplate('pi', 'π', 'Số pi', 'symbols', '\\pi'),
    commandMathTemplate('approximately', '≈', 'Xấp xỉ', 'symbols', '\\approx'),
    commandMathTemplate('infinity', '∞', 'Vô cực', 'symbols', '\\infty'),
    commandMathTemplate('belongsTo', '∈', 'Thuộc', 'symbols', '\\in'),
    commandMathTemplate('notBelongsTo', '∉', 'Không thuộc', 'symbols', '\\notin'),
    commandMathTemplate('union', '∪', 'Hợp', 'symbols', '\\cup'),
    commandMathTemplate('intersection', '∩', 'Giao', 'symbols', '\\cap'),
    commandMathTemplate('arrow', '→', 'Mũi tên', 'symbols', '\\to'),
    commandMathTemplate('implies', '⇒', 'Suy ra', 'symbols', '\\Rightarrow'),
];
