import { Send } from 'lucide-react';

export const AssignmentComposerHeader = () => (
  <div className="flex items-center gap-3 mb-6">
    <div className="p-2.5 bg-orange-50 rounded-xl">
      <Send className="w-5 h-5 text-orange-500" />
    </div>
    <div>
      <h2 className="text-xl font-bold text-gray-800">Giao bài tập</h2>
      <p className="text-sm text-gray-400">Chọn đề, chọn lớp, đặt deadline</p>
    </div>
  </div>
);
