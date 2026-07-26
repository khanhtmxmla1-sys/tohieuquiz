import { CalendarClock, ClipboardList } from 'lucide-react';

interface AssignmentScheduleFieldsProps {
  deadline: string;
  setDeadline: (value: string) => void;
  maxAttempts: number;
  setMaxAttempts: (value: number) => void;
}

export const AssignmentScheduleFields = (props: AssignmentScheduleFieldsProps) => (
  <>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        <CalendarClock className="w-3.5 h-3.5 inline mr-1 text-gray-400" /> Hạn nộp
      </label>
      <input
        type="datetime-local"
        value={props.deadline}
        onChange={event => props.setDeadline(event.target.value)}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm"
      />
      <p className="text-xs text-gray-400 mt-1">Giờ Việt Nam (UTC+7)</p>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        <ClipboardList className="w-3.5 h-3.5 inline mr-1 text-gray-400" /> Số lượt làm bài
      </label>
      <input
        type="number"
        min={1}
        max={10}
        value={props.maxAttempts}
        onChange={event => props.setMaxAttempts(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm"
      />
      <p className="text-xs text-gray-400 mt-1">Tối đa 10 lượt</p>
    </div>
  </>
);
