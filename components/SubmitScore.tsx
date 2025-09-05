import React, { useState, useEffect } from 'react';
import { DeviceType, UserDTO } from '../types';
import { isMobile } from '../utils/device';
import { getGeoInfo, submitScore } from '../utils/leaderboard';
import { SpinnerIcon } from './icons';
import { piService } from '../utils/pi';

interface SubmitScoreProps {
  scoreData: {
    score: number;
    level: number;
    topSpeed: number;
  };
  onClose: () => void;
  requestPiAuth: (onSuccess: () => void) => void;
  isRotated: boolean;
  isForLeaderboard: boolean;
}

const SubmitScore: React.FC<SubmitScoreProps> = ({ scoreData, onClose, requestPiAuth, isRotated, isForLeaderboard }) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const piUser = piService.getCurrentUser();

  useEffect(() => {
    if (piUser) {
        setName(piUser.username);
    }
  }, [piUser]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    const performSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
          const geo = await getGeoInfo();
          const region = geo ? geo.countryCode : 'UNK';
          const deviceType: DeviceType = isMobile() ? 'mobile' : 'computer';
          
          await submitScore(deviceType, { ...scoreData, name: name.trim(), region });
    
          setSubmitSuccess(true);
          setTimeout(() => {
            onClose();
          }, 2000);
    
        } catch (err) {
          setError('Failed to submit score. Please try again.');
          console.error(err);
        } finally {
          setIsSubmitting(false);
        }
    };

    if (piService.getCurrentUser()) {
        await performSubmit();
    } else {
        requestPiAuth(performSubmit);
    }
  };

  const containerClasses = isRotated
    ? 'h-auto max-h-md w-full max-w-[90dvw]'
    : 'w-full max-w-md max-h-full';

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-score-title"
    >
      <div className={`bg-neutral-900/80 border border-yellow-400/50 rounded-2xl shadow-2xl flex flex-col ${containerClasses}`}>
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 text-center text-white">
          {submitSuccess ? (
            <div>
              <img src="https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/trophy.png" alt="Success Trophy" className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" />
              <h2 id="submit-score-title" className="text-xl sm:text-2xl font-bold mt-2 sm:mt-4 text-green-400">Success!</h2>
              <p className="mt-2 text-neutral-300">Your score has been submitted to the leaderboard!</p>
            </div>
          ) : isForLeaderboard ? (
            <>
              <img src="https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/trophy.png" alt="High Score Trophy" className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" />
              <h2 id="submit-score-title" className="text-xl sm:text-2xl font-bold mt-2 sm:mt-4">New High Score!</h2>
              <p className="mt-2 text-neutral-300">You've made it to the leaderboard! Enter your name to save your score.</p>
              <p className="text-3xl sm:text-4xl font-bold my-2 sm:my-4 text-cyan-300">{scoreData.score.toLocaleString()}</p>
              
              <form onSubmit={handleSubmit}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={piUser ? piUser.username : "Enter your name"}
                  maxLength={20}
                  required
                  className="w-full px-4 py-3 bg-neutral-800 border-2 border-neutral-600 rounded-lg text-white text-center text-lg focus:outline-none focus:border-cyan-400 transition-colors"
                  aria-label="Your name for the leaderboard"
                />
                {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
                <div className="flex gap-4 mt-4 sm:mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Skip
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim() || isSubmitting}
                    className="flex-1 px-4 py-3 bg-green-700 hover:bg-green-800 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:bg-green-700/50 flex items-center justify-center"
                  >
                    {isSubmitting ? <SpinnerIcon className="w-6 h-6 animate-spin" /> : 'Submit'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <img src="https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/trophy.png" alt="High Score Trophy" className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" />
              <h2 id="submit-score-title" className="text-xl sm:text-2xl font-bold mt-2 sm:mt-4">New High Score!</h2>
              <p className="mt-2 text-neutral-300">Congratulations on setting a new personal best.</p>
              <p className="text-3xl sm:text-4xl font-bold my-2 sm:my-4 text-cyan-300">{scoreData.score.toLocaleString()}</p>
              <button
                  type="button"
                  onClick={onClose}
                  className="w-full mt-4 sm:mt-6 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors"
              >
                  Continue
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmitScore;