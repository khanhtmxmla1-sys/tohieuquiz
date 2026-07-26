import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { ResultDashboardSummary } from '../../../../shared/result-summary.contract';
import type { Quiz, StudentResult } from '../../../types';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';

export type ResultsLoadState = 'loading' | 'success' | 'error';

export interface PasswordGateState {
  requireCurrentPassword: boolean;
}

export interface TeacherDashboardLayoutProps {
  activeTab: TeacherDashboardTab;
  setActiveTab: (tab: TeacherDashboardTab) => void;
  selectTab: (tab: TeacherDashboardTab) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: Dispatch<SetStateAction<boolean>>;
  giftShopEnabled: boolean;
  passwordGate: PasswordGateState | null;
  completePasswordChange: () => void;
  displayName: string;
  teacherInitial: string;
  isAdmin: boolean;
  username?: string | null;
  onLogout: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  resultsLoadState: ResultsLoadState;
  resultsLoadError: string | null;
  loadTeacherResults: () => Promise<void>;
  resultSummary: ResultDashboardSummary | null;
  summaryLoadState: ResultsLoadState;
  summaryLoadError: string | null;
  filteredResults: StudentResult[];
  quizzes: Quiz[];
  editingQuiz: Quiz | null;
  setEditingQuiz: Dispatch<SetStateAction<Quiz | null>>;
  openAccessCodeEditor: (quizId: string, currentCode: string) => void;
  removeQuiz: any;
  createQuiz: any;
  modifyQuiz: any;
  editingAccessCode: { quizId: string; currentCode: string } | null;
  newAccessCode: string;
  setNewAccessCode: (value: string) => void;
  closeAccessCodeEditor: () => void;
  updateAccessCode: () => Promise<void>;
  onNavigate: (path: string) => void;
}
