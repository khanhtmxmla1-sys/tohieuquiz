import React from 'react';

interface Student {
  student_id: string;
  student_name: string;
  student_score?: string;
}

interface Props {
  students: Student[];
  selectedStudents: Student[];
  onChange: (students: Student[]) => void;
}

export default function StudentSelector({ students, selectedStudents, onChange }: Props) {
  const toggleStudent = (student: Student) => {
    const isSelected = selectedStudents.some(s => s.student_id === student.student_id);

    if (isSelected) {
      onChange(selectedStudents.filter(s => s.student_id !== student.student_id));
    } else {
      onChange([...selectedStudents, student]);
    }
  };

  return (
    <div className="space-y-3">
      {students.map(student => {
        const isSelected = selectedStudents.some(s => s.student_id === student.student_id);

        return (
          <div
            key={student.student_id}
            onClick={() => toggleStudent(student)}
            className={`p-4 border rounded-2xl flex justify-between items-center cursor-pointer transition-all
              ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
            `}
          >
            <div>
              <div className="font-medium">{student.student_name}</div>
              <div className="text-sm text-gray-500">{student.student_score || 'Chưa có điểm'}</div>
            </div>
            <input type="checkbox" checked={isSelected} readOnly className="w-5 h-5" />
          </div>
        );
      })}
    </div>
  );
}