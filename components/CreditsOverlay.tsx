import React from 'react';
import { XIcon } from './icons';

interface CreditsOverlayProps {
    onClose: () => void;
    isRotated: boolean;
}

const CreditSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section>
        <h3 className="text-lg font-bold text-cyan-300 mb-3">{title}</h3>
        <div className="space-y-2 text-neutral-300">{children}</div>
    </section>
);

const CreditsOverlay: React.FC<CreditsOverlayProps> = ({ onClose, isRotated }) => {
    const containerClasses = isRotated
        ? 'h-full max-h-lg w-auto max-w-[90dvw]'
        : 'w-full max-w-lg max-h-[90dvh]';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="credits-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
                    <h2 id="credits-title" className="text-xl font-bold text-white">Credits</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
                    <CreditSection title="Development">
                        <p>
                            <strong>Lead Developer & Visionary:</strong>{' '}
                            <a 
                                href="https://profiles.pinet.com/profiles/n3ptun3" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-yellow-400 hover:underline"
                            >
                                n3ptun3
                            </a>
                        </p>
                        <p>
                            <strong>AI Engineering & UI/UX:</strong> Gemini (from Google)
                        </p>
                    </CreditSection>
                    
                    <CreditSection title="Core Technologies">
                        <ul className="list-disc list-inside space-y-1">
                            <li>React</li>
                            <li>Three.js</li>
                            <li>TypeScript</li>
                            <li>Tailwind CSS</li>
                            <li>Firebase</li>
                        </ul>
                    </CreditSection>

                     <CreditSection title="Audio">
                        <p>Background music and sound effects are sourced from various royalty-free and open-source libraries.</p>
                    </CreditSection>

                    <CreditSection title="Special Thanks">
                        <p>A huge thank you to the Pi Network community and all the Pioneers for their inspiration and support. This game is built for you.</p>
                    </CreditSection>
                </div>
            </div>
        </div>
    );
};

export default CreditsOverlay;