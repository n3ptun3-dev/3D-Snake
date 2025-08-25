import React, { useState, useEffect, useRef } from 'react';
import audioManager from '../sounds';
import { 
    MusicOnIcon, MusicOffIcon, SfxOnIcon, SfxOffIcon,
    PlayIcon, PauseIcon, FullScreenEnterIcon, FullScreenExitIcon,
    HeartIcon, SpeedIcon, TrophyIcon, CameraIcon,
    SpeedBoostIcon, SlowDownIcon, MagnetIcon, ScoreDoublerIcon, TripleIcon, RadioIcon,
    ChevronUpIcon, ChevronDownIcon, MegaphoneIcon, BurgerMenuIcon, RotateIcon
} from './icons';
import { GameState, ActiveEffect, FruitType, RadioStation, CameraView, UserDTO } from '../types';
import { isMobile } from '../utils/device';
import MenuOverlay from './MenuOverlay';

interface GameHUDProps {
    gameState: GameState;
    isPaused: boolean;
    onTogglePause: () => void;
    isFullScreen: boolean;
    onToggleFullScreen: () => void;
    score: number;
    level: number;
    lives: number;
    gameSpeed: number;
    onStartGame: () => void;
    topSpeed: number;
    highScore: number;
    isWelcomePanelVisible: boolean;
    activeEffects: ActiveEffect[];
    onOpenLeaderboard: () => void;
    onOpenSettings: () => void;
    onOpenGraphicsSettings: () => void;
    onOpenAmi: () => void;
    onOpenHowToPlay: () => void;
    musicSource: 'default' | 'radio' | 'saved';
    currentStation: RadioStation | null;
    flashMessage: string | null;
    cameraView: CameraView;
    onCycleCamera: () => void;
    isHudContentVisible: boolean;
    setIsHudContentVisible: (visible: boolean) => void;
    onResetToWelcome: () => void;
    onOpenFeedback: () => void;
    onOpenJoinPi: () => void;
    onOpenAboutSpi: () => void;
    onOpenCredits: () => void;
    onOpenTerms: () => void;
    onOpenPrivacyPolicy: () => void;
    piUser: UserDTO | null;
    isPiBrowser: boolean;
    isRotated: boolean;
    onToggleRotate: () => void;
}

const ControlButton: React.FC<{
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isToggled?: boolean;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  'aria-label': string;
  isDisabled?: boolean;
  className?: string;
}> = ({ onClick, isToggled, onIcon, offIcon, 'aria-label': ariaLabel, isDisabled = false, className = '' }) => (
    <button
        onClick={(e) => {
            if (isDisabled) return;
            e.stopPropagation();
            e.preventDefault();
            e.currentTarget.blur();
            onClick(e);
        }}
        aria-label={ariaLabel}
        aria-pressed={isToggled}
        disabled={isDisabled}
        className={`rounded-full text-neutral-300 transition-all duration-200 flex items-center justify-center bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-cyan-400 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-white'} ${className}`}
    >
        {isToggled ? offIcon : onIcon}
    </button>
);


const EffectProgressBar: React.FC<{ effect: ActiveEffect }> = ({ effect }) => {
    const [progress, setProgress] = useState(100);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = requestAnimationFrame(() => setIsVisible(true));
        return () => cancelAnimationFrame(timer);
    }, []);

    useEffect(() => {
        if (effect.type === FruitType.EXTRA_LIFE || effect.type === FruitType.SLOW_DOWN) return;

        const updateProgress = () => {
            const now = Date.now();
            const elapsed = now - effect.startTime;
            const remaining = effect.duration - elapsed;
            const percentage = Math.max(0, (remaining / effect.duration) * 100);
            setProgress(percentage);
        };
        updateProgress();
        const interval = setInterval(updateProgress, 100);
        return () => clearInterval(interval);
    }, [effect]);

    const ICONS: Record<FruitType, React.ReactNode> = {
        [FruitType.SPEED_BOOST]: <SpeedBoostIcon className="w-5 h-5 text-yellow-300" />,
        [FruitType.SLOW_DOWN]: <SlowDownIcon className="w-5 h-5 text-cyan-300" />,
        [FruitType.MAGNET]: <MagnetIcon className="w-5 h-5 text-purple-300" />,
        [FruitType.SCORE_DOUBLER]: <ScoreDoublerIcon className="w-5 h-5 text-amber-300" />,
        [FruitType.APPLE]: <></>,
        [FruitType.EXTRA_LIFE]: <HeartIcon className="w-5 h-5 text-red-400" />,
        [FruitType.TRIPLE]: <TripleIcon className="w-5 h-5 text-green-400" />,
    };

    const NAMES: Record<FruitType, string> = {
        [FruitType.SPEED_BOOST]: "Overdrive Node",
        [FruitType.SLOW_DOWN]: "Stasis Node",
        [FruitType.MAGNET]: "Tractor Node",
        [FruitType.SCORE_DOUBLER]: "Multiplier Node",
        [FruitType.APPLE]: "",
        [FruitType.EXTRA_LIFE]: "Aegis Node",
        [FruitType.TRIPLE]: "Fork Node",
    };
    
    const effectName = NAMES[effect.type];
    const effectIcon = ICONS[effect.type];
    const isInstantEffect = effect.type === FruitType.EXTRA_LIFE || effect.type === FruitType.SLOW_DOWN;

    const wrapperClasses = `w-full transition-all duration-300 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`;

    if (isInstantEffect) {
        return (
            <div className={wrapperClasses}>
                <div className="flex items-center justify-between p-2 rounded-lg bg-black/20 backdrop-blur-sm">
                    <span className="font-bold text-white tracking-wide text-sm">{effectName}</span>
                    {effectIcon}
                </div>
            </div>
        );
    }

    return (
        <div className={wrapperClasses}>
            <div className="flex justify-between items-center mb-1 text-sm">
                <span className="font-bold text-white tracking-wide">{effectName}</span>
                {effectIcon}
            </div>
            <div className="relative w-full h-2 bg-white/10 backdrop-blur-sm rounded-full overflow-hidden">
                <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};


const GameHUD: React.FC<GameHUDProps> = ({ 
    gameState, isPaused, onTogglePause, isFullScreen, onToggleFullScreen, 
    score, level, lives, gameSpeed, onStartGame, topSpeed, highScore, isWelcomePanelVisible, activeEffects,
    onOpenLeaderboard, onOpenSettings, onOpenGraphicsSettings, onOpenAmi, onOpenHowToPlay, musicSource, currentStation, flashMessage,
    cameraView, onCycleCamera, isHudContentVisible, setIsHudContentVisible, onResetToWelcome, onOpenFeedback,
    onOpenJoinPi, onOpenAboutSpi, onOpenCredits, onOpenTerms, onOpenPrivacyPolicy, piUser,
    isPiBrowser, isRotated, onToggleRotate
}) => {
    const [muteState, setMuteState] = useState(audioManager.getMuteState());
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showCollapseButton, setShowCollapseButton] = useState(false);
    const [useSideLayout, setUseSideLayout] = useState(false);

    const isPlaying = gameState === 'Playing';
    const isWelcome = gameState === 'Welcome';
    const isGameOver = gameState === 'GameOver';
    const isExpanded = (isWelcome && isWelcomePanelVisible) || isGameOver || isPaused;

    useEffect(() => {
        const unsubscribe = audioManager.subscribe(() => setMuteState(audioManager.getMuteState()));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const checkLayout = () => {
            // Switch to side layout if the panel is expanded, the screen is in landscape, AND it's short.
            const isLandscape = window.innerWidth > window.innerHeight;
            const isShort = window.innerHeight < 240;

            if (isExpanded && isLandscape && isShort) {
                setUseSideLayout(true);
            } else {
                setUseSideLayout(false);
            }
        };

        checkLayout();
        window.addEventListener('resize', checkLayout);
        
        return () => window.removeEventListener('resize', checkLayout);
    }, [isExpanded]);

    useEffect(() => {
        if (isExpanded) {
            const timer = setTimeout(() => {
                setShowCollapseButton(true);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setShowCollapseButton(false);
        }
    }, [isExpanded]);
    
    const handleToggleMusic = () => {
        audioManager.toggleMusicMute();
    };

    const handleStart = () => {
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isPiBrowser) {
            if (!isRotated) onToggleRotate();
        } else if (isMobile() && !isFullScreen && !isIOS) {
            onToggleFullScreen();
        }
        onStartGame();
    };

    const handleEndGame = () => {
        onResetToWelcome();
        setIsMenuOpen(false);
    };

    const speedMps = (1000 / gameSpeed).toFixed(2);
    
    const isHudVisible = !((isWelcome && !isWelcomePanelVisible) || gameState === 'Starting' || gameState === 'Loading');
    const isPanelHidden = !isHudVisible || (!isHudContentVisible && isExpanded);

    const glowStyle = { filter: 'drop-shadow(0 0 4px rgba(0, 0, 0, 0.6))' };
    
    const now = Date.now();
    const displayableEffects = activeEffects.filter(effect => {
        if (effect.duration === 0) return false;
        const hasExpired = now >= effect.startTime + effect.duration;
        return !hasExpired;
    });

    const ActionButtons = () => (
        <div className="mt-6 flex flex-col items-center gap-2">
            <div className="flex justify-center items-center gap-4">
                <button onClick={handleStart} className="px-6 py-2 bg-green-700 hover:bg-green-800 text-white font-bold rounded-lg text-lg transition-transform transform hover:scale-105">
                    {isGameOver ? 'Play Again' : 'Start Game'}
                </button>
                <button onClick={onOpenLeaderboard} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg text-lg transition-transform transform hover:scale-105 flex items-center gap-2">
                    <TrophyIcon className="w-5 h-5" /> Leaderboard
                </button>
            </div>
            <button
                onClick={onOpenAmi}
                className="mt-3 text-sm text-neutral-400 hover:text-cyan-300 transition-colors underline flex items-center gap-1.5"
            >
                <MegaphoneIcon className="w-4 h-4" />
                View Our Sponsors
            </button>
        </div>
    );

    const LivesIndicator = () => (
      <div className="flex items-center gap-x-1.5" aria-label={`${lives} lives remaining`}>
          {Array.from({ length: Math.min(lives, 10) }).map((_, i) => (
              <HeartIcon key={i} className="w-6 h-6 text-red-500" />
          ))}
          {lives > 10 && <span className="text-sm ml-1">+{lives - 10}</span>}
      </div>
    );

    return (
        <>
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full z-30 flex flex-col items-center transition-all duration-500 ease-in-out`}>
                <div 
                  className={`w-full bg-transparent backdrop-blur-md rounded-b-2xl text-white transition-all duration-500 ease-in-out border-b border-white/20 ${isPanelHidden ? 'opacity-0 -translate-y-full pointer-events-none' : 'opacity-100 translate-y-0'}`}
                >
                    {/* Expanded Content Area */}
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96 p-6' : 'max-h-0 p-0'}`}>
                        <div className="text-center w-full" style={glowStyle}>
                            {isWelcome && isWelcomePanelVisible && <>
                                <h1 className="text-4xl sm:text-5xl font-bold mb-2 text-yellow-300">3D Snake</h1>
                                <p className="text-neutral-300 mb-4 text-sm sm:text-base">Use the arrow keys to turn 90° left or right.</p>
                                 <ActionButtons />
                            </>}
                            {isGameOver && <>
                                <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-red-500">Game Over</h1>
                                <div className="flex flex-col gap-y-3 my-4 text-base sm:text-lg max-w-md mx-auto px-4">
                                    <div className="flex justify-between items-baseline">
                                        <div>
                                            <span className="font-semibold text-neutral-300 mr-2">Score</span>
                                            <span className="font-bold text-white text-xl">{score.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-neutral-300 mr-2">Level</span>
                                            <span className="font-bold text-white text-xl">{level}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <div>
                                            <span className="font-semibold text-neutral-300 mr-2">High Score</span>
                                            <span className="font-bold text-yellow-300 text-xl">{highScore.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-neutral-300 mr-2">Top Speed</span>
                                            <span className="font-bold text-white text-xl">{topSpeed.toFixed(2)} m/s</span>
                                        </div>
                                    </div>
                                </div>
                                <ActionButtons />
                            </>}
                            {isPaused && <h1 className="text-4xl sm:text-5xl font-bold text-blue-300 tracking-widest">PAUSED</h1>}
                        </div>
                    </div>

                    {/* Main Control Bar */}
                    <div className={`relative flex items-center justify-between flex-wrap gap-x-4 gap-y-2 w-full min-h-[4rem] px-2 sm:px-4 ${isExpanded ? 'border-t border-white/20' : ''}`} style={glowStyle}>
                        {/* Left side */}
                        <div className="flex items-center gap-x-2 flex-1 min-w-0">
                           {!useSideLayout && (
                                isPiBrowser ? (
                                    <ControlButton onClick={onToggleRotate} isToggled={isRotated} onIcon={<RotateIcon className="w-5 h-5" />} offIcon={<RotateIcon className="w-5 h-5" />} aria-label={isRotated ? "Rotate to Portrait" : "Rotate to Landscape"} className="w-10 h-10" />
                                ) : (
                                    <>
                                        <ControlButton onClick={onToggleFullScreen} isToggled={isFullScreen} onIcon={<FullScreenEnterIcon className="w-5 h-5" />} offIcon={<FullScreenExitIcon className="w-5 h-5" />} aria-label={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"} className="w-10 h-10" />
                                        {/* Temporary Rotate Button for development */}
                                        {/* <ControlButton onClick={onToggleRotate} isToggled={isRotated} onIcon={<RotateIcon className="w-5 h-5" />} offIcon={<RotateIcon className="w-5 h-5" />} aria-label={isRotated ? "Rotate to Portrait" : "Rotate to Landscape"} className="w-10 h-10" /> */}
                                    </>
                                )
                           )}
                           {(isPlaying && !isPaused) ? (
                               <div className="flex items-center justify-start gap-x-3 sm:gap-x-4 text-base sm:text-lg font-semibold">
                                   <div className="flex items-center gap-x-1 sm:gap-x-2"><span className="hidden sm:inline">Score:</span><span className="font-bold text-xl w-12 text-center">{score}</span></div>
                                   <div className="hidden sm:flex items-center gap-x-1 sm:gap-x-2"><span>Level:</span><span className="font-bold text-xl w-8 text-center">{level}</span></div>
                                   <div className="hidden sm:flex items-center gap-x-1.5"><LivesIndicator /></div>
                               </div>
                           ) : null}
                        </div>
                        
                        {/* Right side */}
                        <div className="flex items-center justify-end gap-x-1 sm:gap-x-2">
                            <div className={`hidden sm:flex items-center bg-black/20 px-3 py-1.5 rounded-full transition-opacity duration-300 ${isPlaying && !isPaused ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} aria-label={`Current speed: ${speedMps} meters per second`}>
                                <SpeedIcon className="w-5 h-5 mr-2 text-cyan-300" />
                                <span className="font-semibold text-sm sm:text-base">{speedMps} m/s</span>
                            </div>
                            {!useSideLayout && (
                                <div className="flex items-center gap-x-1 sm:gap-x-2">
                                    <ControlButton onClick={() => audioManager.toggleSfxMute()} isToggled={muteState.areSfxMuted} onIcon={<SfxOnIcon className="w-5 h-5" />} offIcon={<SfxOffIcon className="w-5 h-5" />} aria-label={muteState.areSfxMuted ? "Unmute Sound Effects" : "Mute Sound Effects"} className="w-10 h-10" />
                                    <ControlButton onClick={handleToggleMusic} isToggled={muteState.isMusicMuted} onIcon={<MusicOnIcon className="w-5 h-5" />} offIcon={<MusicOffIcon className="w-5 h-5" />} aria-label={muteState.isMusicMuted ? "Unmute Music" : "Mute Music"} className="w-10 h-10" />
                                    {isExpanded && <ControlButton onClick={() => onOpenSettings()} onIcon={<RadioIcon className="w-5 h-5" />} offIcon={<RadioIcon className="w-5 h-5" />} aria-label="Open Radio Settings" className="w-10 h-10 flex-shrink-0" />}
                                    <ControlButton onClick={onTogglePause} isToggled={isPaused} onIcon={<PauseIcon className="w-7 h-7" />} offIcon={<PlayIcon className="w-7 h-7" />} aria-label={isPaused ? "Resume Game" : "Pause Game"} isDisabled={!isPlaying && !isPaused} className={`w-12 h-12 text-cyan-300 border border-cyan-300/60 ${!isPlaying && !isPaused ? 'hidden' : ''}`} />
                                </div>
                            )}
                        </div>

                        {/* Centered Radio Info */}
                        {isExpanded && !useSideLayout && (musicSource === 'radio' || musicSource === 'saved') && currentStation && !muteState.isMusicMuted && (
                            <button
                                onClick={() => onOpenSettings()}
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 min-w-0 max-w-[calc(100%-17rem)] p-2 rounded-full bg-black/20 hover:bg-black/60 transition-colors cursor-pointer"
                                aria-label={`Now playing: ${currentStation.name}. Click to open music settings.`}
                            >
                                <img src={currentStation.favicon} alt="" className="w-5 h-5 rounded-sm flex-shrink-0" onError={(e) => e.currentTarget.style.display = 'none'} />
                                <span className="text-sm font-semibold truncate text-neutral-300">{currentStation.name}</span>
                            </button>
                        )}

                        {/* Flash Message */}
                        {flashMessage && (
                            <div 
                                key={flashMessage} 
                                className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-red-800/90 border border-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold animate-fade-in-out"
                            >
                                {flashMessage}
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile-only stats row for active gameplay */}
                {(isPlaying && !isPaused && !isPanelHidden) && (
                    <div className="sm:hidden flex justify-around items-center w-full px-2 pb-2 -mt-2 text-white backdrop-blur-md rounded-b-xl border-b border-t border-white/10" style={glowStyle}>
                        <div className="flex items-center gap-x-1 text-base font-semibold">
                            <span>Lv:</span><span className="font-bold text-lg w-8 text-center">{level}</span>
                        </div>
                         <div className="flex items-center gap-x-1.5 font-semibold"><LivesIndicator/></div>
                        <div className="flex items-center gap-x-1 font-semibold text-base">
                            <SpeedIcon className="w-5 h-5 text-cyan-300" />
                            <span>{speedMps}m/s</span>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Side Layout Buttons for short screens */}
            {useSideLayout && isHudContentVisible && (
                <>
                    <div className="absolute top-20 left-4 z-40 flex flex-col gap-2 items-start">
                        {isPiBrowser ? (
                            <ControlButton onClick={onToggleRotate} isToggled={isRotated} onIcon={<RotateIcon className="w-5 h-5" />} offIcon={<RotateIcon className="w-5 h-5" />} aria-label={isRotated ? "Rotate to Portrait" : "Rotate to Landscape"} className="w-10 h-10" />
                        ) : (
                           <>
                                <ControlButton onClick={onToggleFullScreen} isToggled={isFullScreen} onIcon={<FullScreenEnterIcon className="w-5 h-5" />} offIcon={<FullScreenExitIcon className="w-5 h-5" />} aria-label={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"} className="w-10 h-10" />
                                {/* Temporary Rotate Button for development */}
                                {/* <ControlButton onClick={onToggleRotate} isToggled={isRotated} onIcon={<RotateIcon className="w-5 h-5" />} offIcon={<RotateIcon className="w-5 h-5" />} aria-label={isRotated ? "Rotate to Portrait" : "Rotate to Landscape"} className="w-10 h-10" /> */}
                            </>
                        )}
                        {(isExpanded && !isPlaying) && (
                            <>
                                {(musicSource === 'radio' || musicSource === 'saved') && currentStation && !muteState.isMusicMuted && (
                                    <button 
                                        onClick={() => onOpenSettings()}
                                        className="flex items-center gap-2 min-w-0 max-w-[120px] bg-black/50 hover:bg-black/70 transition-colors p-1 pr-2 rounded-full"
                                        aria-label={`Now playing: ${currentStation.name}. Click to open music settings.`}
                                    >
                                        <img src={currentStation.favicon} alt="" className="w-5 h-5 rounded-sm flex-shrink-0" onError={(e) => e.currentTarget.style.display = 'none'} />
                                        <span className="text-xs font-semibold truncate text-neutral-300">{currentStation.name}</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                    <div className="absolute top-20 right-4 z-40 flex flex-col gap-2">
                        <ControlButton onClick={() => audioManager.toggleSfxMute()} isToggled={muteState.areSfxMuted} onIcon={<SfxOnIcon className="w-5 h-5" />} offIcon={<SfxOffIcon className="w-5 h-5" />} aria-label={muteState.areSfxMuted ? "Unmute Sound Effects" : "Mute Sound Effects"} className="w-10 h-10" />
                        <ControlButton onClick={handleToggleMusic} isToggled={muteState.isMusicMuted} onIcon={<MusicOnIcon className="w-5 h-5" />} offIcon={<MusicOffIcon className="w-5 h-5" />} aria-label={muteState.isMusicMuted ? "Unmute Music" : "Mute Music"} className="w-10 h-10" />
                        {(isExpanded && !isPlaying) && (
                            <ControlButton onClick={() => onOpenSettings()} onIcon={<RadioIcon className="w-5 h-5" />} offIcon={<RadioIcon className="w-5 h-5" />} aria-label="Open Radio Settings" className="w-10 h-10 flex-shrink-0" />
                        )}
                        {(isPlaying || isPaused) && (
                           <ControlButton onClick={onTogglePause} isToggled={isPaused} onIcon={<PauseIcon className="w-7 h-7" />} offIcon={<PlayIcon className="w-7 h-7" />} aria-label={isPaused ? "Resume Game" : "Pause Game"} isDisabled={!isPlaying && !isPaused} className={`w-12 h-12 text-cyan-300 border border-cyan-300/60`} />
                        )}
                    </div>
                </>
            )}

            {/* Menu Toggle Button */}
            {isExpanded && isHudContentVisible && (
                <div className="absolute top-4 left-4 z-40">
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="p-2 w-12 h-12 bg-black/50 rounded-full text-white backdrop-blur-sm transition-all duration-300 hover:bg-black/70 hover:scale-110 flex justify-center items-center"
                        aria-label="Open menu"
                    >
                        <BurgerMenuIcon className="w-6 h-6" />
                    </button>
                </div>
            )}

            {/* HUD Visibility Toggle Button */}
            {isExpanded && showCollapseButton && (
                <div className="absolute top-4 right-4 z-40 flex gap-2">
                    {!isHudContentVisible && (
                         <button
                            onClick={onCycleCamera}
                            className="p-2 w-auto h-12 bg-black/50 rounded-full text-white backdrop-blur-sm transition-all duration-300 hover:bg-black/70 hover:scale-110 flex justify-center items-center px-4"
                            aria-label={`Cycle camera view. Current view: ${cameraView}`}
                        >
                           <CameraIcon className="w-6 h-6 mr-2" />
                           <span className="font-semibold text-sm">{cameraView}</span>
                        </button>
                    )}
                    <button
                        onClick={() => setIsHudContentVisible(!isHudContentVisible)}
                        className="p-2 w-12 h-12 bg-black/50 rounded-full text-white backdrop-blur-sm transition-all duration-300 hover:bg-black/70 hover:scale-110 flex justify-center items-center"
                        aria-label={isHudContentVisible ? "Hide menu" : "Show menu"}
                    >
                        {isHudContentVisible ? <ChevronUpIcon className="w-6 h-6" /> : <ChevronDownIcon className="w-6 h-6" />}
                    </button>
                </div>
            )}

            {/* Active Effects Bar */}
            {displayableEffects.length > 0 && (
                <div className="absolute top-24 sm:top-20 left-1/2 -translate-x-1/2 w-[90%] max-w-xs sm:max-w-sm z-20 flex flex-col gap-2">
                    {displayableEffects.map(effect => <EffectProgressBar key={effect.id} effect={effect} />)}
                </div>
            )}

            {isMenuOpen && (
                <MenuOverlay
                    onClose={() => setIsMenuOpen(false)}
                    isPaused={isPaused}
                    onEndGame={handleEndGame}
                    onOpenHowToPlay={onOpenHowToPlay}
                    onOpenSettings={onOpenSettings}
                    onOpenGraphicsSettings={onOpenGraphicsSettings}
                    onOpenFeedback={onOpenFeedback}
                    onOpenJoinPi={onOpenJoinPi}
                    onOpenAboutSpi={onOpenAboutSpi}
                    onOpenCredits={onOpenCredits}
                    onOpenTerms={onOpenTerms}
                    onOpenPrivacyPolicy={onOpenPrivacyPolicy}
                    piUser={piUser}
                    isRotated={isRotated}
                />
            )}
        </>
    );
};

export default GameHUD;