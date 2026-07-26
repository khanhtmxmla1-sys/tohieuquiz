import {
    commandMathTemplate,
    mathTemplateField,
    type MathTemplate,
} from '../mathTemplateTypes';

export const geometryMathTemplates: MathTemplate[] = [
    {
        id: 'angle', label: '∠', title: 'Góc', category: 'geometry',
        fields: [mathTemplateField('points', 'Tên góc', 'ABC', 'ABC')],
        format: ({ selected, caret }) => `\\angle ${selected || caret('ABC')}`,
    },
    {
        id: 'segment', label: 'AB̅', title: 'Đoạn thẳng', category: 'geometry',
        fields: [mathTemplateField('points', 'Tên đoạn thẳng', 'AB', 'AB')],
        format: ({ selected, caret }) => `\\overline{${selected || caret('AB')}}`,
    },
    {
        id: 'triangle', label: '△', title: 'Tam giác', category: 'geometry',
        fields: [mathTemplateField('points', 'Tên tam giác', 'ABC', 'ABC')],
        format: ({ selected, caret }) => `\\triangle ${selected || caret('ABC')}`,
    },
    {
        id: 'parallel', label: '∥', title: 'Song song', category: 'geometry',
        fields: [
            mathTemplateField('first', 'Đường thứ nhất', 'AB', 'AB'),
            mathTemplateField('second', 'Đường thứ hai', 'CD', 'CD'),
        ],
        format: ({ selected, caret }) => `${selected || caret('AB')} \\parallel CD`,
    },
    {
        id: 'perpendicular', label: '⟂', title: 'Vuông góc', category: 'geometry',
        fields: [
            mathTemplateField('first', 'Đường thứ nhất', 'AB', 'AB'),
            mathTemplateField('second', 'Đường thứ hai', 'CD', 'CD'),
        ],
        format: ({ selected, caret }) => `${selected || caret('AB')} \\perp CD`,
    },
    commandMathTemplate('degree', '°', 'Độ', 'geometry', '^{\\circ}'),
    {
        id: 'areaUnit', label: 'cm²', title: 'Đơn vị diện tích', category: 'geometry',
        fields: [mathTemplateField('unit', 'Đơn vị', 'cm', 'cm')],
        format: ({ nextValue }) => `${nextValue('unit', 'cm')}^{2}`,
    },
    {
        id: 'volumeUnit', label: 'cm³', title: 'Đơn vị thể tích', category: 'geometry',
        fields: [mathTemplateField('unit', 'Đơn vị', 'cm', 'cm')],
        format: ({ nextValue }) => `${nextValue('unit', 'cm')}^{3}`,
    },
];
