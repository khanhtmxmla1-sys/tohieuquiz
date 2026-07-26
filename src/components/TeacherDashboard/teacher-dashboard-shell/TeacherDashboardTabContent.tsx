import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from '../../common';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';
import type { ResultDashboardSummary } from '../../../../shared/result-summary.contract';
import type { Quiz, StudentResult } from '../../../types';
import type { ResultsLoadState } from './types';
import { TeacherDashboardCoreTabs } from './TeacherDashboardCoreTabs';
import { TeacherDashboardFeatureTabs } from './TeacherDashboardFeatureTabs';

interface TeacherDashboardTabContentProps {
  activeTab: TeacherDashboardTab;
  setActiveTab: (tab: TeacherDashboardTab) => void;
  resultsLoadState: ResultsLoadState;
  resultsLoadError: string | null;
  loadTeacherResults: () => Promise<void>;
  resultSummary: ResultDashboardSummary | null;
  summaryLoadState: ResultsLoadState;
  summaryLoadError: string | null;
  filteredResults: StudentResult[];
  quizzes: Quiz[];
  editingQuiz: Quiz | null;
  setEditingQuiz: (quiz: Quiz | null) => void;
  openAccessCodeEditor: (quizId: string, currentCode: string) => void;
  removeQuiz: any;
  createQuiz: any;
  modifyQuiz: any;
  isAdmin: boolean;
  giftShopEnabled: boolean;
  username?: string | null;
}

export const TeacherDashboardTabContent = (props: TeacherDashboardTabContentProps) => (
  <ErrorBoundary onReset={() => props.setActiveTab('overview')}>
    <Suspense fallback={(
      <div className="flex items-center justify-center py-20 h-full">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )}>
      <TeacherDashboardCoreTabs {...props} />
      <TeacherDashboardFeatureTabs
        activeTab={props.activeTab}
        isAdmin={props.isAdmin}
        giftShopEnabled={props.giftShopEnabled}
        username={props.username}
      />
    </Suspense>
  </ErrorBoundary>
);
