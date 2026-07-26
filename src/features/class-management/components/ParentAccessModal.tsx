import React, { useEffect, useState } from 'react';
import { Copy, Download, Printer, QrCode, RefreshCw, ShieldOff, X } from 'lucide-react';
import QRCode from 'qrcode';
import {
  createParentLink,
  getParentLink,
  reissueParentLink,
  revokeParentLink,
} from '../../parent-portal/parentPortalService';
import type { ParentLinkSafeView } from '../../parent-portal/types';

interface ParentAccessModalProps {
  studentId: string;
  studentName: string;
  className: string;
  onClose: () => void;
}

const statusText: Record<ParentLinkSafeView['status'], string> = {
  PENDING: 'Chờ kích hoạt',
  ACTIVE: 'Đã kích hoạt',
  REVOKED: 'Đã thu hồi',
};

export default function ParentAccessModal({
  studentId,
  studentName,
  className,
  onClose,
}: ParentAccessModalProps) {
  const [link, setLink] = useState<ParentLinkSafeView | null>(null);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getParentLink(studentId)
      .then(response => { if (active) setLink(response.link); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Không tải được quyền phụ huynh.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [studentId]);

  useEffect(() => {
    let active = true;
    if (!activationUrl) {
      setQrSvg('');
      return () => { active = false; };
    }
    void QRCode.toString(activationUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    }).then(svg => { if (active) setQrSvg(svg); })
      .catch(() => { if (active) setError('Không tạo được mã QR.'); });
    return () => { active = false; };
  }, [activationUrl]);

  const create = async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await createParentLink(studentId);
      setLink(response.link);
      setActivationUrl(response.activationUrl || null);
      setMessage(response.activationUrl
        ? 'Đã tạo QR dùng một lần. Hãy in hoặc gửi cho phụ huynh.'
        : 'Quyền đã được cấp trước đó. Cấp lại QR nếu phụ huynh cần kích hoạt lại.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tạo được QR phụ huynh.');
    } finally {
      setIsSaving(false);
    }
  };

  const reissue = async () => {
    if (!link) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await reissueParentLink(link.id);
      setLink(response.link);
      setActivationUrl(response.activationUrl);
      setMessage('QR cũ đã bị vô hiệu. Hãy dùng QR mới này.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không cấp lại được QR.');
    } finally {
      setIsSaving(false);
    }
  };

  const revoke = async () => {
    if (!link) return;
    setIsSaving(true);
    setError(null);
    try {
      await revokeParentLink(link.id);
      setLink({ ...link, status: 'REVOKED', revokedAt: new Date().toISOString() });
      setActivationUrl(null);
      setQrSvg('');
      setMessage('Quyền phụ huynh đã được thu hồi ngay lập tức.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thu hồi được quyền phụ huynh.');
    } finally {
      setIsSaving(false);
    }
  };

  const copy = async () => {
    if (!activationUrl) return;
    await navigator.clipboard.writeText(activationUrl);
    setMessage('Đã sao chép liên kết kích hoạt.');
  };

  const downloadQr = () => {
    if (!qrSvg) return;
    const url = URL.createObjectURL(new Blob([qrSvg], { type: 'image/svg+xml' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `qr-phu-huynh-${studentName.replace(/\s+/g, '-').toLowerCase()}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label={`Quyền phụ huynh của ${studentName}`}>
      <div className="max-h-[95vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white shadow-2xl">
        <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <div><p className="text-sm font-semibold text-indigo-600">Cổng phụ huynh</p><h2 className="text-xl font-bold">{studentName}</h2><p className="text-sm text-slate-500">Lớp {className}</p></div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-100"><X /></button>
        </header>
        <div className="space-y-5 p-5">
          {isLoading && <p role="status" className="rounded-xl bg-slate-50 p-4 text-slate-500">Đang tải quyền phụ huynh…</p>}
          {!isLoading && !link && <section className="rounded-2xl border border-dashed border-slate-300 p-6 text-center"><QrCode className="mx-auto h-10 w-10 text-slate-400" /><h3 className="mt-3 font-bold">Chưa cấp quyền phụ huynh</h3><p className="mt-1 text-sm text-slate-500">Tạo QR dùng một lần để phụ huynh kích hoạt tài khoản.</p><button type="button" onClick={create} disabled={isSaving} className="mt-4 min-h-11 rounded-xl bg-indigo-600 px-5 font-bold text-white disabled:opacity-50">Tạo QR phụ huynh</button></section>}
          {link && <section className="rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Trạng thái</p><p className="font-bold">{statusText[link.status]}</p></div>{link.status !== 'REVOKED' && <div className="text-right"><p className="text-sm text-slate-500">Mã phụ huynh</p><p className="font-mono text-lg font-bold tracking-[0.15em]">{link.accessCode}</p></div>}</div></section>}
          {qrSvg && activationUrl && link?.status !== 'REVOKED' && <section className="grid gap-5 rounded-2xl bg-slate-50 p-5 sm:grid-cols-[240px_1fr]"><div data-testid="parent-qr-svg" className="rounded-xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} /><div><h3 className="font-bold">QR kích hoạt dùng một lần</h3><p className="mt-2 text-sm text-slate-600">QR không chứa tên, lớp, số điện thoại hoặc mã học sinh. Sau khi kích hoạt, QR này không dùng lại được.</p><div className="mt-4 grid gap-2"><button type="button" onClick={copy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-semibold"><Copy className="h-4 w-4" />Sao chép liên kết</button><button type="button" onClick={downloadQr} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-semibold"><Download className="h-4 w-4" />Tải QR SVG</button><button type="button" onClick={() => globalThis.print()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-semibold"><Printer className="h-4 w-4" />In phiếu QR</button></div></div></section>}
          {link && link.status !== 'REVOKED' && <div className="flex flex-wrap gap-2"><button type="button" onClick={reissue} disabled={isSaving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-100 px-4 font-bold text-amber-900 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Cấp lại QR</button><button type="button" onClick={revoke} disabled={isSaving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-50 px-4 font-bold text-red-700 disabled:opacity-50"><ShieldOff className="h-4 w-4" />Thu hồi quyền</button></div>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
        </div>
      </div>
    </div>
  );
}
