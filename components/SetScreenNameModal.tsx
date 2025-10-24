import React, { useState } from 'react';
import { SpinnerIcon } from './icons';

interface SetScreenNameModalProps {
    onClose: () => void;
    onConfirm: (name: string) => void;
    isRotated: boolean;
    piUsername: string;
}

const SetScreenNameModal: React.FC<SetScreenNameModalProps> = ({ onClose, onConfirm, isRotated, piUsername }) => {
    const [name, setName] = useState(piUsername || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (trimmedName.length < 3) {
            setError('Chatter name must be at least 3 characters long.');
            return;
        }
        if (trimmedName.length > 15) {
            setError('Chatter name cannot exceed 15 characters.');
            return;
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedName)) {
            setError('Chatter name can only contain letters, numbers, underscores, dots, and hyphens.');
            return;
        }

        setLoading(true);
        setError('');
        // Simulate a small delay for better UX
        setTimeout(() => {
            onConfirm(trimmedName);
            setLoading(false);
        }, 300);
    };

    const containerClasses = isRotated ? 'w-auto max-w-[80vw]' : 'w-full max-w-sm';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center font-sans p-4">
            <div className={`bg-[#0a0a0a] border-2 border-[#00ffff] rounded-2xl shadow-[0_0_15px_rgba(0,255,255,0.7)] p-6 text-center ${containerClasses}`}>
                <h2 className="text-xl font-bold text-white mb-2" style={{ textShadow: '0 0 5px #ff33cc' }}>Choose Your Chatter Name</h2>
                <p className="text-neutral-300 mb-6">This name will be displayed in the chat. You can change it later in the chat settings.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your chatter name"
                        maxLength={15}
                        required
                        className="w-full px-4 py-3 bg-[#1a1a1a] border-2 border-[#ff33cc] rounded-lg text-white text-center text-lg focus:outline-none focus:border-[#00ffff] transition-colors"
                        aria-label="Enter your chatter name"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center px-6 py-3 bg-[#00ffff] hover:bg-white text-black font-bold rounded-lg text-lg transition-colors disabled:opacity-50"
                    >
                        {loading ? <SpinnerIcon className="w-6 h-6 animate-spin" /> : 'Confirm'}
                    </button>
                </form>
                {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
                <button onClick={onClose} className="mt-4 text-sm text-neutral-400 hover:text-white">
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default SetScreenNameModal;