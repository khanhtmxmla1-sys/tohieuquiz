import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Check,
    Clipboard,
    Cookie,
    Gift,
    Loader2,
    PackageCheck,
    PencilRuler,
    Receipt,
    Search,
    Sparkles,
    Star,
    X,
} from 'lucide-react';
import { useQuizStore } from '../../../stores/quizStore';
import { useClassroomStore } from '../../stores/useClassroomStore';
import { useGamificationStore } from '../../stores/useGamificationStore';
import { useGiftShopStore } from '../../stores/useGiftShopStore';
import type { GiftCatalogItem, GiftCategory, GiftOrder, GiftOrderStatus } from '../../types/giftShop.types';

const CATEGORY_META: Record<GiftCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    SNACK: { label: 'Ăn vặt', icon: Cookie },
    SUPPLY: { label: 'Đồ dùng học tập', icon: PencilRuler },
    PRIVILEGE: { label: 'Đặc quyền lớp', icon: Star },
};

const ORDER_STATUS: Record<GiftOrderStatus, { label: string; className: string }> = {
    CREATED: { label: 'Đang tạo đơn', className: 'border-slate-200 bg-slate-50 text-slate-700' },
    VOUCHER_ISSUED: { label: 'Chờ giáo viên trao', className: 'border-amber-200 bg-amber-50 text-amber-800' },
    DELIVERED: { label: 'Đã nhận', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
    CANCELLED_REFUNDED: { label: 'Đã hủy và hoàn xu', className: 'border-rose-200 bg-rose-50 text-rose-800' },
};

const randomKey = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const GiftImage = ({ item, className = '' }: { item: GiftCatalogItem; className?: string }) => {
    const [failed, setFailed] = useState(false);
    return (
        <div className={`relative flex items-center justify-center overflow-hidden bg-slate-50 text-slate-300 ${className}`}>
            <Gift className="h-10 w-10" aria-hidden="true" />
            {!failed && item.imageUrl && (
                <img
                    src={item.imageUrl}
                    alt={item.name}
                    onError={() => setFailed(true)}
                    className="absolute inset-0 h-full w-full bg-white object-contain p-3"
                />
            )}
        </div>
    );
};

const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
    });
};

const OrderCard = ({ order, copiedCode, onCopy }: {
    order: GiftOrder;
    copiedCode: string | null;
    onCopy: (code: string) => Promise<void>;
}) => (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <h3 className="line-clamp-2 font-semibold text-slate-900">{order.itemSnapshot.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{formatDate(order.createdAt)}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${ORDER_STATUS[order.status].className}`}>
                {ORDER_STATUS[order.status].label}
            </span>
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Mã nhận quà</p>
            <div className="mt-1 flex items-center justify-between gap-2">
                <code className="font-bold tracking-wider text-slate-900">{order.voucherCode}</code>
                <button
                    type="button"
                    onClick={() => void onCopy(order.voucherCode)}
                    aria-label={`Sao chép mã ${order.voucherCode}`}
                    className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                    {copiedCode === order.voucherCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Clipboard className="h-4 w-4" />}
                </button>
            </div>
        </div>
    </article>
);

const GiftShop: React.FC = () => {
    const goHome = useQuizStore().goHome;
    const { studentSession } = useClassroomStore();
    const coins = useGamificationStore((state) => state.coins);
    const {
        catalog,
        myOrders,
        loading,
        error,
        pendingAction,
        lastPurchase,
        loadCatalog,
        loadStudentOrders,
        purchaseGift,
        clearError,
        clearLastPurchase,
    } = useGiftShopStore();

    const [activeCategory, setActiveCategory] = useState<GiftCategory>('SNACK');
    const [mobileView, setMobileView] = useState<'store' | 'orders'>('store');
    const [searchTerm, setSearchTerm] = useState('');
    const [affordableOnly, setAffordableOnly] = useState(false);
    const [selectedItem, setSelectedItem] = useState<GiftCatalogItem | null>(null);
    const [purchaseKey, setPurchaseKey] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [clipboardError, setClipboardError] = useState(false);

    useEffect(() => {
        if (!studentSession) return;
        void Promise.all([
            loadCatalog(),
            loadStudentOrders(studentSession.studentId),
        ]);
    }, [studentSession?.studentId, loadCatalog, loadStudentOrders]);

    useEffect(() => {
        if (!selectedItem && !lastPurchase) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || loading.action) return;
            if (lastPurchase) clearLastPurchase();
            else {
                setSelectedItem(null);
                setPurchaseKey(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItem, lastPurchase, loading.action, clearLastPurchase]);

    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('vi');
    const categoryItems = useMemo(
        () => catalog.filter((item) => (
            item.category === activeCategory
            && item.isActive
            && (!affordableOnly || coins >= item.priceCoins)
            && (!normalizedSearch || item.name.toLocaleLowerCase('vi').includes(normalizedSearch))
        )),
        [catalog, activeCategory, affordableOnly, coins, normalizedSearch]
    );

    const nearestGoal = useMemo(() => catalog
        .filter((item) => item.isActive && item.priceCoins > coins)
        .sort((a, b) => a.priceCoins - b.priceCoins)[0], [catalog, coins]);
    const goalProgress = nearestGoal ? Math.min(100, Math.round((coins / nearestGoal.priceCoins) * 100)) : 100;

    const closePurchaseModal = () => {
        if (loading.action) return;
        setSelectedItem(null);
        setPurchaseKey(null);
    };

    const handleConfirmPurchase = async () => {
        if (!selectedItem || !studentSession) return;
        const idempotencyKey = purchaseKey || randomKey();
        setPurchaseKey(idempotencyKey);

        const result = await purchaseGift({
            studentId: studentSession.studentId,
            studentName: studentSession.fullName,
            studentUsername: studentSession.username,
            classId: studentSession.classId,
            className: studentSession.className,
            itemId: selectedItem.id,
            currentCoins: coins,
            idempotencyKey,
        });

        if (result) closePurchaseModal();
    };

    const handleCopyVoucher = async (code: string) => {
        setClipboardError(false);
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCode(code);
            window.setTimeout(() => setCopiedCode(null), 1400);
        } catch {
            setClipboardError(true);
        }
    };

    const retry = async () => {
        if (!studentSession) return;
        clearError();
        await Promise.all([loadCatalog(), loadStudentOrders(studentSession.studentId)]);
    };

    if (!studentSession) {
        return (
            <div className="min-h-screen bg-[#fffdf7] flex items-center justify-center p-6">
                <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
                    <p className="font-semibold text-slate-700">Không tìm thấy phiên đăng nhập học sinh.</p>
                    <button onClick={goHome} className="mt-4 min-h-11 rounded-xl bg-sky-600 px-4 py-2 font-semibold text-white">Về trang chủ</button>
                </div>
            </div>
        );
    }

    const isPurchasing = pendingAction?.type === 'purchase';

    return (
        <div className="min-h-screen bg-[#fffdf7] text-slate-800">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
                <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
                    <button
                        type="button"
                        onClick={goHome}
                        className="min-h-11 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Quay lại trang học tập</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <Gift className="h-5 w-5 text-sky-600" aria-hidden="true" />
                        <h1 className="text-base font-bold text-slate-900 sm:text-lg">Tiệm tạp hóa</h1>
                    </div>
                    <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2">
                        <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
                        <span className="text-sm font-bold text-amber-800">{coins.toLocaleString('vi-VN')} xu</span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
                <section className="rounded-2xl border border-sky-100 bg-white p-5 md:p-6">
                    <div className="grid gap-5 md:grid-cols-[1fr_360px] md:items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">Đổi xu lấy phần thưởng</h2>
                            <p className="mt-2 max-w-2xl text-slate-600">Chọn món quà em thích và đưa mã nhận quà cho giáo viên.</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                            {nearestGoal ? (
                                <>
                                    <p className="text-sm font-semibold text-slate-800">Cần thêm {(nearestGoal.priceCoins - coins).toLocaleString('vi-VN')} xu để đổi {nearestGoal.name}</p>
                                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" aria-label={`Tiến độ ${goalProgress}%`}>
                                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${goalProgress}%` }} />
                                    </div>
                                    <button type="button" onClick={goHome} className="mt-3 min-h-11 text-sm font-semibold text-sky-700 hover:underline focus:outline-none focus:ring-2 focus:ring-sky-500">Cách kiếm thêm xu</button>
                                </>
                            ) : (
                                <p className="text-sm font-semibold text-emerald-700">Em đã đủ xu để chọn mọi phần thưởng đang có.</p>
                            )}
                        </div>
                    </div>
                </section>

                <div className="mt-4 grid grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1 lg:hidden">
                    <button type="button" onClick={() => setMobileView('store')} className={`min-h-11 rounded-xl text-sm font-semibold ${mobileView === 'store' ? 'bg-sky-600 text-white' : 'text-slate-600'}`}>Cửa hàng</button>
                    <button type="button" onClick={() => setMobileView('orders')} className={`min-h-11 rounded-xl text-sm font-semibold ${mobileView === 'orders' ? 'bg-sky-600 text-white' : 'text-slate-600'}`}>Đơn của em ({myOrders.length})</button>
                </div>

                {error && (
                    <div role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
                        <p className="font-semibold">Lỗi tải dữ liệu</p>
                        <p className="mt-1 text-sm">{error}</p>
                        <button type="button" onClick={() => void retry()} className="mt-3 min-h-11 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold">Thử lại</button>
                    </div>
                )}

                <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
                    <section className={`${mobileView === 'orders' ? 'hidden lg:block' : 'block'} rounded-2xl border border-slate-200 bg-white p-4 md:p-5`}>
                        <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Danh mục phần thưởng">
                            {(Object.keys(CATEGORY_META) as GiftCategory[]).map((category) => {
                                const Icon = CATEGORY_META[category].icon;
                                const selected = activeCategory === category;
                                return (
                                    <button
                                        key={category}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => setActiveCategory(category)}
                                        className={`min-h-11 shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 ${selected ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                        {CATEGORY_META[category].label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                            <label className="relative">
                                <span className="sr-only">Tìm phần thưởng</span>
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm phần thưởng…" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
                            </label>
                            <button type="button" aria-pressed={affordableOnly} onClick={() => setAffordableOnly(value => !value)} className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 ${affordableOnly ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700'}`}>Đủ xu để đổi</button>
                        </div>

                        <div className="mt-4">
                            {loading.catalog && catalog.length === 0 ? (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="status" aria-label="Đang tải phần thưởng">
                                    {[0, 1, 2, 3, 4, 5].map(item => <div key={item} className="animate-pulse rounded-2xl border border-slate-200 p-3"><div className="aspect-square rounded-xl bg-slate-100" /><div className="mt-3 h-4 rounded bg-slate-200" /><div className="mt-3 h-11 rounded-xl bg-slate-200" /></div>)}
                                </div>
                            ) : categoryItems.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
                                    <Gift className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
                                    <p className="mt-3 font-semibold text-slate-800">Chưa có phần thưởng phù hợp</p>
                                    <p className="mt-1 text-sm text-slate-500">Thử đổi danh mục hoặc bỏ bộ lọc đủ xu.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    {categoryItems.map((item) => {
                                        const canBuy = coins >= item.priceCoins;
                                        const missingCoins = Math.max(0, item.priceCoins - coins);
                                        return (
                                            <article key={item.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3">
                                                <GiftImage item={item} className="aspect-square rounded-xl" />
                                                <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold text-slate-900 sm:text-base">{item.name}</h3>
                                                <p className="mt-1 font-bold text-amber-700">{item.priceCoins.toLocaleString('vi-VN')} xu</p>
                                                <p className={`mt-2 text-xs font-semibold ${canBuy ? 'text-emerald-700' : 'text-slate-500'}`}>{canBuy ? '✓ Đủ xu' : `Cần thêm ${missingCoins.toLocaleString('vi-VN')} xu`}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => { setPurchaseKey(null); setSelectedItem(item); }}
                                                    disabled={!canBuy || isPurchasing}
                                                    className={`mt-3 min-h-11 w-full rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 ${canBuy ? 'bg-sky-600 text-white hover:bg-sky-700' : 'cursor-not-allowed bg-slate-100 text-slate-500'}`}
                                                >
                                                    {canBuy ? 'Đổi quà' : 'Chưa đủ xu'}
                                                </button>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className={`${mobileView === 'store' ? 'hidden lg:block' : 'block'} space-y-4`}>
                        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
                            <div className="flex items-center gap-2">
                                <Receipt className="h-5 w-5 text-slate-500" aria-hidden="true" />
                                <h2 className="font-bold text-slate-900">Đơn đổi quà của em</h2>
                            </div>
                            <div className="mt-4 space-y-3">
                                {loading.studentOrders && myOrders.length === 0 ? (
                                    [0, 1].map(item => <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)
                                ) : myOrders.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-300 py-9 text-center">
                                        <PackageCheck className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
                                        <p className="mt-2 text-sm font-semibold text-slate-700">Em chưa có đơn nào</p>
                                    </div>
                                ) : myOrders.map(order => <OrderCard key={order.id} order={order} copiedCode={copiedCode} onCopy={handleCopyVoucher} />)}
                            </div>
                            {clipboardError && <p role="status" className="mt-3 text-sm text-rose-700">Không thể sao chép tự động. Em hãy ghi lại mã nhận quà.</p>}
                        </section>
                        <section className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                            <h2 className="font-bold text-sky-900">Cách nhận quà</h2>
                            <ol className="mt-3 space-y-3 text-sm text-sky-950">
                                {['Chọn và xác nhận đổi quà', 'Nhận mã xác nhận', 'Đưa mã cho giáo viên'].map((step, index) => (
                                    <li key={step} className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white font-bold text-sky-700">{index + 1}</span>{step}</li>
                                ))}
                            </ol>
                        </section>
                    </aside>
                </div>
            </main>

            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="purchase-dialog-title">
                    <div className="w-full rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-2xl">
                        <div className="flex items-start justify-between gap-3">
                            <div><h2 id="purchase-dialog-title" className="text-lg font-bold text-slate-900">Xác nhận đổi quà</h2><p className="mt-1 text-sm text-slate-500">Kiểm tra số xu trước khi xác nhận.</p></div>
                            <button type="button" onClick={closePurchaseModal} aria-label="Đóng" className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="mt-4 flex gap-3"><GiftImage item={selectedItem} className="h-20 w-20 shrink-0 rounded-xl" /><div><p className="font-semibold text-slate-900">{selectedItem.name}</p><p className="mt-1 font-bold text-amber-700">{selectedItem.priceCoins.toLocaleString('vi-VN')} xu</p></div></div>
                        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm"><div><dt className="text-slate-500">Xu hiện tại</dt><dd className="mt-1 font-bold text-slate-900">{coins.toLocaleString('vi-VN')} xu</dd></div><div><dt className="text-slate-500">Xu sau khi đổi</dt><dd className="mt-1 font-bold text-slate-900">{Math.max(0, coins - selectedItem.priceCoins).toLocaleString('vi-VN')} xu</dd></div></dl>
                        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Không thể hoàn tác sau khi giáo viên đã trao quà.</p>
                        <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={closePurchaseModal} className="min-h-11 rounded-xl border border-slate-200 font-semibold text-slate-700">Quay lại</button><button type="button" autoFocus onClick={() => void handleConfirmPurchase()} disabled={isPurchasing} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 font-semibold text-white disabled:opacity-60">{isPurchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Xác nhận đổi quà</button></div>
                    </div>
                </div>
            )}

            {lastPurchase && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="success-dialog-title">
                    <div className="w-full rounded-t-3xl bg-white p-6 text-center sm:max-w-md sm:rounded-2xl">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-6 w-6" /></div>
                        <h2 id="success-dialog-title" className="mt-3 text-xl font-bold text-slate-900">Đổi quà thành công</h2>
                        <p className="mt-1 text-sm text-slate-600">Đưa mã này cho giáo viên để nhận quà.</p>
                        <code className="mt-4 block rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-xl font-bold tracking-widest text-sky-900">{lastPurchase.voucherCode}</code>
                        <button type="button" onClick={() => void handleCopyVoucher(lastPurchase.voucherCode)} className="mt-3 min-h-11 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 font-semibold text-slate-700"><Clipboard className="h-4 w-4" />{copiedCode === lastPurchase.voucherCode ? 'Đã sao chép' : 'Sao chép mã'}</button>
                        <button type="button" onClick={() => { clearLastPurchase(); setMobileView('orders'); }} className="mt-2 min-h-11 w-full rounded-xl bg-sky-600 font-semibold text-white">Xem đơn của em</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GiftShop;
