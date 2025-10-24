import React from 'react';
import { XIcon, WarningIcon } from './icons';
import { piService } from '../utils/pi';

interface ExternalLinkWarningModalProps {
    url: string;
    onClose: () => void;
    onConfirm: () => void;
    isRotated: boolean;
}

const ExternalLinkWarningModal: React.FC<ExternalLinkWarningModalProps> = ({ url, onClose, onConfirm, isRotated }) => {
    const containerClasses = isRotated
        ? 'h-auto max-h-lg w-auto max-w-[90vw]'
        : 'w-full max-w-lg';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center font-sans p-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="warning-title"
            aria-describedby="warning-description"
        >
            <div className={`bg-neutral-900/90 border border-yellow-500/50 rounded-2xl shadow-2xl text-center p-6 ${containerClasses}`}>
                <WarningIcon className="w-16 h-16 mx-auto text-yellow-400" />
                <h2 id="warning-title" className="text-xl font-bold text-white mt-4 mb-2">External Link Warning</h2>
                <p id="warning-description" className="text-neutral-300 mb-4">
                    You are about to navigate to an external website. The content of this site is not affiliated with or endorsed by 3D Snake: Neon Grid Runner. Proceed with caution.
                </p>
                <div className="p-3 bg-neutral-800 border border-neutral-600 rounded-lg break-words text-cyan-300 text-sm mb-6">
                    {url}
                </div>
                <div className="flex gap-4">
                    <button onClick={onClose} className="flex-1 px-6 py-3 bg-neutral-600 hover:bg-neutral-500 text-white font-bold rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="flex-1 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-black font-bold rounded-lg transition-colors">
                        Continue to Site
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExternalLinkWarningModal;
