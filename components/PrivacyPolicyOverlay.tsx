import React from 'react';
import { XIcon } from './icons';
import { piService } from '../utils/pi';

interface PrivacyPolicyOverlayProps {
    onClose: () => void;
    isRotated: boolean;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="space-y-2">
        <h3 className="text-lg font-bold text-cyan-300">{title}</h3>
        <div className="space-y-2 text-neutral-300 text-sm">{children}</div>
    </section>
);

const PrivacyPolicyOverlay: React.FC<PrivacyPolicyOverlayProps> = ({ onClose, isRotated }) => {
    const containerClasses = isRotated
        ? 'h-full max-h-2xl w-auto max-w-[90vh]'
        : 'w-full max-w-2xl max-h-[90dvh]';
        
    const handleLinkClick = (e: React.MouseEvent, url: string) => {
        e.preventDefault();
        piService.openUrl(url);
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[52] flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-policy-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
                    <h2 id="privacy-policy-title" className="text-xl font-bold text-white">Privacy Policy</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
                    <p className="text-neutral-400 text-sm">Last Updated: August 13, 2025</p>

                    <p>Welcome to 3D Snake: Neon Grid Runner! Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information when you play our game.</p>
                    
                    <Section title="1. Information We Collect">
                        <p>We collect a very limited amount of information to make the game work and to improve your experience:</p>
                        <ul className="list-disc list-inside pl-4 space-y-1">
                            <li><strong>Leaderboard Data:</strong> If you choose to submit your score to the leaderboard, we collect the name you provide, your score, level, top speed, and your general region (country code). This is voluntary. Your Pi username is used for authentication but is not displayed publicly unless you enter it as your display name.</li>
                            <li><strong>Gameplay Analytics:</strong> We use Firebase Analytics to collect anonymous data about gameplay, such as session duration, levels reached, and device type (mobile or computer). This helps us understand how the game is played and where we can make improvements. This data is aggregated and does not personally identify you.</li>
                            <li><strong>Advertising Data:</strong> If ads are enabled and you provide consent, our advertising partner (InMobi) may collect device identifiers and other data to show you personalized ads. Please refer to their privacy policy for more details.</li>
                        </ul>
                    </Section>

                    <Section title="2. How We Use Your Information">
                         <p>We use the information we collect to:</p>
                        <ul className="list-disc list-inside pl-4 space-y-1">
                            <li>Operate and maintain the game, including displaying leaderboards.</li>
                            <li>Improve and optimize the game for all players.</li>
                            <li>Display in-game advertisements from our sponsors.</li>
                            <li>Respond to your feedback and support requests.</li>
                        </ul>
                    </Section>

                     <Section title="3. Third-Party Services">
                        <p>We use the following third-party services:</p>
                        <ul className="list-disc list-inside pl-4 space-y-1">
                            <li><strong>Firebase (Google):</strong> For hosting, analytics, and game configuration. You can view Google's privacy policy <a href="https://policies.google.com/privacy" onClick={(e) => handleLinkClick(e, 'https://policies.google.com/privacy')} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">here</a>.</li>
                            <li><strong>InMobi:</strong> For serving in-game advertisements. When ads are shown, you will be presented with a consent dialog from InMobi's Consent Management Platform (CMP). This allows you to control your data preferences for advertising. You can review InMobi's privacy policy <a href="https://www.inmobi.com/privacy-policy" onClick={(e) => handleLinkClick(e, 'https://www.inmobi.com/privacy-policy')} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">here</a>.</li>
                            <li><strong>Pi Network SDK:</strong> For authenticating you with your Pi account. We only request access to your username for leaderboard submissions and payments. We do not access any other personal information from your Pi account.</li>
                        </ul>
                    </Section>

                    <Section title="4. Advertising">
                        <p>Our game is supported by in-game advertising. When you play, you may see advertisements on billboards, posters, and banners. Some of these are from community members who have purchased ad space using Pi.</p>
                        <p>We may also feature a post-game video ad provided by InMobi. You have control over the data used for personalized advertising through the consent management window that appears when you first play.</p>
                    </Section>

                    <Section title="5. Your Choices & Rights">
                        <ul className="list-disc list-inside pl-4 space-y-1">
                             <li><strong>Leaderboard:</strong> Submitting your score to the leaderboard is completely optional.</li>
                            <li><strong>Advertising Consent:</strong> You can manage your consent for personalized advertising through the InMobi CMP window.</li>
                            <li><strong>Data Access:</strong> Since most of the data we collect is anonymous, it is not possible to provide access to individual user data. For leaderboard removal requests, please contact us.</li>
                        </ul>
                    </Section>

                    <Section title="6. Children's Privacy">
                        <p>Our game is not directed at children under the age of 13. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child under 13, we will take steps to delete it.</p>
                    </Section>

                    <Section title="7. Changes to This Policy">
                        <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy in the game. You are advised to review this policy periodically for any changes.</p>
                    </Section>

                    <Section title="8. Contact Us">
                        <p>If you have any questions about this Privacy Policy, please use the "Feedback" option in the game menu.</p>
                    </Section>
                </div>

                 <footer className="p-4 border-t border-neutral-700 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="block w-full text-center px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors text-lg"
                    >
                        Close
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default PrivacyPolicyOverlay;