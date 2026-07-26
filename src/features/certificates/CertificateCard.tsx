import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Calendar, Download, Share2, Star, Trophy, User } from 'lucide-react';
import type { Certificate } from './certificates.types';
import { fetchCertificateImageBlob } from './useCertificates';

interface CertificateCardProps {
    cert: Certificate;
}

const CertificateCard: React.FC<CertificateCardProps> = ({ cert }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [imageBlob, setImageBlob] = useState<Blob | null>(null);
    const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        if (!cert.pngUrl) return;
        let active = true;
        let objectUrl: string | null = null;
        fetchCertificateImageBlob(cert.pngUrl)
            .then((blob) => {
                if (!active) return;
                objectUrl = URL.createObjectURL(blob);
                setImageBlob(blob);
                setImageObjectUrl(objectUrl);
            })
            .catch(() => active && setImgError(true));
        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [cert.pngUrl]);

    const formattedDate = new Date(cert.issuedAt).toLocaleDateString('vi-VN', {
        year: 'numeric', month: 'long', day: 'numeric',
    });

    const handleDownload = async () => {
        if (!imageBlob || isDownloading) return;
        setIsDownloading(true);
        try {
            const url = URL.createObjectURL(imageBlob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `chung-nhan-${cert.id}.png`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Không thể tải chứng nhận. Vui lòng thử lại.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleShare = async () => {
        if (!imageBlob) return;
        const file = new File([imageBlob], `chung-nhan-${cert.id}.png`, { type: 'image/png' });
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
            try {
                await navigator.share({ title: cert.title, text: `Tôi đã nhận được chứng nhận: ${cert.title}`, files: [file] });
            } catch {
                // Người dùng có thể chủ động hủy hộp thoại chia sẻ.
            }
            return;
        }
        toast('Thiết bị chưa hỗ trợ chia sẻ tệp. Hãy dùng nút Tải về.');
    };

    return (
        <article className="bg-white rounded-2xl shadow-md border border-amber-100 overflow-hidden hover:shadow-lg transition-shadow duration-200">
            <div className="relative bg-gradient-to-br from-amber-50 to-yellow-100 aspect-[4/3] flex items-center justify-center overflow-hidden">
                {imageObjectUrl && !imgError ? (
                    <img src={imageObjectUrl} alt={cert.title} className="w-full h-full object-cover" onError={() => setImgError(true)} />
                ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-amber-400 p-6">
                        <Trophy size={48} className="opacity-60" />
                        <p className="text-sm font-medium text-amber-600 text-center">{imgError ? 'Không thể tải ảnh chứng nhận' : cert.title}</p>
                    </div>
                )}
                <div className="absolute top-3 right-3 bg-amber-400 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow">
                    <Star size={10} fill="white" /> Chứng nhận
                </div>
            </div>

            <div className="p-4">
                <h3 className="font-bold text-gray-800 text-sm md:text-base line-clamp-2 mb-2">{cert.title}</h3>
                <div className="space-y-1 mb-3">
                    {cert.quizTitle && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Trophy size={12} className="text-amber-400 shrink-0" /><span className="line-clamp-1">{cert.quizTitle}</span></div>}
                    {cert.studentScore !== null && cert.studentScore !== undefined && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Star size={12} className="text-amber-400 shrink-0" /><span>Điểm: <strong className="text-amber-600">{cert.studentScore}</strong></span></div>}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500"><User size={12} className="text-indigo-400 shrink-0" /><span className="line-clamp-1">GV: {cert.teacherName}</span></div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500"><Calendar size={12} className="text-indigo-400 shrink-0" /><span>{formattedDate}</span></div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleDownload} disabled={isDownloading || !imageBlob} className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white text-xs font-semibold py-2 px-3 rounded-xl transition-colors">
                        <Download size={13} /> {isDownloading ? 'Đang tải...' : 'Tải về'}
                    </button>
                    <button onClick={handleShare} disabled={!imageBlob} className="flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 text-white text-xs font-semibold py-2 px-3 rounded-xl transition-colors">
                        <Share2 size={13} /> Chia sẻ
                    </button>
                </div>
            </div>
        </article>
    );
};

export default CertificateCard;
