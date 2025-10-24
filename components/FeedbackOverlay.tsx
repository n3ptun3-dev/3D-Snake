import React, { useState } from 'react';
import { XIcon, SpinnerIcon, StarIcon } from './icons';

interface FeedbackOverlayProps {
    onClose: () => void;
    isRotated: boolean;
}

const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScUF_Yrk2_-AKabYWS-qVqwFz81jMudTVvjE4gxgTR6l-aQHQ/formResponse';

const TenPointScale: React.FC<{
    label: string;
    value: number | null;
    onSelect: (value: number) => void;
}> = ({ label, value, onSelect }) => (
    <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">{label}</label>
        <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                <button
                    key={num}
                    type="button"
                    onClick={() => onSelect(num)}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-md text-sm font-bold transition-colors flex-shrink-0
                        ${value === num
                            ? 'bg-cyan-500 text-white'
                            : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                        }`}
                >
                    {num}
                </button>
            ))}
        </div>
    </div>
);

const StarRating: React.FC<{
    value: number | null;
    onSelect: (value: number) => void;
}> = ({ value, onSelect }) => (
    <div className="flex items-center justify-center gap-2">
        {Array.from({ length: 5 }, (_, i) => i + 1).map(star => (
            <button
                key={star}
                type="button"
                onClick={() => onSelect(star)}
                className="p-1"
                aria-label={`${star} star`}
            >
                <StarIcon className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors ${value && star <= value ? 'text-yellow-400' : 'text-neutral-600 hover:text-neutral-500'}`} />
            </button>
        ))}
    </div>
);


const FeedbackOverlay: React.FC<FeedbackOverlayProps> = ({ onClose, isRotated }) => {
    const [firstImpression, setFirstImpression] = useState<number | null>(null);
    const [gettingStarted, setGettingStarted] = useState<number | null>(null);
    const [howToPlay, setHowToPlay] = useState<number | null>(null);
    const [progression, setProgression] = useState<number | null>(null);
    const [rating, setRating] = useState<number | null>(null);
    const [feedback, setFeedback] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const isFormBlank =
            firstImpression === null &&
            gettingStarted === null &&
            howToPlay === null &&
            progression === null &&
            rating === null &&
            feedback.trim() === '';

        if (isFormBlank) {
            setError('Please provide some feedback before submitting.');
            return;
        }
        
        setStatus('submitting');
        setError('');

        const formData = new FormData();
        formData.append('entry.1470429092', firstImpression !== null ? String(firstImpression) : '');
        formData.append('entry.1240240622', gettingStarted !== null ? String(gettingStarted) : '');
        formData.append('entry.1780800046', howToPlay !== null ? String(howToPlay) : '');
        formData.append('entry.1297444167', progression !== null ? String(progression) : '');
        formData.append('entry.1893392591', rating !== null ? String(rating) : '');
        formData.append('entry.411898003', feedback);

        try {
            await fetch(FEEDBACK_FORM_URL, {
                method: 'POST',
                body: formData,
                mode: 'no-cors',
            });
            setStatus('submitted');
        } catch (err) {
            console.error(err);
            setError('Could not submit feedback. Please try again later.');
            setStatus('error');
        }
    };

    const containerClasses = isRotated
        ? 'h-auto max-h-[95%] w-auto max-w-[90vh]'
        : 'h-auto w-full max-w-lg max-h-[90%]';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
                    <h2 id="feedback-title" className="text-xl font-bold text-white">Share Your Feedback</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                {status === 'submitted' ? (
                    <div className="p-6 text-center flex flex-col items-center justify-center h-full">
                        <h3 className="text-2xl font-bold text-green-400 mb-2">Thank You!</h3>
                        <p className="text-neutral-300">We can't grow without your feedback.</p>
                        <p className="text-neutral-300 mt-2">Your thoughts have been received.</p>
                        <button onClick={onClose} className="mt-6 px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors">
                            Close
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
                        <p className="text-neutral-300 text-center">We value your input! Your feedback helps us improve the game for everyone.</p>
                        
                        <TenPointScale label="Overall First Impression (1=Poor, 10=Excellent)" value={firstImpression} onSelect={setFirstImpression} />
                        <TenPointScale label="Ease of Getting Started" value={gettingStarted} onSelect={setGettingStarted} />
                        <TenPointScale label="Clarity of 'How to Play' Instructions" value={howToPlay} onSelect={setHowToPlay} />
                        <TenPointScale label="Player Progression (Speed, challenge, etc.)" value={progression} onSelect={setProgression} />

                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-2 text-center">How would you rate the overall enjoyment?</label>
                            <StarRating value={rating} onSelect={setRating} />
                        </div>

                        <div>
                            <label htmlFor="feedback-text" className="block text-sm font-medium text-neutral-300 mb-2">Any additional feedback or suggestions?</label>
                            <textarea
                                id="feedback-text"
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400 transition-colors"
                                placeholder="Tell us what you think..."
                            />
                        </div>

                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        
                        <div className="flex justify-end pt-2">
                             <button
                                type="submit"
                                disabled={status === 'submitting'}
                                className="px-8 py-3 bg-green-700 hover:bg-green-800 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:bg-green-700/50 flex items-center justify-center min-w-[120px]"
                            >
                                {status === 'submitting' ? <SpinnerIcon className="w-6 h-6 animate-spin" /> : 'Submit'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default FeedbackOverlay;
