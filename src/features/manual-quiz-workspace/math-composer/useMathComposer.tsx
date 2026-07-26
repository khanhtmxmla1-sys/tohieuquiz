import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react';
import { insertMathTemplate, type FormulaInsertionResult } from './mathInsertion';
import type { MathTemplateId } from './mathTemplates';

type MathFieldElement = HTMLInputElement | HTMLTextAreaElement;

interface RegisteredMathField {
    element: MathFieldElement;
    updateValue(nextValue: string): void;
    label: string;
}

interface MathComposerContextValue {
    activeFieldLabel: string | null;
    registerField(field: RegisteredMathField): void;
    captureSelection(element: MathFieldElement): void;
    selectedText(): string;
    insertTemplate(
        templateId: MathTemplateId,
        values?: Record<string, string>,
    ): FormulaInsertionResult | null;
}

const MathComposerContext = createContext<MathComposerContextValue | null>(null);

export const MathComposerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const activeFieldRef = useRef<RegisteredMathField | null>(null);
    const selectionRef = useRef({ start: 0, end: 0 });
    const [activeFieldLabel, setActiveFieldLabel] = useState<string | null>(null);

    const captureSelection = useCallback((element: MathFieldElement) => {
        if (activeFieldRef.current?.element !== element) return;
        selectionRef.current = {
            start: element.selectionStart ?? element.value.length,
            end: element.selectionEnd ?? element.value.length,
        };
    }, []);

    const registerField = useCallback((field: RegisteredMathField) => {
        const labelChanged = activeFieldRef.current?.element !== field.element
            || activeFieldRef.current?.label !== field.label;
        activeFieldRef.current = field;
        selectionRef.current = {
            start: field.element.selectionStart ?? field.element.value.length,
            end: field.element.selectionEnd ?? field.element.value.length,
        };
        if (labelChanged) setActiveFieldLabel(field.label);
    }, []);

    const selectedText = useCallback((): string => {
        const active = activeFieldRef.current;
        if (!active) return '';
        const { start, end } = selectionRef.current;
        return active.element.value.slice(start, end);
    }, []);

    const insertTemplate = useCallback((
        templateId: MathTemplateId,
        values: Record<string, string> = {},
    ): FormulaInsertionResult | null => {
        const active = activeFieldRef.current;
        if (!active) return null;
        const result = insertMathTemplate({
            value: active.element.value,
            selectionStart: selectionRef.current.start,
            selectionEnd: selectionRef.current.end,
            template: templateId,
            values,
        });
        active.updateValue(result.value);
        selectionRef.current = {
            start: result.selectionStart,
            end: result.selectionEnd,
        };
        window.requestAnimationFrame(() => {
            active.element.focus();
            active.element.setSelectionRange(result.selectionStart, result.selectionEnd);
        });
        return result;
    }, []);

    const value = useMemo<MathComposerContextValue>(() => ({
        activeFieldLabel,
        registerField,
        captureSelection,
        selectedText,
        insertTemplate,
    }), [activeFieldLabel, captureSelection, insertTemplate, registerField, selectedText]);

    return (
        <MathComposerContext.Provider value={value}>
            {children}
        </MathComposerContext.Provider>
    );
};

export const useMathComposer = (): MathComposerContextValue => {
    const context = useContext(MathComposerContext);
    if (!context) throw new Error('useMathComposer must be used inside MathComposerProvider');
    return context;
};

export const useOptionalMathComposer = (): MathComposerContextValue | null =>
    useContext(MathComposerContext);

export const useMathComposerField = <T extends MathFieldElement>(
    ref: React.RefObject<T | null>,
    updateValue: (nextValue: string) => void,
    label: string,
) => {
    const composer = useOptionalMathComposer();

    const activate = useCallback(() => {
        if (!composer || !ref.current) return;
        composer.registerField({
            element: ref.current,
            updateValue,
            label,
        });
        composer.captureSelection(ref.current);
    }, [composer, label, ref, updateValue]);

    const capture = useCallback(() => {
        if (!composer || !ref.current) return;
        composer.captureSelection(ref.current);
    }, [composer, ref]);

    return {
        hasVisualComposer: composer !== null,
        activate,
        capture,
    };
};
