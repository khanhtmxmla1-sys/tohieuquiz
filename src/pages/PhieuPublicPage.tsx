import React, { useEffect, useState } from 'react';
import { WORKERS_API_URL } from '../config/constants';
import { Loader2, Printer } from 'lucide-react';
import { useParams } from 'react-router';
import { Button } from '../components/common';
import { PhieuKetQuaCardV2 } from '../features/results/components/PhieuKetQuaCardV2';
import { phieuService } from '../features/homework/services/phieuService';
import { PublicPhieuResult } from '../features/homework/types/phieu.types';
import ShareBar from '../features/results/components/ShareBar';

const PhieuPublicPage: React.FC = () => {
  const { publicToken } = useParams<{ publicToken: string }>();
  const [data, setData] = useState<PublicPhieuResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!publicToken) {
        setError('Link phiếu không hợp lệ.');
        setLoading(false);
        return;
      }

      try {
        setData(await phieuService.getPublicPhieu(publicToken));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải phiếu.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [publicToken]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="font-bold text-slate-500">Đang tải phiếu kết quả...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-3xl bg-white border border-slate-200 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-800">Không tìm thấy phiếu</h1>
          <p className="text-slate-500 mt-3">{error || 'Phiếu có thể đã hết hạn hoặc đã bị thu hồi.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header — ẩn khi in */}
        <header className="flex items-center justify-between print:hidden">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-600">TôHiệuQuiz</p>
            <h1 className="text-lg font-black text-slate-800">{data.phieu.ten_bai_tap || data.title}</h1>
          </div>
          <Button
            variant="secondary"
            onClick={() => window.print()}
            className="rounded-2xl"
            icon={<Printer className="w-4 h-4" />}
          >
            In phiếu
          </Button>
        </header>

        {/* Phiếu kết quả — dùng mẫu PhieuKetQuaCardV2 khớp mockup */}
        <PhieuKetQuaCardV2
          phieu={data.phieu}
          editable={false}
          tenGVCN={data.phieu.teacher_name || data.phieu.created_by || ''}
        />

        {/* Chia sẻ phiếu — ẩn khi in */}
        <div className="print:hidden">
          <ShareBar
            url={`${WORKERS_API_URL}/p/${publicToken}`}
            studentName={data.phieu.student_name}
            title={`Phiếu kết quả bài tập của ${data.phieu.student_name}`}
          />
        </div>

      </div>
    </main>
  );
};

export default PhieuPublicPage;
