import React from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from './icons';
import { GameState } from '../types';

interface ControlsProps {
  onTurnLeft: () => void;
  onTurnRight: () => void;
  gameState: GameState;
  activeKey: 'left' | 'right' | null;
  isPaused: boolean;
  isHudVisible: boolean;
}

const Controls: React.FC<ControlsProps> = ({ onTurnLeft, onTurnRight, gameState, activeKey, isPaused, isHudVisible }) => {
  const isPlaying = gameState === 'Playing';

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, turnFn: () => void) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isPaused) {
      turnFn();
    }
  };

  // Hide controls if not playing, or if paused and the HUD is collapsed for an unobstructed view.
  if (!isPlaying || (isPaused && !isHudVisible)) {
    return null;
  }

  const isLeftActive = activeKey === 'left';
  const isRightActive = activeKey === 'right';

  // Dynamically set background and icon opacity based on paused state.
  const backgroundClass = isPaused ? 'bg-black/50' : 'bg-black/20'; // Paused: darker. Gameplay: more transparent.
  const iconOpacityClass = isPaused ? 'opacity-50' : 'opacity-90';

  const controlClass = `w-1/3 h-20 ${backgroundClass} backdrop-blur-sm flex items-center justify-center transition-colors duration-200 rounded-lg`;
  const activeClass = 'bg-cyan-500/30';
  
  // Removed the global opacity change for the paused state. Now only cursor changes.
  const interactiveClass = isPaused ? 'cursor-not-allowed' : 'active:bg-cyan-500/30 cursor-pointer';

  return (
    <div
      className="absolute bottom-0 left-0 w-full z-10 flex items-center justify-between p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      role="group"
      aria-label="Movement Controls"
    >
      {/* Left Button */}
      <button
        aria-label="Turn Left"
        onPointerDown={(e) => handlePointerDown(e, onTurnLeft)}
        className={`${controlClass} text-cyan-400 ${interactiveClass} ${isLeftActive ? activeClass : ''}`}
      >
        <ArrowLeftIcon className={`w-12 h-12 ${iconOpacityClass}`} />
      </button>

      {/* Right Button */}
      <button
        aria-label="Turn Right"
        onPointerDown={(e) => handlePointerDown(e, onTurnRight)}
        className={`${controlClass} text-cyan-400 ${interactiveClass} ${isRightActive ? activeClass : ''}`}
      >
        <ArrowRightIcon className={`w-12 h-12 ${iconOpacityClass}`} />
      </button>
    </div>
  );
};

export default Controls;