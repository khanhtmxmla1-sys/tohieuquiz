import { Search } from 'lucide-react';
import type React from 'react';
import type { DashboardSearchDestination } from './dashboardConfig';

interface DashboardSearchFormProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  options: DashboardSearchDestination[];
}

export const DashboardSearchForm = ({
  searchQuery,
  setSearchQuery,
  onSubmit,
  options,
}: DashboardSearchFormProps) => (
  <form onSubmit={onSubmit} className="relative hidden w-full max-w-[520px] md:block">
    <label htmlFor="teacher-dashboard-search" className="sr-only">Tìm chức năng</label>
    <input
      id="teacher-dashboard-search"
      type="search"
      list="teacher-dashboard-search-options"
      value={searchQuery}
      onChange={event => setSearchQuery(event.target.value)}
      placeholder="Tìm kiếm lớp học, đề kiểm tra, học sinh..."
      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-4 pr-11 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
    />
    <button
      type="submit"
      aria-label="Tìm chức năng"
      className="absolute right-0 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-[10px] text-[#7A8796] hover:bg-white hover:text-[#0284C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]"
    >
      <Search aria-hidden="true" className="size-4" />
    </button>
    <datalist id="teacher-dashboard-search-options">
      {options.map(item => <option key={item.id} value={item.label} />)}
    </datalist>
  </form>
);
