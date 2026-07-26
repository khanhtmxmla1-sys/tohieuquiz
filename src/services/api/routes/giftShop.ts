import type { RouteRegistry } from '../types';

export const giftShopRoutes: RouteRegistry = {
    get_gift_shop_catalog: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/gift-shop/catalog',
    },
    create_gift_shop_catalog_item: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/gift-shop/catalog',
    },
    update_gift_shop_catalog_item: {
        method: 'PUT',
        auth: 'session',
        path: ({ id }) => `/api/gift-shop/catalog/${encodeURIComponent(id)}`,
    },
    delete_gift_shop_catalog_item: {
        method: 'DELETE',
        auth: 'session',
        path: ({ id }) => `/api/gift-shop/catalog/${encodeURIComponent(id)}`,
        query: ({ actorIsAdmin, actorUsername }) => {
            const q = new URLSearchParams();
            if (typeof actorIsAdmin !== 'undefined') q.append('actorIsAdmin', String(actorIsAdmin));
            if (actorUsername) q.append('actorUsername', String(actorUsername));
            return q;
        },
    },
    purchase_gift_shop_item: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/gift-shop/purchase',
    },
    get_gift_shop_orders: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/gift-shop/orders',
        query: ({ studentId, classId, status, actorUsername, actorTeacherClass, actorIsAdmin }) => {
            const q = new URLSearchParams();
            if (studentId) q.append('studentId', studentId);
            if (classId) q.append('classId', classId);
            if (status) q.append('status', status);
            if (actorUsername) q.append('actorUsername', actorUsername);
            if (actorTeacherClass) q.append('actorTeacherClass', actorTeacherClass);
            if (typeof actorIsAdmin !== 'undefined') q.append('actorIsAdmin', String(actorIsAdmin));
            return q;
        },
    },
    deliver_gift_shop_order: {
        method: 'PATCH',
        auth: 'session',
        path: ({ orderId }) => `/api/gift-shop/orders/${encodeURIComponent(orderId)}/deliver`,
    },
    cancel_gift_shop_order: {
        method: 'PATCH',
        auth: 'session',
        path: ({ orderId }) => `/api/gift-shop/orders/${encodeURIComponent(orderId)}/cancel`,
    },
    get_gift_shop_event_logs: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/gift-shop/events',
    },
};
