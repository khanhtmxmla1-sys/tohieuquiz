import { Loader2 } from 'lucide-react';

export const GiftShopLoadingIndicator = ({ isLoading }: { isLoading: boolean }) => isLoading ? (
  <div className="fixed right-6 bottom-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white shadow-lg text-sm font-semibold">
    <Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...
  </div>
) : null;
