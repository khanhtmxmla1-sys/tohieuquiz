/**
 * Toast Utility - Centralized notification system
 * Uses react-hot-toast with Apple-style design
 * Position: top-center for optimal mobile visibility
 */
import toast from 'react-hot-toast';
import React from 'react';

// ─── Sound ───────────────────────────────────────────────────────────────────

/**
 * Play a soft "Ting" sound using Web Audio API — no MP3 file needed.
 * Used specifically when a student submits their quiz successfully.
 */
export const playTingSound = (): void => {
    try {
        const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note — bright & clear
        gain.gain.setValueAtTime(0.28, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.7);

        // Clean up context after sound finishes
        osc.onended = () => ctx.close();
    } catch {
        // Silently ignore — audio permission denied or unsupported
    }
};

// ─── Base Options ─────────────────────────────────────────────────────────────

const BASE_DURATION = 3500;

export type SystemToastOptions = NonNullable<Parameters<typeof toast.success>[1]>;

type SystemToastOptionsInput = number | SystemToastOptions;

const normalizeToastOptions = (optionsOrDuration?: SystemToastOptionsInput): SystemToastOptions => {
    if (typeof optionsOrDuration === 'number') return { duration: optionsOrDuration };
    return optionsOrDuration ?? {};
};

const baseStyle: React.CSSProperties = {
    fontFamily: "'Baloo 2', sans-serif",
    fontWeight: 600,
    fontSize: '0.93rem',
    borderRadius: '14px',
    padding: '12px 16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
};

// ─── Notification helpers ─────────────────────────────────────────────────────

/** Show a success toast */
export const showSuccess = (message: string, optionsOrDuration?: SystemToastOptionsInput): string => {
    const options = normalizeToastOptions(optionsOrDuration);
    return toast.success(message, {
        ...options,
        duration: options.duration ?? BASE_DURATION,
        style: {
            ...baseStyle,
            background: '#f0fdf4',
            color: '#15803d',
            ...options.style,
        },
        iconTheme: options.iconTheme ?? { primary: '#22c55e', secondary: '#f0fdf4' },
    });
};

/** Show an error toast */
export const showError = (message: string, optionsOrDuration?: SystemToastOptionsInput): string => {
    const options = normalizeToastOptions(optionsOrDuration);
    return toast.error(message, {
        ...options,
        duration: options.duration ?? BASE_DURATION,
        style: {
            ...baseStyle,
            background: '#fef2f2',
            color: '#dc2626',
            ...options.style,
        },
        iconTheme: options.iconTheme ?? { primary: '#ef4444', secondary: '#fef2f2' },
    });
};

/** Show an info / neutral toast */
export const showInfo = (message: string, optionsOrDuration?: SystemToastOptionsInput): string => {
    const options = normalizeToastOptions(optionsOrDuration);
    return toast(message, {
        ...options,
        duration: options.duration ?? BASE_DURATION,
        icon: options.icon ?? 'ℹ️',
        style: {
            ...baseStyle,
            background: '#eff6ff',
            color: '#1d4ed8',
            ...options.style,
        },
    });
};

/** Show a warning toast */
export const showWarning = (message: string, optionsOrDuration?: SystemToastOptionsInput): string => {
    const options = normalizeToastOptions(optionsOrDuration);
    return toast(message, {
        ...options,
        duration: options.duration ?? BASE_DURATION,
        icon: options.icon ?? '⚠️',
        style: {
            ...baseStyle,
            background: '#fffbeb',
            color: '#b45309',
            ...options.style,
        },
    });
};

/**
 * Show a loading toast that you dismiss manually.
 * Returns the toast ID so you can call `toast.dismiss(id)` later.
 */
export const showLoading = (message: string): string =>
    toast.loading(message, {
        style: {
            ...baseStyle,
            background: '#f8fafc',
            color: '#334155',
        },
    });

// ─── System Dialogs ──────────────────────────────────────────────────────────

export interface ConfirmOptions {
    message: string;
    onConfirm?: () => unknown;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
}

export interface PromptOptions {
    title: string;
    message: string;
    defaultValue?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    inputType?: React.HTMLInputTypeAttribute;
}

interface ConfirmDialogRequest {
    id: string;
    kind: 'confirm';
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
}

interface PromptDialogRequest {
    id: string;
    kind: 'prompt';
    options: PromptOptions;
    resolve: (value: string | null) => void;
}

export type SystemDialogRequest = ConfirmDialogRequest | PromptDialogRequest;

let nextSystemDialogId = 0;
let activeSystemDialog: SystemDialogRequest | null = null;
const pendingSystemDialogs: SystemDialogRequest[] = [];
const systemDialogListeners = new Set<() => void>();

const notifySystemDialogListeners = (): void => {
    systemDialogListeners.forEach((listener) => listener());
};

const enqueueSystemDialog = (request: SystemDialogRequest): void => {
    if (activeSystemDialog) {
        pendingSystemDialogs.push(request);
        return;
    }
    activeSystemDialog = request;
    notifySystemDialogListeners();
};

export const getSystemDialogRequest = (): SystemDialogRequest | null => activeSystemDialog;

export const subscribeSystemDialog = (listener: () => void): (() => void) => {
    systemDialogListeners.add(listener);
    return () => systemDialogListeners.delete(listener);
};

export const settleSystemDialog = (id: string, value: boolean | string | null): void => {
    if (!activeSystemDialog || activeSystemDialog.id !== id) return;

    const request = activeSystemDialog;
    activeSystemDialog = pendingSystemDialogs.shift() ?? null;

    if (request.kind === 'confirm') {
        const confirmed = value === true;
        request.resolve(confirmed);
        notifySystemDialogListeners();
        if (confirmed) request.options.onConfirm?.();
        return;
    }

    request.resolve(typeof value === 'string' ? value : null);
    notifySystemDialogListeners();
};

/**
 * Show an accessible confirmation dialog through SystemDialogHost.
 * Existing callback-style callers remain supported while new callers can await the result.
 */
export const showConfirm = (options: ConfirmOptions): Promise<boolean> =>
    new Promise((resolve) => {
        enqueueSystemDialog({
            id: `system-confirm-${++nextSystemDialogId}`,
            kind: 'confirm',
            options,
            resolve,
        });
    });

/** Show an accessible prompt dialog through SystemDialogHost. */
export const showPrompt = (options: PromptOptions): Promise<string | null> =>
    new Promise((resolve) => {
        enqueueSystemDialog({
            id: `system-prompt-${++nextSystemDialogId}`,
            kind: 'prompt',
            options,
            resolve,
        });
    });
