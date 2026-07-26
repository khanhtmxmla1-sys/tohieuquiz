import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;

vi.mock('../workers/src/middleware/jwtAuth', () => ({
    verifyJWTMiddleware: vi.fn(async () => currentUser
        ? { user: currentUser }
        : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
    requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
    requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import { handleGiftShopRoutes } from '../workers/src/routes/giftShop';

type Resolver = (sql: string, bindings: unknown[]) => unknown;

class FakeStatement {
    bindings: unknown[] = [];

    constructor(readonly sql: string, readonly db: FakeDatabase) {}

    bind(...values: unknown[]) {
        this.bindings = values;
        return this;
    }

    async first<T>() {
        this.db.executed.push(this);
        return this.db.firstResolver(this.sql, this.bindings) as T;
    }

    async all<T>() {
        this.db.executed.push(this);
        return { results: this.db.allResolver(this.sql, this.bindings) as T[] };
    }

    async run() {
        this.db.executed.push(this);
        return { success: true };
    }
}

class FakeDatabase {
    executed: FakeStatement[] = [];
    batches: FakeStatement[][] = [];

    constructor(
        readonly firstResolver: Resolver = () => null,
        readonly allResolver: Resolver = () => [],
    ) {}

    prepare(sql: string) {
        return new FakeStatement(sql, this);
    }

    async batch(statements: FakeStatement[]) {
        this.batches.push(statements);
        this.executed.push(...statements);
        return statements.map(() => ({ success: true }));
    }
}

const env = (db: FakeDatabase) => ({ DB: db, JWT_SECRET: 'test-secret' } as any);

const request = (path: string, method = 'GET', body?: unknown) => new Request(`https://test${path}`, {
    method,
    headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
});

const catalogRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'gift-1',
    name: 'Pencil',
    category: 'SUPPLY',
    price_coins: 125,
    image_url: 'https://cdn.test/pencil.png',
    is_active: 1,
    created_at: '2026-07-19T00:00:00.000Z',
    updated_at: '2026-07-19T00:00:00.000Z',
    ...overrides,
});

const orderRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'order-1',
    student_id: 'student-1',
    class_id: 'class-3a',
    item_snapshot: JSON.stringify({ id: 'gift-1', name: 'Pencil' }),
    price_coins: 125,
    status: 'VOUCHER_ISSUED',
    voucher_code: 'VCH-TEST-0001',
    created_at: '2026-07-19T00:00:00.000Z',
    updated_at: '2026-07-19T00:00:00.000Z',
    student_name: 'Student One',
    student_username: 'student01',
    class_name: '3A',
    ...overrides,
});

const responseJson = async (response: Response) => await response.json() as any;

beforeEach(() => {
    currentUser = null;
});

describe('Gift Shop worker route contracts', () => {
    it('preserves the legacy route import through a one-line compatibility barrel', async () => {
        const source = await import('../workers/src/routes/giftShop?raw');
        expect(source.default.trim()).toBe("export { handleGiftShopRoutes } from './gift-shop';");
    });

    it('seeds an empty catalog and maps active catalog rows without authentication', async () => {
        const db = new FakeDatabase(
            (sql) => sql.includes('SELECT COUNT(*) AS cnt') ? { cnt: 0 } : null,
            (sql) => sql.includes('FROM gift_catalog_items') ? [catalogRow()] : [],
        );

        const response = await handleGiftShopRoutes(
            new Request('https://test/api/gift-shop/catalog'),
            env(db),
            '/api/gift-shop/catalog',
            'GET',
        );

        expect(response.status).toBe(200);
        expect(await responseJson(response)).toEqual([{
            id: 'gift-1',
            name: 'Pencil',
            category: 'SUPPLY',
            priceCoins: 125,
            imageUrl: 'https://cdn.test/pencil.png',
            isActive: true,
            createdAt: '2026-07-19T00:00:00.000Z',
            updatedAt: '2026-07-19T00:00:00.000Z',
        }]);
        expect(db.batches).toHaveLength(1);
        expect(db.batches[0]).toHaveLength(3);
        expect(db.executed.some((statement) => statement.sql.includes('ORDER BY category ASC, name ASC'))).toBe(true);
    });

    it('requires admin and preserves normalized catalog create bindings and event logging', async () => {
        currentUser = { username: 'admin-1', role: 'admin' };
        const db = new FakeDatabase((sql) => {
            if (sql.includes('SELECT * FROM gift_catalog_items WHERE id = ?')) {
                return catalogRow({ id: 'gift-custom', name: 'Pencil Pro', price_coins: 129 });
            }
            return null;
        });

        const response = await handleGiftShopRoutes(
            request('/api/gift-shop/catalog', 'POST', {
                id: 'gift-custom',
                name: '  Pencil Pro  ',
                category: 'supply',
                priceCoins: 129.9,
                imageUrl: '  https://cdn.test/pro.png  ',
                isActive: '1',
            }),
            env(db),
            '/api/gift-shop/catalog',
            'POST',
        );

        expect(response.status).toBe(200);
        expect((await responseJson(response)).id).toBe('gift-custom');
        const insert = db.executed.find((statement) => statement.sql.includes('INSERT INTO gift_catalog_items'));
        expect(insert?.bindings.slice(0, 6)).toEqual([
            'gift-custom',
            'Pencil Pro',
            'SUPPLY',
            129,
            'https://cdn.test/pro.png',
            1,
        ]);
        const event = db.executed.find((statement) => statement.sql.includes('INSERT INTO gift_order_events'));
        expect(event?.bindings[1]).toBe('CATALOG_CREATED');
        expect(event?.bindings[5]).toBe(JSON.stringify({ itemId: 'gift-custom', priceCoins: 129 }));
    });

    it('forbids non-admin catalog mutation before writing', async () => {
        currentUser = { username: 'teacher-1', role: 'teacher', classId: '3A' };
        const db = new FakeDatabase();

        const response = await handleGiftShopRoutes(
            request('/api/gift-shop/catalog', 'POST', {
                name: 'Pencil', category: 'SUPPLY', priceCoins: 100, imageUrl: 'https://cdn.test/pencil.png',
            }),
            env(db),
            '/api/gift-shop/catalog',
            'POST',
        );

        expect(response.status).toBe(403);
        expect(db.executed).toHaveLength(0);
    });

    it('does not write an update event when the catalog item does not exist', async () => {
        currentUser = { username: 'admin-1', role: 'admin' };
        const db = new FakeDatabase(() => null);

        const response = await handleGiftShopRoutes(
            request('/api/gift-shop/catalog/missing-gift', 'PUT', {
                name: 'Missing gift',
                category: 'SUPPLY',
                priceCoins: 100,
                imageUrl: 'https://cdn.test/missing.png',
                isActive: true,
            }),
            env(db),
            '/api/gift-shop/catalog/missing-gift',
            'PUT',
        );

        expect(response.status).toBe(404);
        expect(db.executed.some((statement) => statement.sql.includes('UPDATE gift_catalog_items'))).toBe(false);
        expect(db.executed.some((statement) => statement.sql.includes('INSERT INTO gift_order_events'))).toBe(false);
    });

    it('scopes teacher order queries by JWT class name and maps order snapshots', async () => {
        currentUser = { username: 'teacher-3a', role: 'teacher', classId: '3A' };
        const db = new FakeDatabase(
            () => null,
            (sql) => sql.includes('FROM gift_orders o') ? [orderRow()] : [],
        );

        const response = await handleGiftShopRoutes(
            request('/api/gift-shop/orders?classId=ignored&status=voucher_issued'),
            env(db),
            '/api/gift-shop/orders',
            'GET',
        );

        expect(response.status).toBe(200);
        const payload = await responseJson(response);
        expect(payload[0]).toMatchObject({
            id: 'order-1',
            studentId: 'student-1',
            classId: 'class-3a',
            className: '3A',
            status: 'VOUCHER_ISSUED',
            itemSnapshot: { id: 'gift-1', name: 'Pencil' },
        });
        const query = db.executed.find((statement) => statement.sql.includes('FROM gift_orders o'));
        expect(query?.sql).toContain('(o.class_id = ? OR c.name = ?)');
        expect(query?.bindings).toEqual(['3A', '3A', 'VOUCHER_ISSUED']);
    });

    it('allows student self-history but forbids purchasing for another student', async () => {
        currentUser = { id: 'student-1', username: 'student01', role: 'student', classId: 'class-3a' };
        const db = new FakeDatabase(
            () => null,
            (sql) => sql.includes('FROM gift_orders o') ? [] : [],
        );

        const historyResponse = await handleGiftShopRoutes(
            request('/api/gift-shop/orders?studentId=student-1'),
            env(db),
            '/api/gift-shop/orders',
            'GET',
        );
        expect(historyResponse.status).toBe(200);
        const historyQuery = db.executed.find((statement) => statement.sql.includes('FROM gift_orders o'));
        expect(historyQuery?.bindings).toEqual(['student-1']);

        const otherStudentHistory = await handleGiftShopRoutes(
            request('/api/gift-shop/orders?studentId=student-2'),
            env(db),
            '/api/gift-shop/orders',
            'GET',
        );
        expect(otherStudentHistory.status).toBe(403);

        const purchaseResponse = await handleGiftShopRoutes(
            request('/api/gift-shop/purchase', 'POST', {
                studentId: 'student-2', itemId: 'gift-1', idempotencyKey: 'idem-1',
            }),
            env(db),
            '/api/gift-shop/purchase',
            'POST',
        );
        expect(purchaseResponse.status).toBe(403);
    });

    it('prevents teachers from purchasing for students outside their assigned class', async () => {
        currentUser = { username: 'teacher-3a', role: 'teacher', classId: '3A' };
        const db = new FakeDatabase((sql) => {
            if (sql.includes('FROM students s')) {
                return {
                    id: 'student-2', full_name: 'Student Two', username: 'student02',
                    class_id: 'class-4b', class_name: '4B', coins: 500,
                };
            }
            return null;
        });

        const response = await handleGiftShopRoutes(
            request('/api/gift-shop/purchase', 'POST', {
                studentId: 'student-2', itemId: 'gift-1', idempotencyKey: 'idem-cross-class',
            }),
            env(db),
            '/api/gift-shop/purchase',
            'POST',
        );

        expect(response.status).toBe(403);
        expect(db.batches).toHaveLength(0);
        expect(db.executed.some((statement) => statement.sql.includes('gift_catalog_items'))).toBe(false);
    });

    it('replays an existing purchase idempotently without executing a batch', async () => {
        currentUser = { id: 'student-1', username: 'student01', role: 'student', classId: 'class-3a' };
        const db = new FakeDatabase((sql) => {
            if (sql.includes('FROM students s')) {
                return { id: 'student-1', full_name: 'Student One', username: 'student01', class_id: 'class-3a', class_name: '3A', coins: 375 };
            }
            if (sql.includes('WHERE o.idempotency_key = ?')) return orderRow();
            if (sql.includes('SELECT coins FROM students')) return { coins: 375 };
            return null;
        });

        const response = await handleGiftShopRoutes(
            request('/api/gift-shop/purchase', 'POST', {
                studentId: 'student-1', itemId: 'gift-1', idempotencyKey: 'idem-1',
            }),
            env(db),
            '/api/gift-shop/purchase',
            'POST',
        );

        expect(response.status).toBe(200);
        expect(await responseJson(response)).toMatchObject({
            orderId: 'order-1',
            voucherCode: 'VCH-TEST-0001',
            newCoins: 375,
            status: 'VOUCHER_ISSUED',
            idempotencyReplay: true,
        });
        expect(db.batches).toHaveLength(0);
    });

    it('creates a purchase atomically with wallet, voucher, ledger, and two events', async () => {
        currentUser = { id: 'student-1', username: 'student01', role: 'student', classId: 'class-3a' };
        let db: FakeDatabase;
        db = new FakeDatabase((sql, bindings) => {
            if (sql.includes('WHERE o.idempotency_key = ?')) return null;
            if (sql.includes('FROM gift_catalog_items') && sql.includes('is_active = 1')) return catalogRow();
            if (sql.includes('FROM students s')) {
                return { id: 'student-1', full_name: 'Student One', username: 'student01', class_id: 'class-3a', class_name: '3A', coins: 500 };
            }
            if (sql.includes('WHERE o.id = ?')) return orderRow({ id: String(bindings[0]) });
            if (sql.includes('SELECT coins FROM students')) return { coins: 375 };
            return null;
        });

        const response = await handleGiftShopRoutes(
            request('/api/gift-shop/purchase', 'POST', {
                studentId: 'student-1', itemId: 'gift-1', idempotencyKey: 'idem-new',
            }),
            env(db),
            '/api/gift-shop/purchase',
            'POST',
        );

        expect(response.status).toBe(200);
        expect(await responseJson(response)).toMatchObject({
            newCoins: 375,
            status: 'VOUCHER_ISSUED',
            idempotencyReplay: false,
        });
        expect(db.batches).toHaveLength(1);
        expect(db.batches[0]).toHaveLength(6);
        const sql = db.batches[0].map((statement) => statement.sql).join('\n');
        expect(sql).toContain('UPDATE students SET coins = coins - ?');
        expect(sql).toContain('INSERT INTO gift_orders');
        expect(sql).toContain('INSERT INTO gift_vouchers');
        expect(sql).toContain("'PURCHASE'");
        expect(sql).toContain("'ORDER_CREATED'");
        expect(sql).toContain("'VOUCHER_ISSUED'");
    });

    it('delivers an issued order with teacher class access and updates voucher and audit event', async () => {
        currentUser = { username: 'teacher-3a', role: 'teacher', classId: '3A' };
        let db: FakeDatabase;
        db = new FakeDatabase((sql) => {
            if (sql.includes('FROM gift_orders o') && sql.includes('WHERE o.id = ?')) {
                return db.batches.length === 0
                    ? orderRow()
                    : orderRow({ status: 'DELIVERED', delivered_by: 'teacher-3a' });
            }
            return null;
        });

        const response = await handleGiftShopRoutes(
            request('/api/gift-shop/orders/order-1/deliver', 'PATCH', {}),
            env(db),
            '/api/gift-shop/orders/order-1/deliver',
            'PATCH',
        );

        expect(response.status).toBe(200);
        expect(await responseJson(response)).toMatchObject({ status: 'DELIVERED', deliveredBy: 'teacher-3a' });
        expect(db.batches[0]).toHaveLength(3);
        const sql = db.batches[0].map((statement) => statement.sql).join('\n');
        expect(sql).toContain("status = 'DELIVERED'");
        expect(sql).toContain("status = 'USED'");
        expect(sql).toContain("'ORDER_DELIVERED'");
    });

    it('cancels and refunds an issued order in one batch with ledger and two events', async () => {
        currentUser = { username: 'admin-1', role: 'admin' };
        let db: FakeDatabase;
        db = new FakeDatabase((sql) => {
            if (sql.includes('FROM gift_orders o') && sql.includes('WHERE o.id = ?')) {
                return db.batches.length === 0
                    ? orderRow()
                    : orderRow({ status: 'CANCELLED_REFUNDED', cancel_reason: 'Manual cancel' });
            }
            if (sql.includes('SELECT coins FROM students')) return { coins: 500 };
            return null;
        });

        const response = await handleGiftShopRoutes(
            request('/api/gift-shop/orders/order-1/cancel', 'PATCH', { reason: 'Manual cancel' }),
            env(db),
            '/api/gift-shop/orders/order-1/cancel',
            'PATCH',
        );

        expect(response.status).toBe(200);
        expect(await responseJson(response)).toMatchObject({
            order: { status: 'CANCELLED_REFUNDED', cancelReason: 'Manual cancel' },
            newCoins: 500,
        });
        expect(db.batches[0]).toHaveLength(6);
        const sql = db.batches[0].map((statement) => statement.sql).join('\n');
        expect(sql).toContain('UPDATE students SET coins = coins + ?');
        expect(sql).toContain("status = 'CANCELLED_REFUNDED'");
        expect(sql).toContain("status = 'CANCELLED'");
        expect(sql).toContain("'REFUND'");
        expect(sql).toContain("'ORDER_CANCELLED'");
        expect(sql).toContain("'WALLET_REFUNDED'");
    });

    it('restricts event logs to admins and maps metadata JSON', async () => {
        currentUser = { username: 'admin-1', role: 'admin' };
        const db = new FakeDatabase(
            () => null,
            (sql) => sql.includes('FROM gift_order_events') ? [{
                id: 'event-1',
                event_type: 'ORDER_CREATED',
                order_id: 'order-1',
                student_id: 'student-1',
                actor: 'student01',
                created_at: '2026-07-19T00:00:00.000Z',
                metadata: JSON.stringify({ itemId: 'gift-1' }),
            }] : [],
        );

        const response = await handleGiftShopRoutes(
            request('/api/gift-shop/events'),
            env(db),
            '/api/gift-shop/events',
            'GET',
        );

        expect(response.status).toBe(200);
        expect(await responseJson(response)).toEqual([{
            id: 'event-1',
            type: 'ORDER_CREATED',
            orderId: 'order-1',
            studentId: 'student-1',
            actor: 'student01',
            createdAt: '2026-07-19T00:00:00.000Z',
            metadata: { itemId: 'gift-1' },
        }]);

        currentUser = { username: 'teacher-1', role: 'teacher', classId: '3A' };
        const forbidden = await handleGiftShopRoutes(
            request('/api/gift-shop/events'),
            env(new FakeDatabase()),
            '/api/gift-shop/events',
            'GET',
        );
        expect(forbidden.status).toBe(403);
    });

    it('returns the existing 404 error contract for unknown Gift Shop paths', async () => {
        const response = await handleGiftShopRoutes(
            new Request('https://test/api/gift-shop/unknown'),
            env(new FakeDatabase()),
            '/api/gift-shop/unknown',
            'GET',
        );

        expect(response.status).toBe(404);
        expect(await responseJson(response)).toEqual({
            status: 'error',
            message: 'Not found: /api/gift-shop/unknown',
        });
    });
});
