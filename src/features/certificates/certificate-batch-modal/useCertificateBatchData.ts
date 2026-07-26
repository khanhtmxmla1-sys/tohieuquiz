import { useEffect, useState } from 'react';
import { showError } from '../../../utils/toast';
import { fetchTemplateOptions, type TemplateOption } from '../useBatches';
import {
  fetchClassOptions,
  fetchClassStudents,
  fetchQuizOptions,
  fetchQuizResults,
} from './certificateBatchApi';
import type { ClassOption, QuizOption, ResultRecord, StudentOption } from './types';

export const useCertificateBatchData = () => {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [classStudents, setClassStudents] = useState<StudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);
  const [quizId, setQuizId] = useState('');
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    fetchTemplateOptions()
      .then(options => {
        setTemplates(options);
        const defaultTemplate = options.find(template => template.is_default) ?? options[0];
        if (defaultTemplate) setTemplateId(defaultTemplate.id);
      })
      .catch(error => showError(error instanceof Error ? error.message : 'Không thể tải mẫu chứng nhận'));
    setLoadingClasses(true);
    fetchClassOptions()
      .then(list => {
        setClasses(list);
        if (list.length > 0) setClassId(list[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingClasses(false));
    fetchQuizOptions().then(setQuizzes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!classId) return;
    setLoadingStudents(true);
    setClassStudents([]);
    fetchClassStudents(classId)
      .then(setClassStudents)
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, [classId]);

  useEffect(() => {
    if (!quizId || !classId) {
      setResults([]);
      return;
    }
    setLoadingResults(true);
    fetchQuizResults(quizId)
      .then(setResults)
      .catch(() => {})
      .finally(() => setLoadingResults(false));
  }, [quizId, classId]);

  return {
    templates,
    templateId,
    setTemplateId,
    classes,
    classId,
    setClassId,
    loadingClasses,
    classStudents,
    loadingStudents,
    quizzes,
    quizId,
    setQuizId,
    results,
    loadingResults,
  };
};
