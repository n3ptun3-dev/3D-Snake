import React, { useState } from 'react';
import { piService } from '../utils/pi';
import { isMobile } from '../utils/device';
import { getGeoInfo, submitScore } from '../utils/leaderboard';
import { DeviceType } from '../types';
import { SpinnerIcon } from './icons';

interface NonPiBrowserModalProps {
    action: {
        intent: 'submit-score' | 'purchase-ad' | 'link-device' | 'donation';
        data?: any;
    };
    onClose: () => void;
    isRotated: boolean;
}

const NonPiBrowserModal: React.FC<NonPiBrowserModalProps> = ({ action, onClose, isRotated }) => {
    const { intent, data: scoreData } = action;
    const referralUrl = 'https://minepi.com/n3ptun3';
    const piBrowserLink = 'pi://d-snake-7a80a.web.app';

    const [code, setCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const handleLinkAndSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim() || isSubmitting) return;

        setIsSubmitting(true);
        setError('');

        try {
            const urlMatch = code.match(/link=([A-Z0-9]+)/i);
            const finalCode = urlMatch ? urlMatch[1] : code;

            if (!finalCode) {
                throw new Error("Please enter a valid code or URL.");
            }

            const user = await piService.validateLinkCode(finalCode);

            const geo = await getGeoInfo();
            const region = geo ? geo.countryCode : 'UNK';
            const deviceType: DeviceType = isMobile() ? 'mobile' : 'computer';

            await submitScore(deviceType, { ...scoreData, name: user.username, region });
            
            setSubmitSuccess(true);
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to link account or submit score. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };


    const containerClasses = isRotated
        ? 'h-auto max-h-lg w-auto max-w-[90vw]'
        : 'w-full max-w-lg';

    if (intent === 'submit-score') {
        if (submitSuccess) {
            return (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4">
                    <div className={`bg-neutral-900/90 border border-green-400/50 rounded-2xl shadow-2xl p-6 text-center ${containerClasses}`}>
                        <img src="https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/trophy.png" alt="Success Trophy" className="w-16 h-16 mx-auto" />
                        <h2 className="text-xl font-bold mt-4 text-green-400">Success!</h2>
                        <p className="mt-2 text-neutral-300">Your score has been submitted!</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4">
                <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl p-6 text-center ${containerClasses}`}>
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                        <img src="https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Pi%20Network%20icon.png" alt="Pi Network" className="w-6 h-6 object-contain" />
                        Pi Account Required
                    </h2>
                    <p className="text-neutral-300 mb-6">
                        To submit your high score, link your Pi account. Click here to{' '}
                        <a href={piBrowserLink} className="text-cyan-400 hover:underline font-semibold">
                            Open the game in Pi Browser
                        </a>
                        , find 'Play on Another Device' in the menu to get your code.
                    </p>

                    <form onSubmit={handleLinkAndSubmit} className="space-y-4">
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Paste Code or URL here"
                            required
                            className="w-full px-4 py-3 bg-neutral-800 border-2 border-neutral-600 rounded-lg text-white text-center text-lg focus:outline-none focus:border-cyan-400 transition-colors"
                            aria-label="Enter link code"
                        />
                        <button type="submit" disabled={!code.trim() || isSubmitting} className="w-full flex items-center justify-center px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50">
                            {isSubmitting ? <SpinnerIcon className="w-6 h-6 animate-spin" /> : 'Link & Submit Score'}
                        </button>
                    </form>
                    
                    {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
                    
                    <a href={referralUrl} target="_blank" rel="noopener noreferrer" className="block w-full mt-4 px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white font-bold rounded-lg transition-colors">
                        Join Pi Network
                    </a>

                    <button onClick={onClose} className="mt-4 text-sm text-neutral-400 hover:text-white">
                        Cancel
                    </button>
                </div>
            </div>
        );
    }
    
    // --- Existing Modals for other intents ---
    let title: string;
    let description: React.ReactNode;
    let primaryButton: React.ReactNode;
    let secondaryAction: React.ReactNode | null = null;
    let showJoinButton = true;

    switch (intent) {
        case 'purchase-ad':
            title = 'Pi Browser Required';
            description = "To purchase advertisements, please open this app in the Pi Browser. This ensures a secure transaction.";
            primaryButton = <a href={piBrowserLink} className="block w-full text-center px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors text-lg">Open in Pi Browser</a>;
            secondaryAction = <button onClick={onClose} className="mt-2 text-sm text-neutral-400 hover:text-white">Cancel</button>;
            break;
        case 'link-device':
             title = 'Pi Browser Required';
             description = "To get a code to play on another device, you must open this app in the Pi Browser.";
             primaryButton = <a href={piBrowserLink} className="block w-full text-center px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors text-lg">Open in Pi Browser</a>;
             break;
        case 'donation':
             title = 'Pi Browser Required';
             description = "To support the developer by buying a coffee, please open this app in the Pi Browser. This ensures a secure transaction.";
             primaryButton = <a href={piBrowserLink} className="block w-full text-center px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors text-lg">Open in Pi Browser</a>;
             secondaryAction = <button onClick={onClose} className="mt-2 text-sm text-neutral-400 hover:text-white">Cancel</button>;
             break;
        default: // Fallback
            title = 'Pi Browser Recommended';
            description = "This feature works best inside the Pi Browser.";
            primaryButton = <button onClick={onClose} className="block w-full px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors text-lg">OK</button>;
            break;
    }

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4"
            role="dialog" aria-modal="true" aria-labelledby="non-pi-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl text-center p-6 ${containerClasses}`}>
                <img 
                    src="https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Pi%20Network%20icon.png" 
                    alt="Pi Network Logo" 
                    className="w-20 h-20 mx-auto rounded-full bg-black/20 mb-4 object-contain"
                />
                <h2 id="non-pi-title" className="text-xl font-bold text-white mb-2">{title}</h2>
                <p className="text-neutral-300 mb-6">{description}</p>
                
                <div className="space-y-4">
                    {primaryButton}
                    {showJoinButton && (
                        <a href={referralUrl} target="_blank" rel="noopener noreferrer" className="block w-full px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white font-bold rounded-lg transition-colors">
                            Join Pi Network
                        </a>
                    )}
                </div>
                {secondaryAction}
            </div>
        </div>
    );
};

export default NonPiBrowserModal;