import React, { useEffect, useRef } from 'react';
import { FRUIT_COLORS } from '../constants';
import { FruitType } from '../types';
import {
    XIcon, ArrowLeftIcon, ArrowRightIcon, SpeedBoostIcon, SlowDownIcon, MagnetIcon,
    ScoreDoublerIcon, HeartIcon, TripleIcon, EyeIcon, RadioIcon, MusicOnIcon, SfxOnIcon
} from './icons';

interface HowToPlayOverlayProps {
    onClose: () => void;
    isRotated: boolean;
    showBackdrop?: boolean;
}

const nodeData = [
    {
        type: FruitType.APPLE,
        name: 'Data Node',
        description: 'The primary energy source. Collect these to score points, increase your speed, and grow longer.',
        icon: <div className="w-6 h-6 rounded-md" style={{ backgroundColor: FRUIT_COLORS[FruitType.APPLE] }}></div>
    },
    {
        type: FruitType.SPEED_BOOST,
        name: 'Overdrive Node (speed up)',
        description: 'Temporarily doubles your current speed. Use with caution at high velocities!',
        icon: <SpeedBoostIcon className="w-6 h-6 text-yellow-400" />
    },
    {
        type: FruitType.SLOW_DOWN,
        name: 'Stasis Node (slow down)',
        description: 'Instantly reduces your base speed, making high-speed navigation more manageable.',
        icon: <SlowDownIcon className="w-6 h-6 text-cyan-400" />
    },
    {
        type: FruitType.MAGNET,
        name: 'Tractor Node (magnet)',
        description: 'Pulls nearby Data Nodes towards you for a short period.',
        icon: <MagnetIcon className="w-6 h-6 text-purple-400" />
    },
    {
        type: FruitType.SCORE_DOUBLER,
        name: 'Multiplier Node (x2)',
        description: 'Doubles the points gained from each Data Node for a limited time.',
        icon: <ScoreDoublerIcon className="w-6 h-6 text-amber-500" />
    },
    {
        type: FruitType.TRIPLE,
        name: 'Fork Node (x3)',
        description: 'For a short duration, each Data Node collected spawns three more and triples your growth.',
        icon: <TripleIcon className="w-6 h-6 text-green-400" />
    },
    {
        type: FruitType.EXTRA_LIFE,
        name: 'Aegis Node (1up)',
        description: 'A rare node found in the outer passages that grants an extra life.',
        icon: <HeartIcon className="w-6 h-6 text-red-500" />
    },
];

const InfoItem: React.FC<{ title: string; description: React.ReactNode; children: React.ReactNode; }> = ({ title, description, children }) => (
    <div className="bg-neutral-800/60 p-4 rounded-lg flex items-center gap-4">
        <div className="flex-shrink-0 flex items-center justify-center gap-1 bg-black/40 p-3 rounded-md">
            {children}
        </div>
        <div className="flex-grow">
            <h4 className="font-bold text-white">{title}</h4>
            <p className="text-sm text-neutral-300">{description}</p>
        </div>
    </div>
);

const HowToPlayOverlay: React.FC<HowToPlayOverlayProps> = ({ onClose, isRotated, showBackdrop = true }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (!showBackdrop) {
            // This component is shown on a timer, not a click, so no timeout is needed to prevent
            // the opening click from being caught.
            // We use 'click' instead of 'mousedown' to ensure it fires on the same event type
            // as the global audio unlock listener in sounds.ts, making the behavior consistent.
            document.addEventListener('click', handleClickOutside);
            return () => {
                document.removeEventListener('click', handleClickOutside);
            };
        }
    }, [onClose, showBackdrop]);

    const containerClasses = isRotated
        ? 'h-auto max-h-[95%] w-auto max-w-[90vh]'
        : 'h-auto w-full max-w-lg max-h-[90%]';
        
    const backdropClass = showBackdrop ? "bg-black/80 backdrop-blur-md" : "bg-transparent pointer-events-none";
    const modalClass = showBackdrop ? "" : "pointer-events-auto";

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center font-sans p-4 ${backdropClass}`}
            onClick={showBackdrop ? onClose : undefined}
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-to-play-title"
        >
            <div ref={modalRef} className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col ${modalClass} ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
                    <h2 id="how-to-play-title" className="text-xl font-bold text-white">How to Play 3D Snake</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
                    <section>
                        <h3 className="text-lg font-bold text-cyan-300 mb-3">Interface Controls</h3>
                        <div className="space-y-3">
                            <InfoItem title="Toggle View" description={<>Switch between <strong className="text-cyan-300">first-person</strong> and <strong className="text-cyan-300">third-person</strong> camera views during gameplay.</>}>
                                <EyeIcon className="w-8 h-8 text-cyan-400" />
                            </InfoItem>
                            <InfoItem title="Audio Settings" description="Toggle game music and sound effects, or open the settings to tune into live radio stations.">
                                <div className="flex gap-2">
                                    <RadioIcon className="w-8 h-8 text-cyan-400" />
                                    <MusicOnIcon className="w-8 h-8 text-cyan-400" />
                                    <SfxOnIcon className="w-8 h-8 text-cyan-400" />
                                </div>
                            </InfoItem>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-cyan-300 mb-2">Objective</h3>
                        <p className="text-neutral-300">Navigate the grid, collect nodes to grow your snake and increase your score. Avoid crashing into walls or your own tail!</p>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-cyan-300 mb-3">Core Maneuvers</h3>
                        <div className="space-y-3">
                            <InfoItem title="90° Turn" description="Press once to make a sharp turn.">
                                <ArrowLeftIcon className="w-8 h-8 text-cyan-400" />
                            </InfoItem>
                            <InfoItem title="180° Turn" description={<><strong className="text-cyan-300">Quickly</strong> press the same direction twice to make a U-turn.</>}>
                                <ArrowLeftIcon className="w-8 h-8 text-cyan-400" />
                                <ArrowLeftIcon className="w-8 h-8 text-cyan-400" />
                            </InfoItem>
                            <InfoItem title="Sidestep" description={<><strong className="text-cyan-300">Quickly</strong> press opposite directions to shift one lane over.</>}>
                                <ArrowLeftIcon className="w-8 h-8 text-cyan-400" />
                                <ArrowRightIcon className="w-8 h-8 text-cyan-400" />
                            </InfoItem>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-cyan-300 mb-3">Energy Nodes</h3>
                        <p className="text-sm text-neutral-400 mb-4">Collect these nodes scattered across the grid to gain points, grow, and activate special abilities.</p>
                        <ul className="space-y-3">
                            {nodeData.map(node => (
                                <li key={node.name} className="flex items-start gap-4 p-3 bg-neutral-800/60 rounded-lg">
                                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                                        {node.icon}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">{node.name}</h4>
                                        <p className="text-sm text-neutral-300">{node.description}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                    
                    <section>
                        <h3 className="text-lg font-bold text-cyan-300 mb-3">Pro Tip</h3>
                        <p className="text-sm text-neutral-300">
                            Keep an eye on the city skyline. When you see a building with active searchlights, it's a signal that a rare, powerful node has just spawned in the outer street passage. Time your route carefully to grab it!
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default HowToPlayOverlay;
