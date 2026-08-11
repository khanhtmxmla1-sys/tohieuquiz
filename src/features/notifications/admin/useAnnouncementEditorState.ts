import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnnouncementDraft } from './AnnouncementComposer';
import { announcementDraftsEqual } from './announcementDraftUtils';

export type AnnouncementEditorMode = 'closed' | 'create' | 'edit' | 'readonly';

export interface AnnouncementEditorState {
  baseline: AnnouncementDraft | null;
  draft: AnnouncementDraft | null;
  dirty: boolean;
  mode: AnnouncementEditorMode;
}

const modeForDraft = (draft: AnnouncementDraft): AnnouncementEditorMode => (
  draft.status === 'ARCHIVED' || draft.status === 'EXPIRED' ? 'readonly' : 'edit'
);

export function useAnnouncementEditorState() {
  const [baseline, setBaseline] = useState<AnnouncementDraft | null>(null);
  const [draft, setDraft] = useState<AnnouncementDraft | null>(null);
  const [mode, setMode] = useState<AnnouncementEditorMode>('closed');

  const dirty = useMemo(
    () => Boolean(draft && baseline && !announcementDraftsEqual(baseline, draft)),
    [baseline, draft],
  );

  useEffect(() => {
    if (!dirty) return undefined;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const open = useCallback((next: AnnouncementDraft) => {
    setBaseline(next);
    setDraft(next);
    setMode(modeForDraft(next));
  }, []);

  const create = useCallback((next: AnnouncementDraft) => {
    setBaseline(next);
    setDraft(next);
    setMode('create');
  }, []);

  const update = useCallback((next: AnnouncementDraft) => {
    setDraft(next);
  }, []);

  const markSaved = useCallback((next: AnnouncementDraft) => {
    setBaseline(next);
    setDraft(next);
    setMode(modeForDraft(next));
  }, []);

  const close = useCallback(() => {
    setBaseline(null);
    setDraft(null);
    setMode('closed');
  }, []);

  return {
    baseline,
    draft,
    dirty,
    mode,
    open,
    create,
    update,
    markSaved,
    close,
  };
}
