import React, { useState, useEffect, useMemo } from 'react';
import { LeaderboardEntry, DeviceType } from '../types';
import { fetchLeaderboard, countryCodeToFlag, formatTimeAgo } from '../utils/leaderboard';
import { isMobile } from '../utils/device';
import { XIcon, SpinnerIcon, MobileIcon, DesktopComputerIcon, PodiumIcon } from './icons';

interface LeaderboardProps {
  onClose: () => void;
  onLeaderboardUpdate: (allScores: LeaderboardEntry[]) => void;
  isRotated: boolean;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ onClose, onLeaderboardUpdate, isRotated }) => {
  const [activeTab, setActiveTab] = useState<DeviceType>(isMobile() ? 'mobile' : 'computer');
  const [allScores, setAllScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadScores = async () => {
      setLoading(true);
      setError(null);
      try {
        const [mobileScores, computerScores] = await Promise.all([
          fetchLeaderboard('mobile').catch(() => []),
          fetchLeaderboard('computer').catch(() => [])
        ]);
        const combinedScores = [...mobileScores, ...computerScores];
        
        onLeaderboardUpdate(combinedScores);
        setAllScores(combinedScores);
      } catch (err) {
        setError('Could not load leaderboard. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadScores();
  }, [onLeaderboardUpdate]);
  
  const scores = useMemo(() => {
    const filtered = allScores.filter(entry => entry.device === activeTab);
    return filtered
        .sort((a, b) => b.score - a.score)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [allScores, activeTab]);
  
  const extractCountryCode = (regionStr: string): string => {
    if (!regionStr) return 'UNK';
    // New format: "ZA"
    if (regionStr.length === 2 && /^[a-zA-Z]{2}$/.test(regionStr)) {
      return regionStr;
    }
    // Old format: "South Africa (ZA)"
    const match = regionStr.match(/\((\w{2})\)/);
    if (match && match[1]) {
      return match[1];
    }
    return 'UNK';
  };

  const getTileClass = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500/30 border-yellow-400';
    if (rank === 2) return 'bg-gray-400/30 border-gray-300';
    if (rank === 3) return 'bg-orange-600/30 border-orange-500';
    if (rank <= 10) return 'bg-sky-600/20 border-sky-500';
    return 'bg-white/5 border-white/10';
  };

  const TabButton: React.FC<{ type: DeviceType; label: string; icon: React.ReactNode }> = ({ type, label, icon }) => (
    <button
      onClick={() => setActiveTab(type)}
      className={`flex-1 flex items-center justify-center gap-2 p-3 text-sm sm:text-base font-semibold border-b-2 ${activeTab === type ? 'border-cyan-400 text-white' : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/5'}`}
      aria-pressed={activeTab === type}
    >
      {icon}
      {label}
    </button>
  );

  const containerClasses = isRotated
    ? 'h-[95%] max-h-lg w-[90%] max-w-[700px]'
    : 'w-[95%] max-w-lg h-[90%] max-h-[700px]';

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-title"
    >
      <div className={`bg-neutral-900/80 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${containerClasses}`}>
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
          <h2 id="leaderboard-title" className="text-xl sm:text-2xl font-bold text-yellow-300 flex items-center gap-2">
            <PodiumIcon className="w-7 h-7" />
            Leaderboard
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close leaderboard"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </header>

        {/* Tabs */}
        <div className="flex items-stretch border-b border-neutral-700 flex-shrink-0">
          <TabButton type="computer" label="Computer" icon={<DesktopComputerIcon className="w-5 h-5" />} />
          <TabButton type="mobile" label="Mobile" icon={<MobileIcon className="w-5 h-5" />} />
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-2 sm:p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400">
              <SpinnerIcon className="w-12 h-12 animate-spin text-cyan-400" />
              <p className="mt-4 text-lg">Loading Scores...</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center h-full text-red-400">
              <p className="text-lg text-center">{error}</p>
            </div>
          )}
          {!loading && !error && (
            scores.length > 0 ? (
              <ul className="space-y-2">
                {scores.map(entry => (
                  <li
                    key={`${entry.rank}-${entry.name}-${entry.score}`}
                    className={`p-3 rounded-lg border transition-all duration-300 ${getTileClass(entry.rank)}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`text-xl sm:text-2xl font-bold w-10 text-center flex-shrink-0 ${entry.rank <= 3 ? 'text-yellow-300' : 'text-neutral-300'}`}>
                        {entry.rank}
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center justify-between">
                          <p className="text-base sm:text-lg font-bold text-white truncate pr-2">
                             {entry.name} {countryCodeToFlag(extractCountryCode(entry.region))}
                          </p>
                          <p className="text-lg sm:text-xl font-bold text-cyan-300">{entry.score.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm text-neutral-400 mt-1">
                          <span>Lv.{entry.level} | {entry.speed.toFixed(2)} m/s</span>
                          <span>{formatTimeAgo(entry.time)}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                    <p className="text-lg">No scores yet. Be the first!</p>
                </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;