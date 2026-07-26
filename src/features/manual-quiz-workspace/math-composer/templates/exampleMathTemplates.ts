import {
    commandMathTemplate,
    noMathTemplateFields,
    type MathTemplate,
} from '../mathTemplateTypes';

export const exampleMathTemplates: MathTemplate[] = [
    commandMathTemplate(
        'blankEquation',
        '□ + □',
        'Mẫu phép tính có ô trống',
        'examples',
        '\\square + \\square = \\square',
    ),
    {
        id: 'fractionSum',
        label: 'a⁄b + c⁄d',
        title: 'Mẫu cộng phân số',
        category: 'examples',
        fields: noMathTemplateFields,
        format: ({ caret }) => `\\frac{${caret()}}{} + \\frac{}{} =`,
    },
    commandMathTemplate('perimeterFormula', 'P = …', 'Mẫu công thức chu vi', 'examples', 'P ='),
    commandMathTemplate('areaFormula', 'S = …', 'Mẫu công thức diện tích', 'examples', 'S ='),
];
