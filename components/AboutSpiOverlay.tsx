import React from 'react';
import { XIcon } from './icons';

interface AboutSpiOverlayProps {
    onClose: () => void;
    isRotated: boolean;
}

const AboutSpiOverlay: React.FC<AboutSpiOverlayProps> = ({ onClose, isRotated }) => {
    const iconUrl = "https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Spi%20vs%20Spi%20icon%20sm.png";
    
    const containerClasses = isRotated
        ? 'h-full max-h-lg w-auto max-w-[90dvw]'
        : 'w-full max-w-lg max-h-[90dvh]';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-spi-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col text-center ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
                    <h2 id="about-spi-title" className="text-xl font-bold text-white">About Spi vs Spi</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto p-4 sm:p-6">
                    <img 
                        src={iconUrl}
                        alt="Spi vs Spi Logo" 
                        className="w-24 h-24 mx-auto rounded-full bg-black/20 mb-4 object-cover"
                    />
                     <h3 className="text-3xl font-bold text-cyan-300 mb-4">Coming Soon...</h3>
                    <p className="text-neutral-300 max-w-md mx-auto">
                        Spi vs Spi is a massively multiplayer online game where strategy, espionage, and mini-games collide on the Pi Network. Steal intelligence (ELINT), defend your network, and rise through the ranks in a persistent digital world.
                    </p>
                </div>

                <footer className="p-4 border-t border-neutral-700 flex-shrink-0">
                    <a
                        href="https://n3ptun3-dev.github.io/Spi-vs-Spi/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors text-lg"
                    >
                        Learn More
                    </a>
                </footer>
            </div>
        </div>
    );
};

export default AboutSpiOverlay;