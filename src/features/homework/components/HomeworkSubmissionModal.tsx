import React, { useState, useCallback, useMemo } from 'react';
import { HomeworkAssignment, HomeworkSubmission } from '../types';
import { X, Upload, Camera, Send, CheckCircle2, AlertCircle, FileText, Trophy, BookOpen, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useHomeworkStore } from '../stores/useHomeworkStore';
import MathSpan from '../../../components/common/MathSpan';
import { uploadToCloudinary } from '../../../services/cloudinaryService';

interface HomeworkSubmissionModalProps {
  assignment: HomeworkAssignment;
  submission?: HomeworkSubmission;
  studentId: string;
  studentName: string;
  onClose: () => void;
}

/**
 * Senior Refactor: Decomposition into sub-components for better maintainability and performance.
 */

// 1. Assignment Details Helper Component
const AssignmentDetails = React.memo(({ assignment, submission, isGraded }: { 
  assignment: HomeworkAssignment, 
  submission?: HomeworkSubmission, 
  isGraded: boolean 
}) => (
  <div className="space-y-6">
    <section>
      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
        <BookOpen className="w-4 h-4" /> Đề bài & Hướng dẫn
      </h3>
      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-slate-600 leading-relaxed shadow-sm">
        <MathSpan content={assignment.description || 'Làm bài tập theo yêu cầu của thầy cô.'} />
      </div>
      
      {assignment.file_url && (
        <div className="mt-4 rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-transform hover:scale-[1.01]">
          {assignment.file_url.toLowerCase().includes('.pdf')
            ? <iframe src={assignment.file_url} title="Đề bài PDF" className="w-full h-[520px]" />
            : <img src={assignment.file_url} alt="Đề bài" className="w-full h-auto object-cover" loading="lazy" />}
        </div>
      )}
    </section>

    {isGraded && submission && (
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h3 className="text-sm font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          NHẬN XÉT TỪ THẦY CÔ
        </h3>
        <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span className="font-bold text-emerald-900">Điểm số cuối cùng</span>
            </div>
            <span className="text-3xl font-black text-emerald-600">{submission.score}/10</span>
          </div>
          <div className="text-emerald-800 leading-relaxed whitespace-pre-wrap italic">
            <span aria-hidden="true">“</span>
            <MathSpan content={submission.teacher_feedback || submission.ai_evaluation || ''} />
            <span aria-hidden="true">”</span>
          </div>
        </div>
      </section>
    )}
  </div>
));

AssignmentDetails.displayName = 'AssignmentDetails';

async function inspectImageQuality(file: File): Promise<string[]> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = url;
    });
    const warnings: string[] = [];
    if (image.naturalWidth < 800 || image.naturalHeight < 600) warnings.push('độ phân giải thấp');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return warnings;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let luminance = 0;
    let edgeEnergy = 0;
    const gray = new Float32Array(canvas.width * canvas.height);
    for (let index = 0; index < gray.length; index++) {
      const offset = index * 4;
      gray[index] = 0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2];
      luminance += gray[index];
    }
    for (let y = 1; y < canvas.height - 1; y++) for (let x = 1; x < canvas.width - 1; x++) {
      const index = y * canvas.width + x;
      edgeEnergy += Math.abs(4 * gray[index] - gray[index - 1] - gray[index + 1] - gray[index - canvas.width] - gray[index + canvas.width]);
    }
    if (luminance / Math.max(gray.length, 1) < 45) warnings.push('ảnh quá tối');
    if (edgeEnergy / Math.max((canvas.width - 2) * (canvas.height - 2), 1) < 5) warnings.push('ảnh có thể bị mờ');
    return warnings;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 2. Submission Area Helper Component
const SubmissionArea = React.memo(({ 
  isSubmitted, 
  isGraded, 
  submission, 
  previewUrl, 
  isSubmitting, 
  storeError,
  allowUpload,
  maxAttempts,
  onFileChange,
  onCancelPreview,
  onSubmit
}: {
  isSubmitted: boolean;
  isGraded: boolean;
  submission?: HomeworkSubmission;
  previewUrl: string | null;
  isSubmitting: boolean;
  storeError: string | null;
  allowUpload: boolean;
  maxAttempts: number;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancelPreview: () => void;
  onSubmit: () => void;
}) => (
  <div className="space-y-6">
    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
      <Camera className="w-4 h-4" /> Bài làm của em
    </h3>
    
    {isSubmitted && submission && (
      <div className="rounded-2xl overflow-hidden border-2 border-slate-100 shadow-inner relative group">
        <img 
          src={submission.file_urls[0]} 
          alt="Bài làm đã nộp" 
          className="w-full h-auto min-h-[200px] object-cover"
        />
        {!isGraded && (
          <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[2px] flex items-center justify-center">
             <div className="bg-white rounded-2xl px-6 py-4 shadow-xl border border-blue-100 text-center max-w-[80%]">
               <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
               <p className="font-bold text-blue-900">Đang chờ chấm điểm</p>
               <p className="text-xs text-blue-600 mt-1">Hệ thống AI và thầy cô đang xem bài làm của em.</p>
             </div>
          </div>
        )}
      </div>
    )}
    {allowUpload ? (
      <div className="space-y-4">
        <div 
          className={`border-3 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all min-h-[300px] ${
            previewUrl ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
          }`}
        >
          {previewUrl ? (
            <div className="relative w-full">
              <img src={previewUrl} alt="Preview" className="w-full rounded-2xl shadow-md" />
              <button 
                onClick={onCancelPreview}
                className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
                <Upload className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-bold mb-1">Chụp ảnh hoặc chọn file bài làm</p>
              <p className="text-slate-400 text-xs max-w-[200px]">Hãy đảm bảo ảnh chụp rõ ràng, đủ ánh sáng và ngay ngắn.</p>
              
              <input 
                type="file" 
                id="hw-upload" 
                className="hidden" 
                accept="image/jpeg,image/png,image/webp"
                multiple
                capture="environment"
                onChange={onFileChange}
              />
              <label 
                htmlFor="hw-upload"
                className="mt-6 px-6 py-3 bg-white border-2 border-indigo-100 text-indigo-700 font-black text-xs rounded-xl cursor-pointer hover:border-indigo-600 hover:text-indigo-700 transition-all shadow-sm active:scale-95"
              >
                CHỌN ẢNH BÀI LÀM
              </label>
            </>
          )}
        </div>

        {storeError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {storeError}
          </div>
        )}

        <button 
          disabled={!previewUrl || isSubmitting}
          onClick={onSubmit}
          className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${
            !previewUrl || isSubmitting
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200'
          }`}
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
          {isSubmitting ? 'ĐANG NỘP BÀI...' : 'NỘP BÀI NGAY'}
        </button>
        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
          Bài này cho phép tối đa {maxAttempts} lần nộp. Mỗi lần đều được lưu trong lịch sử.
        </p>
      </div>
    ) : !isSubmitted ? <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-sm font-bold text-rose-700">Bài tập đã đóng hoặc hết hạn nộp.</div> : null}
  </div>
));

SubmissionArea.displayName = 'SubmissionArea';

export const HomeworkSubmissionModal: React.FC<HomeworkSubmissionModalProps> = ({
  assignment,
  submission,
  studentId,
  studentName,
  onClose
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { submitHomework, error: storeError } = useHomeworkStore();

  const isSubmitted = useMemo(() => !!submission, [submission]);
  const isGraded = useMemo(() => submission?.status === 'GRADED', [submission]);
  const maxAttempts = assignment.maxAttempts || assignment.max_attempts || 1;
  const attemptsUsed = submission?.attemptNo || submission?.attempt_no || (submission ? 1 : 0);
  const isOpen = assignment.effectiveStatus === 'OPEN' || (!assignment.effectiveStatus && Date.parse(assignment.deadline) > Date.now());
  const allowUpload = isOpen && !isGraded && attemptsUsed < maxAttempts;

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 8);
    if (files.length) {
      const invalid = files.find(file => file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
      if (invalid) {
        window.alert('Chỉ nhận ảnh JPG, PNG hoặc WebP, tối đa 10 MB mỗi ảnh.');
        return;
      }
      const warnings = (await Promise.all(files.map(inspectImageQuality))).flat();
      if (warnings.length && window.confirm(`Phát hiện ${[...new Set(warnings)].join(', ')}. Chọn OK để chọn lại ảnh, hoặc Cancel để vẫn dùng ảnh này.`)) {
        e.target.value = '';
        return;
      }
      setSelectedFiles(files);
      setPreviewUrl(URL.createObjectURL(files[0]));
    }
  }, []);

  const handleCancelPreview = useCallback(() => {
    setPreviewUrl(null);
    setSelectedFiles([]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedFiles.length || !allowUpload) return;
    
    setIsSubmitting(true);
    try {
      // 1. Upload to Cloudinary first
      const cloudinaryUrls = await Promise.all(selectedFiles.map(uploadToCloudinary));
      
      // 2. Submit to backend with real URL and student name
      await submitHomework({
        assignment_id: assignment.id,
        student_id: studentId,
        student_name: studentName,
        file_urls: cloudinaryUrls,
        idempotency_key: crypto.randomUUID(),
        status: 'SUBMITTED'
      });
      onClose();
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedFiles, allowUpload, assignment.id, studentId, studentName, submitHomework, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-indigo-200 shadow-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 leading-tight">{assignment.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase tracking-wider">
                  Môn {assignment.subject || 'Công nghệ'}
                </span>
                {isGraded && (
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Đã hoàn thành
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-200 transition-all active:rotate-90 pointer-events-auto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <AssignmentDetails 
              assignment={assignment} 
              submission={submission} 
              isGraded={isGraded} 
            />
            
            <SubmissionArea 
              isSubmitted={isSubmitted}
              isGraded={isGraded}
              submission={submission}
              previewUrl={previewUrl}
              isSubmitting={isSubmitting}
              storeError={storeError}
              allowUpload={allowUpload}
              maxAttempts={maxAttempts}
              onFileChange={handleFileChange}
              onCancelPreview={handleCancelPreview}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
};
