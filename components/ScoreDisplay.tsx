import React from 'react';
import { HeartIcon } from './icons.tsx';

interface ScoreDisplayProps {
  score: number;
  level: number;
  lives: number;
}

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score, level, lives }) => {
  return (
    <div 
      className="absolute top-4 left-1/2 -translate-x-1/2 w-auto flex items-center justify-center gap-x-4 sm:gap-x-6 bg-neutral-900/70 backdrop-blur-sm text-white px-4 sm:px-6 py-2 rounded-xl shadow-lg z-10 text-lg font-semibold"
      aria-live="polite"
    >
      <div aria-label={`Score: ${score}`}>Score: {score}</div>
      <div className="text-neutral-500">|</div>
      <div aria-label={`Level: ${level}`}>Level: {level}</div>
      <div className="text-neutral-500">|</div>
      <div className="flex items-center gap-x-1.5" aria-label={`${lives} lives remaining`}>
        {Array.from({ length: lives }).map((_, i) => (
          <HeartIcon key={i} className="w-5 h-5 text-red-500" />
        ))}
      </div>
    </div>
  );
};

export default ScoreDisplay;