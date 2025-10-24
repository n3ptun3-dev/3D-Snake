import React from 'react';
import { XIcon } from './icons';

interface CommunityGuidelinesOverlayProps {
    onClose: () => void;
    isRotated: boolean;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="space-y-2">
        <h3 className="text-lg font-bold text-[#00ffff]">{title}</h3>
        <div className="space-y-2 text-neutral-300 text-sm">{children}</div>
    </section>
);

const CommunityGuidelinesOverlay: React.FC<CommunityGuidelinesOverlayProps> = ({ onClose, isRotated }) => {
    const containerClasses = isRotated
        ? 'h-[95%] w-[90%] max-w-2xl'
        : 'h-[90%] w-[95%] max-w-lg';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[52] flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guidelines-title"
        >
            <div className={`bg-[#0a0a0a] border-2 border-[#ff33cc] rounded-2xl shadow-[0_0_15px_rgba(255,51,204,0.7)] flex flex-col ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b-2 border-[#00ffff] flex-shrink-0">
                    <h2 id="guidelines-title" className="text-xl font-bold text-white">The Bus Stop: Community Guidelines</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-[#ff33cc] hover:bg-[#ff33cc]/20 transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
                    <p className="text-neutral-300">Welcome to The Bus Stop! To ensure this is a safe and enjoyable space for everyone, please follow these guidelines.</p>

                    <Section title="1. Be Respectful & Kind">
                        <p>Treat everyone with respect. Healthy debates are natural, but kindness is required. No personal attacks, harassment, bullying, or hate speech will be tolerated.</p>
                    </Section>

                    <Section title="2. No Spam or Excessive Self-Promotion">
                        <p>This is a place for conversation. While you can share what you're working on, please avoid spamming, excessive advertising, or posting repetitive messages. Keep promotional content relevant and minimal.</p>
                    </Section>

                    <Section title="3. Keep it Safe and Legal">
                        <p>Do not share illegal content, promote illegal activities, or post anything that is sexually explicit, graphically violent, or otherwise inappropriate for a general audience. This includes links to external sites.</p>
                    </Section>

                    <Section title="4. Protect Your Privacy">
                        <p>Do not share sensitive personal information about yourself or others, such as full names, addresses, phone numbers, or private keys. Be cautious about what you share online.</p>
                    </Section>

                    <Section title="5. Use the Report Function">
                        <p>If you see a message that violates these guidelines, please use the "Report" function. This helps us maintain a positive environment for everyone. Do not engage in arguments with users who are breaking the rules.</p>
                    </Section>

                    <p className="text-center pt-4 text-neutral-400">
                        Failure to follow these guidelines may result in message deletion or other moderation actions. Let's build a great community together!
                    </p>
                </div>

                 <footer className="p-4 border-t-2 border-[#00ffff]/50 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="block w-full text-center px-6 py-3 bg-[#00ffff] hover:bg-white text-black font-bold rounded-lg transition-colors text-lg"
                    >
                        I Understand
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CommunityGuidelinesOverlay;
