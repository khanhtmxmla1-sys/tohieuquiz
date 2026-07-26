/**
 * PhieuLinkSection
 * Hiển thị nút "Xuất link phụ huynh", danh sách link đã tạo,
 * nút Copy và nút Thu hồi.
 *
 * @blueprint senior-engineering-toolkit
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Copy, Trash2, Loader2, Check } from 'lucide-react';
import type { PhieuNhanXet, PhieuNhanXetInput, PhieuPublicLink } from '../../homework/types/phieu.types';
import { resultPhieuLinkService } from '../services/resultPhieuLinkService';
import ShareBar from './ShareBar';

interface Props {
  /** ID của bản ghi trong bảng results — dùng để Worker xác thực quyền sở hữu. */
  resultId: string;
  /** phieuInput đã build sẵn từ modal state — luôn có */
  phieuInput: PhieuNhanXetInput;
  /** Nếu phiếu đã được upsert trước đó thì truyền vào để skip upsert */
  savedPhieu?: PhieuNhanXet | null;
  /** Callback để modal cập nhật savedPhieu sau khi upsert xong */
  onPhieuSaved?: (phieu: PhieuNhanXet) => void;
  /** Link đã xuất trước đó — để hiển thị lại khi mở lại modal */
  existingLink?: PhieuPublicLink | null;
  /** Callback khi link mới được tạo — để lưu lên parent */
  onLinkPublished?: (link: PhieuPublicLink) => void;
  /** Callback khi link bị thu hồi — để xoá khỏi parent cache */
  onLinkRevoked?: () => void;
}

const PhieuLinkSection: React.FC<Props> = ({ resultId, phieuInput, savedPhieu, onPhieuSaved, existingLink, onLinkPublished, onLinkRevoked }) => {
  const [link, setLink]           = useState<PhieuPublicLink | null>(existingLink ?? null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRevoking,   setIsRevoking]   = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    setLink(existingLink ?? null);
  }, [existingLink]);

  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    setError(null);
    try {
      const { phieu, link: newLink } = await resultPhieuLinkService.upsertAndPublish({
        resultId,
        phieuInput,
        existingPhieuId: savedPhieu?.id,
      });
      onPhieuSaved?.(phieu);
      setLink(newLink);
      onLinkPublished?.(newLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setIsPublishing(false);
    }
  }, [resultId, phieuInput, savedPhieu?.id, onPhieuSaved, onLinkPublished]);

  const handleCopy = useCallback(async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [link]);

  const handleRevoke = useCallback(async () => {
    if (!link) return;
    setIsRevoking(true);
    setError(null);
    try {
      await resultPhieuLinkService.revokeLink(link.publicToken);
      setLink(null);
      onLinkRevoked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setIsRevoking(false);
    }
  }, [link, onLinkRevoked]);

  return (
    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 rounded-b-none space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Link phụ huynh {link ? '(1)' : ''}
        </p>
        {!link && (
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            title="Xuất link vĩnh viễn cho phụ huynh"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPublishing
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <ExternalLink className="w-3 h-3" />}
            Xuất link phụ huynh
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}

      {link && (
        <div className="space-y-2">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex-1 truncate"
          >
            {link.url}
          </a>

          <button
            onClick={handleCopy}
            title="Copy link"
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={handleRevoke}
            disabled={isRevoking}
            title="Thu hồi link"
            className="p-1.5 text-red-900 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
          >
            {isRevoking
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
        <ShareBar
          url={link.url}
          studentName={phieuInput.student_name}
        />
        </div>
      )}

      {!link && !error && (
        <p className="text-xs text-gray-400">
          Tạo link vĩnh viễn để phụ huynh xem phiếu kết quả. Có thể thu hồi bất cứ lúc nào.
        </p>
      )}

    </div>
  );
};

export default PhieuLinkSection;
