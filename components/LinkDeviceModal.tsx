import React, { useState, useEffect } from 'react';
import { XIcon, SpinnerIcon, CopyIcon } from './icons';
import { piService } from '../utils/pi';

interface LinkDeviceModalProps {
    onClose: () => void;
    isRotated: boolean;
}

const LinkDeviceModal: React.FC<LinkDeviceModalProps> = ({ onClose, isRotated }) => {
    const [code, setCode] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState<'none' | 'code' | 'link'>('none');

    useEffect(() => {
        const generateCode = async () => {
            setLoading(true);
            setError('');
            try {
                const generatedCode = await piService.generateLinkCode();
                if (!generatedCode) throw new Error("Could not generate a link code.");
                const url = `https://d-snake-7a80a.web.app/?link=${generatedCode}`;
                setCode(generatedCode);
                setLinkUrl(url);
            } catch (err: any) {
                setError(err instanceof Error ? err.message : 'Failed to generate link. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        generateCode();
    }, []);

    const handleOpen = () => {
        if (linkUrl && window.Pi) {
            window.Pi.openUrlInSystemBrowser(linkUrl);
        }
    };

    const handleCopy = (type: 'code' | 'link') => {
        const textToCopy = type === 'code' ? code : linkUrl;
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy);
            setCopied(type);
            setTimeout(() => setCopied('none'), 2000);
        }
    };

    const containerClasses = isRotated ? 'w-auto max-w-[80vw]' : 'w-full max-w-md';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4">
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl p-6 text-center ${containerClasses}`}>
                <h2 className="text-xl font-bold text-white mb-2">Play on Another Device</h2>
                <p className="text-neutral-300 mb-6">Use the code or link below to link your Pi account to another browser session. This expires in 5 minutes.</p>

                {loading && <SpinnerIcon className="w-10 h-10 animate-spin text-cyan-400 mx-auto" />}
                {error && <p className="text-red-400">{error}</p>}

                {linkUrl && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                             <div className="p-4 bg-neutral-800 border border-neutral-600 rounded-lg text-cyan-300 text-2xl font-bold tracking-widest">
                                {code}
                            </div>
                             <button onClick={() => handleCopy('code')} className="w-full px-4 py-2 bg-neutral-600 hover:bg-neutral-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                                <CopyIcon className="w-5 h-5" />
                                {copied === 'code' ? 'Code Copied!' : 'Copy Code'}
                            </button>
                        </div>
                       
                        <div className="space-y-2">
                            <div className="p-3 bg-neutral-800 border border-neutral-600 rounded-lg break-words text-cyan-300 text-sm">
                                {linkUrl}
                            </div>
                            <button onClick={() => handleCopy('link')} className="w-full px-4 py-2 bg-neutral-600 hover:bg-neutral-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                                <CopyIcon className="w-5 h-5" />
                                {copied === 'link' ? 'Link Copied!' : 'Copy Link'}
                            </button>
                        </div>

                        <button onClick={handleOpen} className="w-full px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors">
                            Open in Browser
                        </button>
                    </div>
                )}
                 <button onClick={onClose} className="mt-6 text-sm text-neutral-400 hover:text-white">
                    Close
                </button>
            </div>
        </div>
    );
};

export default LinkDeviceModal;