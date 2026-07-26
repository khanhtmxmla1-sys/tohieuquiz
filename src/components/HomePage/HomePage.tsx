import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Quiz } from '../../types';
import { useAuthStore } from '../../../stores/authStore';
import { useQuizStore } from '../../../stores/quizStore';
import { useAssignmentStore } from '../../stores/useAssignmentStore';
import { useClassroomStore } from '../../stores/useClassroomStore';
import { Lock, Search, Clock, ChevronRight } from 'lucide-react';
import Modal from '../common/Modal';
import LoginModal from '../common/LoginModal';
import AnnouncementMarquee from '../common/AnnouncementMarquee';
import QuizListPage from './QuizListPage';
import { getAllAssignments } from '../../services/classroomService';
import { Assignment } from '../../types/classroom.types';
import LoginLandingPage from './LoginLandingPage';
const StudentDashboardUI = React.lazy(() => import('./StudentDashboardUI'));

// --- Sub-components ---
import { DashboardNavbar } from './components/DashboardNavbar';
import { DashboardHero } from './components/DashboardHero';
import { DashboardDecoration } from './components/DashboardDecoration';
import { SubjectGrid } from './components/SubjectGrid';

// --- Constants ---
import { 
    FLUENT_CDN, 
    COMING_SOON_CATEGORIES, 
    SUBJECT_CONFIG 
} from './constants/dashboard.constants';

const isAssignmentClosed = (assignment?: Assignment): boolean => {
    if (!assignment) return false;
    if (assignment.status === 'CLOSED') return true;
    const deadline = Date.parse(assignment.deadline || '');
    return Number.isFinite(deadline) && deadline < Date.now();
};

const HomePage: React.FC = () => {
    // --- State ---
    const [view, setView] = useState<'home' | 'quiz-list'>('home');
    const [activeTab, setActiveTab] = useState<string>('all');
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [loginTab, setLoginTab] = useState<'student' | 'teacher'>('student');
    const [searchTerm, setSearchTerm] = useState('');
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [showComingSoon, setShowComingSoon] = useState(false);

    // --- Stores ---
    const authStore = useAuthStore();
    const quizStore = useQuizStore();
    const classroomStore = useClassroomStore();
    const assignmentStore = useAssignmentStore();

    // --- Derived State ---
    const isStudentLoggedIn = !!classroomStore.studentSession;
    const isTeacherLoggedIn = authStore.isLoggedIn;
    const isLoggedIn = isStudentLoggedIn || isTeacherLoggedIn;

    // --- Fetch assignments only for authenticated teacher/admin views ---
    // Student-specific assignments are fetched separately from the student JWT session.
    useEffect(() => {
        if (!isTeacherLoggedIn) {
            setAssignments([]);
            return;
        }

        const fetchAssignments = async () => {
            try {
                const data = await getAllAssignments();
                setAssignments(data);
            } catch (error) {
                console.error('Failed to fetch assignments:', error);
                setAssignments([]);
            }
        };
        fetchAssignments();
    }, [isTeacherLoggedIn]);

    // --- Fetch Student Assignments if Logged In ---
    useEffect(() => {
        if (isStudentLoggedIn && classroomStore.studentSession) {
            assignmentStore.fetchStudentAssignments(classroomStore.studentSession.studentId);
        }
    }, [isStudentLoggedIn, classroomStore.studentSession?.studentId]);

    // --- Auto-redirect Teachers to Dashboard ---
    useEffect(() => {
        if (isTeacherLoggedIn && !isStudentLoggedIn && quizStore.view === 'home') {
            quizStore.setView('teacher_dash');
        }
    }, [isTeacherLoggedIn, isStudentLoggedIn, quizStore.view, quizStore]);

    // --- Map Assignments to Quiz Format ---
    const assignmentQuizzes = useMemo((): Quiz[] => {
        return assignments.map((assignment) => ({
            id: assignment.quizId,
            title: assignment.quizTitle || 'Bài tập',
            category: 'class',
            questions: [],
            duration: 0,
            timeLimit: 0,
            requireCode: false,
            allowReview: false,
            classLevel: '',
            subject: 'class',
            createdAt: assignment.createdAt,
            maxScore: 0,
            _assignmentData: assignment
        } as Quiz & { _assignmentData?: Assignment }));
    }, [assignments]);

    // Filter assignments for current student
    const myAssignmentQuizzes = useMemo(() => {
        if (!isStudentLoggedIn || !classroomStore.studentSession) return [];

        const studentAssignments = assignmentStore.assignments;
        const allQuizzes = quizStore.quizzes;

        return studentAssignments.map((assignment) => {
            const originalQuiz = allQuizzes.find(q => q.id === assignment.quizId);

            return {
                id: assignment.quizId,
                title: originalQuiz?.title || assignment.quizTitle || 'Bài tập',
                category: 'class',
                questions: originalQuiz?.questions || [],
                duration: 0,
                timeLimit: originalQuiz?.timeLimit || 0,
                requireCode: false,
                allowReview: false,
                classLevel: originalQuiz?.classLevel || '',
                subject: 'class',
                createdAt: assignment.createdAt,
                maxScore: originalQuiz ? (originalQuiz.questions?.length || 0) * 10 : 0,
                _assignmentData: assignment
            } as Quiz & { _assignmentData?: Assignment; duration?: number; maxScore?: number };
        });
    }, [isStudentLoggedIn, classroomStore.studentSession, assignmentStore.assignments, quizStore.quizzes]);

    // --- Filter Quizzes ---
    const filteredQuizzes = useMemo(() => {
        let quizzes: Quiz[] = [];

        if (activeTab === 'all') {
            quizzes = [...quizStore.quizzes];
        } else if (activeTab === 'game') {
            return [];
        } else if (activeTab === 'class') {
            if (isStudentLoggedIn) {
                quizzes = myAssignmentQuizzes;
            } else {
                quizzes = assignmentQuizzes;
            }
        } else {
            quizzes = quizStore.quizzes.filter(q => (q.category || 'class') === activeTab);
        }

        if (activeTab !== 'class') {
            quizzes = quizzes.filter(q => q.showOnHome !== false);

            if (isStudentLoggedIn) {
                const assignedQuizIds = myAssignmentQuizzes.map(aq => aq.id);
                quizzes = quizzes.filter(q => !assignedQuizIds.includes(q.id));
            }
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            quizzes = quizzes.filter(q => q.title.toLowerCase().includes(term));
        }
        if (quizStore.selectedClassLevel) {
            quizzes = quizzes.filter(q => q.classLevel === quizStore.selectedClassLevel);
        }
        return quizzes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [activeTab, quizStore.quizzes, myAssignmentQuizzes, assignments, searchTerm, quizStore.selectedClassLevel, isTeacherLoggedIn]);

    // --- Handlers ---
    const openLogin = (tab: 'student' | 'teacher') => {
        setLoginTab(tab);
        setIsLoginModalOpen(true);
    };

    const handleQuizClick = async (q: Quiz) => {
        if (isStudentLoggedIn && classroomStore.studentSession) {
            if (q._assignmentData) {
                const assignmentId = q._assignmentData.id;
                const studentId = classroomStore.studentSession.studentId;

                await assignmentStore.fetchStudentAssignments(studentId);
                const freshAssignments = useAssignmentStore.getState().assignments;
                const freshAssignment = freshAssignments.find(a => a.id === assignmentId);

                if (freshAssignment) {
                    const maxAttempts = freshAssignment.maxAttempts || 1;
                    const usedAttempts = freshAssignment.attemptCount || 0;

                    if (isAssignmentClosed(freshAssignment)) {
                        toast.error('Bài tập này đã đóng nên không thể làm nữa.');
                        return;
                    }

                    if (usedAttempts >= maxAttempts) {
                        toast.error(`Bạn đã hết lượt làm bài này! (${usedAttempts}/${maxAttempts} lượt)`);
                        return;
                    }
                }

                const success = await assignmentStore.startAssignmentAttempt(assignmentId, studentId);
                if (!success) {
                    toast.error('Lỗi khi bắt đầu làm bài. Vui lòng thử lại.');
                    return;
                }
                await assignmentStore.fetchStudentAssignments(studentId);
            } else {
                const linkedAssignment = myAssignmentQuizzes.find(aq => aq.id === q.id);
                if (linkedAssignment && linkedAssignment._assignmentData) {
                    const assignmentId = linkedAssignment._assignmentData.id;
                    const studentId = classroomStore.studentSession.studentId;
                    const attemptCount = linkedAssignment._assignmentData.attemptCount || 0;
                    const maxAttempts = linkedAssignment._assignmentData.maxAttempts || 1;

                    if (isAssignmentClosed(linkedAssignment._assignmentData)) {
                        toast.error('Bài tập này đã đóng nên không thể làm nữa.');
                        return;
                    }

                    if (attemptCount >= maxAttempts) {
                        toast.error(`Bạn đã hết lượt làm bài tập này (${attemptCount}/${maxAttempts}).`);
                        return;
                    }

                    const success = await assignmentStore.startAssignmentAttempt(assignmentId, studentId);
                    if (!success) {
                        toast.error('Lỗi khi bắt đầu làm bài. Vui lòng thử lại.');
                        return;
                    }
                    await assignmentStore.fetchStudentAssignments(studentId);
                }
            }
        }
        quizStore.selectQuiz(q);
        quizStore.setView('student');
    };

    const handleCategoryClick = (catId: string) => {
        if (COMING_SOON_CATEGORIES.includes(catId)) {
            setShowComingSoon(true);
            return;
        }
        setActiveTab(catId);
        setView('quiz-list');
    };

    const handleBackHome = () => {
        setView('home');
        setActiveTab('all');
        setSearchTerm('');
    };

    const handleResetHome = () => {
        setView('home');
        setActiveTab('all');
        quizStore.setClassLevel(null);
    };

    // --- Subject Stats (for cards) ---
    const subjectCards = useMemo(() => {
        const allQuizzes = quizStore.quizzes;
        const categories = ['all', 'class'];
        return categories.map(cat => {
            let catQuizzes = [];
            if (cat === 'all') {
                catQuizzes = allQuizzes.filter(q => q.showOnHome !== false);
            } else if (cat === 'class') {
                catQuizzes = isStudentLoggedIn ? myAssignmentQuizzes : assignmentQuizzes;
            } else {
                catQuizzes = quizStore.quizzes.filter(q => (q.category || 'class') === cat && q.showOnHome !== false);
            }
            return {
                id: cat,
                ...SUBJECT_CONFIG[cat],
                total: catQuizzes.length,
            };
        });
    }, [quizStore.quizzes, myAssignmentQuizzes, assignmentQuizzes, isStudentLoggedIn]);

    // =====================================================
    // RENDER
    // =====================================================

    if (!isLoggedIn) {
        return <LoginLandingPage />;
    }

    if (isStudentLoggedIn && view === 'home') {
        return (
            <React.Suspense fallback={(
                <div className="min-h-dvh bg-[#F4F7FC] flex items-center justify-center text-slate-500 font-semibold">
                    Đang tải không gian học tập...
                </div>
            )}>
                <StudentDashboardUI />
            </React.Suspense>
        );
    }

    // Nếu là giáo viên/admin đã đăng nhập và đang ở view 'home', trả về null để chờ App.tsx hoặc useEffect nội bộ chuyển hướng
    // Điều này ngăn chặn việc hiển thị giao diện "Green Meadow" (vốn dành cho học sinh) trong giây lát.
    if (isTeacherLoggedIn && !isStudentLoggedIn && quizStore.view === 'home') {
        return null;
    }

    return (
        <div className="sticker-land">
            <AnnouncementMarquee />
            <DashboardDecoration />

            <DashboardNavbar 
                isLoggedIn={isLoggedIn}
                isTeacherLoggedIn={isTeacherLoggedIn}
                onResetHome={handleResetHome}
                onOpenLogin={() => openLogin('student')}
                onActionCta={() => isTeacherLoggedIn ? quizStore.setView('teacher_dash') : quizStore.setView('home')}
            />

            {/* QUIZ LIST VIEW */}
            {view === 'quiz-list' && (
                <QuizListPage
                    category={activeTab}
                    quizzes={filteredQuizzes}
                    onBack={handleBackHome}
                    onQuizClick={handleQuizClick}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    selectedGrade={quizStore.selectedClassLevel}
                    onGradeChange={quizStore.setClassLevel}
                    isLoggedIn={isLoggedIn}
                    onLoginClick={() => openLogin('student')}
                />
            )}

            {/* HOME VIEW */}
            {view === 'home' && (
                <>
                    <DashboardHero 
                        onScrollToSubjects={() => document.getElementById('subject-cards')?.scrollIntoView({ behavior: 'smooth' })}
                    />

                    <SubjectGrid 
                        subjectCards={subjectCards}
                        activeTab={activeTab}
                        onCategoryClick={handleCategoryClick}
                    />

                    {/* SEARCH BAR (For quick filtering if needed) */}
                    {activeTab !== 'all' && !COMING_SOON_CATEGORIES.includes(activeTab) && (
                        <div className="sticker-search max-w-2xl mx-auto mb-8">
                            <Search className="sticker-search__icon" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Tìm bài ôn tập..."
                                className="sticker-search__input"
                            />
                        </div>
                    )}

                    {/* INLINE QUIZ LIST (If a category is selected and we stay on home) */}
                    {activeTab !== 'all' && !COMING_SOON_CATEGORIES.includes(activeTab) && (
                        <section className="sticker-quiz-list">
                            <h2 className="sticker-quiz-list__title">
                                <img
                                    src={SUBJECT_CONFIG[activeTab]?.icon || `${FLUENT_CDN}/Books/3D/books_3d.png`}
                                    alt=""
                                    className="sticker-quiz-list__title-icon"
                                />
                                {SUBJECT_CONFIG[activeTab]?.title || 'Bài ôn tập'}
                                <span className="sticker-quiz-list__count">{filteredQuizzes.length} bài</span>
                            </h2>

                            <div className="sticker-quiz-grid">
                                {filteredQuizzes.length > 0 ? (
                                    filteredQuizzes.map((quiz) => {
                                        const catConfig = SUBJECT_CONFIG[quiz.category || 'class'] || SUBJECT_CONFIG['class'];
                                        return (
                                            <button
                                                key={(quiz as any)._assignmentData?.id || quiz.id}
                                                onClick={() => handleQuizClick(quiz)}
                                                className="sticker-quiz-item"
                                            >
                                                <div
                                                    className="sticker-quiz-item__stripe"
                                                    style={{ background: catConfig.color }}
                                                />
                                                <div className="sticker-quiz-item__header">
                                                    <img src={catConfig.icon} alt="" className="sticker-quiz-item__emoji" />
                                                    {quiz.requireCode && (
                                                        <Lock className="sticker-quiz-item__lock" />
                                                    )}
                                                </div>
                                                <h4 className="sticker-quiz-item__title">{quiz.title}</h4>
                                                <div className="sticker-quiz-item__meta">
                                                    <span><Clock className="w-3.5 h-3.5" /> {quiz.timeLimit} phút</span>
                                                    <span>📝 {quiz.questions.length} câu</span>
                                                </div>
                                                <div className="sticker-quiz-item__cta" style={{ color: catConfig.color }}>
                                                    Bắt đầu <ChevronRight className="w-4 h-4" />
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="sticker-empty">
                                        <img
                                            src={`${FLUENT_CDN}/See-no-evil%20monkey/3D/see-no-evil_monkey_3d.png`}
                                            alt=""
                                            className="sticker-empty__img"
                                        />
                                        <h3 className="sticker-empty__title">Không tìm thấy bài nào!</h3>
                                        <p className="sticker-empty__text">Thử tìm từ khóa khác xem sao?</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </>
            )}

            {/* COMING SOON MODAL */}
            <Modal
                isOpen={showComingSoon}
                onClose={() => setShowComingSoon(false)}
                title=""
                showCloseButton={false}
                size="sm"
            >
                <div className="text-center p-4">
                    <div className="mb-4 flex justify-center">
                        <img
                            src={`${FLUENT_CDN}/Rocket/3D/rocket_3d.png`}
                            alt="Rocket"
                            className="w-24 h-24 object-contain motion-safe:animate-pulse"
                        />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                        Sắp ra mắt!
                    </h3>
                    <p className="text-gray-600 font-medium mb-6">
                        Chức năng này đang được phát triển.<br />
                        Các em quay lại sau nhé!
                    </p>
                    <button
                        onClick={() => setShowComingSoon(false)}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform transform hover:scale-105 active:scale-95"
                    >
                        Dạ vâng ạ!
                    </button>
                </div>
            </Modal>

            {/* LOGIN MODAL */}
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                initialTab={loginTab}
            />
        </div>
    );
};

export default HomePage;
