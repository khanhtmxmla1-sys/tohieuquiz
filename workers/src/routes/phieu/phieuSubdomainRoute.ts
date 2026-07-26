import { renderOgPng, type PhieuRecord } from '../../utils/ogImage';
import { toArrayBuffer } from '../../utils/bytes';
import type { Env } from '../../types';
import { PUBLIC_APP_ORIGIN, PUBLIC_PHIEU_HOST } from './constants';
import { renderOgHtml } from './phieuOgRenderer';
import { getPublicPhieuRecord } from './phieuRepository';

export async function handlePhieuSubdomain(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.hostname !== PUBLIC_PHIEU_HOST) return null;
  if (url.pathname.startsWith('/api/')) return null;

  const [scope, publicToken, subpath] = url.pathname.replace(/^\//, '').split('/');
  if (scope !== 'p' || !publicToken) return null;
  const record = await getPublicPhieuRecord(env.DB, publicToken);
  if (!record) {
    return new Response('Phieu da het han hoac khong ton tai', { status: 404 });
  }

  if (subpath === 'og-image') {
    const r2Key = `og/${publicToken}.png`;
    const cached = await env.OG_IMAGES.get(r2Key);
    if (cached) {
      return new Response(cached.body, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800',
          'X-Cache': 'HIT',
        },
      });
    }
    const png = await renderOgPng(record as PhieuRecord);
    env.OG_IMAGES.put(r2Key, png, {
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=604800',
      },
    });
    return new Response(toArrayBuffer(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=604800',
        'X-Cache': 'MISS',
      },
    });
  }

  const userAgent = request.headers.get('User-Agent') || '';
  const isBot = /bot|crawl|spider|facebookexternalhit|zalo|zalocrawler|telegram|whatsapp|viber|slack|twitter|linkedin|line|kakaotalk|discordbot|iframely/i.test(userAgent);
  if (isBot) {
    return new Response(renderOgHtml(record, publicToken), {
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'public, max-age=300',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }
  return Response.redirect(
    `${PUBLIC_APP_ORIGIN}/phieu/p/${encodeURIComponent(publicToken)}`,
    302,
  );
}
