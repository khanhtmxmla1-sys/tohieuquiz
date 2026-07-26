import React, { useMemo, useState } from 'react';
import { CheckCircle2, Gift, RotateCcw, ShoppingBag } from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import { useGiftShopStore } from '../../../stores/useGiftShopStore';
import { GiftCatalogAdminSection } from './GiftCatalogAdminSection';
import { GiftOrdersSection } from './GiftOrdersSection';
import { GiftShopAuditSection } from './GiftShopAuditSection';
import { GiftShopErrorBanner } from './GiftShopErrorBanner';
import { GiftShopHeader } from './GiftShopHeader';
import { useGiftCatalogEditor } from './useGiftCatalogEditor';
import { useGiftOrderActions } from './useGiftOrderActions';
import { useGiftShopFilters } from './useGiftShopFilters';
import { useGiftShopRefresh } from './useGiftShopRefresh';

type GiftShopTabKey = 'orders' | 'catalog' | 'audit';

const GiftShopTab: React.FC = () => {
  const authStore = useAuthStore();
  const store = useGiftShopStore();
  const [activeTab, setActiveTab] = useState<GiftShopTabKey>('orders');
  const filters = useGiftShopFilters({
    username: authStore.username,
    isAdmin: authStore.isAdmin,
    teacherClass: authStore.teacherClass,
  });
  const refreshAll = useGiftShopRefresh({
    isAdmin: authStore.isAdmin,
    query: filters.query,
    loadCatalog: store.loadCatalog,
    loadManagedOrders: store.loadManagedOrders,
    loadEventLogs: store.loadEventLogs,
  });
  const catalogEditor = useGiftCatalogEditor({
    actor: filters.actor,
    saveCatalogItem: store.saveCatalogItem,
    removeCatalogItem: store.removeCatalogItem,
  });
  const orderActions = useGiftOrderActions({
    actor: filters.actor,
    query: filters.query,
    deliverOrder: store.deliverOrder,
    cancelOrder: store.cancelOrder,
  });

  const metrics = useMemo(() => {
    const today = new Date().toDateString();
    return {
      pending: store.managedOrders.filter(order => order.status === 'VOUCHER_ISSUED').length,
      deliveredToday: store.managedOrders.filter(order => (
        order.status === 'DELIVERED'
        && new Date(order.deliveredAt || order.updatedAt).toDateString() === today
      )).length,
      refunded: store.managedOrders.filter(order => order.status === 'CANCELLED_REFUNDED').length,
      activeGifts: store.catalog.filter(item => item.isActive).length,
    };
  }, [store.managedOrders, store.catalog]);

  const metricCards = [
    { label: 'Chờ trao quà', value: metrics.pending, note: 'Cần giáo viên xử lý', icon: ShoppingBag, className: 'border-amber-200 bg-amber-50 text-amber-900' },
    { label: 'Đã trao hôm nay', value: metrics.deliveredToday, note: 'Tính theo thiết bị hiện tại', icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { label: 'Đã hoàn xu', value: metrics.refunded, note: 'Theo bộ lọc hiện tại', icon: RotateCcw, className: 'border-rose-200 bg-rose-50 text-rose-900' },
    { label: 'Quà đang hoạt động', value: metrics.activeGifts, note: 'Đang hiển thị cho học sinh', icon: Gift, className: 'border-sky-200 bg-sky-50 text-sky-900' },
  ];

  const tabs: Array<{ key: GiftShopTabKey; label: string; badge?: number }> = authStore.isAdmin
    ? [
      { key: 'orders', label: 'Đơn đổi quà', badge: metrics.pending },
      { key: 'catalog', label: 'Kho quà' },
      { key: 'audit', label: 'Nhật ký' },
    ]
    : [{ key: 'orders', label: 'Đơn đổi quà', badge: metrics.pending }];

  return (
    <div className="space-y-5">
      <GiftShopHeader
        isAdmin={authStore.isAdmin}
        isLoading={store.isLoading}
        onRefresh={refreshAll}
        onAddGift={() => setActiveTab('catalog')}
      />

      <GiftShopErrorBanner error={store.error} onClose={store.clearError} onRetry={refreshAll} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Tổng quan tiệm tạp hóa">
        {metricCards.map(({ label, value, note, icon: Icon, className }) => (
          <article key={label} className={`rounded-2xl border p-4 ${className}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{label}</p>
              <Icon className="h-5 w-5 opacity-70" aria-hidden="true" />
            </div>
            <p className="mt-3 text-2xl font-bold">{value.toLocaleString('vi-VN')}</p>
            <p className="mt-1 text-xs opacity-75">{note}</p>
          </article>
        ))}
      </section>

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5" aria-label="Các khu vực tiệm tạp hóa">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            aria-current={activeTab === tab.key ? 'page' : undefined}
            onClick={() => setActiveTab(tab.key)}
            className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 ${
              activeTab === tab.key
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {tab.label}
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {activeTab === 'orders' && (
        <GiftOrdersSection
          isAdmin={authStore.isAdmin}
          orders={store.managedOrders}
          isLoading={store.loading.managedOrders}
          pendingAction={store.pendingAction}
          filters={filters}
          onDeliver={orderActions.deliver}
          onCancel={orderActions.cancel}
        />
      )}
      {authStore.isAdmin && activeTab === 'catalog' && (
        <GiftCatalogAdminSection catalog={store.catalog} editor={catalogEditor} />
      )}
      {authStore.isAdmin && activeTab === 'audit' && (
        <GiftShopAuditSection events={store.eventLogs} />
      )}
    </div>
  );
};

export default GiftShopTab;
