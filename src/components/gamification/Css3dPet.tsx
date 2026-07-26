/**
 * Css3dPet.tsx
 *
 * A pure CSS 3D animated cat (Cube style).
 * Features:
 * - 3D Cube Head & Body using `transform-style: preserve-3d`
 * - Gentle floating animation
 * - Blinking eyes
 * - Responsive to props (color?)
 */

import React from 'react';

interface Css3dPetProps {
    color?: string; // Hex color for main body
    size?: 'sm' | 'md' | 'lg';
}

const Css3dPet: React.FC<Css3dPetProps> = ({ color = '#FFAA33', size = 'lg' }) => {
    // Size scaling
    const scale = { sm: 0.5, md: 0.8, lg: 1.2 }[size];

    return (
        <div className="scene relative" style={{ transform: `scale(${scale})` }}>
            <div className="cat-container">
                {/* --- HEAD --- */}
                <div className="head-group">
                    {/* Ears */}
                    <div className="ear left" style={{ backgroundColor: color }} />
                    <div className="ear right" style={{ backgroundColor: color }} />

                    <div className="cube head">
                        <div className="face front" style={{ backgroundColor: color }}>
                            <div className="eyes">
                                <div className="eye left"><div className="pupil" /></div>
                                <div className="eye right"><div className="pupil" /></div>
                            </div>
                            <div className="muzzle">
                                <div className="nose" />
                                <div className="mouth" />
                            </div>
                            <div className="whiskers left" />
                            <div className="whiskers right" />
                        </div>
                        <div className="face back" style={{ backgroundColor: color }} />
                        <div className="face right" style={{ backgroundColor: darken(color, 10) }} />
                        <div className="face left" style={{ backgroundColor: darken(color, 10) }} />
                        <div className="face top" style={{ backgroundColor: lighten(color, 10) }} />
                        <div className="face bottom" style={{ backgroundColor: darken(color, 20) }} />
                    </div>
                </div>

                {/* --- BODY --- */}
                <div className="cube body">
                    <div className="face front" style={{ backgroundColor: color }}>
                        <div className="belly" />
                    </div>
                    <div className="face back" style={{ backgroundColor: color }} />
                    <div className="face right" style={{ backgroundColor: darken(color, 10) }} />
                    <div className="face left" style={{ backgroundColor: darken(color, 10) }} />
                    <div className="face top" style={{ backgroundColor: lighten(color, 10) }} />
                    <div className="face bottom" style={{ backgroundColor: darken(color, 20) }} />
                </div>

                {/* --- PAWS --- */}
                <div className="paws">
                    <div className="paw left" style={{ backgroundColor: '#FFFFFF' }} />
                    <div className="paw right" style={{ backgroundColor: '#FFFFFF' }} />
                </div>

                {/* --- TAIL --- */}
                <div className="tail" style={{ backgroundColor: color }} />
            </div>

            <style>{`
                .scene {
                    width: 100px;
                    height: 100px;
                    perspective: 400px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .cat-container {
                    width: 60px;
                    height: 80px;
                    transform-style: preserve-3d;
                    animation: float 3s ease-in-out infinite;
                }
                .cube {
                    position: absolute;
                    transform-style: preserve-3d;
                }
                .face {
                    position: absolute;
                    border: 1px solid rgba(0,0,0,0.05); /* Subtle border for definition */
                }

                /* --- HEAD --- */
                .head-group {
                    position: absolute;
                    top: 0;
                    left: 5px; /* Center relative to body width 50 */
                    width: 50px;
                    height: 40px;
                    transform-style: preserve-3d;
                    animation: headBob 3s ease-in-out infinite;
                }
                .head {
                    width: 50px;
                    height: 40px;
                }
                .head .front  { transform: translateZ(25px); width: 50px; height: 40px; }
                .head .back   { transform: rotateY(180deg) translateZ(25px); width: 50px; height: 40px; }
                .head .right  { transform: rotateY(90deg) translateZ(25px); width: 50px; height: 40px; }
                .head .left   { transform: rotateY(-90deg) translateZ(25px); width: 50px; height: 40px; }
                .head .top    { transform: rotateX(90deg) translateZ(25px); width: 50px; height: 50px; top: -5px; } /* Adjust for depth */
                .head .bottom { transform: rotateX(-90deg) translateZ(15px); width: 50px; height: 50px; }

                /* Face Details */
                .eyes { display: flex; justify-content: space-between; padding: 12px 8px 0; }
                .eye { width: 8px; height: 8px; background: #333; border-radius: 50%; position: relative; animation: blink 4s infinite; }
                .pupil { width: 3px; height: 3px; background: white; border-radius: 50%; position: absolute; top: 1px; right: 1px; }
                .muzzle { position: absolute; bottom: 8px; left: 15px; width: 20px; height: 10px; background: #FFF; border-radius: 10px; }
                .nose { width: 6px; height: 4px; background: pink; border-radius: 2px; margin: 2px auto 0; }

                /* Ears (Triangles approximated by borders or clip-path) */
                .ear {
                    position: absolute;
                    top: -10px;
                    width: 15px;
                    height: 15px;
                    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
                }
                .ear.left { left: 0; transform: rotate(-10deg); }
                .ear.right { right: 0; transform: rotate(10deg); }

                /* --- BODY --- */
                .body {
                    top: 40px;
                    left: 5px;
                    width: 50px;
                    height: 40px;
                }
                .body .front  { transform: translateZ(20px); width: 50px; height: 40px; }
                .body .back   { transform: rotateY(180deg) translateZ(20px); width: 50px; height: 40px; }
                .body .right  { transform: rotateY(90deg) translateZ(25px); width: 40px; height: 40px; left: 5px; }
                .body .left   { transform: rotateY(-90deg) translateZ(25px); width: 40px; height: 40px; left: 5px; }
                .body .top    { transform: rotateX(90deg) translateZ(20px); width: 50px; height: 40px; }
                .body .bottom { transform: rotateX(-90deg) translateZ(20px); width: 50px; height: 40px; }

                .belly {
                    width: 30px;
                    height: 25px;
                    background: #FFF;
                    border-radius: 50% 50% 0 0;
                    margin: 15px auto 0;
                }

                /* --- PAWS & TAIL --- */
                .paws {
                    position: absolute;
                    bottom: -5px; /* Stick out slightly */
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                    transform: translateZ(25px);
                }
                .paw {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    box-shadow: 0 2px 0 rgba(0,0,0,0.1);
                }

                .tail {
                    position: absolute;
                    bottom: 10px;
                    right: -10px;
                    width: 10px;
                    height: 30px;
                    border-radius: 5px;
                    transform-origin: bottom center;
                    transform: rotate(-30deg) translateZ(-20px);
                    animation: tailWag 2s ease-in-out infinite;
                }

                /* --- ANIMATIONS --- */
                @keyframes float {
                    0%, 100% { transform: translateY(0) rotateY(-10deg); }
                    50% { transform: translateY(-5px) rotateY(10deg); }
                }
                @keyframes headBob {
                    0%, 100% { transform: rotateX(0deg); }
                    50% { transform: rotateX(5deg); }
                }
                @keyframes blink {
                    0%, 96%, 100% { transform: scaleY(1); }
                    98% { transform: scaleY(0.1); }
                }
                @keyframes tailWag {
                    0%, 100% { transform: rotate(-30deg) translateZ(-20px); }
                    50% { transform: rotate(-10deg) translateZ(-20px); }
                }
            `}</style>
        </div>
    );
};

// Helper to darken/lighten hex (simple version)
function darken(hex: string, percent: number) {
    // Basic hex manipulation or return hardcoded values based on input
    if (hex === '#FFAA33') return '#E6992E'; // Darker orange
    if (hex === '#FFFFFF') return '#E0E0E0';
    return hex; // Fallback
}
function lighten(hex: string, percent: number) {
    if (hex === '#FFAA33') return '#FFBB55'; // Lighter orange
    return hex;
}

export default Css3dPet;
