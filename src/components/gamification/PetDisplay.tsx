/**
 * PetDisplay Component
 *
 * Cute & Cartoon style. Renders the student's pet with bouncy animations,
 * mood indicator, speech bubbles, and equipped accessories.
 * Supports both Emoji mode and 3D Sprite mode (via imageUrl).
 * Fallback: Image -> 3D CSS Cube -> Emoji.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PetData, PET_OPTIONS } from '../../types/gamification.types';
import Css3dChibiPet from './Css3dChibiPet';

// Pet emoji map by ID and level
const getPetEmoji = (petId: string, level: number): string => {
    const petType = petId.split('_')[0]; // "cat", "dog", "rabbit"
    if (level >= 8) {
        // Adult - special variants
        return { cat: '🦁', dog: '🐺', rabbit: '🦊' }[petType] || '🐱';
    }
    if (level >= 4) {
        // Teen variants
        return { cat: '😼', dog: '🐕', rabbit: '🐇' }[petType] || '🐱';
    }
    // Baby variants
    return PET_OPTIONS.find((p) => p.id === petId)?.emoji || '🐱';
};

// Mood emoji
const getMoodEmoji = (mood: string): string => {
    return { happy: '😊', sad: '😢', excited: '🤩', neutral: '😐' }[mood] || '😊';
};

// Random speech bubbles
const SPEECH_BUBBLES = [
    'Hôm nay học gì nè! 📚',
    'Đi thôi nào! 🚀',
    'Mình giỏi lắm! ⭐',
    'Thêm bài nữa đi~',
    'Yay! Vui quá! 🎉',
    'Cho mình đồ mới đi~ 🛍️',
    'Level up thôi! 💪',
    'Mình nhớ bạn! 💝',
];

interface PetDisplayProps {
    pet: PetData;
    size?: 'sm' | 'md' | 'lg';
    interactive?: boolean;
}

const PetDisplay: React.FC<PetDisplayProps> = ({ pet, size = 'lg', interactive = true }) => {
    const [isJumping, setIsJumping] = useState(false);
    const [showHearts, setShowHearts] = useState(false);
    const [speechBubble, setSpeechBubble] = useState('');
    const [showBubble, setShowBubble] = useState(false);
    const [imageError, setImageError] = useState(false);

    // Determines the image URL to try (User's custom URL > Default Option URL)
    const effectiveImageUrl = pet.imageUrl || PET_OPTIONS.find(p => p.id === pet.petId)?.imageUrl;

    // Reset error state if pet changes
    useEffect(() => {
        setImageError(false);
    }, [pet.petId, effectiveImageUrl]);

    // Random speech bubble on mount and periodically
    useEffect(() => {
        const showRandomBubble = () => {
            const msg = SPEECH_BUBBLES[Math.floor(Math.random() * SPEECH_BUBBLES.length)];
            setSpeechBubble(msg);
            setShowBubble(true);
            setTimeout(() => setShowBubble(false), 3000);
        };

        const initialTimer = setTimeout(showRandomBubble, 2000);
        const interval = setInterval(showRandomBubble, 10000 + Math.random() * 5000);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, []);

    const handleClick = useCallback(() => {
        if (!interactive) return;

        setIsJumping(true);
        setTimeout(() => setIsJumping(false), 600);

        setShowHearts(true);
        setTimeout(() => setShowHearts(false), 1000);

        const msg = SPEECH_BUBBLES[Math.floor(Math.random() * SPEECH_BUBBLES.length)];
        setSpeechBubble(msg);
        setShowBubble(true);
        setTimeout(() => setShowBubble(false), 2500);
    }, [interactive]);

    const petEmoji = getPetEmoji(pet.petId, pet.level);
    const moodEmoji = getMoodEmoji(pet.mood);

    const sizeConfig = {
        sm: { container: 'w-24 h-24', emoji: 'text-5xl', img: 'w-16', name: 'text-sm', mood: 'w-6 h-6 text-sm' },
        md: { container: 'w-32 h-32', emoji: 'text-7xl', img: 'w-24', name: 'text-base', mood: 'w-7 h-7 text-base' },
        lg: { container: 'w-48 h-48', emoji: 'text-8xl', img: 'w-40', name: 'text-lg', mood: 'w-8 h-8 text-lg' },
    };

    const cfg = sizeConfig[size];

    // Accessory emojis
    const ACCESSORY_MAP: Record<string, string> = {
        hat_01: '🎩', glass_01: '🕶️', bow_01: '🎀', crown_01: '👑',
        scarf_01: '🧣', wing_01: '🪽', tie_01: '👔', hat_02: '🤠',
        glass_02: '💖', mask_01: '🦸',
    };

    // Determine render mode: CSS 3D Chibi -> Image -> Emoji
    // Priority: CSS 3D chibi is preferred for supported types (looks better than static PNG)
    const petTypeFromId = pet.petId.split('_')[0] as 'cat' | 'dog' | 'rabbit';
    const supportedChibiTypes = ['cat', 'dog', 'rabbit'];
    const showCss3d = supportedChibiTypes.includes(petTypeFromId);
    const showImage = !showCss3d && effectiveImageUrl && !imageError;

    // Border logic: Hide heavy borders for Image/3D modes to look cleaner
    const showBorder = !showImage && !showCss3d;

    return (
        <div className="relative flex flex-col items-center select-none" style={{ fontFamily: "'Quicksand', sans-serif" }}>
            {/* Speech Bubble (Cartoon style) */}
            <div className={`absolute -top-16 left-1/2 -translate-x-1/2 transition-all duration-300 z-10 ${showBubble ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                <div
                    className="rounded-2xl px-4 py-2 shadow-lg text-sm font-bold whitespace-nowrap relative"
                    style={{
                        background: '#FFFFFF',
                        border: '3px solid #E5E5E5',
                        color: '#4B4B4B',
                    }}
                >
                    {speechBubble}
                    {/* Triangle pointer */}
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                        <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent" style={{ borderTopColor: '#E5E5E5' }} />
                        <div className="absolute top-[-2px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" />
                    </div>
                </div>
            </div>

            {/* Pet Container (Radial Glow Background) */}
            <div
                onClick={handleClick}
                className={`relative ${cfg.container} flex items-center justify-center rounded-full ${interactive ? 'cursor-pointer hover:scale-105' : ''} transition-transform`}
                style={{
                    background: 'radial-gradient(circle, #E0F7FF 0%, #F0F9FF 50%, transparent 70%)',
                    // Only show border/shadow if it's emoji mode
                    border: showBorder ? '5px solid #FFFFFF' : 'none',
                    boxShadow: showBorder ? '0 8px 25px rgba(28, 176, 246, 0.15), inset 0 -3px 0 rgba(0,0,0,0.05)' : 'none',
                    animation: isJumping
                        ? 'petJump 0.6s ease-out'
                        : 'petIdle 3s ease-in-out infinite',
                }}
            >
                {/* 1. Preferred: CSS 3D Chibi (Cat, Dog, Rabbit) */}
                {showCss3d ? (
                    <Css3dChibiPet
                        petType={petTypeFromId}
                        size={size}
                        mood={pet.mood}
                        interactive={false}
                    />
                ) : showImage ? (
                    /* 2. Fallback: Image for unsupported types */
                    <img
                        src={effectiveImageUrl}
                        alt={pet.petName}
                        onError={() => setImageError(true)}
                        className={`${cfg.img} object-contain drop-shadow-xl`}
                        style={{ filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.1))' }}
                    />
                ) : (
                    /* 3. Fallback: Emoji */
                    <span className={`${cfg.emoji} drop-shadow-lg`}>{petEmoji}</span>
                )}

                {/* Mood indicator (hide if image/3D to keep clean) */}
                {showBorder && (
                    <span
                        className={`absolute -bottom-1 -right-1 ${cfg.mood} flex items-center justify-center rounded-full shadow-md`}
                        style={{ background: '#FFFFFF', border: '2px solid #E5E5E5' }}
                    >
                        {moodEmoji}
                    </span>
                )}

                {/* Equipped accessories */}
                {pet.items && pet.items.length > 0 && (
                    <div className="absolute -top-3 -right-3 flex gap-0.5">
                        {pet.items.slice(0, 3).map((itemId) => (
                            <span
                                key={itemId}
                                className="text-lg w-7 h-7 flex items-center justify-center rounded-full shadow"
                                style={{ background: '#FFF5CC', border: '2px solid #FFD900' }}
                            >
                                {ACCESSORY_MAP[itemId] || '✨'}
                            </span>
                        ))}
                    </div>
                )}

                {/* Hearts animation */}
                {showHearts && (
                    <div className="absolute inset-0 pointer-events-none">
                        {[...Array(5)].map((_, i) => (
                            <span
                                key={i}
                                className="absolute text-xl"
                                style={{
                                    left: `${20 + Math.random() * 60}%`,
                                    animation: `heartFloat 1s ease-out forwards`,
                                    animationDelay: `${i * 0.1}s`,
                                    top: '30%',
                                }}
                            >
                                💖
                            </span>
                        ))}
                    </div>
                )}

                {/* Level glow for high levels */}
                {pet.level >= 5 && (
                    <div className="absolute inset-0 rounded-full"
                        style={{ animation: 'levelGlow 2s ease-in-out infinite', boxShadow: '0 0 40px rgba(88, 204, 2, 0.4)' }}
                    />
                )}
            </div>

            {/* Pet name + level */}
            <div className="mt-2 text-center">
                <p className={`font-extrabold ${cfg.name}`} style={{ color: '#4B4B4B' }}>{pet.petName}</p>
                <p className="text-sm font-bold" style={{ color: '#AFAFAF' }}>Lv.{pet.level}</p>
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes petIdle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                @keyframes petJump {
                    0% { transform: translateY(0) scale(1); }
                    30% { transform: translateY(-30px) scale(1.1); }
                    50% { transform: translateY(-30px) scale(1.1) rotate(5deg); }
                    100% { transform: translateY(0) scale(1) rotate(0deg); }
                }
                @keyframes heartFloat {
                    0% { opacity: 1; transform: translateY(0) scale(0.5); }
                    100% { opacity: 0; transform: translateY(-60px) scale(1.2); }
                }
                @keyframes levelGlow {
                    0%, 100% { box-shadow: 0 0 15px rgba(88, 204, 2, 0.2); }
                    50% { box-shadow: 0 0 30px rgba(88, 204, 2, 0.5); }
                }
            `}</style>
        </div>
    );
};

export default PetDisplay;
