import React from 'react';
import { LifeStats, FruitType, NodeCollection } from '../types';
import { FRUIT_COLORS } from '../constants';
import { SpeedBoostIcon, SlowDownIcon, MagnetIcon, ScoreDoublerIcon, HeartIcon, TripleIcon } from './icons';

interface PostRunDebriefProps {
  stats: LifeStats;
  totalScore: number;
  livesLeft: number;
  onContinue: () => void;
  onEndGame: () => void;
  isRotated: boolean;
}

const NodeIcon: React.FC<{ type: FruitType }> = ({ type }) => {
    const iconMap: Record<FruitType, React.ReactNode> = {
        [FruitType.APPLE]: <div className="w-5 h-5 rounded-sm" style={{ backgroundColor: FRUIT_COLORS[FruitType.APPLE] }}></div>,
        [FruitType.SPEED_BOOST]: <SpeedBoostIcon className="w-5 h-5 text-yellow-400" />,
        [FruitType.SLOW_DOWN]: <SlowDownIcon className="w-5 h-5 text-cyan-400" />,
        [FruitType.MAGNET]: <MagnetIcon className="w-5 h-5 text-purple-400" />,
        [FruitType.SCORE_DOUBLER]: <ScoreDoublerIcon className="w-5 h-5 text-amber-500" />,
        [FruitType.TRIPLE]: <TripleIcon className="w-5 h-5 text-green-400" />,
        [FruitType.EXTRA_LIFE]: <HeartIcon className="w-5 h-5 text-red-500" />,
    };
    return <>{iconMap[type]}</>;
};

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const StatItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="flex justify-between items-baseline text-base">
        <span className="text-neutral-400">{label}</span>
        <span className="font-bold text-white">{value}</span>
    </div>
);

const PostRunDebrief: React.FC<PostRunDebriefProps> = ({ stats, totalScore, livesLeft, onContinue, onEndGame, isRotated }) => {
    const isLastLife = livesLeft <= 0;
    const borderColor = isLastLife ? 'border-red-500' : 'border-cyan-400';
    const shadowColor = isLastLife ? 'shadow-[0_0_20px_rgba(239,68,68,0.7)]' : 'shadow-[0_0_20px_rgba(0,255,255,0.7)]';
    
    const containerClasses = isRotated
        ? 'w-full max-w-sm'
        : 'w-full max-w-sm';

    const nodeEntries = Object.entries(stats.nodesCollected) as [string, number][];

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none">
            <div className={`bg-neutral-900/80 backdrop-blur-md border-2 ${borderColor} ${shadowColor} rounded-2xl flex flex-col pointer-events-auto ${containerClasses} max-h-[90vh]`}>
                
                <div className="flex-grow p-4 overflow-y-auto space-y-4">
                    <div className="text-center relative py-4">
                        {isLastLife && (
                            <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-red-500" style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.7)' }}>
                                Game Over
                            </h1>
                        )}
                        <div className="relative inline-block bg-gradient-to-br from-neutral-800 to-black p-1 rounded-2xl border-2 border-neutral-600">
                             <div className="px-8 py-4 bg-black/50 rounded-xl">
                                <p className="text-sm text-neutral-400">Life Score</p>
                                <p className="text-6xl font-bold text-cyan-300 leading-tight">{stats.score.toLocaleString()}</p>
                            </div>
                        </div>
                        <p className="text-base text-neutral-300 mt-2">Total Score: {totalScore.toLocaleString()}</p>
                    </div>

                    <div className="space-y-2 bg-black/20 p-3 rounded-md">
                        <StatItem label="Duration" value={formatDuration(stats.duration)} />
                        <StatItem label="Top Speed" value={`${stats.topSpeed.toFixed(2)} m/s`} />
                        <StatItem label="Portals Entered" value={stats.portalsEntered} />
                        <StatItem label="Passages Cleared" value={stats.successfulPassages} />
                    </div>

                    <div>
                        <h4 className="text-base font-semibold text-neutral-300 mb-2">Nodes Collected</h4>
                        {nodeEntries.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2 text-center">
                                {nodeEntries.map(([type, count]) => (
                                    <div key={type} className="bg-black/20 p-2 rounded-md flex flex-col items-center justify-center">
                                        <NodeIcon type={Number(type) as FruitType} />
                                        <p className="text-lg font-bold mt-1">{count}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-neutral-500 text-center">No special nodes collected.</p>
                        )}
                    </div>
                </div>

                <footer className="p-4 border-t border-neutral-700 flex flex-col items-center gap-3">
                    {isLastLife ? (
                        <button onClick={onEndGame} className="w-full max-w-xs px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors text-lg">
                            Continue
                        </button>
                    ) : (
                        <>
                            <button onClick={onContinue} className="w-full max-w-xs px-4 py-3 bg-green-700 hover:bg-green-800 text-white font-bold rounded-lg transition-colors text-lg flex items-center justify-center gap-2">
                                Continue <HeartIcon className="w-5 h-5 text-red-400" /> x {livesLeft}
                            </button>
                            <button onClick={onEndGame} className="text-sm text-neutral-400 hover:text-white underline">
                                End Game
                            </button>
                        </>
                    )}
                </footer>
            </div>
        </div>
    );
};

export default PostRunDebrief;