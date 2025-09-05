import React, { useState } from 'react';
import { piService } from '../utils/pi';
import { XIcon, SpinnerIcon } from './icons';

interface PiAuthModalProps {
    onClose: () => void;
    onSuccess: () => void;
    isRotated: boolean;
}

const PiAuthModal: React.FC<PiAuthModalProps> = ({ onClose, onSuccess, isRotated }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async () => {
        setLoading(true);
        setError('');
        try {
            await piService.authenticate();
            onSuccess();
        } catch (err: any) {
            if (err && err.code === 'USER_CANCELLED') {
                 setError('Authentication cancelled. Please authenticate to proceed.');
            } else {
                 setError('Authentication failed. Please try again.');
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const containerClasses = isRotated
        ? 'h-auto max-h-sm w-auto max-w-[80vw]'
        : 'w-full max-w-sm';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pi-auth-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl text-center p-6 ${containerClasses}`}>
                 <img 
                    src="https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Pi%20Network%20icon.png" 
                    alt="Pi Network Logo" 
                    className="w-20 h-20 mx-auto rounded-full bg-black/20 mb-4 object-cover"
                />
                <h2 id="pi-auth-title" className="text-xl font-bold text-white mb-2">Authentication Required</h2>
                <p className="text-neutral-300 mb-6">Please authenticate with your Pi account to use this feature.</p>
                
                <div className="my-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-300 text-sm">
                    <strong>Developer Notice:</strong> This feature is in sandbox mode for testing. Please press "Authenticate with Pi" to continue with a test user—no real Pi will be used.
                </div>

                <button 
                    onClick={handleAuth} 
                    disabled={loading}
                    className="w-full flex items-center justify-center px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg transition-colors text-lg disabled:opacity-70"
                >
                    {loading ? <SpinnerIcon className="w-6 h-6 animate-spin" /> : 'Authenticate with Pi'}
                </button>

                {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
                
                <button onClick={onClose} className="mt-4 text-sm text-neutral-400 hover:text-white">
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default PiAuthModal;