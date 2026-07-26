import { BookOpen, ChevronDown, Users } from 'lucide-react';
import type { ClassOption, QuizOption } from './types';

interface BatchScopeFieldsProps {
  classes: ClassOption[];
  classId: string;
  setClassId: (value: string) => void;
  loadingClasses: boolean;
  quizzes: QuizOption[];
  quizId: string;
  setQuizId: (value: string) => void;
}

export const BatchScopeFields = (props: BatchScopeFieldsProps) => (
  <div className="grid grid-cols-2 gap-3">
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1">
        <Users size={13} className="text-slate-400" /> Lớp học
      </label>
      <div className="relative">
        <select
          value={props.classId}
          onChange={event => props.setClassId(event.target.value)}
          disabled={props.loadingClasses}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        >
          {props.classes.length === 0 && <option value="">-- Chưa có lớp --</option>}
          {props.classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1">
        <BookOpen size={13} className="text-slate-400" /> Bài thi{' '}
        <span className="font-normal text-slate-400">(tùy chọn)</span>
      </label>
      <div className="relative">
        <select
          value={props.quizId}
          onChange={event => props.setQuizId(event.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Không chọn --</option>
          {props.quizzes.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  </div>
);
