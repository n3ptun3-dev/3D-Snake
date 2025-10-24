import React, { useState, useEffect, useMemo } from 'react';
import { LeaderboardEntry, DeviceType } from '../types';
import { fetchLeaderboard, countryCodeToFlag, formatTimeAgo, getGeoInfo } from '../utils/leaderboard';
import { isMobile } from '../utils/device';
import { XIcon, SpinnerIcon, MobileIcon, DesktopComputerIcon, PodiumIcon, SpeedIcon, HourglassIcon } from './icons';

interface LeaderboardProps {
  onClose: () => void;
  onLeaderboardUpdate: (allScores: LeaderboardEntry[]) => void;
  isRotated: boolean;
}

const ToggleFilterButton: React.FC<{
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}> = ({ label, icon, onClick, disabled, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="flex-1 flex items-center justify-center gap-2 max-w-[160px] px-3 py-2 text-sm font-semibold rounded-lg transition-colors border bg-neutral-800 border-neutral-600 text-neutral-200 hover:bg-neutral-700/80 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {icon}
    <span className="capitalize">{label}</span>
  </button>
);

const Leaderboard: React.FC<LeaderboardProps> = ({ onClose, onLeaderboardUpdate, isRotated }) => {
  const [activeTab, setActiveTab] = useState<DeviceType>(isMobile() ? 'mobile' : 'computer');
  const [allScores, setAllScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New state for filters
  const [scopeFilter, setScopeFilter] = useState<'global' | 'local'>('global');
  const [sortFilter, setSortFilter] = useState<'score' | 'speed' | 'time'>('score');
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [isFetchingRegion, setIsFetchingRegion] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      setIsFetchingRegion(true);
      
      try {
        const [mobileScores, computerScores, geoInfo] = await Promise.all([
          fetchLeaderboard('mobile').catch(() => []),
          fetchLeaderboard('computer').catch(() => []),
          getGeoInfo().catch(() => null)
        ]);
        
        const combinedScores = [...mobileScores, ...computerScores];
        onLeaderboardUpdate(combinedScores);
        setAllScores(combinedScores);
        setUserRegion(geoInfo ? geoInfo.countryCode : null);

      } catch (err) {
        setError('Could not load leaderboard. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
        setIsFetchingRegion(false);
      }
    };
    loadData();
  }, [onLeaderboardUpdate]);
  
  const scores = useMemo(() => {
    let filtered = allScores.filter(entry => entry.device === activeTab);

    if (scopeFilter === 'local' && userRegion) {
        const extractCountryCode = (regionStr: string): string => {
            if (!regionStr) return 'UNK';
            if (regionStr.length === 2 && /^[a-zA-Z]{2}$/.test(regionStr)) return regionStr;
            const match = regionStr.match(/\((\w{2})\)/);
            return match && match[1] ? match[1] : 'UNK';
        };
        filtered = filtered.filter(entry => extractCountryCode(entry.region) === userRegion);
    }
    
    if (sortFilter === 'speed') {
        filtered.sort((a, b) => b.speed - a.speed);
    } else if (sortFilter === 'time') {
        filtered.sort((a, b) => b.time - a.time);
    } else { // Default to score
        filtered.sort((a, b) => b.score - a.score);
    }

    return filtered.map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [allScores, activeTab, scopeFilter, sortFilter, userRegion]);
  
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
    if (sortFilter === 'time') {
      if (rank <= 3) return 'bg-sky-600/20 border-sky-500';
      return 'bg-white/5 border-white/10';
    }
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
      aria-label={`Show ${label} leaderboard`}
    >
      {icon}
      {label}
    </button>
  );

  const handleSortToggle = () => {
    setSortFilter(current => {
      if (current === 'score') return 'speed';
      if (current === 'speed') return 'time';
      return 'score';
    });
  };

  const sortButtonLabel = sortFilter === 'time' ? 'most recent' : sortFilter;
  const sortButtonIcon = useMemo(() => {
    if (sortFilter === 'score') return <PodiumIcon className="w-4 h-4" />;
    if (sortFilter === 'speed') return <SpeedIcon className="w-4 h-4" />;
    return <HourglassIcon className="w-4 h-4" />;
  }, [sortFilter]);

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

        {/* Tabs & Filters */}
        <div className="border-b border-neutral-700 flex-shrink-0">
            <div className="flex items-stretch">
                <TabButton type="computer" label="Computer" icon={<DesktopComputerIcon className="w-5 h-5" />} />
                <TabButton type="mobile" label="Mobile" icon={<MobileIcon className="w-5 h-5" />} />
            </div>
            <div className="p-3 flex items-center justify-center gap-4 bg-black/20">
                <ToggleFilterButton
                    label={scopeFilter}
                    onClick={() => setScopeFilter(s => (s === 'global' ? 'local' : 'global'))}
                    disabled={isFetchingRegion || !userRegion}
                    title={!userRegion ? 'Could not determine your location to show local scores.' : 'Toggle between Global and Local scores'}
                />
                <ToggleFilterButton
                    label={sortButtonLabel}
                    icon={sortButtonIcon}
                    onClick={handleSortToggle}
                    title="Cycle sorting between Score, Speed, and Most Recent"
                />
            </div>
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
                    key={`${entry.rank}-${entry.name}-${entry.score}-${entry.time}`}
                    className={`p-3 rounded-lg border transition-all duration-300 ${getTileClass(entry.rank)}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`text-xl sm:text-2xl font-bold w-10 text-center flex-shrink-0 ${sortFilter !== 'time' && entry.rank <= 3 ? 'text-yellow-300' : 'text-neutral-300'}`}>
                        {entry.rank}
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center justify-between">
                          <p className="text-base sm:text-lg font-bold text-white truncate pr-2">
                             {entry.name} {countryCodeToFlag(extractCountryCode(entry.region))}
                          </p>
                          {sortFilter === 'speed' ? (
                               <p className="text-lg sm:text-xl font-bold text-cyan-300">{entry.speed.toFixed(2)} m/s</p>
                          ) : (
                               <p className="text-lg sm:text-xl font-bold text-cyan-300">{entry.score.toLocaleString()}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm text-neutral-400 mt-1">
                          {sortFilter === 'speed' ? (
                                <span>Score: {entry.score.toLocaleString()} | Lv.{entry.level}</span>
                          ) : (
                                <span>Lv.{entry.level} | {entry.speed.toFixed(2)} m/s</span>
                          )}
                          <span className={sortFilter === 'time' ? 'font-bold text-cyan-300' : ''}>{formatTimeAgo(entry.time)}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                    <p className="text-lg">{scopeFilter === 'local' ? "No local scores found." : "No scores yet. Be the first!"}</p>
                </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;