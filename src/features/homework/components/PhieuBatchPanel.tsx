import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Copy, Download, ExternalLink, FileText, Loader2, Sparkles } from 'lucide-react';
import { Button } from '../../../components/common';
import { HomeworkAssignment, HomeworkSubmission } from '../types';
import { PhieuKetQuaCard } from './PhieuKetQuaCard';
import { phieuBatchService } from '../services/phieuBatchService';
import { createPhieuDraftInput, phieuService, phieuStyleLabels } from '../services/phieuService';
import { PhieuNhanXet, PhieuNhanXetInput, PhieuNhanXetStyle, PhieuPublicLink } from '../types/phieu.types';

interface PhieuBatchPanelProps {
  assignment: HomeworkAssignment;
  submissions: HomeworkSubmission[];
}

export const PhieuBatchPanel: React.FC<PhieuBatchPanelProps> = ({ assignment, submissions }) => {
  const eligibleSubmissions = useMemo(
    () => submissions.filter((submission) => submission.status === 'GRADED'),
    [submissions]
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(eligibleSubmissions.map((submission) => submission.id));
  const [style, setStyle] = useState<PhieuNhanXetStyle>('nhe_nhang');
  const [drafts, setDrafts] = useState<Record<string, PhieuNhanXet | PhieuNhanXetInput>>({});
  const [links, setLinks] = useState<PhieuPublicLink[]>([]);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string>(eligibleSubmissions[0]?.id || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const selectedSubmissions = eligibleSubmissions.filter((submission) => selectedIds.includes(submission.id));
  const activePhieu = activeSubmissionId ? drafts[activeSubmissionId] : null;

  const toggleSubmission = (submissionId: string) => {
    setSelectedIds((current) =>
      current.includes(submissionId)
        ? current.filter((id) => id !== submissionId)
        : [...current, submissionId]
    );
    setActiveSubmissionId(submissionId);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const nextDrafts: Record<string, PhieuNhanXet | PhieuNhanXetInput> = { ...drafts };
      for (const submission of selectedSubmissions) {
        const input = createPhieuDraftInput({
          assignment,
          submission,
          style,
          teacherId: assignment.teacher_id || 'teacher',
        });
        nextDrafts[submission.id] = await phieuService.upsertPhieu(input);
      }
      setDrafts(nextDrafts);
      if (!activeSubmissionId && selectedSubmissions[0]) {
        setActiveSubmissionId(selectedSubmissions[0].id);
      }
      toast.success('Đã sinh và lưu phiếu nhập.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Không thể sinh phiếu.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDraftChange = (patch: Partial<PhieuNhanXetInput>) => {
    if (!activeSubmissionId || !activePhieu) return;
    setDrafts((current) => ({
      ...current,
      [activeSubmissionId]: {
        ...activePhieu,
        ...patch,
        nhan_xet_mode: 'manual',
      },
    }));
  };

  const handleSaveActive = async () => {
    if (!activeSubmissionId || !activePhieu) return;
    try {
      const saved = await phieuService.upsertPhieu(activePhieu as PhieuNhanXetInput);
      setDrafts((current) => ({ ...current, [activeSubmissionId]: saved }));
      toast.success('Đã lưu phiếu.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Không thể lưu phiếu.');
    }
  };

  const handlePublish = async () => {
    const phieuIds = Object.values(drafts)
      .filter((phieu): phieu is PhieuNhanXet => Boolean((phieu as PhieuNhanXet).id))
      .map((phieu) => phieu.id);

    if (phieuIds.length === 0) {
      toast.error('Cần sinh và lưu ít nhất 1 phiếu trước khi xuất link.');
      return;
    }

    setIsPublishing(true);
    try {
      const result = await phieuBatchService.publishBatch({
        assignmentId: assignment.id,
        classId: assignment.class_id,
        teacherId: assignment.teacher_id || 'teacher',
        title: assignment.title,
        phieuIds,
        expiresInDays: undefined,
      });
      setLinks(result.links);
      toast.success('Đã xuất link phụ huynh.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Không thể xuất link.');
    } finally {
      setIsPublishing(false);
    }
  };

  const copyAllLinks = async () => {
    const text = links.map((link) => `${link.studentName}: ${link.url}`).join('\n');
    await navigator.clipboard.writeText(text);
  };

  const downloadCsv = () => {
    const csv = ['student_name,link', ...links.map((link) => `"${link.studentName.replace(/"/g, '""')}","${link.url}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `phieu-links-${assignment.id}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (eligibleSubmissions.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-black text-slate-700">Chua co bai da cham</h3>
        <p className="text-slate-500 mt-2">Phieu ket qua chi tao tu cac bai da co diem va nhan xet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <aside className="xl:col-span-1 space-y-4">
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phong cach AI</p>
            <select
              value={style}
              onChange={(event) => setStyle(event.target.value as PhieuNhanXetStyle)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
            >
              {Object.entries(phieuStyleLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={selectedSubmissions.length === 0 || isGenerating}
            className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-2xl py-3"
            icon={isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          >
            AI nhan xet hang loat
          </Button>

          <Button
            variant="success"
            onClick={handlePublish}
            disabled={Object.keys(drafts).length === 0 || isPublishing}
            className="w-full rounded-2xl py-3"
            icon={isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          >
            Xuat link phu huynh
          </Button>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
          {eligibleSubmissions.map((submission) => {
            const checked = selectedIds.includes(submission.id);
            const hasDraft = Boolean(drafts[submission.id]);
            return (
              <button
                key={submission.id}
                type="button"
                onClick={() => toggleSubmission(submission.id)}
                className={`w-full p-4 text-left flex items-center justify-between border-b border-slate-50 last:border-0 hover:bg-indigo-50/50 ${activeSubmissionId === submission.id ? 'bg-indigo-50' : ''}`}
              >
                <span>
                  <span className="block text-sm font-black text-slate-800">{submission.student_name}</span>
                  <span className="text-xs font-bold text-slate-400">{submission.score}/10 diem</span>
                </span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  checked
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {hasDraft || checked ? <Check className="w-4 h-4" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="xl:col-span-2 space-y-5">
        {activePhieu ? (
          <>
            <PhieuKetQuaCard phieu={activePhieu} editable onChange={handleDraftChange} />
            <div className="flex justify-end">
              <Button variant="secondary" onClick={handleSaveActive} className="rounded-2xl">
                Luu chinh sua
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
            <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-black text-slate-700">San sang tao phieu</h3>
            <p className="text-slate-500 mt-2">Chon hoc sinh va bam AI nhan xet hang loat de tao phieu nhap.</p>
          </div>
        )}

        {links.length > 0 && (
          <div className="bg-white border border-emerald-100 rounded-3xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-black text-slate-800">Link phu huynh ({links.length})</h3>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={copyAllLinks} icon={<Copy className="w-4 h-4" />}>Copy tat ca</Button>
                <Button variant="secondary" size="sm" onClick={downloadCsv} icon={<Download className="w-4 h-4" />}>CSV</Button>
              </div>
            </div>
            <div className="space-y-2">
              {links.map((link) => (
                <div key={link.publicToken} className="flex flex-col md:flex-row md:items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="font-bold text-slate-700">{link.studentName}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(link.url)}
                    className="text-left md:text-right text-sm font-semibold text-indigo-700 hover:text-indigo-900 break-all"
                  >
                    {link.url}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
