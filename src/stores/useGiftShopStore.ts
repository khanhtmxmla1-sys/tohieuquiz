import { create } from 'zustand';
import { useGamificationStore } from './useGamificationStore';
import { useClassroomStore } from './useClassroomStore';
import {
    giftShopService,
    GiftCatalogDeleteInput,
    GiftCatalogUpsertInput,
} from '../services/giftShop.service';
import type {
    GiftCatalogItem,
    GiftOrder,
    GiftOrderActor,
    GiftOrderQuery,
    GiftPurchaseResponse,
    GiftShopEventLog,
    GiftShopSettingsResponse,
    GiftShopSettingsUpdate,
} from '../types/giftShop.types';

interface PurchaseArgs {
    studentId: string;
    studentName: string;
    studentUsername: string;
    classId: string;
    className?: string;
    itemId: string;
    currentCoins: number;
    idempotencyKey: string;
}

type LoadingArea = 'catalog' | 'studentOrders' | 'managedOrders' | 'events' | 'action';
type ErrorArea = LoadingArea;

export interface GiftShopLoadingState {
    catalog: boolean;
    studentOrders: boolean;
    managedOrders: boolean;
    events: boolean;
    action: boolean;
}

export interface GiftShopErrorState {
    catalog: string | null;
    studentOrders: string | null;
    managedOrders: string | null;
    events: string | null;
    action: string | null;
}

export interface GiftShopPendingAction {
    type: 'purchase' | 'approve' | 'deliver' | 'cancel' | 'save-catalog' | 'delete-catalog' | 'settings';
    targetId?: string;
}

interface GiftShopStore {
    catalog: GiftCatalogItem[];
    myOrders: GiftOrder[];
    managedOrders: GiftOrder[];
    eventLogs: GiftShopEventLog[];
    shopSettings: GiftShopSettingsResponse | null;
    loading: GiftShopLoadingState;
    errors: GiftShopErrorState;
    isLoading: boolean;
    error: string | null;
    pendingAction: GiftShopPendingAction | null;
    lastPurchase: GiftPurchaseResponse | null;

    loadCatalog: () => Promise<void>;
    loadStudentOrders: (studentId: string) => Promise<void>;
    loadManagedOrders: (query: GiftOrderQuery) => Promise<void>;
    loadEventLogs: () => Promise<void>;
    loadSettings: () => Promise<void>;
    purchaseGift: (args: PurchaseArgs) => Promise<GiftPurchaseResponse | null>;
    approveOrder: (orderId: string, actor: GiftOrderActor, queryAfter?: GiftOrderQuery) => Promise<boolean>;
    deliverOrder: (orderId: string, actor: GiftOrderActor, queryAfter?: GiftOrderQuery) => Promise<boolean>;
    cancelOrder: (orderId: string, actor: GiftOrderActor, reason: string, queryAfter?: GiftOrderQuery) => Promise<boolean>;
    saveCatalogItem: (input: GiftCatalogUpsertInput) => Promise<GiftCatalogItem | null>;
    removeCatalogItem: (input: GiftCatalogDeleteInput) => Promise<boolean>;
    updateSettings: (input: GiftShopSettingsUpdate) => Promise<boolean>;
    clearLastPurchase: () => void;
    clearError: () => void;
}

const EMPTY_LOADING: GiftShopLoadingState = {
    catalog: false,
    studentOrders: false,
    managedOrders: false,
    events: false,
    action: false,
};

const EMPTY_ERRORS: GiftShopErrorState = {
    catalog: null,
    studentOrders: null,
    managedOrders: null,
    events: null,
    action: null,
};

type StoreSetter = (
    partial: Partial<GiftShopStore> | ((state: GiftShopStore) => Partial<GiftShopStore>)
) => void;

const firstError = (errors: GiftShopErrorState) =>
    errors.action
    || errors.managedOrders
    || errors.studentOrders
    || errors.catalog
    || errors.events
    || null;

const setLoading = (set: StoreSetter, area: LoadingArea, value: boolean) => {
    set((state) => {
        const loading = { ...state.loading, [area]: value };
        return { loading, isLoading: Object.values(loading).some(Boolean) };
    });
};

const setAreaError = (set: StoreSetter, area: ErrorArea, value: string | null) => {
    set((state) => {
        const errors = { ...state.errors, [area]: value };
        return { errors, error: firstError(errors) };
    });
};

const startAction = (set: StoreSetter, pendingAction: GiftShopPendingAction) => {
    set({ pendingAction });
    setAreaError(set, 'action', null);
    setLoading(set, 'action', true);
};

const finishAction = (set: StoreSetter) => {
    set({ pendingAction: null });
    setLoading(set, 'action', false);
};

const syncGamificationCoins = (coins: number) => {
    useGamificationStore.setState((state) => ({
        ...state,
        coins,
    }));
};

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

export const useGiftShopStore = create<GiftShopStore>((set, get) => ({
    catalog: [],
    myOrders: [],
    managedOrders: [],
    eventLogs: [],
    shopSettings: null,
    loading: { ...EMPTY_LOADING },
    errors: { ...EMPTY_ERRORS },
    isLoading: false,
    error: null,
    pendingAction: null,
    lastPurchase: null,

    loadCatalog: async () => {
        setAreaError(set, 'catalog', null);
        setLoading(set, 'catalog', true);
        try {
            const catalog = await giftShopService.getCatalog();
            set({ catalog });
        } catch (error) {
            setAreaError(set, 'catalog', getErrorMessage(error, 'Không thể tải danh mục quà.'));
        } finally {
            setLoading(set, 'catalog', false);
        }
    },

    loadStudentOrders: async (studentId: string) => {
        setAreaError(set, 'studentOrders', null);
        setLoading(set, 'studentOrders', true);
        try {
            const orders = await giftShopService.getOrders({ studentId });
            set({ myOrders: orders });
        } catch (error) {
            setAreaError(set, 'studentOrders', getErrorMessage(error, 'Không thể tải lịch sử đổi quà.'));
        } finally {
            setLoading(set, 'studentOrders', false);
        }
    },

    loadManagedOrders: async (query: GiftOrderQuery) => {
        setAreaError(set, 'managedOrders', null);
        setLoading(set, 'managedOrders', true);
        try {
            const managedOrders = await giftShopService.getOrders(query);
            set({ managedOrders });
        } catch (error) {
            setAreaError(set, 'managedOrders', getErrorMessage(error, 'Không thể tải danh sách đơn quà.'));
        } finally {
            setLoading(set, 'managedOrders', false);
        }
    },

    loadEventLogs: async () => {
        setAreaError(set, 'events', null);
        setLoading(set, 'events', true);
        try {
            const logs = await giftShopService.getEventLogs();
            set({ eventLogs: logs });
        } catch (error) {
            setAreaError(set, 'events', getErrorMessage(error, 'Không thể tải nhật ký giao dịch.'));
        } finally {
            setLoading(set, 'events', false);
        }
    },


    loadSettings: async () => {
        setAreaError(set, 'catalog', null);
        try {
            const shopSettings = await giftShopService.getSettings();
            set({ shopSettings });
        } catch (error) {
            setAreaError(set, 'catalog', getErrorMessage(error, 'Kh?ng th? t?i tr?ng th?i ti?m t?p h?a.'));
        }
    },

    purchaseGift: async (args: PurchaseArgs) => {
        startAction(set, { type: 'purchase', targetId: args.itemId });
        try {
            const result = await giftShopService.purchase({
                studentId: args.studentId,
                studentName: args.studentName,
                studentUsername: args.studentUsername,
                classId: args.classId,
                className: args.className,
                itemId: args.itemId,
                currentCoins: args.currentCoins,
                idempotencyKey: args.idempotencyKey,
            });
            syncGamificationCoins(result.newCoins);
            const [myOrders, catalog] = await Promise.all([
                giftShopService.getOrders({ studentId: args.studentId }),
                giftShopService.getCatalog(),
            ]);
            set({ lastPurchase: result, myOrders, catalog });
            return result;
        } catch (error) {
            setAreaError(set, 'action', getErrorMessage(error, 'Đổi quà thất bại.'));
            return null;
        } finally {
            finishAction(set);
        }
    },


    approveOrder: async (orderId: string, actor: GiftOrderActor, queryAfter?: GiftOrderQuery) => {
        startAction(set, { type: 'approve', targetId: orderId });
        try {
            await giftShopService.approveOrder(orderId, actor);
            const managedOrders = await giftShopService.getOrders(queryAfter || { status: 'PENDING' });
            set({ managedOrders });
            return true;
        } catch (error) {
            setAreaError(set, 'action', getErrorMessage(error, 'Kh?ng th? duy?t ??n ??i qu?.'));
            return false;
        } finally {
            finishAction(set);
        }
    },

    deliverOrder: async (orderId: string, actor: GiftOrderActor, queryAfter?: GiftOrderQuery) => {
        startAction(set, { type: 'deliver', targetId: orderId });
        try {
            await giftShopService.deliverOrder(orderId, actor);
            const query = queryAfter || { status: 'PENDING' };
            const managedOrders = await giftShopService.getOrders(query);
            set({ managedOrders });
            return true;
        } catch (error) {
            setAreaError(set, 'action', getErrorMessage(error, 'Không thể xác nhận trao quà.'));
            return false;
        } finally {
            finishAction(set);
        }
    },

    cancelOrder: async (orderId: string, actor: GiftOrderActor, reason: string, queryAfter?: GiftOrderQuery) => {
        startAction(set, { type: 'cancel', targetId: orderId });
        try {
            const result = await giftShopService.cancelOrder(orderId, actor, reason);
            const query = queryAfter || { status: 'PENDING' };
            const managedOrders = await giftShopService.getOrders(query);
            const activeStudentId = useClassroomStore.getState().studentSession?.studentId;
            const isCurrentStudent = activeStudentId === result.order.studentId;
            const myOrders = isCurrentStudent
                ? await giftShopService.getOrders({ studentId: result.order.studentId })
                : get().myOrders;

            if (isCurrentStudent) syncGamificationCoins(result.newCoins);
            set({ managedOrders, myOrders });
            return true;
        } catch (error) {
            setAreaError(set, 'action', getErrorMessage(error, 'Không thể hủy đơn quà.'));
            return false;
        } finally {
            finishAction(set);
        }
    },

    saveCatalogItem: async (input: GiftCatalogUpsertInput) => {
        startAction(set, { type: 'save-catalog', targetId: input.id });
        try {
            const savedItem = await giftShopService.upsertCatalogItem(input);
            const catalog = await giftShopService.getCatalog();
            set({ catalog });
            return savedItem;
        } catch (error) {
            setAreaError(set, 'action', getErrorMessage(error, 'Không thể lưu danh mục quà.'));
            return null;
        } finally {
            finishAction(set);
        }
    },

    removeCatalogItem: async (input: GiftCatalogDeleteInput) => {
        startAction(set, { type: 'delete-catalog', targetId: input.id });
        try {
            await giftShopService.deleteCatalogItem(input);
            const catalog = await giftShopService.getCatalog();
            set({ catalog });
            return true;
        } catch (error) {
            setAreaError(set, 'action', getErrorMessage(error, 'Không thể xóa vật phẩm.'));
            return false;
        } finally {
            finishAction(set);
        }
    },


    updateSettings: async (input: GiftShopSettingsUpdate) => {
        startAction(set, { type: 'settings' });
        try {
            const shopSettings = await giftShopService.updateSettings(input);
            set({ shopSettings });
            return true;
        } catch (error) {
            setAreaError(set, 'action', getErrorMessage(error, 'Kh?ng th? c?p nh?t tr?ng th?i ti?m.'));
            return false;
        } finally {
            finishAction(set);
        }
    },

    clearLastPurchase: () => set({ lastPurchase: null }),

    clearError: () => set({ errors: { ...EMPTY_ERRORS }, error: null }),
}));
