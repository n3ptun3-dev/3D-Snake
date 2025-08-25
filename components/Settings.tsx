import React, { useState, useEffect, useMemo } from 'react';
import { RadioStation, RadioBrowserStation } from '../types';
import { XIcon, MusicOnIcon, MusicOffIcon, StarIcon, StarOutlineIcon } from './icons';
import { isMobile } from '../utils/device';
import RadioPlayer from './RadioPlayer';
import audioManager from '../sounds';

interface SettingsProps {
    onClose: () => void;
    musicSource: 'default' | 'radio' | 'saved';
    onMusicSourceChange: (source: 'default' | 'radio' | 'saved') => void;
    currentStation: RadioStation | null;
    onStationSelect: (station: RadioStation) => void;
    radioSearchTerm: string;
    onRadioSearchTermChange: (term: string) => void;
    radioStations: RadioBrowserStation[];
    isRadioLoading: boolean;
    radioError: string | null;
    searchRadioStations: (term: string) => void;
    isRotated: boolean;
    isBackgroundPlayEnabled: boolean;
    onIsBackgroundPlayEnabledChange: (enabled: boolean) => void;
    savedStations: RadioStation[];
    onToggleSaveStation: (station: RadioStation | null) => void;
}

const Settings: React.FC<SettingsProps> = ({ 
    onClose, musicSource, onMusicSourceChange, currentStation, onStationSelect,
    radioSearchTerm, onRadioSearchTermChange, radioStations, isRadioLoading, radioError, searchRadioStations,
    isRotated, isBackgroundPlayEnabled, onIsBackgroundPlayEnabledChange, savedStations, onToggleSaveStation
}) => {
    
    const [muteState, setMuteState] = useState(audioManager.getMuteState());

    useEffect(() => {
        const unsubscribe = audioManager.subscribe(() => setMuteState(audioManager.getMuteState()));
        return () => unsubscribe();
    }, []);
    
    const isCurrentStationSaved = useMemo(() => {
        if (!currentStation) return false;
        return savedStations.some(s => s.url === currentStation.url);
    }, [currentStation, savedStations]);

    const RadioButton = ({ value, label }: { value: 'default' | 'radio' | 'saved', label: string }) => (
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="radio"
                name="musicSource"
                value={value}
                checked={musicSource === value}
                onChange={() => onMusicSourceChange(value)}
                className="w-4 h-4 text-cyan-500 bg-neutral-700 border-neutral-500 focus:ring-cyan-500"
            />
            <span className="text-white">{label}</span>
        </label>
    );

    const containerClasses = isRotated
        ? 'h-full max-h-md w-auto max-w-[90dvw]'
        : 'w-full max-w-md max-h-[90dvh]';

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col ${containerClasses}`}>
                <header className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
                    <h2 id="settings-title" className="text-xl font-bold text-white">Music Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close settings"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto px-6 pb-6 pt-2">
                    <div className="space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/5 -mx-2">
                            <input
                                type="checkbox"
                                checked={isBackgroundPlayEnabled}
                                onChange={(e) => onIsBackgroundPlayEnabledChange(e.target.checked)}
                                className="w-4 h-4 text-cyan-500 bg-neutral-700 border-neutral-500 rounded focus:ring-cyan-500 focus:ring-offset-neutral-900"
                            />
                            <span className="text-white text-sm">Continue playing radio in background</span>
                        </label>

                        <div>
                            <h3 className="text-lg font-semibold text-neutral-300 mb-2">Source</h3>
                            <div className="flex items-center gap-6">
                                <RadioButton value="default" label="Default" />
                                <RadioButton value="radio" label="Online Radio" />
                                <RadioButton value="saved" label="Saved" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30">
                            <div className="min-w-0 flex-grow">
                                <p className="text-xs text-neutral-400">Currently Playing</p>
                                <p className="text-sm font-semibold truncate text-white">
                                    {(musicSource === 'radio' || musicSource === 'saved') && currentStation ? currentStation.name : 'Default Music'}
                                </p>
                            </div>
                            <div className="flex items-center flex-shrink-0">
                                {(musicSource === 'radio' || musicSource === 'saved') && currentStation && (
                                    <button
                                        onClick={() => onToggleSaveStation(currentStation)}
                                        className="p-2 rounded-full text-yellow-400 hover:bg-white/10"
                                        aria-label={isCurrentStationSaved ? "Unsave station" : "Save station"}
                                    >
                                        {isCurrentStationSaved ? <StarIcon className="w-6 h-6" /> : <StarOutlineIcon className="w-6 h-6" />}
                                    </button>
                                )}
                                <button
                                    onClick={() => audioManager.toggleMusicMute()}
                                    className="p-2 rounded-full text-neutral-300 hover:bg-white/10"
                                    aria-label={muteState.isMusicMuted ? "Unmute Music" : "Mute Music"}
                                >
                                    {muteState.isMusicMuted ? <MusicOffIcon className="w-6 h-6" /> : <MusicOnIcon className="w-6 h-6" />}
                                </button>
                            </div>
                        </div>
                        
                        {musicSource === 'radio' && (
                            <div>
                                {isMobile() && (
                                    <p className="text-xs text-yellow-400 bg-yellow-900/50 p-2 rounded-md mb-3">
                                        You are on a mobile device. Playing radio over a cellular network may incur data charges.
                                    </p>
                                )}
                                <RadioPlayer 
                                    onStationSelect={onStationSelect}
                                    currentStation={currentStation}
                                    searchTerm={radioSearchTerm}
                                    onSearchTermChange={onRadioSearchTermChange}
                                    stations={radioStations}
                                    loading={isRadioLoading}
                                    error={radioError}
                                    onSearch={searchRadioStations}
                                />
                            </div>
                        )}
                        
                        {musicSource === 'saved' && (
                            <div className="mt-4 text-left">
                                {savedStations.length > 0 ? (
                                    <div className="mt-3 h-48 overflow-y-auto pr-2">
                                        <ul className="space-y-1">
                                            {savedStations.map((station) => (
                                                <li key={station.url}>
                                                    <button
                                                        onClick={() => onStationSelect(station)}
                                                        className={`w-full text-left p-2 rounded-md flex items-center gap-3 transition-colors ${currentStation?.url === station.url ? 'bg-cyan-500/20' : 'hover:bg-white/10'}`}
                                                    >
                                                        <img src={station.favicon} alt="" className="w-8 h-8 rounded-sm flex-shrink-0 bg-neutral-700" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                        <div className="flex-grow min-w-0">
                                                            <p className="text-sm font-semibold text-white truncate">{station.name}</p>
                                                        </div>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="text-center text-neutral-500 pt-8">
                                        <p>You have no saved stations.</p>
                                        <p className="text-sm">Find stations in "Online Radio" and tap the star to save them.</p>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;