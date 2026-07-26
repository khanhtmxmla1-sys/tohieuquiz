import { BatchIdentityFields } from './BatchIdentityFields';
import { CertificateContentFields } from './CertificateContentFields';
import { BatchScopeFields } from './BatchScopeFields';
import { StudentSelectionSection } from './StudentSelectionSection';
import type { useBatchStudentSelection } from './useBatchStudentSelection';
import type { useCertificateBatchData } from './useCertificateBatchData';
import type { useCertificateBatchSubmit } from './useCertificateBatchSubmit';

interface BatchModalBodyProps {
  data: ReturnType<typeof useCertificateBatchData>;
  selection: ReturnType<typeof useBatchStudentSelection>;
  submit: ReturnType<typeof useCertificateBatchSubmit>;
}

export const BatchModalBody = ({ data, selection, submit }: BatchModalBodyProps) => (
  <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
    <BatchIdentityFields
      templates={data.templates}
      templateId={data.templateId}
      setTemplateId={data.setTemplateId}
      title={submit.title}
      setTitle={submit.setTitle}
      customNote={submit.customNote}
      setCustomNote={submit.setCustomNote}
    />
    <CertificateContentFields
      achievementPrefix={submit.achievementPrefix}
      setAchievementPrefix={submit.setAchievementPrefix}
      dateLine={submit.dateLine}
      setDateLine={submit.setDateLine}
      studentNameFont={submit.studentNameFont}
      setStudentNameFont={submit.setStudentNameFont}
    />
    <BatchScopeFields
      classes={data.classes}
      classId={data.classId}
      setClassId={data.setClassId}
      loadingClasses={data.loadingClasses}
      quizzes={data.quizzes}
      quizId={data.quizId}
      setQuizId={data.setQuizId}
    />
    <StudentSelectionSection
      loadingStudents={data.loadingStudents}
      loadingResults={data.loadingResults}
      totalStudents={data.classStudents.length}
      selectedIds={selection.selectedIds}
      filtered={selection.filtered}
      search={selection.search}
      setSearch={selection.setSearch}
      quizId={data.quizId}
      onToggleAll={selection.toggleAll}
      onToggleOne={selection.toggleOne}
    />
  </div>
);
