import React from 'react';
import { SpinnerIcon } from './icons';

interface RedirectingModalProps {
    isRotated: boolean;
}

const RedirectingModal: React.FC<RedirectingModalProps> = ({ isRotated }) => {
    const containerClasses = isRotated ? 'w-auto max-w-[80vw]' : 'w-full max-w-sm';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[51] flex items-center justify-center font-sans p-4">
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl p-6 text-center ${containerClasses}`}>
                <h2 className="text-xl font-bold text-white mb-2">Redirecting...</h2>
                <p className="text-neutral-300 mb-6">Please open the Pi Browser to complete your payment securely.</p>
                <SpinnerIcon className="w-10 h-10 animate-spin text-cyan-400 mx-auto" />
            </div>
        </div>
    );
};

export default RedirectingModal;
