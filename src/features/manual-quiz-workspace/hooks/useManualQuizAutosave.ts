import type { ManualQuizDraftEnvelope } from '../types/manualQuizWorkspace.types';
import {
    useDraftConflictResolution,
    type DraftConflictResolutionController,
} from './useDraftConflictResolution';
import { useLocalManualQuizAutosave } from './useLocalManualQuizAutosave';
import {
    useRemoteManualQuizAutosave,
    type RemoteManualQuizAutosaveController,
} from './useRemoteManualQuizAutosave';

export type ManualQuizAutosaveController = RemoteManualQuizAutosaveController;

export const useManualQuizAutosave = (
    envelope: ManualQuizDraftEnvelope | null,
): ManualQuizAutosaveController => {
    const localAutosave = useLocalManualQuizAutosave(envelope);
    return useRemoteManualQuizAutosave(envelope, localAutosave);
};

export { useDraftConflictResolution };
