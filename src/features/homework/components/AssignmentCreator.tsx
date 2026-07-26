import React, { useState } from 'react';
import { Upload, FileText, Calendar, Send, Loader2, X, CheckCircle2, Hash, Users } from 'lucide-react';
import { Button } from '../../../components/common';
import { homeworkService } from '../services/homeworkService';
import { useHomeworkUpload } from '../hooks/useHomeworkUpload';
import { useHomeworkStore } from '../stores/useHomeworkStore';
import { useAuthStore } from '../../../../stores/authStore';
import { useClassStore } from '../../../stores/useClassStore';
import { showSuccess, showError } from '../../../utils/toast';

interface AssignmentCreatorProps {
  onSuccess: () => void;
}

export const AssignmentCreator: React.FC<AssignmentCreatorProps> = ({ onSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [deadline, setDeadline] = useState('');
  const [aiContent, setAiContent] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [uploadedFileType, setUploadedFileType] = useState('');
  
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const { addAssignment, isLoading: isSaving } = useHomeworkStore();
  const { username, teacherClass } = useAuthStore();
  const classes = useClassStore((state) => state.classes);
  
  const { uploadHomework, isUploading, progress, url } = useHomeworkUpload();

  // Auto-select class if available
  React.useEffect(() => {
    if (teacherClass) {
        setSelectedClassId(teacherClass);
    } else if (classes.length > 0) {
        setSelectedClassId(classes[0].id);
    }
  }, [teacherClass, classes]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileType(file.type);

    // 1. Upload & Get URL
    const uploadedUrl = await uploadHomework(file);
    if (!uploadedUrl) {
      showError('Không thể tải file lên. Vui lòng thử lại!');
      return;
    }

    // 2. Ask AI to OCR the assignment
    setIsProcessingAI(true);
    try {
      const extractedText = await homeworkService.performOCR(uploadedUrl);
      setAiContent(extractedText);
      showSuccess('AI đã đọc nội dung đề bài giúp bạn!');
    } catch (err) {
      console.error('AI OCR error:', err);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleCreate = async () => {
    if (!title || !url || !deadline || !selectedClassId) {
      showError('Vui lòng điền đủ thông tin, chọn lớp và upload đề bài!');
      return;
    }

    if (!username) {
        showError('Lỗi xác thực. Vui lòng đăng nhập lại!');
        return;
    }

    try {
      await addAssignment({
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim(),
        deadline: new Date(deadline).toISOString(),
        source_ocr_text: aiContent,
        ai_content: aiContent,
        rubric: aiContent.trim() ? [{ questionId: 'rubric', label: 'Đáp án mẫu / Tiêu chí', score: 0, maxScore: 10, comment: aiContent.trim() }] : [],
        file_url: url,
        teacher_id: username,
        class_id: selectedClassId,
        maxAttempts,
        status: 'OPEN',
      });
      showSuccess('Đã tạo phiếu bài tập thành công!');
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tạo bài tập';
      showError(message);
    }
  };

  const resetFile = () => {
    // Note: useHomeworkUpload doesn't have a reset method in the current hook, 
    // but we can just clear the local url for now.
    // Ideally we'd notify the hook to reset.
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-200">
          <Upload className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Giao Phiếu Bài Tập</h2>
          <p className="text-slate-500 text-sm">Tạo bài tập tự luận chấm bằng AI</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side: Info */}
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" /> Tên bài tập
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Phiếu Tiếng Việt tuần 23"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                 <Hash className="w-4 h-4 text-blue-600" /> Môn học
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Tiếng Việt, Toán..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                 <Users className="w-4 h-4 text-blue-600" /> Chọn lớp
               </label>
               <select
                 value={selectedClassId}
                 onChange={(e) => setSelectedClassId(e.target.value)}
                 className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
               >
                 {classes.map(c => (
                   <option key={c.id} value={c.id}>{c.name}</option>
                 ))}
                 {classes.length === 0 && <option value="">Chưa có lớp học</option>}
               </select>
             </div>
             <div>
               <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                 <Calendar className="w-4 h-4 text-blue-600" /> Hạn nộp
               </label>
               <input
                 type="datetime-local"
                 value={deadline}
                 onChange={(e) => setDeadline(e.target.value)}
                 className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
               />
             </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-2">Đáp án mẫu / Tiêu chí chấm</span>
              {isProcessingAI && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
            </label>
            <textarea
              value={aiContent}
              onChange={(e) => setAiContent(e.target.value)}
              rows={4}
              placeholder="Có thể bỏ trống, AI sẽ tự đọc nội dung từ ảnh. Tuy nhiên nên có đáp án để chấm chính xác hơn."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Số lần được nộp</label>
            <select
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} lần</option>)}
            </select>
            <p className="text-xs text-slate-400 mt-1">Mỗi lần nộp được lưu riêng; giáo viên luôn xem được lịch sử.</p>
          </div>
        </div>

        {/* Right Side: File Upload Display */}
        <div className="flex flex-col gap-4">
          <label className="block text-sm font-semibold text-slate-700">Đề bài (Ảnh/PDF)</label>
          <div className={`relative flex-1 group min-h-[200px] rounded-3xl border-2 border-dashed transition-all flex items-center justify-center p-4 ${url ? 'border-green-300 bg-green-50/50' : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30'}`}>
            {!url && !isUploading && (
              <div className="text-center space-y-3 cursor-pointer" onClick={() => document.getElementById('hw-file-input')?.click()}>
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform">
                  <FileText className="w-8 h-8 text-slate-400 group-hover:text-blue-600" />
                </div>
                <p className="text-slate-500 text-sm">Nhấn để tải lên hoặc kéo thả file</p>
                <input id="hw-file-input" type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
              </div>
            )}

            {isUploading && (
              <div className="text-center space-y-4 w-full px-8">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-blue-700 font-medium animate-pulse">Đang nén & tải lên... {progress}%</p>
              </div>
            )}

            {url && (
              <div className="relative w-full h-full flex flex-col items-center justify-center text-center py-4">
                <div className="bg-white p-3 rounded-2xl shadow-xl w-full max-w-[240px]">
                  {uploadedFileType === 'application/pdf'
                    ? <div className="h-40 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 font-bold">Tài liệu PDF đã sẵn sàng</div>
                    : <img src={url} alt="Preview" className="w-full h-40 object-contain rounded-xl mb-2" />}
                  <p className="text-[10px] text-slate-400 truncate">{url}</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-green-600 font-bold bg-white/60 backdrop-blur px-4 py-2 rounded-full border border-green-100">
                  <CheckCircle2 className="w-5 h-5" /> Tải lên hoàn tất!
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <Button 
          variant="primary" 
          onClick={handleCreate} 
          disabled={!url || isUploading || isProcessingAI || isSaving}
          icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          className="px-8 py-3 rounded-2xl shadow-lg shadow-indigo-200 bg-gradient-to-r from-blue-600 to-indigo-500"
        >
          {isSaving ? 'Đang lưu...' : 'Giao phiếu bài tập ngay'}
        </Button>
      </div>
    </div>
  );
};
