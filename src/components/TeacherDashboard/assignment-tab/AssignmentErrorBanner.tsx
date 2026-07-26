import { X } from 'lucide-react';

interface AssignmentErrorBannerProps {
  error: string | null;
  onClear: () => void;
}

export const AssignmentErrorBanner = ({ error, onClear }: AssignmentErrorBannerProps) => {
  if (!error) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center justify-between">
      <span>{error}</span>
      <button onClick={onClear} className="text-red-400 hover:text-red-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
