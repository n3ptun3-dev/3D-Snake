import React from 'react';
import { XIcon } from './icons';

interface TermsAndConditionsOverlayProps {
    onClose: () => void;
    isRotated: boolean;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="space-y-2">
        <h3 className="text-lg font-bold text-cyan-300">{title}</h3>
        <div className="space-y-2 text-neutral-300 text-sm">{children}</div>
    </section>
);

const TermsAndConditionsOverlay: React.FC<TermsAndConditionsOverlayProps> = ({ onClose, isRotated }) => {
    const containerClasses = isRotated
        ? 'h-full max-h-2xl w-auto max-w-[90vh]'
        : 'w-full max-w-2xl max-h-[90dvh]';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[52] flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
                    <h2 id="terms-title" className="text-xl font-bold text-white">Terms and Conditions for In-Game Advertising</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
                    <p className="text-neutral-400 text-sm">Last Updated: August 12, 2025</p>

                    <Section title="1. Acceptance of Terms">
                        <p>Welcome to 3D Snake! These Terms and Conditions ("Terms") govern your use of our in-game advertising feature ("Service"). By purchasing and submitting an advertisement ("Ad"), you agree to be bound by these Terms. If you do not agree to these Terms, do not use the Service.</p>
                    </Section>

                    <Section title="2. The Advertising Service">
                        <p>The Service allows you to pay for the display of an image and associated information (title, description, URL) within the 3D Snake game world on specific, pre-selected dates. This is a novelty feature intended for community engagement.</p>
                        <p>This Service does not include user accounts, performance analytics (e.g., clicks, views), or detailed reporting. The service is provided "as is".</p>
                    </Section>

                    <Section title="3. User Responsibilities & Content Guidelines">
                        <p>You are solely responsible for the content of your Ad. By submitting an Ad, you warrant that you have all necessary rights, licenses, and permissions to do so.</p>
                        <p>Your Ad content must not:</p>
                        <ul className="list-disc list-inside pl-4 space-y-1">
                            <li>Contain illegal, hateful, defamatory, obscene, or sexually explicit material.</li>
                            <li>Promote violence, discrimination, or illegal activities.</li>
                            <li>Infringe upon the intellectual property rights of any third party (e.g., copyright, trademark).</li>
                            <li>Contain malware, viruses, or any malicious code.</li>
                            <li>Be deceptive, misleading, or fraudulent (e.g., scams, phishing links).</li>
                        </ul>
                        <p>We reserve the absolute right to review, approve, or reject any submitted Ad for any reason, at our sole discretion, without providing a reason.</p>
                    </Section>

                    <Section title="4. Payment, Transactions, and Refunds">
                        <p>All payments for the Service must be made using the Pi cryptocurrency.</p>
                        <p>You are responsible for ensuring the payment transaction is sent to the correct wallet address and includes the exact, correct Payment ID (Memo). Failure to do so may result in your payment not being recognized and your Ad not being scheduled.</p>
                        <p><strong>All transactions are final and non-refundable.</strong> Due to the nature of cryptocurrency transactions and the automated system, we do not offer refunds for any reason, including but not limited to, rejected ads, ads that run on dates with low player traffic, or your dissatisfaction with the service.</p>
                    </Section>
                    
                    <Section title="5. Intellectual Property">
                        <p>You retain ownership of the intellectual property rights in the content you submit. However, by submitting an Ad, you grant us a non-exclusive, worldwide, royalty-free, sublicensable license to use, reproduce, display, and distribute your Ad content within the 3D Snake game and in promotional materials for the game.</p>
                    </Section>

                    <Section title="6. Limitation of Liability">
                        <p>To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from (a) your access to or use of or inability to access or use the Service; (b) any conduct or content of any third party on the Service; or (c) unauthorized access, use, or alteration of your transmissions or content.</p>
                        <p>We provide no guarantees regarding game uptime, player numbers, or the visibility your Ad will receive.</p>
                    </Section>

                    <Section title="7. Termination">
                        <p>We reserve the right to remove any active Ad at any time, without notice or refund, if we believe it violates these Terms or is otherwise detrimental to the game or its community.</p>
                    </Section>

                    <Section title="8. Changes to Terms">
                        <p>We may revise these Terms from time to time. The most current version will always be available within the game. By continuing to use the Service after those revisions become effective, you agree to be bound by the revised Terms.</p>
                    </Section>
                </div>

                <footer className="p-4 border-t border-neutral-700 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="block w-full text-center px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors text-lg"
                    >
                        I Understand and Agree
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default TermsAndConditionsOverlay;