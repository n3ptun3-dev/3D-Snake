
import React, { useEffect, useRef } from 'react';
import { XIcon } from './icons';

interface DebugOverlayProps {
  logs: string[];
  dummyMode: boolean;
  onClose: () => void;
  isRotated: boolean;
}

const DebugOverlay: React.FC<DebugOverlayProps> = ({ logs, dummyMode, onClose, isRotated }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to the bottom when new logs are added
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const containerPosition = isRotated
    ? 'top-1/2 left-4 -translate-y-1/2'
    : 'top-1/2 left-4 -translate-y-1/2';

  return (
    <div
      className={`fixed ${containerPosition} bg-black/80 backdrop-blur-md z-[100] flex flex-col font-mono text-xs text-white rounded-lg shadow-2xl border border-neutral-600 w-80 h-96`}
      role="log"
      aria-live="polite"
    >
      <header className="flex items-center justify-between p-2 border-b border-neutral-600 flex-shrink-0">
        <h2 id="debug-log-title" className="font-bold text-sm">
          Auth Debug Log
        </h2>
        <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${dummyMode ? 'bg-yellow-500 text-black' : 'bg-green-500 text-black'}`}>
                DUMMY_MODE: {String(dummyMode)}
            </span>
            <button
                onClick={onClose}
                className="p-1 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close debug log"
            >
                <XIcon className="w-4 h-4" />
            </button>
        </div>
      </header>
      <div ref={logContainerRef} className="flex-grow overflow-y-auto p-2 space-y-1">
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <p key={index} className="break-words leading-relaxed">
              {log}
            </p>
          ))
        ) : (
          <p className="text-neutral-500">Waiting for logs...</p>
        )}
      </div>
    </div>
  );
};

export default DebugOverlay;
