import React from 'react';
import { XIcon, HourglassIcon, RocketIcon, PodiumIcon, TrophyIcon } from './icons';
import { CareerStats, UserDTO, FruitType, NodeCollection } from '../types';
import { SpeedBoostIcon, SlowDownIcon, MagnetIcon, ScoreDoublerIcon, HeartIcon, TripleIcon } from './icons';
import { FRUIT_COLORS } from '../constants';

interface CareerProfileProps {
    onClose: () => void;
    isRotated: boolean;
    piUser: UserDTO | null;
    stats: CareerStats;
}

const formatSeconds = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; }> = ({ title, value, icon }) => (
    <div className="bg-cyan-900/30 p-4 rounded-lg border border-cyan-500/50 flex flex-col items-center justify-center text-center">
        <div className="text-cyan-300 mb-2">{icon}</div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-neutral-400 uppercase tracking-wider">{title}</p>
    </div>
);

const NodeIcon: React.FC<{ type: FruitType }> = ({ type }) => {
    const iconMap: Record<FruitType, React.ReactNode> = {
        [FruitType.APPLE]: <div className="w-6 h-6 rounded-sm" style={{ backgroundColor: FRUIT_COLORS[FruitType.APPLE] }}></div>,
        [FruitType.SPEED_BOOST]: <SpeedBoostIcon className="w-6 h-6 text-yellow-400" />,
        [FruitType.SLOW_DOWN]: <SlowDownIcon className="w-6 h-6 text-cyan-400" />,
        [FruitType.MAGNET]: <MagnetIcon className="w-6 h-6 text-purple-400" />,
        [FruitType.SCORE_DOUBLER]: <ScoreDoublerIcon className="w-6 h-6 text-amber-500" />,
        [FruitType.TRIPLE]: <TripleIcon className="w-6 h-6 text-green-400" />,
        [FruitType.EXTRA_LIFE]: <HeartIcon className="w-6 h-6 text-red-500" />,
    };
    return <>{iconMap[type]}</>;
};

const NodeStat: React.FC<{ type: FruitType; count: number }> = ({ type, count }) => (
    <div className="bg-black/30 p-2 rounded-md flex items-center justify-center gap-2">
        <NodeIcon type={type} />
        <span className="font-bold text-lg text-white">{count.toLocaleString()}</span>
    </div>
);

const CareerProfile: React.FC<CareerProfileProps> = ({ onClose, isRotated, piUser, stats }) => {
    const containerClasses = isRotated
        ? 'h-[95%] w-[90%] max-w-2xl'
        : 'h-[90%] w-[95%] max-w-lg';

    const nodeEntries = Object.entries(stats.nodesCollected) as [string, number][];

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="career-profile-title"
        >
            <div className={`bg-cyan-900/30 backdrop-blur-sm border-2 border-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.5)] rounded-2xl flex flex-col ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b-2 border-cyan-500/50 flex-shrink-0">
                    <div>
                        <h2 id="career-profile-title" className="text-xl font-bold text-white">Grid Runner Dossier</h2>
                        {piUser && <p className="text-sm text-yellow-300">@{piUser.username}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-cyan-300 hover:bg-cyan-500/20"
                        aria-label="Close Profile"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
                    <section>
                        <h3 className="text-lg font-semibold text-cyan-300 mb-3 text-center">Core Career Stats</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <StatCard title="Total Grid Time" value={formatSeconds(stats.totalGridTime)} icon={<HourglassIcon className="w-8 h-8"/>} />
                            <StatCard title="Distance Travelled" value={stats.totalDistanceTravelled.toLocaleString()} icon={<RocketIcon className="w-8 h-8"/>} />
                            <StatCard title="All-Time High" value={stats.allTimeHighScore.toLocaleString()} icon={<PodiumIcon className="w-8 h-8"/>} />
                            <StatCard title="Best Single Life" value={stats.highestSingleLifeScore.toLocaleString()} icon={<TrophyIcon className="w-8 h-8"/>} />
                            <StatCard title="Longest Life" value={formatSeconds(stats.personalBestLifeDuration)} icon={<HourglassIcon className="w-8 h-8"/>} />
                        </div>
                    </section>

                     <section>
                        <h3 className="text-lg font-semibold text-cyan-300 mb-3 text-center">Field Analysis</h3>
                        <div className="mt-3">
                            <StatCard title="Passages Cleared" value={stats.successfulPassages.toLocaleString()} icon={<div className="font-bold text-3xl">S</div>} />
                        </div>
                         <div className="grid grid-cols-2 mt-3 gap-3">
                            <StatCard title="Failed Passage Attempts" value={stats.failedPassages.toLocaleString()} icon={<div className="font-bold text-3xl text-red-400">F</div>} />
                            <StatCard title="Portals Entered" value={stats.portalsEntered.toLocaleString()} icon={<div className="font-bold text-3xl">P</div>} />
                        </div>
                    </section>
                    
                    <section>
                        <h3 className="text-lg font-semibold text-cyan-300 mb-3 text-center">Node Collection</h3>
                        {nodeEntries.length > 0 ? (
                             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {nodeEntries.map(([type, count]) => (
                                    <NodeStat key={type} type={Number(type) as FruitType} count={count} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-neutral-400">No nodes collected yet.</p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default CareerProfile;
