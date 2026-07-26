import { Users } from 'lucide-react';
import type { Classroom } from '../../../types/classroom.types';

interface StudentItem { id: string; fullName: string; username: string }

interface AssignmentAudienceFieldsProps {
  classes: Classroom[];
  selectedClassId: string;
  setSelectedClassId: (value: string) => void;
  selectedStudentId: string;
  setSelectedStudentId: (value: string) => void;
  students: StudentItem[];
}

export const AssignmentAudienceFields = (props: AssignmentAudienceFieldsProps) => (
  <>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        <Users className="w-3.5 h-3.5 inline mr-1 text-gray-400" /> Chọn lớp
      </label>
      <select
        value={props.selectedClassId}
        onChange={event => props.setSelectedClassId(event.target.value)}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none appearance-none cursor-pointer text-sm"
      >
        <option value="">-- Chọn lớp --</option>
        {props.classes.map(classroom => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
      </select>
      {props.classes.length === 0 && (
        <p className="text-xs text-amber-500 mt-1">Chưa có lớp. Tạo lớp ở tab "Lớp học" trước.</p>
      )}
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex justify-between items-center">
        <span><Users className="w-3.5 h-3.5 inline mr-1 text-gray-400" /> Chọn học sinh</span>
        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Tùy chọn</span>
      </label>
      <select
        value={props.selectedStudentId}
        onChange={event => props.setSelectedStudentId(event.target.value)}
        disabled={!props.selectedClassId || props.students.length === 0}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none appearance-none cursor-pointer text-sm disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed"
      >
        <option value="">-- Cả lớp --</option>
        {props.students.map(student => (
          <option key={student.id} value={student.id}>{student.fullName} ({student.username})</option>
        ))}
      </select>
    </div>
  </>
);
