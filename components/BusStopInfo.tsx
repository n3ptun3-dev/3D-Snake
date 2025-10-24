import React from 'react';
import { XIcon } from './icons';

interface BusStopInfoProps {
    onClose: () => void;
    onOpenCommunityGuidelines: () => void;
}

const BusStopInfo: React.FC<BusStopInfoProps> = ({ onClose, onOpenCommunityGuidelines }) => {
    return (
        <div
            className="absolute inset-0 bg-[#0a0a0a] z-30 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bus-stop-info-title"
        >
            <header className="relative w-full flex-shrink-0">
                <img 
                    src="https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Bus%20Stop%20Logo.png" 
                    alt="The Bus Stop Logo"
                    className="w-full h-auto object-contain"
                />
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-2 rounded-full text-[#ff33cc] bg-black/30 hover:bg-[#ff33cc]/20 transition-colors"
                    aria-label="Close Info"
                >
                    <XIcon className="w-6 h-6" />
                </button>
            </header>

            <div className="flex-grow overflow-y-auto px-6 pt-6 pb-8 text-center text-neutral-300 flex flex-col items-center">
                <div className="mb-6 text-center">
                    <p className="text-lg text-neutral-300 tracking-wider">Welcome to</p>
                    <h2 id="bus-stop-info-title" className="text-5xl font-extrabold text-white leading-tight" style={{ textShadow: '0 0 8px #00ffff, 0 0 15px #00ffff' }}>
                        The Bus Stop
                    </h2>
                    <p className="text-lg font-medium text-[#00ffff] mt-2" style={{ textShadow: '0 0 5px #00ffff' }}>
                        A Neon Chatroom for 3D Grid Runners
                    </p>
                </div>

                <div className="max-w-md space-y-4 text-base leading-relaxed text-[#e0e0e0]">
                    <p>
                        The 'buses' here aren't physical; they're high-speed packets of pure data - <strong className="font-bold text-yellow-300">data-buses</strong> - traversing the city's digital arteries. The Bus Stop is a public terminal, a local data-hub where runners jack in to rest, socialize, and wait for their next connection.
                    </p>
                    <p>
                        You never know who you might meet. Legends are born on The Grid, and some say they never truly leave. Pause, recharge, and share your tales from the digital frontier. This is the spot to connect, discuss strategies, or just watch the data-streams go by. Pull up a seat.
                    </p>
                </div>

                <div className="w-24 h-1 my-8 bg-gradient-to-r from-[#00ffff] to-[#ff33cc] rounded-full"></div>

                <button
                    onClick={() => {
                        onOpenCommunityGuidelines();
                        onClose(); // Close this modal when opening the other
                    }}
                    className="w-full max-w-sm px-6 py-3 bg-transparent border-2 border-[#ff33cc] hover:bg-[#ff33cc]/20 text-white font-bold rounded-lg text-lg transition-colors"
                >
                    View Community Guidelines
                </button>
            </div>
        </div>
    );
};

export default BusStopInfo;
