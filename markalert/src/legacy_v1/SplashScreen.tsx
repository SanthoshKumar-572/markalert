import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';

interface SplashScreenProps {
  onComplete: () => void;
  onLoginSuccess?: (user: User) => void;
  isLoggedIn?: boolean;
}

const EMBLEM_BASE64 = "/vsb-logo.png";

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, onLoginSuccess, isLoggedIn = false }) => {
  const [percent, setPercent] = useState(0);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('faculty@college.edu');
  const [password, setPassword] = useState('Faculty@123');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const emblemRef = useRef<HTMLDivElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  // Sparkle stars generation
  const starsRef = useRef<Array<{ x: string; y: string; s: string; d: string }>>([]);
  if (starsRef.current.length === 0) {
    const arr: Array<{ x: string; y: string; s: string; d: string }> = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.283 + Math.random() * 0.4;
      const r = 48 + Math.random() * 9;
      arr.push({
        x: `${49.4 + r * Math.cos(a) - 4}%`,
        y: `${49 + r * Math.sin(a) - 4}%`,
        s: `${10 + Math.random() * 14}px`,
        d: `${(2.2 + Math.random() * 3).toFixed(2)}s`
      });
    }
    starsRef.current = arr;
  }

  // Set CSS variable --logo on emblem container for shine effect
  useEffect(() => {
    if (emblemRef.current) {
      emblemRef.current.style.setProperty('--logo', `url(${EMBLEM_BASE64})`);
    }
  }, []);

  // Progress counter
  useEffect(() => {
    let start: number | null = null;
    let animId: number;

    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, Math.max(0, (ts - start - 500) / 3200));
      setPercent(Math.round(p * 100));
      if (p < 1) {
        animId = requestAnimationFrame(tick);
      }
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 3D Pointer Move Tilt Effect
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!tiltRef.current) return;
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      tiltRef.current.style.transform = `rotateY(${x * 24}deg) rotateX(${-y * 24}deg)`;
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  // Trigger Entrance Transition to Login or Dashboard
  const handleGetStarted = () => {
    setWelcomeOpen(true);
    setTimeout(() => {
      if (isLoggedIn) {
        onComplete();
      } else {
        setShowLogin(true);
      }
    }, 700);
  };

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setMsg({ text: 'Please fill in both email and password.', ok: false });
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await api.auth.login(email, password);
      setMsg({ text: 'Welcome back! Signing in...', ok: true });
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(res.user);
        }
        onComplete();
      }, 600);
    } catch (err: any) {
      setMsg({ text: err.message || 'Invalid institutional credentials.', ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vsb-splash-container">
      <style>{`
        .vsb-splash-container {
          --bg: #1c060d;
          --bg2: #4a101e;
          --g1: #fff3b8;
          --g2: #f6c84c;
          --g3: #c08a16;
          --g4: #7a5510;
          --ink: #fbeec4;
          --mute: #c9a66b;
          --foil2: linear-gradient(100deg, #e8b23a, #fff3b8 30%, #f6c84c 50%, #fff3b8 70%, #e8b23a);
          --foil: linear-gradient(100deg, var(--g4), var(--g2) 25%, var(--g1) 45%, var(--g2) 60%, var(--g3) 80%, var(--g4));
          position: fixed;
          inset: 0;
          z-index: 99999;
          height: 100vh;
          width: 100vw;
          background: var(--bg);
          font-family: 'Manrope', system-ui, sans-serif;
          color: var(--ink);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .vsb-splash-screen {
          position: relative;
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 20px;
          background: #1c060d;
          overflow: hidden;
          text-align: center;
        }

        .vsb-pattern {
          position: absolute;
          inset: 0;
          opacity: 1;
          background-color: #24080f;
          background-image: 
            radial-gradient(ellipse at 50% 35%, rgba(45, 12, 20, 0.15) 0%, rgba(15, 3, 7, 0.92) 100%),
            repeating-conic-gradient(from 45deg, #c29649 0deg 90deg, #2a0c14 90deg 180deg, #c29649 180deg 270deg, #2a0c14 270deg 360deg);
          background-size: 100% 100%, 54px 54px;
          background-position: center center, center center;
          animation: vsb-fade 1.2s ease-out both;
        }

        .vsb-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .vsb-emblem {
          position: relative;
          width: min(64vw, 29vh, 260px);
          aspect-ratio: 1;
          perspective: 800px;
          z-index: 2;
          margin-bottom: -6px;
        }

        .vsb-ringbox {
          position: absolute;
          left: 3%;
          top: 3%;
          width: 94%;
          aspect-ratio: 1;
        }

        .vsb-halo {
          position: absolute;
          inset: -18%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(246,200,76,.45) 0%, rgba(122,26,44,.5) 45%, transparent 72%);
          animation: vsb-breathe 3.4s ease-in-out infinite;
        }

        .vsb-beads {
          position: absolute;
          inset: -6%;
          width: 112%;
          height: 112%;
          animation: vsb-spin 45s linear infinite;
        }

        .vsb-beads circle {
          fill: none;
          stroke: url(#gg-splash);
          stroke-width: 3;
          stroke-linecap: round;
          stroke-dasharray: 0 10;
          opacity: 0.85;
          animation: vsb-fade 1s forwards;
        }

        .vsb-tilt {
          position: absolute;
          inset: 0;
          transition: transform 0.15s ease-out;
          transform-style: preserve-3d;
        }

        .vsb-flip {
          position: absolute;
          inset: 0;
          animation: vsb-coin 1.4s cubic-bezier(.3,1.3,.5,1) both;
        }

        .vsb-flip img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 14px 24px rgba(0,0,0,.75)) drop-shadow(0 0 20px rgba(246,200,76,.5));
        }

        .vsb-shine {
          position: absolute;
          inset: 0;
          -webkit-mask: var(--logo) center/contain no-repeat;
          mask: var(--logo) center/contain no-repeat;
          background: linear-gradient(110deg, transparent 40%, rgba(255,255,255,.95) 50%, transparent 60%) 160% 0/250% 100% no-repeat;
          animation: vsb-sweep 1.5s 2.5s ease-out forwards, vsb-sweep 1.5s 6s ease-out infinite;
        }

        .vsb-sp {
          position: absolute;
          z-index: 3;
          pointer-events: none;
          filter: drop-shadow(0 0 6px rgba(255,243,184,0.9));
        }

        .vsb-sp.star-1 { top: 6%; right: 18%; width: 22px; height: 22px; animation: vsb-twinkle 2.2s 0.2s ease-in-out infinite; }
        .vsb-sp.star-2 { top: 18%; left: 8%; width: 18px; height: 18px; animation: vsb-twinkle 2.5s 0.8s ease-in-out infinite; }
        .vsb-sp.star-3 { bottom: 22%; right: 6%; width: 20px; height: 20px; animation: vsb-twinkle 2.1s 0.5s ease-in-out infinite; }
        .vsb-sp.star-4 { bottom: 8%; left: 14%; width: 17px; height: 17px; animation: vsb-twinkle 2.7s 1.1s ease-in-out infinite; }
        .vsb-sp.star-5 { top: 2%; left: 45%; width: 14px; height: 14px; animation: vsb-twinkle 2.4s 1.4s ease-in-out infinite; }
        .vsb-sp.star-6 { bottom: 4%; right: 30%; width: 16px; height: 16px; animation: vsb-twinkle 2.3s 0.3s ease-in-out infinite; }

        /* Readability glass container */
        .vsb-txt {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          padding: 24px 32px;
          width: min(92vw, 530px);
          border-radius: 28px;
          background: rgba(18, 5, 10, 0.88);
          border: 1px solid rgba(246, 200, 76, 0.35);
          box-shadow: 0 16px 45px rgba(0, 0, 0, 0.65), 0 -8px 30px rgba(246, 200, 76, 0.12);
          -webkit-backdrop-filter: blur(14px);
          backdrop-filter: blur(14px);
        }

        .vsb-txt h1 {
          background: linear-gradient(180deg, #fff3b8 0%, #f6c84c 55%, #c08a16 100%) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 700;
          font-size: clamp(34px, 8.5vw, 52px) !important;
          line-height: 1.05;
          text-align: center;
          filter: drop-shadow(0 3px 8px rgba(0,0,0,.8));
          margin: 0;
          opacity: 0;
          animation: vsb-rise 0.7s 0.2s forwards !important;
        }

        .vsb-txt .sub {
          z-index: 1;
          color: #ffffff !important;
          font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
          font-size: 15px !important;
          font-weight: 700 !important;
          letter-spacing: 0.02em;
          text-align: center;
          margin-top: -2px;
          opacity: 0;
          text-shadow: 0 1px 4px rgba(0,0,0,.9);
          animation: vsb-rise 0.6s 0.4s forwards;
        }

        .vsb-txt .college {
          z-index: 1;
          font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
          font-weight: 800 !important;
          font-size: 18px !important;
          color: #ffffff !important;
          margin-top: 1px !important;
          opacity: 0;
          text-shadow: 0 1px 4px rgba(0,0,0,.9);
          animation: vsb-rise 0.6s 0.5s forwards;
        }

        .vsb-txt .accr {
          z-index: 1;
          max-width: 440px !important;
          font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
          font-size: 13px !important;
          line-height: 1.4 !important;
          font-weight: 600;
          color: #ffffff !important;
          opacity: 0;
          text-shadow: 0 1px 4px rgba(0,0,0,.9);
          animation: vsb-rise 0.6s 0.6s forwards;
        }

        .vsb-orn {
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          opacity: 0;
          animation: vsb-rise 0.6s 0.7s forwards;
          margin: 4px 0 2px;
        }

        .vsb-orn i {
          height: 1px;
          width: 0;
          background: linear-gradient(90deg, transparent, #f6c84c);
          animation: vsb-line 0.8s 0.8s forwards;
        }

        .vsb-orn i:last-child {
          transform: scaleX(-1);
        }

        .vsb-orn b {
          width: 7px;
          height: 7px;
          background: #f6c84c;
          transform: rotate(45deg);
          box-shadow: 0 0 8px #f6c84c;
        }

        /* Motto line */
        .vsb-say {
          z-index: 1;
          position: relative;
          height: 34px !important;
          width: min(90vw, 420px);
          margin-top: 2px;
        }

        .vsb-say span {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          font: italic 700 23px 'Cormorant Garamond', Georgia, serif !important;
          color: #ffffff !important;
          opacity: 0;
          text-shadow: 0 2px 8px rgba(0,0,0,.95) !important;
          animation: vsb-say 9s var(--d) infinite backwards;
        }

        .vsb-say .ta {
          font-family: 'Noto Serif Tamil', serif !important;
          font-size: 20px !important;
          font-weight: 700 !important;
          font-style: normal;
        }

        /* Pill shape Get Started button */
        .vsb-btn-go {
          z-index: 1;
          margin-top: 6px;
          font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
          font-weight: 700;
          font-size: 16px;
          color: #2b1b1b;
          background: linear-gradient(180deg, #F6C84C 0%, #C08A16 100%);
          border: 2px solid #ffffff;
          border-radius: 9999px;
          padding: 12px 56px;
          cursor: pointer;
          opacity: 0;
          letter-spacing: 0.02em;
          box-shadow: 0 6px 20px rgba(0,0,0,.45), 0 0 15px rgba(246,200,76,.3);
          animation: vsb-rise 0.6s 0.9s forwards, vsb-pulse 2.2s 1.5s infinite;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .vsb-btn-go:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 10px 28px rgba(0,0,0,.5), 0 0 20px rgba(246,200,76,.5);
        }

        .vsb-btn-go:active {
          transform: scale(0.98);
        }

        .vsb-bar {
          z-index: 1;
          width: min(55vw, 220px);
          font-size: 12px;
          color: #c9a66b;
          font-weight: 600;
          animation: vsb-fade 0.6s 0.8s both;
          margin-top: 2px;
        }

        .vsb-bar div {
          height: 2.5px;
          margin-top: 5px;
          border-radius: 3px;
          background: rgba(255,255,255,.15);
          overflow: hidden;
        }

        .vsb-bar div::after {
          content: "";
          display: block;
          height: 100%;
          background: linear-gradient(90deg, #c08a16, #f6c84c, #fff3b8);
          transform-origin: left;
          transform: scaleX(0);
          animation: vsb-fillbar 2.4s 0.4s ease-in-out forwards;
        }

        .vsb-door {
          display: none;
        }

        .vsb-welcome {
          position: absolute;
          inset: 0;
          z-index: 8;
          display: grid;
          place-items: center;
          background: var(--foil);
          background-size: 200% 100%;
          color: #3a1a00;
          font: 700 clamp(32px, 9vw, 50px) 'Cormorant Garamond', Georgia, serif;
          padding: 24px;
          clip-path: circle(0% at 50% 88%);
          transition: clip-path 0.9s cubic-bezier(.7,0,.2,1);
          pointer-events: none;
        }

        .vsb-welcome.on {
          clip-path: circle(150% at 50% 88%);
          pointer-events: all;
        }

        /* Skip Button */
        .vsb-btn-skip {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 10;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--g2);
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(246,200,76,0.3);
          padding: 6px 14px;
          border-radius: 999px;
          cursor: pointer;
          backdrop-filter: blur(4px);
          transition: all 0.2s;
        }

        .vsb-btn-skip:hover {
          background: rgba(246,200,76,0.2);
          color: #fff3b8;
          border-color: rgba(246,200,76,0.6);
        }

        /* Integrated Luxury Login Screen overlay */
        .vsb-login-view {
          position: absolute;
          inset: 0;
          z-index: 9;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow-y: auto;
          padding: 24px 16px;
          background: radial-gradient(circle at 50% 20%, var(--bg2), var(--bg) 72%);
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.7s, visibility 0.7s;
        }

        .vsb-login-view.show {
          opacity: 1;
          visibility: visible;
        }

        .vsb-login-card {
          width: min(100%, 410px);
          margin: auto;
          padding: 26px 24px;
          border-radius: 24px;
          background: rgba(20,4,9,.82);
          border: 1px solid rgba(246,200,76,.35);
          box-shadow: 0 14px 44px rgba(0,0,0,.65);
          text-align: center;
          transform: translateY(16px);
          transition: transform 0.7s 0.1s;
          backdrop-filter: blur(8px);
        }

        .vsb-login-view.show .vsb-login-card {
          transform: none;
        }

        .vsb-login-card img {
          width: 80px;
          height: 80px;
          margin: 0 auto;
          display: block;
          filter: drop-shadow(0 6px 14px rgba(0,0,0,.6)) drop-shadow(0 0 14px rgba(246,200,76,.35));
        }

        .vsb-login-card h2 {
          margin-top: 8px;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 700;
          font-size: 30px;
          color: #ffd75e;
          text-shadow: 0 2px 0 #3a1a00;
          line-height: 1.1;
        }

        .vsb-login-card .cn {
          font-size: 13px;
          color: #ffeebd;
          margin: 4px 0 16px;
          font-weight: 500;
        }


        .vsb-fld {
          display: block;
          text-align: left;
          margin-bottom: 14px;
        }

        .vsb-fld span {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #fff3b8;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .vsb-fld div {
          position: relative;
        }

        .vsb-fld input {
          width: 100%;
          padding: 12px 14px;
          font-family: 'Manrope', sans-serif;
          font-weight: 500;
          font-size: 14px;
          color: #fff;
          background: rgba(255,255,255,.1);
          border: 1px solid rgba(246,200,76,.4);
          border-radius: 12px;
          outline: none;
          transition: all 0.2s;
          box-sizing: border-box;
        }

        .vsb-fld input::placeholder {
          color: #c9b98f;
        }

        .vsb-fld input:focus {
          border-color: var(--g1);
          box-shadow: 0 0 0 3px rgba(246,200,76,.3);
          background: rgba(255,255,255,.15);
        }

        .vsb-fld .eye {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          margin: 0;
          padding: 4px 8px;
          font-family: 'Manrope', sans-serif;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.04em;
          color: var(--g1);
          background: rgba(0,0,0,0.3);
          border-radius: 6px;
          border: none;
          cursor: pointer;
          opacity: 1;
          animation: none;
        }

        .vsb-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin: 4px 0 16px;
          font-size: 12px;
          color: #ffeebd;
        }

        .vsb-row label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }

        .vsb-row a {
          color: var(--g1);
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
        }

        .vsb-row a:hover {
          text-decoration: underline;
        }

        .vsb-login-card .go {
          width: 100%;
          margin: 0;
          padding: 13px;
          font-family: 'Manrope', sans-serif;
          font-weight: 700;
          font-size: 15px;
          letter-spacing: 0.04em;
          color: #3a1a00;
          background: var(--foil);
          background-size: 250% 100%;
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          opacity: 1;
          animation: vsb-foil 3s linear infinite;
          box-shadow: 0 4px 16px rgba(246,200,76,0.35);
          transition: transform 0.2s;
        }

        .vsb-login-card .go:hover {
          transform: translateY(-2px);
        }

        .vsb-login-card .go:active {
          transform: scale(0.98);
        }

        .vsb-msg {
          min-height: 20px;
          margin-top: 10px;
          font-size: 12px;
          font-weight: 600;
          color: #ffb4a8;
        }

        .vsb-msg.ok {
          color: #a8f0b8;
        }

        .vsb-back-btn {
          margin-top: 10px;
          background: none;
          border: none;
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          color: var(--mute);
          cursor: pointer;
          transition: color 0.2s;
        }

        .vsb-back-btn:hover {
          color: #fff3b8;
          text-decoration: underline;
        }

        @keyframes vsb-openL {
          to { transform: translateX(-101%); }
        }

        @keyframes vsb-openR {
          to { transform: translateX(101%); }
        }

        @keyframes vsb-spin {
          to { transform: rotate(360deg); }
        }

        @keyframes vsb-coin {
          from {
            transform: rotateY(540deg) scale(0.4);
            opacity: 0;
          }
          to {
            transform: none;
            opacity: 1;
          }
        }

        @keyframes vsb-rise {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }

        @keyframes vsb-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes vsb-sweep {
          to { background-position: -60% 0; }
        }

        @keyframes vsb-foil {
          to { background-position: -260% 0; }
        }

        @keyframes vsb-twinkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0.2) rotate(0);
          }
          50% {
            opacity: 1;
            transform: scale(1) rotate(90deg);
          }
        }

        @keyframes vsb-breathe {
          50% {
            transform: scale(1.12);
            opacity: 0.7;
          }
        }

        @keyframes vsb-ripple {
          0% {
            transform: scale(1);
            opacity: 0.55;
          }
          100% {
            transform: scale(1.7);
            opacity: 0;
          }
        }

        @keyframes vsb-line {
          to { width: 50px; }
        }

        @keyframes vsb-fillbar {
          to { transform: scaleX(1); }
        }

        @keyframes vsb-say {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          5%, 30% {
            opacity: 1;
            transform: none;
          }
          35%, 100% {
            opacity: 0;
          }
        }

        @keyframes vsb-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(246,200,76,.6);
          }
          70%, 100% {
            box-shadow: 0 0 0 20px rgba(246,200,76,0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .vsb-splash-container * {
            animation-duration: 0.01s !important;
            animation-delay: 0s !important;
            animation-iteration-count: 1 !important;
          }
          .vsb-say span:not(:first-child) { display: none; }
          .vsb-say span:first-child { animation: none; opacity: 1; }
        }
      `}</style>

      {/* Splash Screen Intro Mode */}
      <main className="vsb-splash-screen">
        <div className="vsb-pattern"></div>

        <div className="vsb-emblem" ref={emblemRef}>
          <div className="vsb-ringbox">
            <div className="vsb-halo"></div>
            <span className="vsb-ripple"></span>
            <span className="vsb-ripple"></span>
            <svg className="vsb-beads" viewBox="0 0 200 200" aria-hidden="true">
              <defs>
                <linearGradient id="gg-splash" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fff3b8" />
                  <stop offset="0.5" stopColor="#f6c84c" />
                  <stop offset="1" stopColor="#9a6b12" />
                </linearGradient>
              </defs>
              <circle cx="100" cy="100" r="98" />
            </svg>
          </div>

          <div className="vsb-tilt" ref={tiltRef}>
            <div className="vsb-flip">
              <img
                ref={logoImgRef}
                id="lg"
                alt="V.S.B. Engineering College emblem"
                src={EMBLEM_BASE64}
              />
              <div className="vsb-shine"></div>
            </div>
          </div>

          {/* Positioned 4-Point Golden Sparkle Star Flares */}
          <span className="vsb-sp star-1">
            <svg viewBox="-10 -10 20 20" className="w-full h-full">
              <path d="M0-10 Q1 -1 10 0 Q1 1 0 10 Q-1 1 -10 0 Q-1 -1 0 -10 Z" fill="#fff3b8" />
              <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
            </svg>
          </span>
          <span className="vsb-sp star-2">
            <svg viewBox="-10 -10 20 20" className="w-full h-full">
              <path d="M0-10 Q1 -1 10 0 Q1 1 0 10 Q-1 1 -10 0 Q-1 -1 0 -10 Z" fill="#f6c84c" />
              <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
            </svg>
          </span>
          <span className="vsb-sp star-3">
            <svg viewBox="-10 -10 20 20" className="w-full h-full">
              <path d="M0-10 Q1 -1 10 0 Q1 1 0 10 Q-1 1 -10 0 Q-1 -1 0 -10 Z" fill="#fff3b8" />
              <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
            </svg>
          </span>
          <span className="vsb-sp star-4">
            <svg viewBox="-10 -10 20 20" className="w-full h-full">
              <path d="M0-10 Q1 -1 10 0 Q1 1 0 10 Q-1 1 -10 0 Q-1 -1 0 -10 Z" fill="#f6c84c" />
              <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
            </svg>
          </span>
          <span className="vsb-sp star-5">
            <svg viewBox="-10 -10 20 20" className="w-full h-full">
              <path d="M0-10 Q1 -1 10 0 Q1 1 0 10 Q-1 1 -10 0 Q-1 -1 0 -10 Z" fill="#fff3b8" />
            </svg>
          </span>
          <span className="vsb-sp star-6">
            <svg viewBox="-10 -10 20 20" className="w-full h-full">
              <path d="M0-10 Q1 -1 10 0 Q1 1 0 10 Q-1 1 -10 0 Q-1 -1 0 -10 Z" fill="#f6c84c" />
            </svg>
          </span>
        </div>

        {/* Readability Box for Content */}
        <div className="vsb-txt">
          <h1>College Marks Portal</h1>
          <p className="sub">Internal Marks Notification System</p>
          <p className="college">V.S.B. Engineering College, Karur</p>
          <p className="accr">(An Autonomous Institution | Approved by AICTE &amp; Affiliated to Anna University)</p>
          <div className="vsb-orn">
            <i />
            <b />
            <i />
          </div>
          <div className="vsb-say">
            <span style={{ ['--d' as any]: '3.3s' }}>Hardwork is the Key to Success</span>
            <span className="ta" style={{ ['--d' as any]: '6.3s' }}>உழைப்பே உயர்வு தரும்</span>
            <span style={{ ['--d' as any]: '9.3s' }}>Empowering Minds, Engineering Excellence</span>
          </div>
        </div>

        <button
          type="button"
          id="vsb-go-btn"
          onClick={handleGetStarted}
          className="vsb-btn-go"
        >
          Get started
        </button>

        <div className="vsb-door l" />
        <div className="vsb-door r" />

        <div className={`vsb-welcome ${welcomeOpen ? 'on' : ''}`}>
          Welcome to College Marks
        </div>
      </main>

      {/* Integrated Luxury Login Screen View */}
      <section className={`vsb-login-view ${showLogin ? 'show' : ''}`} id="login">
        <div className="vsb-login-card">
          <img src={EMBLEM_BASE64} alt="V.S.B. Engineering College Emblem" />
          <h2>CollegeMarks Portal</h2>
          <p className="cn">V.S.B. Engineering College, Karur</p>

          <form onSubmit={handleLoginSubmit} autoComplete="on">
            <label className="vsb-fld">
              <span>Institutional Email</span>
              <div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@vsb.edu.in"
                  required
                />
              </div>
            </label>

            <label className="vsb-fld">
              <span>Password</span>
              <div>
                <input
                  type={showPass ? 'text' : 'password'}
                  id="pass"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="eye"
                  id="eye"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </label>

            <div className="vsb-row">
              <label>
                <input type="checkbox" id="rem" defaultChecked /> Remember me
              </label>
              <a
                href="#help"
                onClick={(e) => {
                  e.preventDefault();
                  alert('For password resets or login assistance, please contact the IT Cell at itcell@vsb.edu.in or System Administrator.');
                }}
              >
                Need help?
              </a>
            </div>

            <button type="submit" className="go" id="loginBtn" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign in to Portal'}
            </button>
          </form>

          <div className={`vsb-msg ${msg?.ok ? 'ok' : ''}`} id="msg">
            {msg?.text}
          </div>

          <button
            type="button"
            className="vsb-back-btn"
            onClick={() => {
              setShowLogin(false);
              setWelcomeOpen(false);
            }}
          >
            ← Back to Intro
          </button>
        </div>
      </section>
    </div>
  );
};
