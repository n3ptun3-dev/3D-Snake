import React from 'react';
import { SpeedIcon } from './icons.tsx';

interface SpeedometerProps {
  gameSpeed: number;
}

const Speedometer: React.FC<SpeedometerProps> = ({ gameSpeed }) => {
  // gameSpeed is the interval in ms. Speed in m/s is 1000 / interval.
  const speedMps = (1000 / gameSpeed).toFixed(2);

  return (
    <div 
      className="absolute top-4 right-4 bg-neutral-900/70 backdrop-blur-sm text-white px-4 py-2 rounded-xl shadow-lg z-10 flex items-center text-lg font-semibold"
      aria-live="off" // Speed changes too frequently for polite announcements
      aria-label={`Current speed: ${speedMps} meters per second`}
    >
      <SpeedIcon className="w-5 h-5 mr-2" />
      <span>{speedMps} m/s</span>
    </div>
  );
};

export default Speedometer;