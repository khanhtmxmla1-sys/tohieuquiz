import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { useQuizStore } from '../../stores/useQuizStore';
import { Loader2, Play, RotateCcw, Home } from 'lucide-react';
import { getRandomQuestions } from './gameQuestions';

const GameCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { state, score, lives, highScore, startGame, resetGame, addScore, loseLife } = useGameStore();
    const { quizzes } = useQuizStore();

    // Local Game State
    const [gameQuestions, setGameQuestions] = useState<any[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [flowers, setFlowers] = useState<any[]>([]);


    // Initialize Game
    useEffect(() => {
        if (state === 'PLAYING') {
            // ALWAYS get 50 random questions from the math question bank
            // This ensures we only use the simple addition/subtraction questions
            const questions = getRandomQuestions(50);

            setGameQuestions(questions);
            setCurrentQuestionIndex(0);
            setFlowers([]);
        }
    }, [state, quizzes]);

    // Game Loop Logic
    useEffect(() => {
        if (state !== 'PLAYING') return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        // Game State (Local to loop for performance)
        let beeY = canvas.height / 2;
        let beeVelocity = 0;
        let localFlowers: any[] = [];
        let localQIndex = 0;
        let isGameOver = false;

        const GRAVITY = 0.4;
        const JUMP_STRENGTH = -7;

        // Input handling
        const jump = () => {
            beeVelocity = JUMP_STRENGTH;
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') jump();
        };

        const handleTouchStart = () => {
            jump();
        };

        window.addEventListener('keydown', handleKeyDown);
        canvas.addEventListener('touchstart', handleTouchStart);
        canvas.addEventListener('mousedown', handleTouchStart);

        const loop = () => {
            if (isGameOver) return;

            const width = canvas.width;
            const height = canvas.height;

            // 1. Update Physics
            beeVelocity += GRAVITY;
            beeY += beeVelocity;

            // Boundaries
            if (beeY < 20) {
                beeY = 20;
                beeVelocity = 0;
            }
            if (beeY > height - 20) {
                beeY = height - 20;
                beeVelocity = -5; // Bounce
            }

            // 2. Spawning Flowers
            if (localFlowers.length === 0 && localQIndex < gameQuestions.length) {
                const q = gameQuestions[localQIndex];
                const options = q.options || ['Yes', 'No'];
                // Ensure at least 2 options, max 4
                const safeOptions = options.slice(0, 4);
                const gap = height / (safeOptions.length + 1);

                safeOptions.forEach((opt: string, idx: number) => {
                    // Determine correctness
                    const isCorrect = opt === q.correctAnswer;

                    localFlowers.push({
                        x: width + 50 + (Math.random() * 20), // Stagger slightly
                        y: gap * (idx + 1),
                        text: opt,
                        isCorrect: isCorrect
                    });
                });
            } else if (localQIndex >= gameQuestions.length && localFlowers.length === 0) {
                isGameOver = true;
                setTimeout(() => {
                    // Start Over with same questions for now (Loop Mode)
                    // Or ideally fetch new quiz.
                    // For now, let's just trigger Game Over to show score.
                    // But if lives > 0, we should probably win?
                    // Let's just create a loop by resetting index
                    // localQIndex = 0; 
                    // NO, let's show Game Over screen with High Score updated.
                    loseLife(); // Hack to trigger Game Over logic in store? No, explicit EndGame needed.
                    // Accessing store getState would be better but hooks don't expose it directly.
                    // But we can just use the bound functions.
                    // Since 'loseLife' checks <=0, we can force it or add 'endGame' to store.
                    // Resetting game loops to menu. Use logic to show summary.
                    // Let's just call loseLife repeatedly? No.
                    // Let's modify store to have 'winGame' or just show score.
                    // For now:
                    resetGame();
                }, 500);
            }

            // 3. Update Flowers
            localFlowers.forEach(f => f.x -= 3); // Move left

            // Respawn condition: All off screen?
            if (localFlowers.length > 0 && localFlowers.every(f => f.x < -100)) {
                // Missed all? Respawn same question
                localFlowers = [];
            }

            // 4. Collision
            const beeRadius = 20;
            const flowerRadius = 25;

            for (let i = localFlowers.length - 1; i >= 0; i--) {
                const f = localFlowers[i];
                const dx = 100 - f.x;
                const dy = beeY - f.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < beeRadius + flowerRadius) {
                    if (f.isCorrect) {
                        addScore(10);
                        localQIndex++;
                        setCurrentQuestionIndex(localQIndex); // Sync for UI
                        localFlowers = []; // Clear
                    } else {
                        loseLife();
                        localFlowers.splice(i, 1); // Remove wrong one
                    }
                    break;
                }
            }

            // 5. Render
            ctx.clearRect(0, 0, width, height);

            // Sky
            ctx.fillStyle = '#e0f2fe';
            ctx.fillRect(0, 0, width, height);

            // Draw Question Text
            if (localQIndex < gameQuestions.length) {
                const q = gameQuestions[localQIndex];
                const qText = q.text || q.question || "Chọn đáp án đúng";
                ctx.font = 'bold 24px "Nunito", sans-serif';
                ctx.fillStyle = '#1e293b';
                ctx.textAlign = 'center';
                ctx.fillText(qText, width / 2, 50);
            }

            // Draw Flowers
            localFlowers.forEach(f => {
                // Stem
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(f.x, f.y);
                ctx.lineTo(f.x, f.y + 30);
                ctx.stroke();

                // Petals
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(f.x, f.y, 20, 0, Math.PI * 2);
                ctx.fill();

                // Center
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(f.x, f.y, 10, 0, Math.PI * 2);
                ctx.fill();

                // Text
                ctx.fillStyle = '#334155';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const displayText = f.text.length > 12 ? f.text.substring(0, 10) + '..' : f.text;
                ctx.fillText(displayText, f.x, f.y + 45);
            });

            // Draw Bee
            // Body
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(100, beeY, 20, 0, Math.PI * 2);
            ctx.fill();

            // Stripes
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(90, beeY - 15, 5, 30);
            ctx.fillRect(105, beeY - 15, 5, 30);

            // Eye
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(110, beeY - 5, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(112, beeY - 5, 2, 0, Math.PI * 2);
            ctx.fill();

            // Wings
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            const wingOffset = Math.abs(Math.sin(Date.now() / 50)) * 5;
            ctx.ellipse(100, beeY - 20, 15, 8 + wingOffset, 0, 0, Math.PI * 2);
            ctx.fill();

            if (state === 'PLAYING') {
                animationFrameId = window.requestAnimationFrame(loop);
            }
        };

        loop();

        return () => {
            window.cancelAnimationFrame(animationFrameId);
            window.removeEventListener('keydown', handleKeyDown);
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('mousedown', handleTouchStart);
            isGameOver = true;
        };
    }, [state, gameQuestions]);

    return (
        <div className="w-full max-w-4xl mx-auto p-4 animate-fade-in">
            {/* HUD */}
            <div className="flex justify-between items-center mb-4 bg-white/90 p-4 rounded-2xl shadow-lg border-2 border-amber-100">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-500 uppercase font-bold">Điểm số</span>
                        <span className="text-2xl font-extrabold text-amber-600">{score}</span>
                    </div>
                    <div className="w-px h-10 bg-slate-200"></div>
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-500 uppercase font-bold">Kỷ lục</span>
                        <span className="text-xl font-bold text-slate-700">{highScore}</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    {[...Array(3)].map((_, i) => (
                        <span key={i} className={`text-2xl transition-all ${i < lives ? 'opacity-100 scale-100' : 'opacity-20 scale-75 grayscale'}`}>
                            ❤️
                        </span>
                    ))}
                </div>
            </div>

            {/* Game Container */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-video bg-sky-100">
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={450}
                    className="w-full h-full object-cover block"
                />

                {/* Overlays */}
                {state === 'MENU' && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                        <div className="text-center text-white space-y-6 animate-scale-in">
                            <h1 className="text-5xl font-extrabold text-yellow-400 drop-shadow-lg">
                                Ong Thợ Tìm Mật
                            </h1>
                            <p className="text-xl opacity-90">Bay qua các bông hoa và trả lời đúng để lấy mật!</p>
                            <button
                                onClick={startGame}
                                className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl font-bold text-xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 mx-auto"
                            >
                                <Play className="fill-current" />
                                Bắt đầu chơi
                            </button>
                        </div>
                    </div>
                )}

                {state === 'GAME_OVER' && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center">
                        <div className="text-center text-white space-y-6 animate-scale-in">
                            <div className="text-6xl mb-2">😢</div>
                            <h2 className="text-4xl font-bold">Hết lượt chơi!</h2>
                            <div className="text-2xl">
                                Điểm của bạn: <span className="text-amber-400 font-extrabold">{score}</span>
                            </div>
                            <div className="flex gap-4 justify-center mt-8">
                                <button
                                    onClick={resetGame}
                                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold backdrop-blur transition-all"
                                >
                                    <Home className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={startGame}
                                    className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                    Chơi lại
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <p className="text-center text-slate-400 text-sm mt-4">
                Tip: Click vào đáp án đúng để giúp Ong bay nhanh hơn!
            </p>
        </div>
    );
};

export default GameCanvas;
