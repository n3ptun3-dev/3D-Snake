import React from 'react';
import { XIcon, BusStopIcon } from './icons';
import { UserDTO } from '../types';

interface BusStopOverlayProps {
    onClose: () => void;
    isRotated: boolean;
    piUser: UserDTO | null;
    isPiBrowser: boolean;
    onContinue: () => void;
    onOpenLinkAccount: () => void;
    onOpenJoinPi: () => void;
    onOpenTerms: () => void;
    onOpenPrivacyPolicy: () => void;
    onOpenCommunityGuidelines: () => void;
}

const BusStopOverlay: React.FC<BusStopOverlayProps> = ({ 
    onClose, isRotated, piUser, isPiBrowser, 
    onContinue, onOpenLinkAccount, onOpenJoinPi, onOpenTerms, onOpenPrivacyPolicy,
    onOpenCommunityGuidelines
}) => {
    const containerClasses = isRotated
        ? 'h-[95%] w-[90%] max-w-[750px]'
        : 'w-full max-w-lg h-auto max-h-[90%]';

    const piBrowserLink = 'pi://d-snake-7a80a.web.app/bus-stop';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center font-sans p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bus-stop-title"
        >
            <div 
                className={`bg-[#0a0a0a] border-2 border-[#ff33cc] rounded-2xl shadow-[0_0_15px_rgba(255,51,204,0.7)] flex flex-col overflow-hidden ${containerClasses}`}
                onClick={e => e.stopPropagation()}
            >
                <header className="relative flex items-center justify-start px-4 border-b-2 border-[#00ffff]">
                    <img 
                        src="https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Bus%20Stop%20Logo.png" 
                        alt="The Bus Stop Logo"
                        className="h-24 sm:h-24 max-h-[15vh] w-auto object-contain"
                    />
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 p-2 rounded-full text-[#ff33cc] hover:bg-[#ff33cc]/20 transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto px-6 pt-8 pb-6 text-center text-neutral-300 flex flex-col items-center">
                    <div className="mb-4 text-center">
                        <p className="text-l text-neutral-300 tracking-wider">Welcome to</p>
                        <h2 id="bus-stop-title" className="text-5xl font-extrabold text-white leading-tight" style={{ textShadow: '0 0 8px #00ffff, 0 0 15px #00ffff' }}>
                            The Bus Stop
                        </h2>
                    </div>
                    <p className="text-lg font-medium text-[#00ffff] mb-6" style={{ textShadow: '0 0 5px #00ffff' }}>
                        A Neon Chatroom for 3D Grid Runners
                    </p>
                    
                    <p className="mb-6 text-base leading-relaxed text-[#e0e0e0] max-w-md">
                        In the neon-drenched city, The Bus Stop is where every grid runner's path eventually crosses. You never know who you might meet.
                    </p>

                    <p className="mb-6 text-base leading-relaxed text-[#e0e0e0] max-w-md">
                        Pause, recharge, and share your tales from the digital frontier. This is the spot to connect, discuss strategies, or just watch the world go by. Pull up a seat.
                    </p>

                    <div className="w-24 h-1 my-4 bg-gradient-to-r from-[#00ffff] to-[#ff33cc] rounded-full"></div>

                    {piUser ? (
                        <>
                            <p className="mb-6 text-sm text-neutral-400">
                                Remember to be respectful and follow the <button onClick={onOpenCommunityGuidelines} className="underline text-cyan-400 hover:text-cyan-300">community guidelines</button>. Let's keep the conversation positive and constructive.
                            </p>
                            <button
                                onClick={onContinue}
                                className="w-full max-w-sm px-6 py-3 bg-[#00ffff] hover:bg-white text-black font-bold rounded-lg text-lg transition-all transform hover:scale-105 shadow-[0_0_10px_rgba(0,255,255,0.7)]"
                            >
                                Continue
                            </button>
                        </>
                    ) : isPiBrowser ? (
                        <>
                             <p className="mb-6 text-yellow-300 font-semibold">
                                Authentication is required to enter the chat. Please authenticate with your Pi account to continue.
                            </p>
                            <button
                                onClick={onContinue}
                                className="w-full max-w-sm px-6 py-3 bg-[#00ffff] hover:bg-white text-black font-bold rounded-lg text-lg transition-colors"
                            >
                                Authenticate with Pi
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="mb-6 text-yellow-300 font-semibold">
                                Authentication is required to enter the chat. Please link your Pi account or open this app in the Pi Browser.
                            </p>
                            <div className="w-full max-w-sm space-y-3">
                                <button
                                    onClick={() => { onClose(); onOpenLinkAccount(); }}
                                    className="w-full px-6 py-3 bg-[#00ffff] hover:bg-white text-black font-bold rounded-lg text-lg transition-colors"
                                >
                                    Link Account
                                </button>
                                <a
                                    href={piBrowserLink}
                                    className="block w-full px-6 py-3 bg-transparent border-2 border-[#ff33cc] hover:bg-[#ff33cc]/20 text-white font-bold rounded-lg text-lg transition-colors"
                                >
                                    Open in Pi Browser
                                </a>
                                {!isPiBrowser && (
                                    <button
                                        onClick={() => { onClose(); onOpenJoinPi(); }}
                                        className="w-full px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white font-bold rounded-lg text-lg transition-colors"
                                    >
                                        Join Pi Network
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                     <div className="mt-8 text-xs text-neutral-500">
                        By continuing, you agree to the{' '}
                        <button onClick={() => { onClose(); onOpenCommunityGuidelines(); }} className="underline hover:text-cyan-400">Community Guidelines</button>, the{' '}
                        <button onClick={() => { onClose(); onOpenTerms(); }} className="underline hover:text-cyan-400">Terms</button>, &amp;{' '}
                        <button onClick={() => { onClose(); onOpenPrivacyPolicy(); }} className="underline hover:text-cyan-400">Privacy Policy</button>.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BusStopOverlay;
