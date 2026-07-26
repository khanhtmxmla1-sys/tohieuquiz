import React, { useState, useEffect } from 'react';
import { Sparkles, BrainCircuit, RefreshCw, Quote, Send, Loader2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ExplanationContent from '../../../components/common/ExplanationContent';
import { hasMathSyntax, normalizeMathText } from '../../../utils/mathText';

interface AIInsightBoxProps {
  insight: string | null;
  isLoading: boolean;
  onAnalyze: () => void;
  error?: string | null;
}

export const AIInsightBox: React.FC<AIInsightBoxProps> = ({
  insight,
  isLoading,
  onAnalyze,
  error
}) => {
  const [displayText, setDisplayText] = useState('');
  
  // Hiệu ứng "typing" khi có insight mới
  useEffect(() => {
    if (!insight || isLoading) {
      setDisplayText('');
      return;
    }

    // A partial TeX expression is invalid while the typewriter is running.
    // Mathematical insights are rendered atomically; plain prose keeps the effect.
    if (hasMathSyntax(normalizeMathText(insight))) {
      setDisplayText(insight);
      return;
    }

    let index = 0;
    setDisplayText('');
    const interval = setInterval(() => {
      setDisplayText(insight.substring(0, index));
      index += 2;
      if (index > insight.length) clearInterval(interval);
    }, 5);
    return () => clearInterval(interval);
  }, [insight, isLoading]);

  return (
    <div className="relative group">
      {/* Background Decor */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
      
      <div className="relative bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden min-h-[250px] flex flex-col">
        
        {/* Card Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 text-white">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg">Cố vấn Học tập AI</h3>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Powered by Gemini 2.0</span>
              </div>
            </div>
          </div>
          
          {insight && !isLoading && (
            <button 
              onClick={onAnalyze}
              className="p-2 text-blue-900 hover:text-blue-700 hover:bg-indigo-50 rounded-xl transition-all"
              title="Phân tích lại"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Card Content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {!insight && !isLoading ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-8 text-center"
              >
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-dashed border-slate-200">
                    <Sparkles className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-sm text-slate-500 font-medium max-w-xs mb-6">
                  TôHiệuQuiz AI sẽ đọc biểu đồ năng lực và viết nhận xét sư phạm chi tiết.
                </p>
                <button 
                  onClick={onAnalyze}
                  className="px-8 py-3 bg-indigo-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  Kích hoạt Phân tích AI
                </button>
              </motion.div>
            ) : isLoading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">
                    Đang đọc dữ liệu...
                </p>
              </motion.div>
            ) : error ? (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100 flex items-center gap-3">
                    <XCircle className="w-5 h-5" />
                    {error}
                </div>
            ) : (
              <motion.div 
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative"
              >
                <Quote className="absolute -top-4 -left-2 w-8 h-8 text-indigo-100 -scale-x-100" />
                <div className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed font-medium">
                  <ExplanationContent content={displayText} />
                </div>
                <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-4">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic flex items-center gap-2">
                        <Quote className="w-3 h-3 text-indigo-300" />
                        Lời khuyên dành riêng cho phụ huynh
                    </p>
                    <button className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 uppercase hover:underline">
                        <Send className="w-3 h-3" /> Gửi báo cáo
                    </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
