import React, { useMemo } from 'react';
import { Quiz, QuestionType, StudentResult } from '../../../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Award, Target, BarChart3 } from 'lucide-react';

interface Props {
    quiz: Quiz;
    result: StudentResult;
    answers: Record<string, any>;
}

const COLORS = {
    correct: '#10B981',
    wrong: '#EF4444',
    skipped: '#9CA3AF'
};

const StatisticsTab: React.FC<Props> = ({ quiz, result, answers }) => {
    // Calculate detailed stats
    const stats = useMemo(() => {
        let correct = 0;
        let wrong = 0;
        let skipped = 0;
        const byType: Record<string, { correct: number; total: number }> = {};

        quiz.questions.forEach(q => {
            const answer = answers[q.id];
            const typeName = q.type;
            const vd = result.validationDetails?.find(d => d.questionId === q.id);

            if (!byType[typeName]) {
                byType[typeName] = { correct: 0, total: 0 };
            }
            byType[typeName].total++;

            // Check if answered
            if (!answer && answer !== false && answer !== 0) {
                skipped++;
                return;
            }

            // Check correctness - USE SERVER VALIDATION DETAILS AS SOURCE OF TRUTH
            const isCorrect = vd ? vd.isCorrect : false;

            if (isCorrect) {
                correct++;
                byType[typeName].correct++;
            } else {
                wrong++;
            }
        });

        return { correct, wrong, skipped, byType };
    }, [quiz.questions, answers, result.validationDetails]);

    // Pie chart data
    const pieData = [
        { name: 'Đúng', value: stats.correct, color: COLORS.correct },
        { name: 'Sai', value: stats.wrong, color: COLORS.wrong },
        { name: 'Bỏ qua', value: stats.skipped, color: COLORS.skipped }
    ].filter(d => d.value > 0);

    // Bar chart data for question types
    const typeLabels: Record<string, string> = {
        MCQ: 'Trắc nghiệm',
        TRUE_FALSE: 'Đúng/Sai',
        SHORT_ANSWER: 'Tự luận',
        MATCHING: 'Nối cặp',
        MULTIPLE_SELECT: 'Chọn nhiều',
        DRAG_DROP: 'Kéo thả',
        CATEGORIZATION: 'Phân loại',
        WORD_SCRAMBLE: 'Ghép từ',
        RIDDLE: 'Câu đố'
    };

    const barData = Object.entries(stats.byType).map(([type, data]) => ({
        name: typeLabels[type] || type,
        'Tỷ lệ đúng': Math.round((data.correct / data.total) * 100),
        total: data.total
    }));

    // Calculate performance metrics
    const accuracy = Math.round((result.correctCount / result.totalQuestions) * 100);
    const performance = accuracy >= 80 ? 'Xuất sắc' : accuracy >= 60 ? 'Khá' : accuracy >= 40 ? 'Trung bình' : 'Cần cải thiện';

    return (
        <div className="p-6 space-y-8">
            {/* Performance Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl p-4 border border-green-200 text-center">
                    <Target className="w-8 h-8 mx-auto mb-2 text-green-600" />
                    <p className="text-3xl font-bold text-green-700">{accuracy}%</p>
                    <p className="text-sm text-green-600">Độ chính xác</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-4 border border-blue-200 text-center">
                    <Award className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                    <p className="text-xl font-bold text-blue-700">{performance}</p>
                    <p className="text-sm text-blue-600">Đánh giá</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-violet-100 rounded-xl p-4 border border-purple-200 text-center">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-700" />
                    <p className="text-3xl font-bold text-blue-800">{result.score}</p>
                    <p className="text-sm text-blue-700">Điểm số</p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl p-4 border border-amber-200 text-center">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-amber-600" />
                    <p className="text-3xl font-bold text-amber-700">{result.timeTaken || 0}</p>
                    <p className="text-sm text-amber-600">Phút hoàn thành</p>
                </div>
            </div>

            {/* Charts section */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Pie Chart - Results Distribution */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" />
                        Tỷ lệ câu trả lời
                    </h3>

                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    labelLine={false}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend summary */}
                    <div className="flex justify-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.correct }} />
                            <span className="text-sm">{stats.correct} câu đúng</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.wrong }} />
                            <span className="text-sm">{stats.wrong} câu sai</span>
                        </div>
                        {stats.skipped > 0 && (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.skipped }} />
                                <span className="text-sm">{stats.skipped} bỏ qua</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bar Chart - Performance by Type */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                        Tỷ lệ đúng theo loại câu hỏi
                    </h3>

                    {barData.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(value) => `${value}%`} />
                                    <Bar
                                        dataKey="Tỷ lệ đúng"
                                        fill="#6366F1"
                                        radius={[0, 4, 4, 0]}
                                        background={{ fill: '#E5E7EB' }}
                                    />

                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-400">
                            <p>Không có dữ liệu</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Weakness Analysis */}
            {stats.wrong > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                    <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                        ⚠️ Điểm cần cải thiện
                    </h3>
                    <ul className="space-y-2">
                        {Object.entries(stats.byType)
                            .filter(([_, data]) => data.correct < data.total)
                            .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
                            .slice(0, 3)
                            .map(([type, data]) => {
                                const rate = Math.round((data.correct / data.total) * 100);
                                return (
                                    <li key={type} className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                                        <span className="text-amber-700">
                                            <strong>{typeLabels[type] || type}</strong>: {rate}% đúng ({data.correct}/{data.total} câu)
                                        </span>
                                    </li>
                                );
                            })}
                    </ul>
                    <p className="mt-4 text-sm text-amber-600">
                        💡 Hãy xem tab <strong>"Gợi ý"</strong> để nhận tư vấn ôn tập từ AI!
                    </p>
                </div>
            )}

            {/* Perfect score celebration */}
            {stats.wrong === 0 && stats.skipped === 0 && (
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-6 text-white text-center">
                    <div className="text-5xl mb-3">🏆</div>
                    <h3 className="text-2xl font-bold mb-2">Hoàn hảo!</h3>
                    <p className="opacity-90">Em đã trả lời đúng tất cả các câu hỏi. Thật tuyệt vời!</p>
                </div>
            )}
        </div>
    );
};

export default StatisticsTab;
