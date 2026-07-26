import { AlertTriangle, X } from 'lucide-react';
import SmartAssignmentInsightCard, { type SmartAssignmentInsightViewModel } from '../SmartAssignmentInsightCard';

interface AssignmentInsightProps {
  manualNotice: string | null;
  model: SmartAssignmentInsightViewModel | null;
  onClearDraft: () => void;
}

export const AssignmentInsight = ({ manualNotice, model, onClearDraft }: AssignmentInsightProps) => (
  <>
    {manualNotice && (
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>{manualNotice}</p>
      </div>
    )}
    {model && (
      <SmartAssignmentInsightCard
        model={model}
        actions={(
          <button
            type="button"
            onClick={onClearDraft}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <X className="h-4 w-4" /> Bo goi y
          </button>
        )}
      />
    )}
  </>
);
