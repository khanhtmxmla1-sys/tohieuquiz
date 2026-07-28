import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export interface OfflineBannerProps {
  isOnline?: boolean;
}

export const OfflineBanner = ({ isOnline: controlledOnline }: OfflineBannerProps) => {
  const onlineStatus = useOnlineStatus();
  const isOnline = controlledOnline ?? onlineStatus.isOnline;

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[100] flex min-h-11 items-center justify-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow-sm"
    >
      <WifiOff aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span>Bạn đang ngoại tuyến. Dữ liệu đã tải vẫn xem được, nhưng thao tác cần máy chủ tạm thời bị khóa.</span>
    </div>
  );
};

export default OfflineBanner;
