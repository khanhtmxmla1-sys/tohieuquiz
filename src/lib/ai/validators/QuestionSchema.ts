import { z } from "zod";

export const BlankSchema = z.object({
    id: z.string().describe("The placeholder ID used in the text, e.g., '1' for [1]"),
    answer: z.string().describe("The correct answer string for this blank"),
    options: z.array(z.string()).optional().describe("Optional distractors for DROPDOWN or DRAG_DROP types"),
});

export const GeneratedQuestionSchema = z.object({
    thought_process: z.string().describe("A mandatory thought process analyzing the LaTeX syntax and bracket placements before generating the question."),
    question: z.object({
        text: z.string().describe("The question content containing [N] blanks. All math/fractions must be wrapped in $...$."),
        blanks: z.array(BlankSchema).describe("List of blanks corresponding to the [N] markers in the text.")
    })
});

export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;
