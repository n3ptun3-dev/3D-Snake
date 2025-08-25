import React from 'react';
import { RadioStation, RadioBrowserStation } from '../types';
import { SpinnerIcon } from './icons';

interface RadioPlayerProps {
    onStationSelect: (station: RadioStation) => void;
    currentStation: RadioStation | null;
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    stations: RadioBrowserStation[];
    loading: boolean;
    error: string | null;
    onSearch: (term: string) => void;
}

const RadioPlayer: React.FC<RadioPlayerProps> = ({ 
    onStationSelect, currentStation, searchTerm, onSearchTermChange, 
    stations, loading, error, onSearch
}) => {

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(searchTerm);
    };

    const handleStationClick = (station: RadioBrowserStation) => {
        if (!station.url_resolved) {
            console.warn(`Station "${station.name}" has no valid stream URL.`);
            return;
        }
        const newStation: RadioStation = {
            name: station.name,
            url: station.url_resolved,
            favicon: station.favicon,
        };
        onStationSelect(newStation);
    };

    return (
        <div className="mt-4 text-left">
            <form onSubmit={handleSearch}>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                    placeholder="Search for a radio station"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
            </form>

            <div className="mt-3 h-48 overflow-y-auto pr-2">
                {loading && (
                    <div className="flex items-center justify-center h-full text-neutral-400">
                        <SpinnerIcon className="w-8 h-8 animate-spin" />
                    </div>
                )}
                {error && <p className="text-red-400 text-center p-4 text-sm">{error}</p>}
                {!loading && !error && stations.length === 0 && (
                    <p className="text-neutral-500 text-center pt-4">Search for stations to begin.</p>
                )}
                <ul className="space-y-1">
                    {stations.map((station) => (
                        <li key={station.stationuuid}>
                            <button
                                onClick={() => handleStationClick(station)}
                                className={`w-full text-left p-2 rounded-md flex items-center gap-3 transition-colors ${currentStation?.url === station.url_resolved ? 'bg-cyan-500/20' : 'hover:bg-white/10'}`}
                            >
                                <img src={station.favicon} alt="" className="w-8 h-8 rounded-sm flex-shrink-0 bg-neutral-700" onError={(e) => e.currentTarget.style.display = 'none'} />
                                <div className="flex-grow min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{station.name}</p>
                                    <p className="text-xs text-neutral-400 truncate">{station.country}</p>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default RadioPlayer;
