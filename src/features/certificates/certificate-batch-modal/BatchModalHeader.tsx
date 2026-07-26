import { X } from 'lucide-react';

export const BatchModalHeader = ({ onClose }: { onClose: () => void }) => (
  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
    <h2 className="text-lg font-bold text-slate-800">Cấp phát chứng nhận</h2>
    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
      <X size={18} />
    </button>
  </div>
);
