import React from 'react';
import { XIcon } from './icons';

interface HowItWorksOverlayProps {
    onClose: () => void;
    isRotated: boolean;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section>
        <h3 className="text-lg font-bold text-cyan-300 mb-3">{title}</h3>
        <div className="space-y-3 text-neutral-300">{children}</div>
    </section>
);

const HowItWorksOverlay: React.FC<HowItWorksOverlayProps> = ({ onClose, isRotated }) => {
    const containerClasses = isRotated
        ? 'h-full max-h-lg w-auto max-w-[90dvw]'
        : 'w-full max-w-lg max-h-[90dvh]';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[51] flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-it-works-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
                    <h2 id="how-it-works-title" className="text-xl font-bold text-white">How It Works: Fun, Simple Advertising</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
                    <p>Welcome to in-game advertising in 3D Snake! This is a fun, novelty feature designed for community engagement. Here’s everything you need to know.</p>

                    <Section title="The 3-Step Process">
                        <ol className="list-decimal list-inside space-y-2">
                            <li><strong>Choose Your Ad & Dates:</strong> Select an ad type (Billboard, Poster, etc.) and pick the available days you'd like your ad to run on the calendar.</li>
                            <li><strong>Provide Your Details:</strong> Fill out the simple form with your ad's title, a link to your image, and an optional website URL.</li>
                            <li><strong>Make the Payment:</strong> Complete the transaction using Pi. Your ad is now booked and will be reviewed before it goes live!</li>
                        </ol>
                    </Section>
                    
                    <Section title="A Note on Images (Important!)">
                        <p>You need a direct link to your image (e.g., one ending in <code className="bg-black/50 px-1 rounded">.png</code>, <code className="bg-black/50 px-1 rounded">.jpg</code>, <code className="bg-black/50 px-1 rounded">.gif</code>).</p>
                        <p><strong>Don't have an image link? No problem!</strong> We recommend using a free and easy tool to host your image.</p>
                        <ol className="list-decimal list-inside space-y-2 pl-2">
                            <li>Go to <a href="https://imgbb.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-semibold">imgbb.com</a> and upload your image.</li>
                            <li>After uploading, find the "Embed codes" dropdown and select <strong>"HTML full linked"</strong>.</li>
                            <li>Copy the entire code snippet provided.</li>
                            <li><strong>Our form is smart!</strong> Just paste the full code you copied into our "Image URL" field, and we'll automatically extract the correct image link for you.</li>
                        </ol>
                    </Section>

                    <Section title="Please Read The Fine Print">
                         <ul className="list-disc list-inside space-y-2">
                            <li><strong>Simplicity is Key:</strong> This is a simple, "fire-and-forget" system. There is no account to create, no performance dashboard, and no analytics (like clicks or views).</li>
                            <li><strong>What You Get:</strong> You are paying for your image to be displayed within the 3D Snake game world on your selected dates. That's it! It's a fun way to share something with the community.</li>
                            <li><strong>No Refunds:</strong> Due to the automated and simple nature of this system, all transactions are final and non-refundable. Please double-check your ad details and dates before confirming your payment.</li>
                            <li><strong>Content Policy:</strong> All submitted ads are subject to a brief review. We reserve the right to decline any ad for any reason (e.g., inappropriate content) before it goes live. In such rare cases, we will attempt to contact you via your provided Pi username if possible.</li>
                        </ul>
                    </Section>

                    <p className="text-center pt-2">Thank you for participating and making the game world more vibrant!</p>
                </div>
            </div>
        </div>
    );
};

export default HowItWorksOverlay;