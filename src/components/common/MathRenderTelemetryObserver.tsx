import { useEffect } from 'react';
import { reportMathTelemetry } from '../../services/mathTelemetryService';

const contextFromNode = (node: Element | null) => {
    const root = node?.closest<HTMLElement>('[data-math-question-id]');
    return {
        quizId: root?.dataset.mathQuizId || '',
        questionId: root?.dataset.mathQuestionId || '',
        questionType: root?.dataset.mathQuestionType || 'UNKNOWN',
        mathFormatVersion: Number(root?.dataset.mathFormatVersion || 0),
    };
};

const send = (code: string, node: Element | null) => {
    const context = contextFromNode(node);
    reportMathTelemetry({
        ...context,
        errorCode: code,
        route: window.location.pathname,
    });
};

/** Watches global failures that component-level MathJax callbacks cannot report. */
const MathRenderTelemetryObserver: React.FC = () => {
    useEffect(() => {
        const onError = (event: ErrorEvent) => {
            const message = `${event.message || ''} ${event.error?.message || ''}`;
            if (/typeset|mathjax/i.test(message)) send('TYPESET-FAILED', event.target instanceof Element ? event.target : null);
            else if (/removeChild|not a child of this node/i.test(message)) send('DOM-SYNC-ERROR', event.target instanceof Element ? event.target : null);
        };
        window.addEventListener('error', onError);
        return () => window.removeEventListener('error', onError);
    }, []);
    return null;
};

export default MathRenderTelemetryObserver;
