import React, { useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import type { AppError } from '../../services/api/errors';
import { Alert } from './Alert';
import { Button } from './Button';

export interface SupportErrorProps {
  error: AppError;
  title?: string;
  onRetry?: () => void | Promise<void>;
}

export const SupportError: React.FC<SupportErrorProps> = ({
  error,
  title = 'Không thể hoàn tất yêu cầu',
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);
  const copyRequestId = async () => {
    if (!error.requestId || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(error.requestId);
    setCopied(true);
  };

  return (
    <Alert tone="danger" title={title} className="w-full">
      <p>{error.message}</p>
      {error.requestId && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-white/70 px-2 py-1 text-xs">Mã hỗ trợ: {error.requestId}</code>
          <Button variant="ghost" size="sm" icon={<Copy />} onClick={() => void copyRequestId()} aria-label="Sao chép mã hỗ trợ">
            {copied ? 'Đã sao chép' : 'Sao chép mã hỗ trợ'}
          </Button>
        </div>
      )}
      {error.retryable && onRetry && (
        <div className="mt-3">
          <Button size="sm" icon={<RefreshCw />} onClick={() => void onRetry()}>Thử lại</Button>
        </div>
      )}
    </Alert>
  );
};

export default SupportError;
