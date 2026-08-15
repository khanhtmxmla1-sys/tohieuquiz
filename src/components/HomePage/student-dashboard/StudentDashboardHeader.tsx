import { useEffect, useRef, useState } from 'react';
import type { NotificationTarget } from '../../../../shared/notifications.contract';
import { NotificationCenter } from '../../../features/notifications/components';
import NotificationBell from '../../common/NotificationBell';
import SchoolLogo from '../../common/SchoolLogo';
import type { StudentDashboardHeaderProps } from './dashboard.types';

const baseActionClass =
  'inline-flex min-h-11 items-center justify-center rounded-[10px] px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2';

export function StudentDashboardHeader({
  studentName,
  className,
  avatarUrl,
  level,
  coins,
  activeSection,
  giftShopEnabled,
  studentId,
  unifiedNotificationsReady,
  unifiedNotificationsEnabled,
  onSelectSection,
  onOpenAssignments,
  onOpenPractice,
  onOpenAssignment,
  onOpenResultReport,
  onOpenGiftShop,
  onOpenLiveExam,
  onOpenAvatar,
  onOpenChangePassword,
  onClearDeviceData,
  onLogout,
}: StudentDashboardHeaderProps) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isAccountMenuOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsAccountMenuOpen(false);
      accountTriggerRef.current?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAccountMenuOpen]);

  const runAccountAction = (action: () => void) => {
    setIsAccountMenuOpen(false);
    action();
  };

  const openNotificationTarget = (target: NotificationTarget) => {
    if (target.kind === 'assignment') onOpenAssignment(target.assignmentId);
    if (target.kind === 'result-report') onOpenResultReport(target.reportId);
    if (target.kind === 'certificate') onSelectSection('achievements');
    if (target.kind === 'live-exam') onOpenLiveExam();
    if (target.kind === 'url') {
      if (target.url.startsWith('/')) window.location.assign(target.url);
      else window.open(target.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E5E7EB] bg-[#FFFDF7]">
      <div className="mx-auto flex min-h-16 max-w-[1180px] items-center gap-3 px-4 sm:px-5 md:min-h-[68px] lg:px-8">
        <div className="flex shrink-0 items-center gap-2">
          <SchoolLogo size={36} />
          <span className="hidden text-xl font-bold tracking-tight text-slate-900 sm:inline">
            TôHiệu<span className="text-sky-600">Quiz</span>
          </span>
        </div>

        <nav className="ml-5 hidden items-center gap-1 lg:flex" aria-label="Điều hướng học sinh">
          <button
            type="button"
            onClick={() => onSelectSection('dashboard')}
            aria-pressed={activeSection === 'dashboard'}
            className={`${baseActionClass} ${
              activeSection === 'dashboard'
                ? 'border-b-2 border-sky-500 text-sky-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trang chủ
          </button>
          <button
            type="button"
            onClick={() => onSelectSection('achievements')}
            aria-pressed={activeSection === 'achievements'}
            className={`${baseActionClass} ${
              activeSection === 'achievements'
                ? 'border-b-2 border-sky-500 text-sky-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Thành tích
          </button>
          <button
            type="button"
            onClick={() => onSelectSection('resultReports')}
            aria-pressed={activeSection === 'resultReports'}
            className={`${baseActionClass} ${
              activeSection === 'resultReports'
                ? 'border-b-2 border-sky-500 text-sky-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Phiếu kết quả
          </button>
          <button
            type="button"
            onClick={onOpenPractice}
            className={`${baseActionClass} text-slate-600 hover:text-slate-900`}
          >
            Thư viện
          </button>
        </nav>

        <div className="ml-auto hidden items-center gap-4 text-xs font-medium text-slate-500 sm:flex">
          <span aria-label={`Cấp bậc ${level}`}>Cấp {level}</span>
          <span aria-label={`${coins} xu`}>{coins} xu</span>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
          {giftShopEnabled ? (
            <button
              type="button"
              onClick={onOpenGiftShop}
              aria-label="Mở Tiệm Tạp Hóa"
              className={`${baseActionClass} hidden border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 xl:inline-flex`}
            >
              Quà tặng
            </button>
          ) : null}

          <button
            type="button"
            onClick={onOpenLiveExam}
            aria-label="Thi trực tiếp"
            className={`${baseActionClass} hidden border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 md:inline-flex`}
          >
            Thi trực tiếp
          </button>

          <div className="flex min-h-11 min-w-11 items-center justify-center">
            {unifiedNotificationsReady && (
              unifiedNotificationsEnabled
                ? (
                  <NotificationCenter
                    enabled={Boolean(studentId)}
                    onNavigate={openNotificationTarget}
                  />
                )
                : (
                  <NotificationBell
                    userId={studentId}
                    onOpenCertificate={() => onSelectSection('achievements')}
                    onOpenResultReport={onOpenResultReport}
                  />
                )
            )}
          </div>

          <div className="relative">
            <button
              ref={accountTriggerRef}
              type="button"
              onClick={() => setIsAccountMenuOpen((current) => !current)}
              aria-label={`Mở menu tài khoản của ${studentName}`}
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
              aria-controls="student-account-menu"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white p-0.5 transition-colors hover:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              <img
                src={avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
                aria-hidden="true"
              />
            </button>

            {isAccountMenuOpen ? (
              <div
                id="student-account-menu"
                role="menu"
                aria-label="Tài khoản học sinh"
                className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-[12px] border border-slate-200 bg-white p-2"
              >
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{studentName}</p>
                  <p className="truncate text-xs text-slate-500">{className || 'Học sinh'}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAccountAction(onOpenAvatar)}
                  className="mt-1 flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Đổi avatar
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAccountAction(onOpenChangePassword)}
                  className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Đổi mật khẩu
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAccountAction(onClearDeviceData)}
                  className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Xóa dữ liệu trên thiết bị này
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAccountAction(onLogout)}
                  className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  Đăng xuất
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 md:hidden"
        aria-label="Điều hướng học sinh trên điện thoại"
      >
        <button
          type="button"
          onClick={() => onSelectSection('dashboard')}
          aria-current={activeSection === 'dashboard' ? 'page' : undefined}
          className={`min-h-12 rounded-[10px] px-1 text-xs font-semibold ${activeSection === 'dashboard' ? 'text-sky-700' : 'text-slate-600'}`}
        >
          Trang chủ
        </button>
        <button
          type="button"
          onClick={onOpenAssignments}
          className="min-h-12 rounded-[10px] px-1 text-xs font-semibold text-slate-600"
        >
          Bài tập
        </button>
        <button
          type="button"
          onClick={onOpenPractice}
          className="min-h-12 rounded-[10px] px-1 text-xs font-semibold text-slate-600"
        >
          Thư viện
        </button>
        <button
          type="button"
          onClick={() => onSelectSection('resultReports')}
          aria-current={activeSection === 'resultReports' ? 'page' : undefined}
          className={`min-h-12 rounded-[10px] px-1 text-xs font-semibold ${activeSection === 'resultReports' ? 'text-sky-700' : 'text-slate-600'}`}
        >
          Phiếu KQ
        </button>
        <button
          type="button"
          onClick={() => onSelectSection('achievements')}
          aria-current={activeSection === 'achievements' ? 'page' : undefined}
          className={`min-h-12 rounded-[10px] px-1 text-xs font-semibold ${activeSection === 'achievements' ? 'text-sky-700' : 'text-slate-600'}`}
        >
          Thành tích
        </button>
      </nav>
    </header>
  );
}
