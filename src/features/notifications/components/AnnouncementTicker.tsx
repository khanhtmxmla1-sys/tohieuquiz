import React, { useEffect, useState } from 'react';
import { Megaphone, Pause, Play } from 'lucide-react';
import type { Announcement } from '../../../services/announcementService';

interface AnnouncementTickerProps {
  announcement: Announcement;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

export function AnnouncementTicker({ announcement }: AnnouncementTickerProps) {
  const [manualPause, setManualPause] = useState(false);
  const [interactionPause, setInteractionPause] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const animated = !reducedMotion;
  const paused = manualPause || interactionPause;

  return (
    <section
      role="region"
      aria-label="Thông báo chung"
      tabIndex={0}
      className="flex items-center gap-3 border-b border-sky-100 bg-sky-50 px-4 py-2 text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      onMouseEnter={() => setInteractionPause(true)}
      onMouseLeave={() => setInteractionPause(false)}
      onFocus={() => setInteractionPause(true)}
      onBlur={() => setInteractionPause(false)}
    >
      <Megaphone aria-hidden="true" className="h-4 w-4 shrink-0 text-sky-700" />
      <div className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
        <span
          data-testid="notification-ticker-track"
          className={[
            'notification-ticker__track inline-block',
            animated ? 'notification-ticker__track--animated' : '',
            paused ? 'notification-ticker__track--paused' : '',
          ].filter(Boolean).join(' ')}
        >
          {announcement.content}
        </span>
      </div>
      {animated && (
        <button
          type="button"
          aria-label={manualPause ? 'Tiếp tục tin chạy' : 'Tạm dừng tin chạy'}
          aria-pressed={manualPause}
          className="rounded-full p-1.5 hover:bg-sky-100"
          onClick={() => setManualPause((current) => !current)}
        >
          {manualPause
            ? <Play aria-hidden="true" className="h-4 w-4" />
            : <Pause aria-hidden="true" className="h-4 w-4" />}
        </button>
      )}
    </section>
  );
}
