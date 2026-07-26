import React, { useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FileText, Sparkles, Send, Copy, CheckCircle2, Loader2, X, ClipboardList, Printer } from 'lucide-react';
import { PhieuNhanXet, PhieuNhanXetInput, PhieuNhanXetStyle, PhieuPublicLink } from '../../homework/types/phieu.types';
import { phieuService, getXepLoai, phieuStyleLabels } from '../../homework/services/phieuService';
import { phieuBatchService } from '../../homework/services/phieuBatchService';
import { resultPhieuLinkService } from '../services/resultPhieuLinkService';
import { PhieuKetQuaCardV2 } from './PhieuKetQuaCardV2';
import PhieuPrintView from './PhieuPrintView';
import { useAuthStore } from '../../../../stores/authStore';

interface ResultRow {
  id: string;
  student_name: string;
  class_name: string;
  quiz_id: string;
  quiz_title: string;
  score: number;
  correctCount?: number;
  total_questions: number;
  submitted_at: string;
  'Student Name'?: string;
  'Class'?: string;
  'Quiz Title'?: string;
  'Score'?: number;
  'Total Questions'?: number;
  'Submitted At'?: string;
}

interface Props {
  results: ResultRow[];
  onClose: () => void;
}

// Chuyển kết quả sang định dạng phiếu input
const resultToPhieuInput = (
  result: ResultRow,
  style: PhieuNhanXetStyle,
  teacherId: string
): PhieuNhanXetInput => {
  const studentName = result['Student Name'] || result.student_name || '';
  const classId = result['Class'] || result.class_name || '';
  const quizTitle = result['Quiz Title'] || result.quiz_title || '';
  const score = Number(result['Score'] ?? result.score ?? 0);
  const totalQ = Number(result['Total Questions'] ?? result.total_questions ?? 0);
  const correctCount = Number(result['correctCount'] ?? result.correctCount ?? 0);
  const wrongCount = Math.max(0, totalQ - correctCount);
  const xepLoai = getXepLoai(score);

  const buildNhanXet = (name: string, s: number) => {
    if (style === 'nghiem_tuc') return {
      nhan_xet: `${name} đạt mức ${xepLoai.toLowerCase()} với ${s}/10 điểm. Em cần rà soát kỹ các phần còn sai và trình bày câu trả lời rõ ràng hơn.`,
      noi_dung_co_gang: 'Tập trung sửa lỗi sai, luyện lại dạng bài chưa chắc và kiểm tra bài trước khi nộp.',
      loi_dong_vien: 'Cố gắng đều mỗi ngày, kết quả sẽ tiến bộ rõ rệt.',
    };
    if (style === 'vui_ve') return {
      nhan_xet: `${name} đã hoàn thành bài với tinh thần tốt và đạt ${s}/10 điểm. Những phần làm đúng cho thấy em đang nắm bài khá ổn.`,
      noi_dung_co_gang: 'Luyện thêm các câu còn nhầm và thử tự giải lại bài sau khi xem đáp án.',
      loi_dong_vien: 'Tiếp tục giữ nhịp học vui vẻ này nhé, em đang đi đúng hướng.',
    };
    return {
      nhan_xet: `${name} đã có nhiều cố gắng trong bài làm và đạt ${s}/10 điểm. Em có nền tảng tốt ở các phần đã làm đúng.`,
      noi_dung_co_gang: 'Cần luyện thêm những câu còn sai, đọc kỹ đề và trình bày từng bước cẩn thận hơn.',
      loi_dong_vien: 'Thầy cô tin rằng em sẽ tiến bộ nếu duy trì sự chăm chỉ này.',
    };
  };

  const resultKey = `result:${String(result.id)}`;

  return {
    submission_id: resultKey,
    student_id: resultKey,
    student_name: studentName,
    class_id: classId,
    mon_hoc: '',
    ten_bai_tap: quizTitle,
    ngay_lam_bai: result['Submitted At'] || result.submitted_at || '',
    tong_cau: totalQ,
    so_cau_dung: correctCount,
    so_cau_sai: wrongCount,
    diem_so: score,
    xep_loai: xepLoai,
    nhan_xet_mode: 'ai',
    nhan_xet_style: style,
    status: 'draft',
    created_by: teacherId,
    ...buildNhanXet(studentName, score),
  };
};

export const PhieuFromResultsPanel: React.FC<Props> = ({ results, onClose }) => {
  const { username } = useAuthStore();
  const [style, setStyle] = useState<PhieuNhanXetStyle>('nhe_nhang');
  const [selectedIds, setSelectedIds] = useState<string[]>(results.map((r) => String(r.id)));
  const [drafts, setDrafts] = useState<Record<string, PhieuNhanXet | PhieuNhanXetInput>>({});
  const [links, setLinks] = useState<PhieuPublicLink[]>([]);
  const [activeId, setActiveId] = useState<string>(String(results[0]?.id || ''));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const selectedResults = useMemo(
    () => results.filter((r) => selectedIds.includes(String(r.id))),
    [results, selectedIds]
  );
  const activePhieu = activeId ? drafts[activeId] : null;
  const hasLinks = links.length > 0;

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const next: Record<string, PhieuNhanXet | PhieuNhanXetInput> = { ...drafts };
      for (const result of selectedResults) {
        const input = resultToPhieuInput(result, style, username || 'teacher');
        const resultId = String(result.id);
        next[resultId] = await resultPhieuLinkService.upsertResult(resultId, input);
      }
      setDrafts(next);
      if (!activeId || !next[activeId]) setActiveId(String(selectedResults[0]?.id || ''));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tạo phiếu');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveActive = async () => {
    if (!activeId || !activePhieu) return;
    try {
      const saved = await resultPhieuLinkService.upsertResult(
        String(activeId),
        activePhieu as PhieuNhanXetInput,
        (activePhieu as PhieuNhanXet).id,
      );
      setDrafts((prev) => ({ ...prev, [activeId]: saved }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể lưu phiếu');
    }
  };

  const handlePublish = async () => {
    if (Object.keys(drafts).length === 0) { toast.error('Chưa có phiếu nào để xuất link.'); return; }
    setIsPublishing(true);
    try {
      // Auto-save: sync mọi draft (kể cả đã có id lẫn chưa có) lên server
      // để đảm bảo nội dung giáo viên vừa sửa được lưu trước khi publish
      const syncedDrafts: Record<string, PhieuNhanXet> = {};
      for (const [id, phieu] of Object.entries(drafts)) {
        const input: PhieuNhanXetInput = (phieu as PhieuNhanXet).id
          ? { ...(phieu as PhieuNhanXetInput), id: (phieu as PhieuNhanXet).id }
          : (phieu as PhieuNhanXetInput);
        const saved = await resultPhieuLinkService.upsertResult(
          String(id),
          input,
          (phieu as PhieuNhanXet).id,
        );
        syncedDrafts[id] = saved;
      }
      setDrafts(syncedDrafts);

      const phieuIds = Object.values(syncedDrafts).map((p) => p.id);
      const title = results[0]
        ? (results[0]['Quiz Title'] || results[0].quiz_title || 'Kết quả bài kiểm tra')
        : 'Kết quả bài kiểm tra';
      const result = await phieuBatchService.publishBatch({
        assignmentId: '',
        classId: results[0]?.['Class'] || results[0]?.class_name || '',
        teacherId: username || 'teacher',
        title,
        phieuIds,
        expiresInDays: 30,
      });
      setLinks(result.links);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tạo link.');
    } finally {
      setIsPublishing(false);
    }
  };

  const copyLink = (url: string, token: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl my-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-white font-black text-lg">Phiếu Kết Quả Học Tập</h2>
              <p className="text-blue-100 text-sm">{results.length} kết quả được chọn</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-0">
          {/* Sidebar danh sách học sinh */}
          <div className="lg:w-64 border-r border-slate-200 flex flex-col">
            {/* Style picker */}
            <div className="p-4 border-b border-slate-100">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Phong cách nhận xét</p>
              <div className="space-y-1">
                {(Object.entries(phieuStyleLabels) as [PhieuNhanXetStyle, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setStyle(key)}
                    className={`w-full text-left text-xs px-3 py-2 rounded-xl font-semibold transition-colors ${
                      style === key
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Danh sách học sinh */}
            <div className="flex-1 overflow-y-auto max-h-96 p-2">
              {results.map((r) => {
                const name = r['Student Name'] || r.student_name;
                const score = Number(r['Score'] ?? r.score ?? 0);
                const resultId = String(r.id);
                const hasDraft = Boolean(drafts[resultId]);
                const isActive = activeId === resultId;
                return (
                  <button
                    key={resultId}
                    onClick={() => setActiveId(resultId)}
                    className={`w-full text-left p-2.5 rounded-xl mb-1 flex items-center gap-2 transition-colors ${
                      isActive ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(resultId)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(resultId); }}
                      className="accent-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{name}</p>
                      <p className="text-[10px] text-slate-400">{score.toFixed(1)} đ</p>
                    </div>
                    {hasDraft && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="p-3 border-t border-slate-100 space-y-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || selectedIds.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGenerating ? 'Đang tạo...' : `Tạo ${selectedIds.length} phiếu`}
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing || Object.keys(drafts).length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isPublishing ? 'Đang xuất...' : 'Xuất link phụ huynh'}
              </button>
            </div>
          </div>

          {/* Phần preview + links */}
          <div className="flex-1 p-5 overflow-y-auto max-h-[80vh]">
            {!hasLinks ? (
              activePhieu ? (
                <div className="space-y-4">
                  <PhieuKetQuaCardV2
                    phieu={activePhieu}
                    editable
                    onChange={(patch) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [activeId]: { ...activePhieu, ...patch, nhan_xet_mode: 'manual' },
                      }))
                    }
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveActive}
                      className="flex-1 py-2.5 px-4 border-2 border-blue-500 text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-colors text-sm"
                    >
                      💾 Lưu chỉnh sửa
                    </button>
                    <button
                      onClick={() => setShowPrintModal(true)}
                      className="flex items-center gap-1.5 py-2.5 px-4 border-2 border-orange-400 text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors text-sm"
                    >
                      <Printer className="w-4 h-4" />
                      In phiếu
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <FileText className="w-16 h-16 text-slate-200 mb-4" />
                  <p className="font-semibold">Chưa có phiếu nào</p>
                  <p className="text-sm mt-1">Chọn học sinh và nhấn <strong>Tạo phiếu</strong> để bắt đầu</p>
                </div>
              )
            ) : (
              // Hiển thị links sau khi publish
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 font-black text-sm mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                  Đã tạo {links.length} link phiếu kết quả!
                </div>
                {links.map((link) => (
                  <div
                    key={link.publicToken}
                    className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3 border border-slate-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{link.studentName}</p>
                      <p className="text-xs text-slate-400 truncate">{link.url}</p>
                    </div>
                    <button
                      onClick={() => copyLink(link.url, link.publicToken)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        copiedToken === link.publicToken
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      {copiedToken === link.publicToken ? (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> Đã sao chép</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" /> Sao chép</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Print modal */}
      {showPrintModal && activePhieu && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex flex-col items-center overflow-y-auto py-4">
          <div className="w-full max-w-lg">
            <div className="flex justify-end mb-2 px-4">
              <button
                onClick={() => setShowPrintModal(false)}
                className="flex items-center gap-2 bg-white text-slate-700 font-bold px-4 py-2 rounded-xl shadow hover:bg-slate-100 transition-colors text-sm"
              >
                <X className="w-4 h-4" /> Đóng
              </button>
            </div>
            <PhieuPrintView phieu={activePhieu} showPrintButton />
          </div>
        </div>
      )}
    </div>
  );
};
