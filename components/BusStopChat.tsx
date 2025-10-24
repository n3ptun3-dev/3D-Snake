import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { XIcon, RefreshCwIcon, CogIcon, BellIcon, UserIcon, ArrowUturnLeftIcon, AtSignIcon, CopyIcon, FlagIcon, SpinnerIcon, HourglassIcon, MessageSquareIcon } from './icons';
import { UserDTO, BusStopSettings, ChatMessage } from '../types';
import audioManager from '../sounds';
import { getGeoInfo } from '../utils/leaderboard';
import { logger } from '../utils/logger';
import { CHAT_SERVICE_URL } from '../config';
import BusStopInfo from './BusStopInfo';

// --- Constants ---
const SUBMIT_FORM_BASE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfxFIczEsr8AVROhlPipDrn7XGoL88Ca11NpKml44xrhDN8Qw/formResponse';


// --- Helper Functions ---
const generateColorFromUsername = (username: string): string => {
    // A simple hash function to assign a color from a predefined palette
    const colors = ['#00ffff', '#ff33cc', '#39ff14', '#fdfd96', '#ff9933', '#8a2be2', '#ff6b6b', '#48dbfb'];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
};

const formatBusStopTime = (epochSeconds: number): string => {
    const epoch = epochSeconds * 1000;
    const now = Date.now();
    const diffSeconds = Math.floor((now - epoch) / 1000);

    if (isNaN(diffSeconds) || diffSeconds < 0) return "Just now";
    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(epoch).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};


interface BusStopChatProps {
    onClose: () => void;
    isRotated: boolean;
    piUser: UserDTO;
    settings: BusStopSettings;
    onSettingsChange: (newSettings: BusStopSettings) => void;
    showNotification: (message: string, type: 'info' | 'mention') => void;
    onOpenCommunityGuidelines: () => void;
}

const BusStopChat: React.FC<BusStopChatProps> = ({ onClose, isRotated, piUser, settings, onSettingsChange, showNotification, onOpenCommunityGuidelines }) => {
    // ... Main Component Implementation ...
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

    const messageListRef = useRef<HTMLDivElement>(null);
    const refreshTimerRef = useRef<number | null>(null);
    const isMounted = useRef(true);

    const fetchMessages = useCallback(async () => {
        logger.log('[BusStopChat] Starting fetchMessages.');
        if (!isMounted.current) {
            logger.log('[BusStopChat] Component unmounted, aborting fetch.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            logger.log('[BusStopChat] Fetching from new service URL...');
            const response = await fetch(`${CHAT_SERVICE_URL}/messages`);
            logger.log(`[BusStopChat] Fetch response status: ${response.status}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Failed to fetch messages. Status: ${response.status}` }));
                throw new Error(errorData.error);
            }
            
            const rawMessages: Omit<ChatMessage, 'color'>[] = await response.json();
            logger.log(`[BusStopChat] Fetched ${rawMessages.length} raw JSON messages.`);

            const localMutedUsers = new Set(settings.mutedUsers.map(u => u.pi_username));
            
            const newMessages: ChatMessage[] = rawMessages
                .filter(msg => {
                    if (!msg || !msg.id || isNaN(msg.timestamp)) {
                        logger.log(`[BusStopChat] Skipping invalid message object from API: ${JSON.stringify(msg)}`);
                        return false;
                    }
                    return !localMutedUsers.has(msg.pi_uid);
                })
                .map(msg => ({
                    ...msg,
                    color: generateColorFromUsername(msg.pi_name)
                }));
            
            logger.log(`[BusStopChat] Found ${newMessages.length} valid messages after filtering.`);
            
            if(isMounted.current) {
                setMessages(prevMessages => {
                    // Check for new mentions
                    if (prevMessages.length > 0 && newMessages.length > prevMessages.length) {
                        const oldMessageIds = new Set(prevMessages.map(m => m.id));
                        const latestMessages = newMessages.filter(m => !oldMessageIds.has(m.id));
                        const mentionRegex = new RegExp(`@${settings.chatterName}\\b`, 'i');
                        const newMention = latestMessages.find(m => mentionRegex.test(m.message) && m.pi_uid !== piUser.uid);
                        if (newMention) {
                            logger.log(`[BusStopChat] New mention found for ${settings.chatterName}.`);
                            showNotification(`${newMention.screen_name} mentioned you!`, 'mention');
                            if(settings.notificationSoundOn) audioManager.playLevelUpSound();
                        } else if (latestMessages.length > 0 && settings.notifyOnNewActivity) {
                            logger.log(`[BusStopChat] New activity found.`);
                            showNotification(`New message in The Bus Stop`, 'info');
                            if(settings.notificationSoundOn) audioManager.playLevelUpSound();
                        }
                    }
                    return newMessages;
                });
                setLastUpdated(new Date());
            }
            logger.log('[BusStopChat] fetchMessages success.');

        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "An unknown error occurred.";
            logger.log(`[BusStopChat] fetchMessages CRITICAL ERROR: ${errorMsg}`);
            if(isMounted.current) setError(errorMsg);
        } finally {
            if(isMounted.current) setIsLoading(false);
            logger.log('[BusStopChat] fetchMessages finished.');
        }
    }, [settings.mutedUsers, settings.chatterName, piUser.uid, showNotification, settings.notifyOnNewActivity, settings.notificationSoundOn]);


    // Initial fetch
    useEffect(() => {
        isMounted.current = true;
        fetchMessages();
        return () => { isMounted.current = false };
    }, [fetchMessages]);
    
    // Auto-refresh timer
    useEffect(() => {
        const setupTimer = () => {
            if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
            refreshTimerRef.current = window.setInterval(fetchMessages, settings.autoRefreshInterval * 60 * 1000);
        };
        
        // Always refresh when window is open, or if the setting is enabled
        if (settings.autoRefreshOnClose) {
            setupTimer();
        } else {
            // If setting is off, clear timer on unmount (chat close)
            return () => {
                if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
            }
        }
        
        return () => {
            if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        };
    }, [settings.autoRefreshInterval, settings.autoRefreshOnClose, fetchMessages]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (messageListRef.current) {
            messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const messageText = newMessage.trim();
        if (!messageText || isSending) return;

        setIsSending(true);
        try {
            const geo = await getGeoInfo();
            const region = geo ? geo.countryCode : 'UNK';
            
            const params = new URLSearchParams({
                'entry.1757606142': `${Date.now()}-${piUser.username}`, // MessageID
                'entry.330026102': piUser.uid, // Pi_UID
                'entry.1880700284': piUser.username, // Pi_Name
                'entry.1806977404': settings.chatterName, // Screen_Name
                'entry.464511137': String(Math.floor(Date.now() / 1000)), // TIMES
                'entry.523932117': messageText, // Message_Text
                'entry.798134972': 'USER_MESSAGE', // Message_Type
                'entry.184274625': '', // Reply_To_ID
                'entry.1321245332': 'VISIBLE', // Status
                'entry.1054301276': region, // Region
            });

            await fetch(`${SUBMIT_FORM_BASE_URL}?${params.toString()}`, {
                method: 'POST',
                mode: 'no-cors'
            });

            setNewMessage('');
            // Optimistically add the message to the UI
            const optimisticMessage: ChatMessage = {
                id: `temp-${Date.now()}`,
                pi_uid: piUser.uid,
                pi_name: piUser.username,
                screen_name: settings.chatterName,
                timestamp: Math.floor(Date.now() / 1000),
                message: messageText,
                message_type: 'USER_MESSAGE',
                reply_to_id: '',
                status: 'VISIBLE',
                region: region,
                color: generateColorFromUsername(piUser.username),
            };
            setMessages(prev => [...prev, optimisticMessage]);

            setTimeout(() => {
                fetchMessages();
                if (refreshTimerRef.current) { // Reset timer
                    clearInterval(refreshTimerRef.current);
                    refreshTimerRef.current = window.setInterval(fetchMessages, settings.autoRefreshInterval * 60 * 1000);
                }
            }, 1500); // A small delay before refreshing

        } catch (err) {
            setError('Failed to send message. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    const handleReply = (message: ChatMessage) => {
        // Find the actual content of the message, stripping any previous quotes.
        const lines = message.message.split('\n');
        const firstContentLineIndex = lines.findIndex(line => !line.trim().startsWith('>'));
        
        // If no content is found (e.g., a message with only a quote), fallback to the full message.
        const contentToQuote = firstContentLineIndex !== -1 
            ? lines.slice(firstContentLineIndex).join('\n').trim() 
            : message.message;

        // Truncate the actual content for the preview.
        const words = contentToQuote.split(/\s+/);
        const messagePreview = words.length > 8
            ? words.slice(0, 8).join(' ') + '...'
            : contentToQuote;

        // Set the new message state for the input box.
        setNewMessage(`> ${message.screen_name}: "${messagePreview}"\n\n`);
        setSelectedMessage(null);
    };

    const handleMention = (message: ChatMessage) => {
        setNewMessage(prev => `${prev}@${message.screen_name} `);
        setSelectedMessage(null);
    };

    const handleCopy = (message: ChatMessage) => {
        navigator.clipboard.writeText(message.message);
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 1500);
    };
    
    // ... Sub-components and main component return ...
    const containerClasses = isRotated
        ? 'h-[95%] w-[90%] max-w-[750px]'
        : 'w-full max-w-2xl h-[90%] max-h-[750px]';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center font-sans p-4" role="dialog" aria-modal="true">
            <div className={`bg-[#0a0a0a] border-2 border-[#ff33cc] rounded-2xl shadow-[0_0_15px_rgba(255,51,204,0.7)] flex flex-col overflow-hidden ${containerClasses}`}>
                <header className="flex items-center justify-between p-2 pl-4 border-b-2 border-[#00ffff] flex-shrink-0">
                    <button onClick={() => setIsInfoOpen(true)} className="flex items-center gap-3 text-left transition-opacity hover:opacity-80">
                        <img src="https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/The%20Bus%20Stop.png" alt="Bus Stop" className="h-10 w-10" />
                        <h2 className="text-xl font-bold text-white" style={{ textShadow: '0 0 5px #00ffff' }}>The Bus Stop</h2>
                    </button>
                    <div className="flex items-center gap-1">
                        <button onClick={fetchMessages} className="p-2 rounded-full text-[#00ffff] hover:bg-[#00ffff]/20 transition-colors" aria-label="Refresh chat" disabled={isLoading}>
                            <RefreshCwIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={onClose} className="p-2 rounded-full text-[#ff33cc] hover:bg-[#ff33cc]/20 transition-colors" aria-label="Close chat">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>

                <button onClick={() => setIsSettingsOpen(true)} className="flex items-center justify-around gap-2 p-1.5 bg-black/50 border-b-2 border-[#00ffff]/50 flex-shrink-0 text-xs text-neutral-400 hover:bg-[#00ffff]/10 transition-colors">
                    <div className="flex items-center gap-1.5"><HourglassIcon className="w-4 h-4 text-neutral-500"/><span>{lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span></div>
                    <div className="flex items-center gap-1.5"><BellIcon className="w-4 h-4 text-neutral-500"/><span>{settings.notificationsOn ? 'On' : 'Off'}</span></div>
                    <div className="flex items-center gap-1.5"><UserIcon className="w-4 h-4 text-neutral-500"/><span>{settings.mutedUsers.length} Muted</span></div>
                    <div className="flex items-center gap-1.5"><RefreshCwIcon className="w-4 h-4 text-neutral-500"/><span>{settings.autoRefreshOnClose ? `${settings.autoRefreshInterval}m` : 'Off'}</span></div>
                </button>

                <div ref={messageListRef} className="flex-grow overflow-y-auto p-4 space-y-4 relative" role="log" aria-live="polite">
                    {isLoading && messages.length === 0 ? (
                        <div className="flex justify-center items-center h-full"><SpinnerIcon className="w-8 h-8 animate-spin text-cyan-400" /></div>
                    ) : error ? (
                         <div className="flex justify-center items-center h-full text-red-400">{error}</div>
                    ) : messages.length === 0 ? (
                        <div className="flex justify-center items-center h-full text-center text-neutral-400">
                            <p>The bus stop is quiet for now...<br/>Start a conversation and see who shows up!</p>
                        </div>
                    ) : (
                        messages.map(msg => (
                            <button key={msg.id} onClick={() => setSelectedMessage(msg)}
                                aria-label={`Message from ${msg.screen_name} sent ${formatBusStopTime(msg.timestamp)}. Content: ${msg.message}`}
                                className={`w-full text-left flex gap-3 p-2 rounded-lg cursor-pointer transition-colors ${msg.pi_uid === piUser.uid ? 'bg-[#00ffff]/10 hover:bg-[#00ffff]/20' : 'hover:bg-white/5'}`}>
                                <div className="flex-shrink-0 w-20 text-right">
                                    <p className="font-bold text-sm truncate" style={{ color: msg.color }}>{msg.screen_name}</p>
                                    <p className="text-xs text-neutral-500">{formatBusStopTime(msg.timestamp)}</p>
                                </div>
                                <div className="flex-grow text-neutral-200 text-sm break-words whitespace-pre-wrap line-clamp-5">{msg.message}</div>
                            </button>
                        ))
                    )}
                </div>

                <div className="p-3 border-t-2 border-[#00ffff]/50 flex-shrink-0">
                    {isInputFocused && <p className="text-xs text-neutral-500 text-center mb-1">Messages are automatically removed after 24 hours.</p>}
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg border-2 border-transparent focus-within:border-[#00ffff]">
                        <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)}
                            placeholder={`Chatting as ${settings.chatterName}...`} aria-label="Type your message" className="flex-grow bg-transparent p-3 text-white focus:outline-none" disabled={isSending} />
                        <button type="submit" className="p-3 text-cyan-400 hover:text-white disabled:text-neutral-600" disabled={isSending || !newMessage.trim()}>
                            {isSending ? <SpinnerIcon className="w-6 h-6 animate-spin"/> : <MessageSquareIcon className="w-6 h-6"/>}
                        </button>
                    </form>
                </div>
                
                {selectedMessage && (
                     <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex items-center justify-center p-4" onClick={() => setSelectedMessage(null)}>
                        <div className="bg-[#1a1a1a] border border-[#ff33cc] rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b border-[#ff33cc]/50 flex justify-between items-center">
                                <div>
                                    <p className="font-bold" style={{ color: selectedMessage.color }}>{selectedMessage.screen_name}</p>
                                    <p className="text-xs text-neutral-400">{new Date(selectedMessage.timestamp * 1000).toLocaleString()}</p>
                                </div>
                                {!settings.mutedUsers.some(u => u.pi_username === selectedMessage.pi_uid) && selectedMessage.pi_uid !== piUser.uid && (
                                    <button onClick={() => { onSettingsChange({...settings, mutedUsers: [...settings.mutedUsers, { pi_username: selectedMessage.pi_uid, screen_name: selectedMessage.screen_name }]}); setSelectedMessage(null); }} className="flex items-center gap-1 p-2 rounded text-red-400 hover:bg-red-500/20 hover:text-red-300 text-xs"><FlagIcon className="w-4 h-4"/> Mute</button>
                                )}
                            </div>
                            <div className="p-4 max-h-64 overflow-y-auto text-neutral-200 whitespace-pre-wrap">{selectedMessage.message}</div>
                            <div className="p-2 border-t border-[#ff33cc]/50 flex justify-around">
                                <button onClick={() => handleReply(selectedMessage)} className="flex items-center gap-2 p-2 rounded text-neutral-300 hover:bg-[#00ffff]/20 hover:text-white"><ArrowUturnLeftIcon className="w-5 h-5"/> Reply</button>
                                <button onClick={() => handleMention(selectedMessage)} className="flex items-center gap-2 p-2 rounded text-neutral-300 hover:bg-[#00ffff]/20 hover:text-white"><AtSignIcon className="w-5 h-5"/> Mention</button>
                                <button onClick={() => handleCopy(selectedMessage)} className="flex items-center gap-2 p-2 rounded text-neutral-300 hover:bg-[#00ffff]/20 hover:text-white"><CopyIcon className="w-5 h-5"/> {copyStatus === 'copied' ? 'Copied!' : 'Copy'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {isSettingsOpen && (
                    <BusStopSettingsPanel
                        settings={settings}
                        onSettingsChange={onSettingsChange}
                        onClose={() => setIsSettingsOpen(false)}
                        piUsername={piUser.username}
                    />
                )}
                 {isInfoOpen && (
                    <BusStopInfo 
                        onClose={() => setIsInfoOpen(false)} 
                        onOpenCommunityGuidelines={onOpenCommunityGuidelines} 
                    />
                )}
            </div>
        </div>
    );
};


// --- BusStopSettingsPanel Sub-component ---
interface BusStopSettingsPanelProps {
    settings: BusStopSettings;
    onSettingsChange: (newSettings: BusStopSettings) => void;
    onClose: () => void;
    piUsername: string;
}

const BusStopSettingsPanel: React.FC<BusStopSettingsPanelProps> = ({ settings, onSettingsChange, onClose, piUsername }) => {
    const [currentSettings, setCurrentSettings] = useState(settings);
    const [nameError, setNameError] = useState('');

    const handleSave = () => {
        const trimmedName = currentSettings.chatterName.trim();
        if (trimmedName.length < 3) { setNameError('Chatter name must be at least 3 characters.'); return; }
        if (trimmedName.length > 15) { setNameError('Chatter name cannot exceed 15 characters.'); return; }
        if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedName)) { setNameError('Chatter name contains invalid characters.'); return; }
        
        onSettingsChange(currentSettings);
        onClose();
    };

    const handleUnmute = (pi_username: string) => {
        setCurrentSettings(prev => ({ ...prev, mutedUsers: prev.mutedUsers.filter(u => u.pi_username !== pi_username) }));
    };

    return (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[#1a1a1a] border-2 border-[#00ffff] rounded-lg w-full max-w-md flex flex-col max-h-[90%]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b-2 border-[#ff33cc]/50 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Chat Settings</h3>
                    <button onClick={onClose} className="p-1 rounded-full text-neutral-400 hover:bg-white/10"><XIcon className="w-6 h-6"/></button>
                </div>
                <div className="flex-grow overflow-y-auto p-4 space-y-6 text-neutral-300">
                    <div>
                        <label className="block text-sm font-medium mb-1">Chatter Name</label>
                        <input type="text" value={currentSettings.chatterName} onChange={e => setCurrentSettings({...currentSettings, chatterName: e.target.value})} maxLength={15}
                            className="w-full px-3 py-2 bg-[#0a0a0a] border border-neutral-600 rounded-md focus:outline-none focus:border-cyan-400" />
                        {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
                    </div>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span>Auto-refresh when chat is closed</span>
                            <input type="checkbox" checked={currentSettings.autoRefreshOnClose} onChange={e => setCurrentSettings({...currentSettings, autoRefreshOnClose: e.target.checked})} className="w-5 h-5 text-cyan-500 bg-neutral-700 border-neutral-600 rounded focus:ring-cyan-500" />
                        </label>
                        <label className={`flex items-center justify-between ${!currentSettings.autoRefreshOnClose && 'opacity-50'}`}>
                            <span>Refresh Interval</span>
                            <select value={currentSettings.autoRefreshInterval} onChange={e => setCurrentSettings({...currentSettings, autoRefreshInterval: parseInt(e.target.value, 10) as BusStopSettings['autoRefreshInterval']})} disabled={!currentSettings.autoRefreshOnClose}
                                className="px-2 py-1 bg-[#0a0a0a] border border-neutral-600 rounded-md focus:outline-none focus:border-cyan-400">
                                {[2, 5, 10, 15, 30, 60].map(val => <option key={val} value={val}>{val} min</option>)}
                            </select>
                        </label>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-neutral-700">
                         <label className="flex items-center justify-between cursor-pointer">
                            <span className="font-bold">Notifications</span>
                            <input type="checkbox" checked={currentSettings.notificationsOn} onChange={e => setCurrentSettings({...currentSettings, notificationsOn: e.target.checked})} className="w-5 h-5 text-cyan-500 bg-neutral-700 border-neutral-600 rounded focus:ring-cyan-500" />
                        </label>
                         <div className={`pl-4 space-y-4 ${!currentSettings.notificationsOn && 'opacity-50'}`}>
                             <label className="flex items-center justify-between cursor-pointer">
                                <span>Notify on @mentions</span>
                                <input type="checkbox" checked={currentSettings.notifyOnMention} onChange={e => setCurrentSettings({...currentSettings, notifyOnMention: e.target.checked})} disabled={!currentSettings.notificationsOn} className="w-5 h-5 text-cyan-500 bg-neutral-700 border-neutral-600 rounded focus:ring-cyan-500" />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer">
                                <span>Notify on new messages</span>
                                <input type="checkbox" checked={currentSettings.notifyOnNewActivity} onChange={e => setCurrentSettings({...currentSettings, notifyOnNewActivity: e.target.checked})} disabled={!currentSettings.notificationsOn} className="w-5 h-5 text-cyan-500 bg-neutral-700 border-neutral-600 rounded focus:ring-cyan-500" />
                            </label>
                             <label className="flex items-center justify-between cursor-pointer">
                                <span>Notification sound</span>
                                <input type="checkbox" checked={currentSettings.notificationSoundOn} onChange={e => setCurrentSettings({...currentSettings, notificationSoundOn: e.target.checked})} disabled={!currentSettings.notificationsOn} className="w-5 h-5 text-cyan-500 bg-neutral-700 border-neutral-600 rounded focus:ring-cyan-500" />
                            </label>
                        </div>
                    </div>
                    
                    <div className="pt-4 border-t border-neutral-700">
                        <h4 className="text-sm font-medium mb-2">Muted Chatters</h4>
                        {currentSettings.mutedUsers.length > 0 ? (
                            <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                                {currentSettings.mutedUsers.map(user => (
                                    <div key={user.pi_username} className="flex items-center justify-between bg-neutral-800 p-2 rounded">
                                        <span className="text-sm truncate">{user.screen_name}</span>
                                        <button onClick={() => handleUnmute(user.pi_username)} className="p-1 text-red-400 hover:text-red-300"><XIcon className="w-4 h-4"/></button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-neutral-500 text-center">You haven't muted anyone.</p>
                        )}
                    </div>
                </div>
                <div className="p-4 border-t-2 border-[#ff33cc]/50 flex justify-end">
                    <button onClick={handleSave} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors">Save & Close</button>
                </div>
            </div>
        </div>
    );
};

export default BusStopChat;