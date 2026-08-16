import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import {
  getSystemDialogRequest,
  settleSystemDialog,
  subscribeSystemDialog,
  type SystemDialogRequest,
} from '../../utils/toast';

export const SystemDialogHost: React.FC = () => {
  const request = useSyncExternalStore(
    subscribeSystemDialog,
    getSystemDialogRequest,
    getSystemDialogRequest,
  );
  const [promptValue, setPromptValue] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (request?.kind === 'prompt') {
      setPromptValue(request.options.defaultValue ?? '');
    }
  }, [request]);

  const close = () => {
    if (!request) return;
    settleSystemDialog(request.id, request.kind === 'confirm' ? false : null);
  };

  useDialogFocus({
    isOpen: Boolean(request),
    dialogRef,
    initialFocusRef: request?.kind === 'prompt' ? promptRef : cancelRef,
    onClose: close,
  });

  if (!request) return null;

  const isConfirm = request.kind === 'confirm';
  const title = isConfirm ? 'Xác nhận thao tác' : request.options.title;
  const message = request.options.message;
  const confirmLabel = request.options.confirmLabel ?? (isConfirm ? 'Đồng ý' : 'Lưu');
  const cancelLabel = request.options.cancelLabel ?? 'Hủy';
  const destructive = isConfirm && Boolean(request.options.destructive);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold text-slate-900">{title}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
          </div>
        </div>

        {!isConfirm ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              settleSystemDialog(request.id, promptValue);
            }}
          >
            <label htmlFor={`${titleId}-input`} className="sr-only">{message}</label>
            <input
              ref={promptRef}
              id={`${titleId}-input`}
              aria-label={message}
              type={request.options.inputType ?? 'text'}
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              className="mb-5 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <div className="flex justify-end gap-3">
              <button ref={cancelRef} type="button" onClick={close} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700">
                {cancelLabel}
              </button>
              <button type="submit" className="min-h-11 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700">
                {confirmLabel}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex justify-end gap-3">
            <button ref={cancelRef} type="button" onClick={close} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700">
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => settleSystemDialog(request.id, true)}
              className={`min-h-11 rounded-xl px-4 py-2 font-bold text-white ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
