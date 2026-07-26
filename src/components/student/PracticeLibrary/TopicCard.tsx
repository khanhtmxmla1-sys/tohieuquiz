import React from 'react';
import { Play } from 'lucide-react';

interface TopicCardProps {
  topic: string;
  count: number;
  isStarting: boolean;
  onClick: (topic: string) => void;
}

const formatTopic = (topic: string) => {
  const value = topic.replace(/^#/, '').replace(/_/g, ' ').trim();
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : 'Chuyên đề';
};

const TopicCard: React.FC<TopicCardProps> = ({ topic, count, isStarting, onClick }) => {
  const formattedTopic = formatTopic(topic);

  return (
    <button
      type="button"
      onClick={() => onClick(topic)}
      disabled={isStarting}
      aria-busy={isStarting}
      className="group flex min-h-44 w-full flex-col rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:border-slate-200 disabled:bg-slate-50 motion-reduce:transform-none motion-reduce:transition-none"
    >
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Chuyên đề
      </span>
      <span className="mt-3 text-xl font-black text-slate-900">{formattedTopic}</span>
      <span className="mt-2 text-sm font-semibold text-slate-600">{count} câu có sẵn</span>
      <span className="mt-auto inline-flex min-h-11 items-center gap-2 pt-5 text-sm font-black text-teal-700">
        {isStarting ? 'Đang chuẩn bị...' : 'Luyện 10 câu'}
        {!isStarting ? <Play className="h-4 w-4" aria-hidden="true" /> : null}
      </span>
    </button>
  );
};

export default TopicCard;
