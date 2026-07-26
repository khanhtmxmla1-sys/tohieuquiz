/**
 * Css3dChibiPet.tsx
 *
 * Pure CSS 3D Chibi-style virtual pets – Kawaii/Tamagotchi edition.
 * Supports: cat, dog, rabbit
 *
 * Cat design based on approved 3D Kawaii mockup:
 * - Oversized round head with gradient 3D shading
 * - Huge sparkling eyes with star-shaped highlights
 * - Prominent rosy blush cheeks
 * - Detailed triangle ears with pink gradient inner
 * - Round chubby body with belly patch
 * - Cute toe-pad paws
 * - Mood-reactive expressions (tears, sparkles, etc.)
 * - Gentle floating + breathing + head bob animations
 * - Click interaction (bounce + hearts)
 */

import React, { useState, useCallback } from 'react';

type PetType = 'cat' | 'dog' | 'rabbit';
type PetMoodType = 'happy' | 'neutral' | 'sad' | 'excited';

interface Css3dChibiPetProps {
    petType?: PetType;
    color?: string;
    size?: 'sm' | 'md' | 'lg';
    mood?: PetMoodType;
    interactive?: boolean;
}

// Color presets per pet type
const PET_COLORS: Record<PetType, {
    body: string; bodyDark: string; accent: string;
    belly: string; nose: string; ear: string; earInner: string;
    eyeColor: string; blush: string;
}> = {
    cat: {
        body: '#FFB347', bodyDark: '#F5962B', accent: '#FF9933',
        belly: '#FFF5E6', nose: '#FF8FA3', ear: '#FF9933',
        earInner: '#FFB8C6', eyeColor: '#2D1B0E', blush: '#FF9999',
    },
    dog: {
        body: '#D4A76A', bodyDark: '#C4975A', accent: '#C4975A',
        belly: '#FFF0DB', nose: '#3D2B1F', ear: '#C4975A',
        earInner: '#E8C89E', eyeColor: '#2D1B0E', blush: '#E8A0A0',
    },
    rabbit: {
        body: '#F5F0EB', bodyDark: '#EDE5DC', accent: '#EDE5DC',
        belly: '#FFFFFF', nose: '#FFB5C8', ear: '#F5F0EB',
        earInner: '#FFD1DC', eyeColor: '#2D1B0E', blush: '#FFB8C6',
    },
};

// Mouth SVG path per mood
const MOUTH_SHAPE: Record<PetMoodType, string> = {
    happy: 'M 6,2 Q 12,9 18,2',       // wide smile
    excited: 'M 5,1 Q 12,12 19,1',     // big open grin
    neutral: 'M 8,4 L 16,4',           // flat line
    sad: 'M 7,7 Q 12,2 17,7',          // frown
};

// Eye style per mood
const EYE_STYLE: Record<PetMoodType, {
    scaleY: number; extraShine: boolean; tearDrop: boolean;
}> = {
    happy: { scaleY: 1, extraShine: true, tearDrop: false },
    excited: { scaleY: 1, extraShine: true, tearDrop: false },
    neutral: { scaleY: 1, extraShine: false, tearDrop: false },
    sad: { scaleY: 0.85, extraShine: false, tearDrop: true },
};

const Css3dChibiPet: React.FC<Css3dChibiPetProps> = ({
    petType = 'cat',
    color,
    size = 'lg',
    mood = 'happy',
    interactive = true,
}) => {
    const [isBouncing, setIsBouncing] = useState(false);

    const scale = { sm: 0.55, md: 0.8, lg: 1.15 }[size];
    const colors = PET_COLORS[petType];
    const mainColor = color || colors.body;
    const darkColor = colors.bodyDark;

    const handleClick = useCallback(() => {
        if (!interactive || isBouncing) return;
        setIsBouncing(true);
        setTimeout(() => setIsBouncing(false), 700);
    }, [interactive, isBouncing]);

    const mouthPath = MOUTH_SHAPE[mood];
    const eyeStyle = EYE_STYLE[mood];

    return (
        <div
            className="chibi-scene"
            onClick={handleClick}
            style={{ transform: `scale(${scale})`, cursor: interactive ? 'pointer' : 'default' }}
        >
            <div className={`chibi-pet ${isBouncing ? 'chibi-bounce' : ''}`}>
                {/* === SHADOW on ground === */}
                <div className="chibi-shadow" />

                {/* === BODY === */}
                <div
                    className="chibi-body"
                    style={{
                        background: `radial-gradient(ellipse at 40% 30%, ${mainColor} 0%, ${darkColor} 100%)`,
                    }}
                >
                    {/* Belly patch */}
                    <div
                        className="chibi-belly"
                        style={{
                            background: `radial-gradient(ellipse at 50% 40%, ${colors.belly} 0%, ${colors.belly}99 100%)`,
                        }}
                    />
                    {/* Paws with toe pads */}
                    <div className="chibi-paws">
                        <div className="chibi-paw left" style={{ backgroundColor: mainColor }}>
                            <div className="chibi-toe-pads" style={{ backgroundColor: colors.nose }} />
                        </div>
                        <div className="chibi-paw right" style={{ backgroundColor: mainColor }}>
                            <div className="chibi-toe-pads" style={{ backgroundColor: colors.nose }} />
                        </div>
                    </div>
                </div>

                {/* === HEAD (oversized chibi) === */}
                <div
                    className="chibi-head"
                    style={{
                        background: `radial-gradient(ellipse at 35% 30%, ${mainColor} 0%, ${darkColor} 100%)`,
                    }}
                >
                    {/* 3D highlight on top */}
                    <div className="chibi-head-highlight" />

                    {/* Inner face circle (lighter muzzle) */}
                    <div
                        className="chibi-face-inner"
                        style={{
                            background: `radial-gradient(ellipse at 50% 30%, ${colors.belly} 0%, ${colors.belly}88 100%)`,
                        }}
                    />

                    {/* Eyes */}
                    <div className="chibi-eyes">
                        {['left', 'right'].map((side) => (
                            <div
                                key={side}
                                className={`chibi-eye ${side}`}
                                style={{
                                    transform: `scaleY(${eyeStyle.scaleY})`,
                                    background: `radial-gradient(circle at 40% 35%, #4A3020 0%, ${colors.eyeColor} 100%)`,
                                }}
                            >
                                {/* Main pupil shine - big */}
                                <div className="chibi-eye-shine big" />
                                {/* Secondary shine */}
                                <div className="chibi-eye-shine small" />
                                {/* Star-shaped highlight */}
                                <div className="chibi-eye-star" />
                                {/* Extra sparkle for happy/excited */}
                                {eyeStyle.extraShine && (
                                    <div className="chibi-eye-sparkle" />
                                )}
                                {/* Tear drop for sad */}
                                {eyeStyle.tearDrop && (
                                    <div className={`chibi-tear ${side}`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Nose */}
                    <div className="chibi-nose" style={{ backgroundColor: colors.nose }}>
                        <div className="chibi-nose-shine" />
                    </div>

                    {/* Mouth (SVG for smooth curves) */}
                    <svg className="chibi-mouth" viewBox="0 0 24 12" width="26" height="12">
                        <path
                            d={mouthPath}
                            fill={mood === 'excited' ? 'rgba(255,140,160,0.3)' : 'none'}
                            stroke="#8B6B5A"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                        />
                    </svg>

                    {/* Blush cheeks - bigger, more prominent */}
                    <div
                        className="chibi-blush left"
                        style={{
                            background: `radial-gradient(ellipse, ${colors.blush}66 0%, transparent 70%)`,
                        }}
                    />
                    <div
                        className="chibi-blush right"
                        style={{
                            background: `radial-gradient(ellipse, ${colors.blush}66 0%, transparent 70%)`,
                        }}
                    />

                    {/* === PET-SPECIFIC EARS === */}
                    {petType === 'cat' && (
                        <>
                            <div className="chibi-ear cat-ear left" style={{ borderBottomColor: mainColor }}>
                                <div className="chibi-ear-inner" style={{ borderBottomColor: colors.earInner }} />
                            </div>
                            <div className="chibi-ear cat-ear right" style={{ borderBottomColor: mainColor }}>
                                <div className="chibi-ear-inner" style={{ borderBottomColor: colors.earInner }} />
                            </div>
                            {/* Whiskers */}
                            <div className="chibi-whiskers left" />
                            <div className="chibi-whiskers right" />
                        </>
                    )}

                    {petType === 'dog' && (
                        <>
                            <div className="chibi-ear dog-ear left" style={{ backgroundColor: colors.accent }} />
                            <div className="chibi-ear dog-ear right" style={{ backgroundColor: colors.accent }} />
                        </>
                    )}

                    {petType === 'rabbit' && (
                        <>
                            <div className="chibi-ear rabbit-ear left" style={{ backgroundColor: mainColor }}>
                                <div className="rabbit-ear-inner" style={{ backgroundColor: colors.earInner }} />
                            </div>
                            <div className="chibi-ear rabbit-ear right" style={{ backgroundColor: mainColor }}>
                                <div className="rabbit-ear-inner" style={{ backgroundColor: colors.earInner }} />
                            </div>
                        </>
                    )}
                </div>

                {/* === TAIL === */}
                {petType === 'cat' && (
                    <div className="chibi-tail cat-tail" style={{ backgroundColor: mainColor }}>
                        <div className="cat-tail-tip" style={{ backgroundColor: darkColor }} />
                    </div>
                )}
                {petType === 'dog' && (
                    <div className="chibi-tail dog-tail" style={{ backgroundColor: colors.accent }} />
                )}
                {petType === 'rabbit' && (
                    <div className="chibi-tail rabbit-tail" style={{ backgroundColor: colors.belly }} />
                )}

                {/* === MOOD PARTICLES === */}
                {mood === 'excited' && (
                    <div className="chibi-sparkles">
                        {[0, 1, 2, 3, 4].map(i => (
                            <span key={i} className="chibi-sparkle-particle" style={{ animationDelay: `${i * 0.3}s` }}>✦</span>
                        ))}
                    </div>
                )}

                {/* === Bounce hearts === */}
                {isBouncing && (
                    <div className="chibi-hearts">
                        {[0, 1, 2].map(i => (
                            <span key={i} className="chibi-heart" style={{ animationDelay: `${i * 0.12}s` }}>💖</span>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                /* === SCENE === */
                .chibi-scene {
                    width: 160px;
                    height: 180px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    user-select: none;
                    -webkit-user-select: none;
                }

                .chibi-pet {
                    position: relative;
                    width: 120px;
                    height: 155px;
                    animation: chibiFloat 3s ease-in-out infinite;
                }

                .chibi-bounce {
                    animation: chibiFloat 0.7s ease-out !important;
                }

                /* === SHADOW === */
                .chibi-shadow {
                    position: absolute;
                    bottom: -4px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 65px;
                    height: 12px;
                    background: radial-gradient(ellipse, rgba(0,0,0,0.18) 0%, transparent 70%);
                    border-radius: 50%;
                    animation: chibiShadow 3s ease-in-out infinite;
                }

                /* === HEAD === */
                .chibi-head {
                    position: absolute;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 100px;
                    height: 90px;
                    border-radius: 50% 50% 46% 46%;
                    z-index: 2;
                    box-shadow:
                        inset 0 -6px 12px rgba(0,0,0,0.08),
                        0 5px 15px rgba(0,0,0,0.10);
                    animation: chibiHeadBob 4s ease-in-out infinite;
                }

                /* 3D top highlight */
                .chibi-head-highlight {
                    position: absolute;
                    top: 6px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 50px;
                    height: 22px;
                    background: radial-gradient(ellipse, rgba(255,255,255,0.45) 0%, transparent 70%);
                    border-radius: 50%;
                    pointer-events: none;
                }

                .chibi-face-inner {
                    position: absolute;
                    bottom: 6px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 68px;
                    height: 52px;
                    border-radius: 50%;
                }

                /* === EYES (bigger, sparklier) === */
                .chibi-eyes {
                    position: absolute;
                    top: 28px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 22px;
                }

                .chibi-eye {
                    width: 20px;
                    height: 22px;
                    border-radius: 50%;
                    position: relative;
                    animation: chibiBlink 4.5s infinite;
                    overflow: visible;
                    box-shadow:
                        0 1px 3px rgba(0,0,0,0.15),
                        inset 0 -2px 4px rgba(0,0,0,0.2);
                }

                /* Main big shine */
                .chibi-eye-shine.big {
                    position: absolute;
                    top: 3px;
                    left: 4px;
                    width: 8px;
                    height: 8px;
                    background: #FFFFFF;
                    border-radius: 50%;
                    animation: chibiShine 2s ease-in-out infinite;
                    z-index: 2;
                    box-shadow: 0 0 3px rgba(255,255,255,0.8);
                }

                /* Small secondary shine */
                .chibi-eye-shine.small {
                    position: absolute;
                    bottom: 4px;
                    right: 3px;
                    width: 4px;
                    height: 4px;
                    background: rgba(255,255,255,0.85);
                    border-radius: 50%;
                    z-index: 2;
                }

                /* Star-shaped highlight */
                .chibi-eye-star {
                    position: absolute;
                    top: 5px;
                    right: 4px;
                    width: 5px;
                    height: 5px;
                    background: rgba(255,255,255,0.7);
                    clip-path: polygon(50% 0%, 65% 35%, 100% 50%, 65% 65%, 50% 100%, 35% 65%, 0% 50%, 35% 35%);
                    z-index: 2;
                    animation: chibiStarTwinkle 3s ease-in-out infinite;
                }

                /* Extra sparkle for happy/excited */
                .chibi-eye-sparkle {
                    position: absolute;
                    bottom: 7px;
                    left: 2px;
                    width: 4px;
                    height: 4px;
                    background: rgba(255,255,255,0.6);
                    clip-path: polygon(50% 0%, 65% 35%, 100% 50%, 65% 65%, 50% 100%, 35% 65%, 0% 50%, 35% 35%);
                    z-index: 2;
                    animation: chibiStarTwinkle 2.5s ease-in-out infinite 0.5s;
                }

                /* Tear drop (sad mood) */
                .chibi-tear {
                    position: absolute;
                    bottom: -8px;
                    width: 5px;
                    height: 8px;
                    background: linear-gradient(180deg, rgba(100,180,255,0.6) 0%, rgba(100,180,255,0.2) 100%);
                    border-radius: 0 0 50% 50%;
                    animation: chibiTearDrop 2s ease-in-out infinite;
                    z-index: 3;
                }
                .chibi-tear.left { left: 6px; animation-delay: 0.4s; }
                .chibi-tear.right { right: 6px; }

                /* === NOSE (cuter, with highlight) === */
                .chibi-nose {
                    position: absolute;
                    top: 54px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 10px;
                    height: 7px;
                    border-radius: 50% 50% 40% 40%;
                    z-index: 3;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }
                .chibi-nose-shine {
                    position: absolute;
                    top: 1px;
                    left: 2px;
                    width: 4px;
                    height: 3px;
                    background: rgba(255,255,255,0.5);
                    border-radius: 50%;
                }

                /* === MOUTH === */
                .chibi-mouth {
                    position: absolute;
                    top: 60px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 3;
                }

                /* === BLUSH (bigger, gradient) === */
                .chibi-blush {
                    position: absolute;
                    top: 50px;
                    width: 20px;
                    height: 12px;
                    border-radius: 50%;
                    z-index: 1;
                }
                .chibi-blush.left { left: 8px; }
                .chibi-blush.right { right: 8px; }

                /* === WHISKERS (Cat only) === */
                .chibi-whiskers {
                    position: absolute;
                    top: 58px;
                    width: 24px;
                    height: 0;
                    z-index: 4;
                }
                .chibi-whiskers.left {
                    left: -8px;
                    border-top: 1px solid rgba(0,0,0,0.12);
                    border-bottom: 1px solid rgba(0,0,0,0.12);
                    box-shadow: 0 -6px 0 0 rgba(0,0,0,0.08), 0 6px 0 0 rgba(0,0,0,0.08);
                    transform: rotate(-5deg);
                }
                .chibi-whiskers.right {
                    right: -8px;
                    border-top: 1px solid rgba(0,0,0,0.12);
                    border-bottom: 1px solid rgba(0,0,0,0.12);
                    box-shadow: 0 -6px 0 0 rgba(0,0,0,0.08), 0 6px 0 0 rgba(0,0,0,0.08);
                    transform: rotate(5deg);
                }

                /* ===== EARS ===== */

                /* Cat ears - pointed triangles (bigger) */
                .cat-ear {
                    position: absolute;
                    top: -16px;
                    width: 0;
                    height: 0;
                    border-left: 16px solid transparent;
                    border-right: 16px solid transparent;
                    border-bottom: 26px solid;
                    z-index: 3;
                    filter: drop-shadow(0 -1px 2px rgba(0,0,0,0.06));
                }
                .cat-ear.left { left: 5px; transform: rotate(-10deg); }
                .cat-ear.right { right: 5px; transform: rotate(10deg); }
                .cat-ear .chibi-ear-inner {
                    position: absolute;
                    top: 7px;
                    left: -8px;
                    width: 0;
                    height: 0;
                    border-left: 8px solid transparent;
                    border-right: 8px solid transparent;
                    border-bottom: 14px solid;
                }

                /* Dog ears - floppy rounded */
                .dog-ear {
                    position: absolute;
                    top: 10px;
                    width: 24px;
                    height: 36px;
                    border-radius: 0 0 50% 50%;
                    z-index: 1;
                    box-shadow: inset 0 -3px 6px rgba(0,0,0,0.08);
                    animation: dogEarWiggle 3s ease-in-out infinite;
                }
                .dog-ear.left { left: -10px; transform: rotate(15deg); transform-origin: top right; }
                .dog-ear.right { right: -10px; transform: rotate(-15deg); transform-origin: top left; }

                /* Rabbit ears - long oval */
                .rabbit-ear {
                    position: absolute;
                    top: -46px;
                    width: 22px;
                    height: 52px;
                    border-radius: 50% 50% 40% 40%;
                    z-index: 1;
                    box-shadow: inset 0 -3px 6px rgba(0,0,0,0.05);
                    animation: rabbitEarTwitch 5s ease-in-out infinite;
                }
                .rabbit-ear.left { left: 14px; transform: rotate(-10deg); animation-delay: 0.3s; }
                .rabbit-ear.right { right: 14px; transform: rotate(10deg); }
                .rabbit-ear-inner {
                    position: absolute;
                    top: 8px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 11px;
                    height: 35px;
                    border-radius: 50%;
                }

                /* === BODY (rounder, gradient 3D) === */
                .chibi-body {
                    position: absolute;
                    bottom: 6px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 68px;
                    height: 56px;
                    border-radius: 34px 34px 28px 28px;
                    z-index: 1;
                    box-shadow:
                        inset 0 -6px 10px rgba(0,0,0,0.08),
                        0 5px 12px rgba(0,0,0,0.08);
                }

                .chibi-belly {
                    position: absolute;
                    bottom: 5px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 42px;
                    height: 34px;
                    border-radius: 50%;
                }

                /* === PAWS (with toe pads) === */
                .chibi-paws {
                    position: absolute;
                    bottom: -5px;
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    gap: 18px;
                    z-index: 2;
                }
                .chibi-paw {
                    width: 18px;
                    height: 12px;
                    border-radius: 50%;
                    position: relative;
                    box-shadow:
                        0 2px 4px rgba(0,0,0,0.10),
                        inset 0 -2px 4px rgba(0,0,0,0.06);
                }
                .chibi-toe-pads {
                    position: absolute;
                    bottom: 1px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 8px;
                    height: 5px;
                    border-radius: 50%;
                    opacity: 0.4;
                }

                /* === TAILS === */

                /* Cat tail - curved with darker tip */
                .cat-tail {
                    position: absolute;
                    bottom: 20px;
                    right: 8px;
                    width: 9px;
                    height: 36px;
                    border-radius: 5px 5px 0 0;
                    transform-origin: bottom center;
                    transform: rotate(-25deg);
                    animation: catTailSwing 2.5s ease-in-out infinite;
                    z-index: 0;
                    box-shadow: inset -2px 0 4px rgba(0,0,0,0.06);
                }
                .cat-tail-tip {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 12px;
                    border-radius: 5px 5px 3px 3px;
                }

                /* Dog tail - shorter, wagging fast */
                .dog-tail {
                    position: absolute;
                    bottom: 28px;
                    right: 6px;
                    width: 11px;
                    height: 26px;
                    border-radius: 6px;
                    transform-origin: bottom center;
                    transform: rotate(-20deg);
                    animation: dogTailWag 0.6s ease-in-out infinite;
                    z-index: 0;
                }

                /* Rabbit tail - fluffy round puff */
                .rabbit-tail {
                    position: absolute;
                    bottom: 16px;
                    right: 10px;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.06);
                    animation: rabbitTailWiggle 2s ease-in-out infinite;
                    z-index: 0;
                }

                /* === SPARKLE PARTICLES (excited mood) === */
                .chibi-sparkles {
                    position: absolute;
                    top: -15px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 120px;
                    height: 100px;
                    pointer-events: none;
                    z-index: 10;
                }
                .chibi-sparkle-particle {
                    position: absolute;
                    font-size: 12px;
                    color: #FFD700;
                    animation: chibiSparkleOrbit 3s ease-in-out infinite;
                    text-shadow: 0 0 4px rgba(255,215,0,0.6);
                }
                .chibi-sparkle-particle:nth-child(1) { top: 5px; left: 10px; }
                .chibi-sparkle-particle:nth-child(2) { top: 0; right: 15px; animation-delay: 0.6s; }
                .chibi-sparkle-particle:nth-child(3) { top: 30px; left: 0; animation-delay: 1.2s; font-size: 10px; }
                .chibi-sparkle-particle:nth-child(4) { top: 25px; right: 5px; animation-delay: 1.8s; font-size: 10px; }
                .chibi-sparkle-particle:nth-child(5) { top: 50px; left: 5px; animation-delay: 2.4s; font-size: 8px; }

                /* === HEARTS === */
                .chibi-hearts {
                    position: absolute;
                    top: -12px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 5px;
                    z-index: 10;
                    pointer-events: none;
                }
                .chibi-heart {
                    font-size: 18px;
                    animation: chibiHeartFloat 0.8s ease-out forwards;
                    opacity: 0;
                }

                /* ========== ANIMATIONS ========== */

                @keyframes chibiFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-7px); }
                }

                @keyframes chibiShadow {
                    0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.18; }
                    50% { transform: translateX(-50%) scale(0.82); opacity: 0.10; }
                }

                @keyframes chibiHeadBob {
                    0%, 100% { transform: translateX(-50%) rotate(0deg); }
                    25% { transform: translateX(-50%) rotate(-2.5deg); }
                    75% { transform: translateX(-50%) rotate(2.5deg); }
                }

                @keyframes chibiBlink {
                    0%, 90%, 100% { transform: scaleY(1); }
                    93%, 96% { transform: scaleY(0.05); }
                }

                @keyframes chibiShine {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(0.9); }
                }

                @keyframes chibiStarTwinkle {
                    0%, 100% { opacity: 0.7; transform: scale(1) rotate(0deg); }
                    50% { opacity: 1; transform: scale(1.3) rotate(45deg); }
                }

                @keyframes chibiFloat {
                    0% { transform: translateY(0) scale(1); }
                    15% { transform: translateY(4px) scale(1.06, 0.94); }
                    30% { transform: translateY(-22px) scale(0.94, 1.06); }
                    50% { transform: translateY(-26px) scale(0.97, 1.03); }
                    70% { transform: translateY(-4px) scale(1.03, 0.97); }
                    85% { transform: translateY(2px) scale(1.01, 0.99); }
                    100% { transform: translateY(0) scale(1); }
                }

                @keyframes chibiTearDrop {
                    0%, 100% { opacity: 0; transform: translateY(0) scaleY(0.5); }
                    20% { opacity: 0.8; transform: translateY(0) scaleY(1); }
                    80% { opacity: 0.6; transform: translateY(10px) scaleY(0.8); }
                    95% { opacity: 0; transform: translateY(14px) scaleY(0.3); }
                }

                @keyframes chibiSparkleOrbit {
                    0%, 100% { opacity: 0.3; transform: scale(0.6) rotate(0deg); }
                    50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
                }

                /* Tail animations */
                @keyframes catTailSwing {
                    0%, 100% { transform: rotate(-25deg); }
                    50% { transform: rotate(-5deg); }
                }

                @keyframes dogTailWag {
                    0%, 100% { transform: rotate(-30deg); }
                    50% { transform: rotate(15deg); }
                }

                @keyframes rabbitTailWiggle {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.18); }
                }

                /* Ear animations */
                @keyframes dogEarWiggle {
                    0%, 100% { transform: rotate(15deg); }
                    50% { transform: rotate(22deg); }
                }
                .dog-ear.right {
                    animation-name: dogEarWiggleR;
                }
                @keyframes dogEarWiggleR {
                    0%, 100% { transform: rotate(-15deg); }
                    50% { transform: rotate(-22deg); }
                }

                @keyframes rabbitEarTwitch {
                    0%, 85%, 100% { transform: rotate(-10deg); }
                    90% { transform: rotate(-4deg); }
                    95% { transform: rotate(-13deg); }
                }

                /* Heart float */
                @keyframes chibiHeartFloat {
                    0% { opacity: 1; transform: translateY(0) scale(0.5); }
                    100% { opacity: 0; transform: translateY(-45px) scale(1.3); }
                }
            `}</style>
        </div>
    );
};

export default Css3dChibiPet;
