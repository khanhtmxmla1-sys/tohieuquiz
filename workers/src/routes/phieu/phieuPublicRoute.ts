import { errorResponse } from '../../utils/response';
import { getPublicPhieuRecord } from './phieuRepository';
import { mapPhieu } from './phieuMapper';

export async function handlePublicPhieuApi(
  db: D1Database,
  path: string,
  method: string,
): Promise<Response | null> {
  const match = path.match(/^\/api\/phieu\/public\/([^/]+)$/);
  if (!match) return null;
  if (method !== 'GET') return errorResponse('Method not allowed', 405);

  const publicToken = decodeURIComponent(match[1]);
  const record = await getPublicPhieuRecord(db, publicToken);
  if (!record) return errorResponse('Phieu da het han hoac khong ton tai', 404);

  await db.prepare(
    'UPDATE phieu_public_links SET view_count = view_count + 1 WHERE public_token = ?',
  ).bind(publicToken).run();
  await db.prepare(`
    UPDATE phieu_batch
    SET view_count = view_count + 1
    WHERE id = (SELECT batch_id FROM phieu_public_links WHERE public_token = ?)
  `).bind(publicToken).run();

  return new Response(JSON.stringify({
    status: 'success',
    data: {
      title: record.batch_title || record.ten_bai_tap || 'Phiếu Kết Quả Học Tập',
      phieu: mapPhieu(record),
    },
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
    },
  });
}
