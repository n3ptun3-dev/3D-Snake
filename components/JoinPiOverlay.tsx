import React from 'react';
import { XIcon } from './icons';
import { piService } from '../utils/pi';

interface JoinPiOverlayProps {
    onClose: () => void;
    isRotated: boolean;
}

const JoinPiOverlay: React.FC<JoinPiOverlayProps> = ({ onClose, isRotated }) => {
    const containerClasses = isRotated
        ? 'h-full max-h-lg w-auto max-w-[90dvw]'
        : 'w-full max-w-lg max-h-[90dvh]';

    const handleJoinClick = (e: React.MouseEvent) => {
        e.preventDefault();
        piService.openUrl('https://minepi.com/n3ptun3');
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-pi-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
                    <h2 id="join-pi-title" className="text-xl font-bold text-white">Join the Pi Network</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-4 text-neutral-300">
                    <img 
                        src="https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Pi%20Network%20icon.png" 
                        alt="Pi Network Logo" 
                        className="w-24 h-24 mx-auto rounded-full bg-black/20 mb-4 object-cover"
                    />
                    <p>This isn't about getting rich overnight. This is about building something real, together.</p>
                    <p><strong>The Pi Network is a social crypto project, a unified effort to create a digital currency that's accessible to everyone, everywhere.</strong></p>
                    <p>We're not just mining coins on our phones; we're joining a global community of people who believe in a future where we have a say in our own financial destiny.</p>
                    <p>By joining with my link, you're not just getting a bonus Pi coin, you're becoming a founding member of a new digital economy.</p>
                    <p>You're part of the team, a team that's pioneering the next step in the future of finance. <br/><br/>This is for all of us, by all of us.</p>
                </div>

                <footer className="p-4 border-t border-neutral-700 flex-shrink-0">
                    <a
                        href="https://minepi.com/n3ptun3"
                        onClick={handleJoinClick}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg transition-colors text-lg"
                    >
                        Join Now
                    </a>
                </footer>
            </div>
        </div>
    );
};

export default JoinPiOverlay;