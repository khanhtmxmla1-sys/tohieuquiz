import { X } from 'lucide-react';

interface TeacherAccountMenuProps {
  displayName: string;
  initial: string;
  isAdmin: boolean;
  onLogout: () => void;
}

export const TeacherAccountMenu = ({
  displayName,
  initial,
  isAdmin,
  onLogout,
}: TeacherAccountMenuProps) => (
  <details className="group relative border-l border-[#E5E7EB] pl-2 sm:pl-3">
    <summary
      aria-label={`Mở menu tài khoản của ${displayName}`}
      className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] [&::-webkit-details-marker]:hidden"
    >
      <span className="hidden flex-col items-end sm:flex">
        <span className="text-sm font-semibold leading-tight text-[#172033]">{displayName}</span>
        <span className="text-xs font-medium text-[#7A8796]">
          {isAdmin ? 'Quản trị viên' : 'Giáo viên'}
        </span>
      </span>
      <span className="flex size-10 items-center justify-center rounded-full border border-[#BAE6FD] bg-[#0EA5E9] font-semibold text-white transition-colors group-hover:bg-[#0284C7]">
        {initial}
      </span>
    </summary>
    <div className="invisible absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white opacity-0 shadow-[0_8px_24px_rgba(23,32,51,0.10)] transition-opacity group-open:visible group-open:opacity-100">
      <div className="border-b border-[#E5E7EB] bg-[#F8FAFC] p-4">
        <p className="mb-1 text-xs text-[#7A8796]">Tài khoản</p>
        <p className="truncate text-sm font-semibold text-[#172033]">{displayName}</p>
      </div>
      <div className="p-2">
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-[#B94733] transition-colors hover:bg-[#FFF4F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E76F51]"
        >
          <X aria-hidden="true" className="size-4" /> Đăng xuất
        </button>
      </div>
    </div>
  </details>
);
