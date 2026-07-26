import {
    mathTemplateField,
    type MathTemplate,
} from '../mathTemplateTypes';

export const fractionMathTemplates: MathTemplate[] = [
    {
        id: 'fraction', label: 'a⁄b', title: 'Phân số', category: 'fractions',
        fields: [
            mathTemplateField('numerator', 'Tử số', '3'),
            mathTemplateField('denominator', 'Mẫu số', '4'),
        ],
        format: ({ selected, nextValue }) =>
            `\\frac{${nextValue('numerator', selected)}}{${nextValue('denominator')}}`,
    },
    {
        id: 'mixedNumber', label: 'a b⁄c', title: 'Hỗn số', category: 'fractions',
        fields: [
            mathTemplateField('whole', 'Phần nguyên', '2'),
            mathTemplateField('numerator', 'Tử số', '1'),
            mathTemplateField('denominator', 'Mẫu số', '3'),
        ],
        format: ({ selected, nextValue }) =>
            `${nextValue('whole', selected)}\\frac{${nextValue('numerator')}}{${nextValue('denominator')}}`,
    },
    {
        id: 'sqrt', label: '√', title: 'Căn bậc hai', category: 'fractions',
        fields: [mathTemplateField('radicand', 'Số dưới căn', '9')],
        format: ({ selected, nextValue }) => `\\sqrt{${nextValue('radicand', selected)}}`,
    },
    {
        id: 'power', label: 'xⁿ', title: 'Số mũ', category: 'fractions',
        fields: [
            mathTemplateField('base', 'Cơ số', 'x'),
            mathTemplateField('exponent', 'Số mũ', '2'),
        ],
        format: ({ selected, nextValue }) =>
            `${nextValue('base', selected || 'x')}^{${nextValue('exponent')}}`,
    },
    {
        id: 'subscript', label: 'xₙ', title: 'Chỉ số dưới', category: 'fractions',
        fields: [
            mathTemplateField('base', 'Ký hiệu', 'x'),
            mathTemplateField('subscript', 'Chỉ số', '1'),
        ],
        format: ({ selected, nextValue }) =>
            `${nextValue('base', selected || 'x')}_{${nextValue('subscript')}}`,
    },
    {
        id: 'percent', label: '%', title: 'Phần trăm', category: 'fractions',
        fields: [mathTemplateField('value', 'Giá trị', '25')],
        format: ({ selected, nextValue }) => `${nextValue('value', selected)}\\%`,
    },
    {
        id: 'absolute', label: '|x|', title: 'Giá trị tuyệt đối', category: 'fractions',
        fields: [mathTemplateField('value', 'Biểu thức', '-5')],
        format: ({ selected, nextValue }) =>
            `\\left|${nextValue('value', selected)}\\right|`,
    },
];
