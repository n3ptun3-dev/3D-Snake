import React from 'react';
import { XIcon } from './icons';
import { UserDTO } from '../types';

interface MenuOverlayProps {
    onClose: () => void;
    isPaused: boolean;
    onEndGame: () => void;
    onOpenHowToPlay: () => void;
    onOpenSettings: () => void;
    onOpenGraphicsSettings: () => void;
    onOpenFeedback: () => void;
    onOpenJoinPi: () => void;
    onOpenAboutSpi: () => void;
    onOpenCredits: () => void;
    onOpenTerms: () => void;
    onOpenPrivacyPolicy: () => void;
    piUser: UserDTO | null;
    isRotated: boolean;
}

const MenuOverlay: React.FC<MenuOverlayProps> = ({ 
    onClose, isPaused, onEndGame, onOpenHowToPlay, onOpenSettings, onOpenGraphicsSettings,
    onOpenFeedback, onOpenJoinPi, onOpenAboutSpi, onOpenCredits, onOpenTerms, onOpenPrivacyPolicy, piUser, isRotated
}) => {
    const menuItems = [
        { name: 'Graphics Settings', action: () => { onOpenGraphicsSettings(); onClose(); } },
        { name: 'Music Settings', action: () => { onOpenSettings(); onClose(); } },
        { name: 'How to play', action: () => { onOpenHowToPlay(); onClose(); } },
        { name: 'Feedback', action: () => { onOpenFeedback(); onClose(); } },
        { name: 'About Spi vs Spi', action: () => { onOpenAboutSpi(); onClose(); } },
        { name: 'Join Pi Network', action: () => { onOpenJoinPi(); onClose(); } },
        { name: 'Credits', action: () => { onOpenCredits(); onClose(); } },
        { name: 'Terms & Conditions', action: () => { onOpenTerms(); onClose(); } },
        { name: 'Privacy Policy', action: () => { onOpenPrivacyPolicy(); onClose(); } },
    ];

    const containerClasses = isRotated
        ? 'h-full max-h-sm w-auto max-w-[90dvw]'
        : 'w-full max-w-sm max-h-[90dvh]';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
                    <h2 id="menu-title" className="text-xl font-bold text-white">Menu</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close menu"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto p-4">
                    <ul className="space-y-2">
                        {isPaused && (
                            <li>
                                <button
                                    onClick={onEndGame}
                                    className="w-full text-left p-3 rounded-lg text-lg font-semibold bg-red-600/80 hover:bg-red-700/80 text-white transition-colors"
                                >
                                    End Game
                                </button>
                            </li>
                        )}
                        {menuItems.map(item => (
                            <li key={item.name}>
                                <button
                                    onClick={item.action}
                                    className="w-full text-left p-3 rounded-lg text-lg font-semibold text-neutral-200 hover:bg-white/10 transition-colors"
                                >
                                    {item.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                
                {piUser && (
                    <footer className="p-4 border-t border-neutral-700 text-center text-sm text-neutral-400 flex-shrink-0">
                        Logged in as <strong className="text-yellow-300">@{piUser.username}</strong>
                    </footer>
                )}
            </div>
        </div>
    );
};

export default MenuOverlay;
