import React from 'react';
import { XIcon } from './icons';

interface NonPiBrowserModalProps {
    action: {
        // FIX: Added 'link-device' to the possible intents and widened the data type to resolve type errors from App.tsx.
        intent: 'submit-score' | 'purchase-ad' | 'link-device';
        data?: any;
    };
    onClose: () => void;
    isRotated: boolean;
}

const NonPiBrowserModal: React.FC<NonPiBrowserModalProps> = ({ action, onClose, isRotated }) => {
    const { intent, data: scoreData } = action;

    const getDeepLink = () => {
        const base = 'pi://d-snake-7a80a.web.app/';
        if (intent === 'submit-score' && scoreData) {
            return `${base}/submit-score?score=${scoreData.score}&level=${scoreData.level}&speed=${scoreData.topSpeed}`;
        }
        if (intent === 'purchase-ad') {
            return `${base}/start-ad-purchase`;
        }
        return base; // Fallback
    };

    const deepLinkUrl = getDeepLink();
    const referralUrl = 'https://minepi.com/n3ptun3';

    const containerClasses = isRotated
        ? 'h-auto max-h-lg w-auto max-w-[90vw]'
        : 'w-full max-w-lg';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4"
            role="dialog" aria-modal="true" aria-labelledby="non-pi-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl text-center p-6 ${containerClasses}`}>
                <img 
                    src="https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Pi%20Network%20icon.png" 
                    alt="Pi Network Logo" 
                    className="w-20 h-20 mx-auto rounded-full bg-black/20 mb-4 object-cover"
                />
                <h2 id="non-pi-title" className="text-xl font-bold text-white mb-2">Pi Browser Required</h2>
                <p className="text-neutral-300 mb-6">This feature requires the Pi Browser for secure authentication and transactions. Please choose an option below.</p>
                
                <div className="space-y-4">
                    <a href={deepLinkUrl} className="block w-full px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg transition-colors text-lg">
                        Continue in Pi Browser
                    </a>
                    <a href={referralUrl} target="_blank" rel="noopener noreferrer" className="block w-full px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white font-bold rounded-lg transition-colors">
                        Join Pi Network
                    </a>
                </div>
                
                <button onClick={onClose} className="mt-6 text-sm text-neutral-400 hover:text-white">
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default NonPiBrowserModal;
