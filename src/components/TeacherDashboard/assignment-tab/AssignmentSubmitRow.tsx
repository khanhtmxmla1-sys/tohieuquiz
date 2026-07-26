import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { Button } from '../../common';

interface AssignmentSubmitRowProps {
  disabled: boolean;
  isLoading: boolean;
  showSuccess: boolean;
  onSubmit: () => Promise<void>;
}

export const AssignmentSubmitRow = ({
  disabled,
  isLoading,
  showSuccess,
  onSubmit,
}: AssignmentSubmitRowProps) => (
  <div className="flex items-center gap-4">
    <Button
      onClick={onSubmit}
      variant="primary"
      disabled={disabled || isLoading}
      icon={isLoading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <Send className="w-4 h-4" />}
    >
      {isLoading ? 'Đang giao...' : 'Giao bài'}
    </Button>
    {showSuccess && (
      <span className="text-green-600 text-sm font-medium flex items-center gap-1 animate-in fade-in">
        <CheckCircle2 className="w-4 h-4" /> Đã giao bài thành công!
      </span>
    )}
  </div>
);
