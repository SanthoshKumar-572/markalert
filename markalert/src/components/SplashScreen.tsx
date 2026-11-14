import React, { useEffect, useState } from 'react';
import logo from '../assets/app-logo.png';
import './splash.css';

interface SplashScreenProps {
  onDone?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone }) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2800);
    const t2 = setTimeout(() => onDone?.(), 3400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div className={`splash ${leaving ? 'splash--out' : ''}`}>
      <div className="splash__stripe splash__stripe--top" />
      <img className="splash__logo" src={logo} alt="CollegeConnect" />
      <div className="splash__bar">
        <span />
      </div>
      <p className="splash__foot">V.S.B. Engineering College · Karur</p>
      <div className="splash__stripe splash__stripe--bottom" />
    </div>
  );
};

export default SplashScreen;
