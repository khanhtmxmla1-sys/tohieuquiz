import { basicMathTemplates } from './templates/basicMathTemplates';
import { exampleMathTemplates } from './templates/exampleMathTemplates';
import { fractionMathTemplates } from './templates/fractionMathTemplates';
import { geometryMathTemplates } from './templates/geometryMathTemplates';
import { symbolMathTemplates } from './templates/symbolMathTemplates';
import type { MathTemplate, MathTemplateId } from './mathTemplateTypes';

const templates: MathTemplate[] = [
    ...basicMathTemplates,
    ...fractionMathTemplates,
    ...geometryMathTemplates,
    ...symbolMathTemplates,
    ...exampleMathTemplates,
];

const templateMap = new Map<MathTemplateId, MathTemplate>(
    templates.map((template) => [template.id, template]),
);

export const listMathTemplates = (): MathTemplate[] => [...templates];

export const getMathTemplate = (id: MathTemplateId): MathTemplate => {
    const template = templateMap.get(id);
    if (!template) throw new Error(`Unknown math template: ${id}`);
    return template;
};

export type {
    MathTemplate,
    MathTemplateCategory,
    MathTemplateField,
    MathTemplateFormatContext,
    MathTemplateId,
} from './mathTemplateTypes';
