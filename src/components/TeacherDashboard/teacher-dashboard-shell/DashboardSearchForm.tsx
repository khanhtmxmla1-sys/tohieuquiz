import { Search } from 'lucide-react';
import type React from 'react';
import { DASHBOARD_SEARCH_ITEMS } from './dashboardConfig';

interface DashboardSearchFormProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export const DashboardSearchForm = ({
  searchQuery,
  setSearchQuery,
  onSubmit,
}: DashboardSearchFormProps) => (
  <form onSubmit={onSubmit} className="relative hidden md:block">
    <label htmlFor="teacher-dashboard-search" className="sr-only">Tìm chức năng</label>
    <input
      id="teacher-dashboard-search"
      type="search"
      list="teacher-dashboard-search-options"
      value={searchQuery}
      onChange={event => setSearchQuery(event.target.value)}
      placeholder="Tìm chức năng..."
      className="h-10 w-52 rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] py-2 pl-3 pr-10 text-sm text-[#172033] outline-none transition-colors placeholder:text-[#9AA5B1] focus:border-[#0EA5E9] focus:bg-white focus:ring-2 focus:ring-[#BAE6FD] lg:w-64"
    />
    <button
      type="submit"
      aria-label="Tìm chức năng"
      className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#7A8796] hover:bg-white hover:text-[#0284C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]"
    >
      <Search aria-hidden="true" className="size-4" />
    </button>
    <datalist id="teacher-dashboard-search-options">
      {DASHBOARD_SEARCH_ITEMS.map(item => <option key={item.tab} value={item.label} />)}
    </datalist>
  </form>
);
