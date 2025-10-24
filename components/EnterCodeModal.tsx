import React, { useState } from 'react';
import { XIcon, SpinnerIcon } from './icons';
import { piService } from '../utils/pi';

interface EnterCodeModalProps {
    onClose: () => void;
    onSuccess: () => void;
    isRotated: boolean;
}

const EnterCodeModal: React.FC<EnterCodeModalProps> = ({ onClose, onSuccess, isRotated }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            // Extract code from URL if pasted
            const urlMatch = code.match(/link=([A-Z0-9]+)/i);
            const finalCode = urlMatch ? urlMatch[1] : code;

            if (!finalCode) {
                throw new Error("Please enter a valid code or URL.");
            }

            await piService.validateLinkCode(finalCode);
            onSuccess();
        } catch (err: any) {
            setError(err instanceof Error ? err.message : 'Linking failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const containerClasses = isRotated ? 'w-auto max-w-[80vw]' : 'w-full max-w-sm';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4">
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl p-6 text-center ${containerClasses}`}>
                <h2 className="text-xl font-bold text-white mb-2">Link Your Pi Account</h2>
                <p className="text-neutral-300 mb-6">
                    <a href="pi://d-snake-7a80a.web.app" className="text-cyan-400 hover:underline font-semibold">
                        Open the game in the Pi Browser
                    </a>
                    , go to the menu, and select "Play on Another Device" to get your code.
                </p>
                <form onSubmit={handleLink} className="space-y-4">
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="Paste Code or URL here"
                        required
                        className="w-full px-4 py-3 bg-neutral-800 border-2 border-neutral-600 rounded-lg text-white text-center text-lg focus:outline-none focus:border-cyan-400 transition-colors"
                        aria-label="Enter link code"
                    />
                    <button
                        type="submit"
                        disabled={!code.trim() || loading}
                        className="w-full flex items-center justify-center px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                        {loading ? <SpinnerIcon className="w-6 h-6 animate-spin" /> : 'Link Account'}
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

export default EnterCodeModal;