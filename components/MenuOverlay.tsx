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
    onOpenWhatsNew: () => void;
    onOpenJoinPi: () => void;
    onOpenCredits: () => void;
    onOpenTerms: () => void;
    onOpenPrivacyPolicy: () => void;
    piUser: UserDTO | null;
    isRotated: boolean;
    isPiBrowser: boolean;
    onOpenLinkDevice: () => void;
    onOpenEnterCode: () => void;
    requestPiAuth: (intent: 'submit-score' | 'purchase-ad' | 'link-device' | 'donation', onSuccess: () => void, data?: any) => void;
    onOpenCareerProfile: () => void;
}

const MenuOverlay: React.FC<MenuOverlayProps> = ({ 
    onClose, isPaused, onEndGame, onOpenHowToPlay, onOpenSettings, onOpenGraphicsSettings,
    onOpenFeedback, onOpenWhatsNew, onOpenJoinPi, onOpenCredits, onOpenTerms, onOpenPrivacyPolicy, piUser, isRotated,
    isPiBrowser, onOpenLinkDevice, onOpenEnterCode, requestPiAuth, onOpenCareerProfile
}) => {
    const menuItems = [
        { name: 'How to Play', action: () => { onOpenHowToPlay(); onClose(); } },
        { name: 'Graphics Settings', action: () => { onOpenGraphicsSettings(); onClose(); } },
        { name: 'Music Settings', action: () => { onOpenSettings(); onClose(); } },
    ];
    
    // Dynamically insert the linking button
    if (isPiBrowser) {
        const handlePlayOnAnotherDevice = () => {
            if (piUser) {
                onOpenLinkDevice();
                onClose();
            } else {
                // Close the menu first before showing the auth modal.
                onClose();
                requestPiAuth('link-device', () => {
                    // This runs after successful auth. The menu is already closed.
                    onOpenLinkDevice();
                });
            }
        };
        menuItems.push({ name: 'Play on Another Device', action: handlePlayOnAnotherDevice });
    } else { // Not in Pi Browser
        menuItems.push({ name: piUser ? 'Account Linked ✅' : 'Link Account', action: () => { if (!piUser) { onOpenEnterCode(); onClose(); } } });
    }

    const commonMenuItems = [
        { name: "Development Updates", action: () => { onOpenWhatsNew(); onClose(); } },
        { name: 'Feedback', action: () => { onOpenFeedback(); onClose(); } },
    ];
    
    // Conditionally add "Join Pi Network" if user is not in Pi Browser and not logged in.
    if (!isPiBrowser && !piUser) {
        commonMenuItems.push({ name: 'Join Pi Network', action: () => { onOpenJoinPi(); onClose(); } });
    }

    commonMenuItems.push(
        { name: 'Credits', action: () => { onOpenCredits(); onClose(); } },
        { name: 'Terms & Conditions', action: () => { onOpenTerms(); onClose(); } },
        { name: 'Privacy Policy', action: () => { onOpenPrivacyPolicy(); onClose(); } }
    );
    
    menuItems.push(...commonMenuItems);


    const containerClasses = isRotated
        ? 'h-auto max-h-[95%] w-auto max-w-[90dvw]'
        : 'w-full max-w-sm max-h-[90%]';

    const handleCareerClick = () => {
        onOpenCareerProfile();
        onClose();
    };

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
                                    onClick={() => { onEndGame(); onClose(); }}
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
                                    disabled={item.name === 'Account Linked ✅'}
                                    aria-label={item.name === 'Account Linked ✅' ? 'Account is already linked' : item.name}
                                    className="w-full text-left p-3 rounded-lg text-lg font-semibold text-neutral-200 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {item.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                
                <footer className="p-4 border-t border-neutral-700 text-center text-sm text-neutral-400 flex-shrink-0">
                    <button onClick={handleCareerClick} className="w-full text-center hover:text-white transition-colors">
                        <strong className="text-cyan-400">Grid Runner Career</strong>
                        {piUser && (
                            <>
                                : <strong className="text-fuchsia-500">@{piUser.username}</strong>
                            </>
                        )}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default MenuOverlay;
