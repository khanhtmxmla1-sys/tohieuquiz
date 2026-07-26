import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;

vi.mock('../workers/src/utils/ogImage', () => ({
  renderOgPng: vi.fn(async () => new Uint8Array()),
}));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import {
  handlePhieuRoutes,
  handlePhieuSubdomain,
  handlePublicPhieuApi,
  handlePublishPhieuBatch,
  handleUpsertPhieu,
} from '../workers/src/routes/phieu';

type Row = Record<string, any>;

class Statement {
  bindings: unknown[] = [];

  constructor(readonly sql: string, readonly db: MockDatabase) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    this.db.reads.push(this);
    return this.db.first(this.sql, this.bindings) as T;
  }

  async run() {
    this.db.writes.push(this);
    return this.db.run(this.sql, this.bindings);
  }
}

class MockDatabase {
  reads: Statement[] = [];
  writes: Statement[] = [];
  resultScope: Row | null = {
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
  };
  phieu: Row | null = null;
  activeLink: Row | null = null;
  publicRecord: Row | null = null;

  prepare(sql: string) {
    return new Statement(sql, this);
  }

  first(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM results r') && sql.includes('JOIN classes c')) return this.resultScope;
    if (sql.includes('WHERE submission_id IN (?, ?)')) return this.phieu;
    if (sql.includes('SELECT l.phieu_id') && sql.includes('FROM phieu_public_links l')) return this.activeLink;
    if (sql.includes('SELECT id, student_name FROM phieu_nhanxet WHERE id = ?')) {
      return this.phieu && String(this.phieu.id) === String(bindings[0])
        ? { id: this.phieu.id, student_name: this.phieu.student_name }
        : null;
    }
    if (sql.includes('SELECT id, version, created_by FROM phieu_nhanxet WHERE submission_id = ?')) {
      if (!this.phieu || String(this.phieu.submission_id) !== String(bindings[0])) return null;
      return { id: this.phieu.id, version: this.phieu.version, created_by: this.phieu.created_by };
    }
    if (sql.includes('SELECT * FROM phieu_nhanxet WHERE submission_id = ?')) {
      return this.phieu && String(this.phieu.submission_id) === String(bindings[0]) ? this.phieu : null;
    }
    if (sql.includes('SELECT p.*, b.title as batch_title')) return this.publicRecord;
    return null;
  }

  run(sql: string, bindings: unknown[]) {
    if (sql.includes('INSERT INTO phieu_nhanxet')) {
      this.phieu = {
        id: bindings[0],
        submission_id: bindings[1],
        student_id: bindings[2],
        student_name: bindings[3],
        class_id: bindings[4],
        mon_hoc: bindings[5],
        ten_bai_tap: bindings[6],
        ngay_lam_bai: bindings[7],
        tong_cau: bindings[8],
        so_cau_dung: bindings[9],
        so_cau_sai: bindings[10],
        diem_so: bindings[11],
        xep_loai: bindings[12],
        nhan_xet_mode: bindings[13],
        nhan_xet_style: bindings[14],
        nhan_xet: bindings[15],
        noi_dung_co_gang: bindings[16],
        loi_dong_vien: bindings[17],
        status: bindings[18],
        version: 1,
        created_by: bindings[19],
        created_at: bindings[20],
        updated_at: bindings[21],
      };
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes('INSERT INTO phieu_public_links') && sql.includes('WHERE NOT EXISTS')) {
      if (this.activeLink) return { success: true, meta: { changes: 0 } };
      this.activeLink = {
        phieu_id: bindings[1],
        batch_id: bindings[2],
        public_token: bindings[3],
        student_name: this.phieu?.student_name || '',
      };
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 1 } };
  }
}

const env = (db: MockDatabase) => ({
  DB: db,
  JWT_SECRET: 'test-secret',
  OG_IMAGES: {
    get: vi.fn(async () => null),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  },
} as any);

const teacherRequest = (path: string, init?: RequestInit) => new Request(`https://test${path}`, {
  ...init,
  headers: {
    Authorization: 'Bearer test-token',
    'Content-Type': 'application/json',
    ...(init?.headers || {}),
  },
});

const savedPhieu = (): Row => ({
  id: 'phieu-42',
  submission_id: 'result:42',
  student_id: 'student-42',
  student_name: 'Học sinh thật',
  class_id: 'class-5a',
  mon_hoc: 'Toán',
  ten_bai_tap: 'Phân số',
  ngay_lam_bai: '2026-07-15T10:00:00.000Z',
  tong_cau: 20,
  so_cau_dung: 16,
  so_cau_sai: 4,
  diem_so: 8,
  xep_loai: 'Giỏi',
  nhan_xet_mode: 'manual',
  nhan_xet_style: 'nhe_nhang',
  nhan_xet: 'Tiến bộ tốt.',
  noi_dung_co_gang: 'Đọc kỹ đề.',
  loi_dong_vien: 'Tiếp tục phát huy.',
  status: 'published',
  version: 2,
  created_by: 'teacher-a',
  created_at: '2026-07-15T10:00:00.000Z',
  updated_at: '2026-07-15T10:30:00.000Z',
});

describe('quiz result phieu routes', () => {
  beforeEach(() => {
    currentUser = { username: 'teacher-a', role: 'teacher' } as JWTPayload;
  });

  it('loads the saved phieu and active link without publishing or writing', async () => {
    const db = new MockDatabase();
    db.phieu = savedPhieu();
    db.activeLink = {
      phieu_id: 'phieu-42',
      batch_id: 'batch-old',
      public_token: 'existing-token',
      student_name: 'Học sinh thật',
    };

    const response = await handlePhieuRoutes(
      teacherRequest('/api/phieu/results/42'),
      env(db),
      '/api/phieu/results/42',
      'GET',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data.phieu.id).toBe('phieu-42');
    expect(payload.data.link).toMatchObject({
      publicToken: 'existing-token',
      url: 'https://api.thtohieu.com/p/existing-token',
    });
    expect(db.writes).toHaveLength(0);
  });

  it('derives identity and score from the result row instead of trusting the client', async () => {
    const db = new MockDatabase();
    const response = await handlePhieuRoutes(
      teacherRequest('/api/phieu/results/42', {
        method: 'POST',
        body: JSON.stringify({
          student_id: 'spoofed-student',
          student_name: 'Tên giả',
          class_id: 'other-class',
          diem_so: 10,
          mon_hoc: 'Môn giả',
          tong_cau: 1,
          so_cau_dung: 1,
          nhan_xet: 'Nhận xét của giáo viên',
        }),
      }),
      env(db),
      '/api/phieu/results/42',
      'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      submission_id: 'result:42',
      student_id: 'student-42',
      student_name: 'Học sinh thật',
      class_id: 'class-5a',
      mon_hoc: 'Toán',
      diem_so: 8,
      tong_cau: 20,
      so_cau_dung: 16,
      so_cau_sai: 4,
      xep_loai: 'Giỏi',
      created_by: 'teacher-a',
    });
  });

  it('rejects a teacher who does not manage the result class', async () => {
    currentUser = { username: 'teacher-b', role: 'teacher' } as JWTPayload;
    const db = new MockDatabase();

    const response = await handlePhieuRoutes(
      teacherRequest('/api/phieu/results/42'),
      env(db),
      '/api/phieu/results/42',
      'GET',
    );

    expect(response.status).toBe(403);
    expect(db.writes).toHaveLength(0);
  });
});

describe('phieu link idempotency and integrity', () => {
  it('reuses an active public link instead of creating another batch or token', async () => {
    const db = new MockDatabase();
    db.phieu = savedPhieu();
    db.activeLink = {
      phieu_id: 'phieu-42',
      batch_id: 'batch-old',
      public_token: 'existing-token',
      student_name: 'Học sinh thật',
    };

    const response = await handlePublishPhieuBatch(db as any, {
      phieuIds: ['phieu-42'],
      classId: 'class-5a',
      teacherId: 'teacher-a',
      title: 'Phân số',
    });
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      batchId: 'batch-old',
      links: [{
        phieuId: 'phieu-42',
        studentName: 'Học sinh thật',
        publicToken: 'existing-token',
        url: 'https://api.thtohieu.com/p/existing-token',
      }],
    });
    expect(db.writes.some((statement) => statement.sql.includes('INSERT INTO phieu_batch'))).toBe(false);
    expect(db.writes.some((statement) => statement.sql.includes('INSERT INTO phieu_public_links'))).toBe(false);
  });

  it('rejects an id that conflicts with the row already stored for a submission', async () => {
    const db = new MockDatabase();
    db.phieu = savedPhieu();

    const response = await handleUpsertPhieu(db as any, {
      id: 'other-phieu',
      submission_id: 'result:42',
      student_id: 'student-42',
    });

    expect(response.status).toBe(409);
    expect(db.writes).toHaveLength(0);
  });
});

describe('public phieu delivery', () => {
  it('does not increment views on the redirect before the SPA loads the content', async () => {
    const db = new MockDatabase();
    db.publicRecord = { ...savedPhieu(), batch_title: 'Phân số' };

    const response = await handlePhieuSubdomain(
      new Request('https://api.thtohieu.com/p/public-token', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }),
      env(db),
    );

    expect(response?.status).toBe(302);
    expect(db.writes).toHaveLength(0);
  });

  it('counts the public JSON fetch once and exposes the teacher full name', async () => {
    const db = new MockDatabase();
    db.publicRecord = {
      ...savedPhieu(),
      batch_title: 'Phân số',
      teacher_full_name: 'Cô Giáo A',
    };

    const response = await handlePublicPhieuApi(
      db as any,
      '/api/phieu/public/public-token',
      'GET',
    );
    const payload = await response?.json() as any;

    expect(response?.status).toBe(200);
    expect(payload.data.phieu.teacher_name).toBe('Cô Giáo A');
    expect(db.writes.filter((statement) => statement.sql.includes('view_count = view_count + 1'))).toHaveLength(2);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
  });
});
