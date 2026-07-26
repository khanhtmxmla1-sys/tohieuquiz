export async function invalidatePhieuOgCache(
  db: D1Database,
  ogImages: R2Bucket | undefined,
  phieuId: string,
): Promise<void> {
  if (!ogImages) return;
  const link = await db.prepare(
    'SELECT public_token FROM phieu_public_links WHERE phieu_id = ?',
  ).bind(phieuId).first<{ public_token: string }>();
  if (link?.public_token) {
    await ogImages.delete(`og/${link.public_token}.png`);
  }
}
