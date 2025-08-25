import React from 'react';
import { XIcon } from './icons';
import { GraphicsQuality } from '../types';

interface GraphicsSettingsProps {
    onClose: () => void;
    currentQuality: GraphicsQuality;
    onQualityChange: (quality: GraphicsQuality) => void;
    isRotated: boolean;
}

const QUALITY_OPTIONS: { id: GraphicsQuality; name: string; description: string }[] = [
    {
        id: 'High',
        name: 'High',
        description: 'Full visual experience with all effects enabled.',
    },
    {
        id: 'Medium',
        name: 'Medium',
        description: 'Balanced performance and quality. Disables demanding effects like shadows.',
    },
    {
        id: 'Low',
        name: 'Low',
        description: 'Best performance. Disables shadows and post-processing effects like bloom.',
    },
];

const GraphicsSettings: React.FC<GraphicsSettingsProps> = ({ onClose, currentQuality, onQualityChange, isRotated }) => {
    
    const selectedOption = QUALITY_OPTIONS.find(opt => opt.id === currentQuality) || QUALITY_OPTIONS[0];

    const containerClasses = isRotated
        ? 'h-auto max-h-md w-auto max-w-[80vw]'
        : 'w-[95%] max-w-md';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans"
            role="dialog"
            aria-modal="true"
            aria-labelledby="graphics-settings-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl p-6 ${containerClasses}`}>
                <header className="flex items-center justify-between mb-4">
                    <h2 id="graphics-settings-title" className="text-xl font-bold text-white">Graphics Quality</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close settings"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-neutral-300 mb-2">Presets</h3>
                        <div className="flex items-center justify-center gap-2 sm:gap-4">
                            {QUALITY_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => onQualityChange(option.id)}
                                    className={`flex-1 px-4 py-3 rounded-lg text-base font-bold transition-all border-2
                                        ${currentQuality === option.id
                                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                                            : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:border-neutral-500'
                                        }`}
                                    aria-pressed={currentQuality === option.id}
                                >
                                    {option.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-black/30 min-h-[6rem]">
                         <p className="text-sm text-neutral-300">{selectedOption.description}</p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default GraphicsSettings;