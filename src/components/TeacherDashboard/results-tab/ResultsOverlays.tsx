import type { Quiz, StudentResult } from '../../../types';
import ResultRowPhieuModal from '../../../features/results/components/ResultRowPhieuModal';
import { ResultReportDeliveryWizard } from '../../../features/results/components/result-report-delivery';
import type { PhieuCache, PhieuCacheEntry } from './types';

interface ResultsOverlaysProps {
  showPhieuPanel: boolean;
  filteredResults: StudentResult[];
  deliveryClassName: string;
  deliveryQuizId: string;
  deliveryQuizTitle: string;
  onClosePhieuPanel: () => void;
  phieuResult: StudentResult | null;
  quizzes: Quiz[];
  phieuCache: PhieuCache;
  onCacheUpdate: (resultId: string, patch: Partial<PhieuCacheEntry>) => void;
  onClosePhieu: () => void;
}

export const ResultsOverlays = (props: ResultsOverlaysProps) => {
  const resultId = String(props.phieuResult?.id || '');
  const cache = props.phieuCache[resultId] ?? { savedPhieu: null, publishedLink: null };
  return (
    <>
      {props.showPhieuPanel && (
        <ResultReportDeliveryWizard
          isOpen
          className={props.deliveryClassName}
          quizId={props.deliveryQuizId}
          quizTitle={props.deliveryQuizTitle}
          onClose={props.onClosePhieuPanel}
        />
      )}
      {props.phieuResult && (
        <ResultRowPhieuModal
          result={props.phieuResult}
          quizTitle={props.phieuResult.quizTitle
            || props.quizzes.find(quiz => quiz.id === props.phieuResult?.quizId)?.title
            || 'Bài kiểm tra'}
          initialSavedPhieu={cache.savedPhieu}
          initialPublishedLink={cache.publishedLink}
          onSavedPhieuChange={phieu => props.onCacheUpdate(resultId, { savedPhieu: phieu })}
          onPublishedLinkChange={link => props.onCacheUpdate(resultId, { publishedLink: link })}
          onClose={props.onClosePhieu}
        />
      )}
    </>
  );
};
