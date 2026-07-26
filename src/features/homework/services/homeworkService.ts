import { AIResult } from '../types';
import { homeworkBackendService } from './homeworkBackendService';

/** AI operations are intentionally routed through the authenticated Worker.
 * No provider token or target URL is shipped in the browser bundle.
 */
export const homeworkService = {
  gradeSubmission(submissionId: string): Promise<AIResult> {
    return homeworkBackendService.requestAiSuggestion(submissionId);
  },
  performOCR(mediaUrl: string): Promise<string> {
    return homeworkBackendService.performOCR(mediaUrl);
  },
};
