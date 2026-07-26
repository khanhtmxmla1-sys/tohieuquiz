import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload;

vi.mock('../workers/src/utils/ogImage', () => ({
  renderOgPng: vi.fn(async () => new Uint8Array()),
}));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import {
  handleDeactivatePublicPhieuLink,
  handleGetPhieuBySubmission,
  handlePhieuRoutes,
  handlePhieuSubdomain,
  handlePublicPhieuApi,
  handlePublishPhieuBatch,
  handleUpsertPhieu,
} from '../workers/src/routes/phieu';

class Statement {
  bindings: unknown[] = [];

  constructor(readonly sql: string) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    if (this.sql.includes('FROM results r') && this.sql.includes('JOIN classes c')) {
      return {
        result_id: '42',
        student_id: 'student-42',
        student_name: 'Học sinh thật',
        class_id: 'class-5a',
        teacher_username: 'teacher-a',
        mon_hoc: 'Toán',
        ten_bai_tap: 'Phân số',
        ngay_lam_bai: '2026-07-15T10:00:00.000Z',
        tong_cau: 20,
        so_cau_dung: 16,
        so_cau_sai: 4,
        diem_so: 8,
      } as T;
    }
    if (this.sql.includes('WHERE submission_id IN (?, ?)')) return null as T;
    return null as T;
  }

  async run() {
    return { success: true, meta: { changes: 1 } };
  }
}

class Database {
  prepare(sql: string) {
    return new Statement(sql);
  }
}

const createEnv = () => ({
  DB: new Database(),
  JWT_SECRET: 'test-secret',
  OG_IMAGES: {
    get: vi.fn(async () => null),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  },
} as any);

const teacherRequest = (path: string, method = 'GET') => new Request(`https://test${path}`, {
  method,
  headers: { Authorization: 'Bearer test-token' },
});

describe('phieu route contracts', () => {
  beforeEach(() => {
    currentUser = { username: 'teacher-a', role: 'teacher' } as JWTPayload;
  });

  it('keeps all public route and mutation exports available', () => {
    expect(typeof handlePhieuRoutes).toBe('function');
    expect(handlePhieuRoutes.length).toBe(4);
    expect(typeof handlePhieuSubdomain).toBe('function');
    expect(typeof handlePublicPhieuApi).toBe('function');
    expect(typeof handleUpsertPhieu).toBe('function');
    expect(typeof handleGetPhieuBySubmission).toBe('function');
    expect(typeof handlePublishPhieuBatch).toBe('function');
    expect(typeof handleDeactivatePublicPhieuLink).toBe('function');
  });

  it('preserves subdomain and public API fallthrough behavior', async () => {
    const env = createEnv();
    expect(await handlePhieuSubdomain(new Request('https://www.thtohieu.com/p/token'), env)).toBeNull();
    expect(await handlePhieuSubdomain(new Request('https://api.thtohieu.com/api/health'), env)).toBeNull();
    expect(await handlePublicPhieuApi(env.DB, '/api/other', 'GET')).toBeNull();
    expect((await handlePublicPhieuApi(env.DB, '/api/phieu/public/token', 'POST'))?.status).toBe(405);
  });

  it('preserves authenticated dispatcher method and not-found boundaries', async () => {
    const env = createEnv();
    const resultMethod = await handlePhieuRoutes(
      teacherRequest('/api/phieu/results/42', 'DELETE'),
      env,
      '/api/phieu/results/42',
      'DELETE',
    );
    expect(resultMethod.status).toBe(405);

    const unknown = await handlePhieuRoutes(
      teacherRequest('/api/phieu/unknown'),
      env,
      '/api/phieu/unknown',
      'GET',
    );
    expect(unknown.status).toBe(404);
  });
});
