/**
 * ShareBar
 * Nút chia sẻ phiếu kết quả qua Facebook, Native Share (mobile), và Copy link.
 *
 * Props:
 *   url          — URL đầy đủ của phiếu cần chia sẻ
 *   studentName  — tên học sinh (để đặt tiêu đề chia sẻ)
 *   title        — ghi đè tiêu đề chia sẻ (optional)
 */
import React, { useCallback, useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';

interface ShareBarProps {
  url: string;
  studentName: string;
  title?: string;
}

const isMobile = (): boolean =>
  typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);

const ShareBar: React.FC<ShareBarProps> = ({ url, studentName, title }) => {
  const [copied, setCopied] = useState(false);

  const shareTitle = title ?? `Phiếu kết quả bài tập của ${studentName}`;

  // --- Native Share (mobile only) ---
  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: shareTitle, url });
    } catch {
      // user đã huỷ — bỏ qua
    }
  }, [url, shareTitle]);

  // --- Facebook ---
  const handleFacebook = useCallback(() => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  }, [url]);

  // --- Copy link ---
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [url]);

  const showNative = isMobile() && typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-gray-500">Chia sẻ:</span>

      {showNative ? (
        <button
          onClick={handleNativeShare}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          Chia sẻ
        </button>
      ) : (
        <>
          {/* Facebook */}
          <button
            onClick={handleFacebook}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors"
            style={{ background: '#1877F2' }}
          >
            <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
            </svg>
            Facebook
          </button>

        </>
      )}

      {/* Copy link */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        {copied
          ? <Check className="w-3.5 h-3.5 text-green-500" />
          : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Đã sao chép' : 'Sao chép link'}
      </button>
    </div>
  );
};

export default ShareBar;
