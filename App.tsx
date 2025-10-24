import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Board, { BoardRef } from './components/Board';
import Controls from './components/Controls';
import GameHUD from './components/GameHUD';
import AdvertisingOverlay from './components/AdvertisingOverlay';
import Leaderboard from './components/Leaderboard';
import SubmitScore from './components/SubmitScore';
import Settings from './components/Settings';
import GraphicsSettings from './components/GraphicsSettings';
import HowToPlayOverlay from './components/HowToPlayOverlay';
import FeedbackOverlay from './components/FeedbackOverlay';
import JoinPiOverlay from './components/JoinPiOverlay';
import CreditsOverlay from './components/CreditsOverlay';
import TermsAndConditionsOverlay from './components/TermsAndConditionsOverlay';
import PrivacyPolicyOverlay from './components/PrivacyPolicyOverlay';
import PiAuthModal from './components/PiAuthModal';
import NonPiBrowserModal from './components/NonPiBrowserModal';
import LinkDeviceModal from './components/LinkDeviceModal';
import EnterCodeModal from './components/EnterCodeModal';
import WhatsNewOverlay from './components/WhatsNewOverlay';
import ExternalLinkWarningModal from './components/ExternalLinkWarningModal';
import BusStopOverlay from './components/BusStopOverlay';
import BusStopChat from './components/BusStopChat';
import SetScreenNameModal from './components/SetScreenNameModal';
import CommunityGuidelinesOverlay from './components/CommunityGuidelinesOverlay';
import MenuOverlay from './components/MenuOverlay';
import CareerProfile from './components/CareerProfile';
import PostRunDebrief from './components/PostRunDebrief';
import { CameraView, Point3D, GameState, Fruit, FruitType, ActiveEffect, LayoutDetails, GameConfig, RadioStation, RadioBrowserStation, ApprovedAd, BillboardData, LeaderboardEntry, GraphicsQuality, PromoCode, UserDTO, ThirdPersonCameraSettings, BusStopSettings, AppNotification, CareerStats, LifeStats, NodeCollection } from './types';
import { BOARD_WIDTH, BOARD_DEPTH, FULL_BOARD_WIDTH, FULL_BOARD_DEPTH, FRUIT_CATEGORIES } from './constants';
import audioManager from './sounds';
import { generateLayoutDetails, isWall, isPortalBlock, getPortalEmergence, getStreetPassageSpawnPoint, isValidSpawnLocation, getBoardSpawnPoint, isStreetPassageBlock, getPortalAbsolutePosition } from './components/gameLogic';
import { isMobile, confirmIsPiBrowser } from './utils/device';
import { fetchLeaderboard } from './utils/leaderboard';
import { getInitialConfig, fetchAndCacheGameConfig } from './utils/gameConfig';
import { fetchApprovedAds, logAdClick, fetchPromoCodes } from './utils/sponsors';
import { SpinnerIcon } from './components/icons';
import { piService } from './utils/pi';
import { logger } from './utils/logger';
import { initFirebase } from './firebase';
import { PI_SANDBOX, VERBOSE_LOGGING } from './config';

const WALL_THICKNESS = (FULL_BOARD_WIDTH - BOARD_WIDTH) / 2;

const LIGHT_SHOW_DURATION = 88000;

const SHOWCASE_CAMERA_CYCLE: CameraView[] = [
  CameraView.ORBIT,
  CameraView.DRONE_1,
  CameraView.DRONE_2,
  CameraView.FIRST_PERSON,
  CameraView.THIRD_PERSON,
];


const createSnakeAtStart = (length: number): Point3D[] => {
  const path: Point3D[] = [];
  const startX = Math.floor(BOARD_WIDTH / 2) + WALL_THICKNESS;
  const maxZ = FULL_BOARD_DEPTH - WALL_THICKNESS - 1;
  
  const headZ = maxZ - 2;

  path.push({ x: startX, y: 1, z: headZ });
  path.push({ x: startX, y: 1, z: headZ + 1 });
  path.push({ x: startX, y: 1, z: maxZ }); 

  const segmentsOnBoard = path.length;
  if (length <= segmentsOnBoard) {
    return path.slice(0, length);
  }

  const verticalSegmentX = startX;
  const verticalSegmentZ = maxZ;
  for (let i = 0; i < length - segmentsOnBoard; i++) {
    path.push({ x: verticalSegmentX, y: 1 + (i + 1), z: verticalSegmentZ });
  }

  return path;
};

const getInitialFruits = (currentSnake: Point3D[], currentLayoutDetails: LayoutDetails, config: GameConfig, totalExtraLivesCollected: number): Fruit[] => {
  const initialFruits: Fruit[] = [];
  const applePos = getBoardSpawnPoint(currentSnake, [], currentLayoutDetails);
  if (applePos) {
    initialFruits.push({ id: Date.now(), type: FruitType.APPLE, position: applePos, spawnTime: performance.now() });
  }
  const passagePos = getStreetPassageSpawnPoint(currentLayoutDetails);
  if (passagePos && isValidSpawnLocation(passagePos, currentSnake, initialFruits, currentLayoutDetails)) {
      let passageFruitType = Math.random() < config.extraLifeChance ? FruitType.EXTRA_LIFE : FruitType.TRIPLE;
      if (passageFruitType === FruitType.EXTRA_LIFE && totalExtraLivesCollected >= config.maxExtraLivesTotal) {
          passageFruitType = FruitType.TRIPLE;
      }
      initialFruits.push({ id: Date.now() + 1, type: passageFruitType, position: passagePos, spawnTime: performance.now() });
  }
  return initialFruits;
};

const determineWeather = (
    extraLivesCollected: number,
    rainOccurrences: number
): 'Clear' | 'Rain' => {
    const hasCollectedExtraLives = extraLivesCollected > 0;
    const hasReachedRainLimit = rainOccurrences >= 1;

    if (!hasCollectedExtraLives && hasReachedRainLimit) {
        return 'Clear';
    }

    const willRain = Math.random() < 0.2;
    return willRain ? 'Rain' : 'Clear';
};

const defaultSavedStations: RadioStation[] = [
    { name: '- 0 N - Chillout on Radio', url: 'https://0n-chillout.radionetz.de/0n-chillout.aac', favicon: 'https://www.0nradio.com/logos/0n-chillout_600x600.jpg' },
    { name: 'Magic Party Mix', url: 'https://live.magicfm.ro/magic.party.mix', favicon: 'https://media.bauerradio.com/image/upload/c_crop,g_custom/v1606492636/brand_manager/stations/agepcxvlmp6fbmslx6tt.jpg' },
];

declare global {
    interface Window {
        preAppLogger?: {
            _queue: string[];
            log: (source: string, ...args: any[]) => void;
        };
    }
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('Loading');
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [layoutDetails, setLayoutDetails] = useState<LayoutDetails | null>(null);
  
  const [snake, setSnake] = useState<{ segments: Point3D[], rotation: number; }>({ segments: [], rotation: 0 });
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [clearingFruits, setClearingFruits] = useState<{ fruit: Fruit; startTime: number }[]>([]);
  
  const [score, setScore] = useState(0);
  const [gameSpeed, setGameSpeed] = useState(0);
  const [baseGameSpeed, setBaseGameSpeed] = useState(0);
  const [lives, setLives] = useState(0);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('snakeHighScore') || '0', 10));
  const [topSpeed, setTopSpeed] = useState(0);
  const [streetFruitBucket, setStreetFruitBucket] = useState<FruitType[]>([]);
  const [extraLivesCollectedThisLife, setExtraLivesCollectedThisLife] = useState(0);
  const [extraLivesCollectedThisGame, setExtraLivesCollectedThisGame] = useState(0);
  const [weather, setWeather] = useState<'Clear' | 'Rain'>('Clear');
  const [rainOccurrencesThisGame, setRainOccurrencesThisGame] = useState(0);

  const [isPassageFruitActive, setIsPassageFruitActive] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [boardFruitCooldown, setBoardFruitCooldown] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(!!document.fullscreenElement);
  const [activeKey, setActiveKey] = useState<'left' | 'right' | null>(null);
  const [isWelcomePanelVisible, setIsWelcomePanelVisible] = useState(false);
  const [isHudContentVisible, setIsHudContentVisible] = useState(true);
  const [isCrashing, setIsCrashing] = useState(false);
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isSubmitScoreOpen, setIsSubmitScoreOpen] = useState(false);
  const [submissionDetails, setSubmissionDetails] = useState<{ isNewHighScore: boolean; qualifiesForLeaderboard: boolean; } | null>(null);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [showHowToPlayBackdrop, setShowHowToPlayBackdrop] = useState(true);
  const [isJoinPiOpen, setIsJoinPiOpen] = useState(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const [isBusStopOpen, setIsBusStopOpen] = useState(false);
  const [isBusStopChatOpen, setIsBusStopChatOpen] = useState(false);
  const [isSetScreenNameModalOpen, setIsSetScreenNameModalOpen] = useState(false);
  const [isCommunityGuidelinesOpen, setIsCommunityGuidelinesOpen] = useState(false);
  const [busStopSettings, setBusStopSettings] = useState<BusStopSettings | null>(() => {
    try {
      const saved = localStorage.getItem('snakeBusStopSettings');
      if (saved) {
        return JSON.parse(saved);
      }
      return null;
    } catch (e) {
      console.warn('Could not read bus stop settings from localStorage.', e);
      return null;
    }
  });
  const [lastGameData, setLastGameData] = useState<{ score: number; level: number; topSpeed: number; } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [cameraView, setCameraView] = useState<CameraView>(CameraView.ORBIT);
  const [lastGameplayView, setLastGameplayView] = useState<CameraView>(() => {
      try {
          const savedView = localStorage.getItem('snakeGameplayView') as CameraView;
          if (savedView === CameraView.FIRST_PERSON || savedView === CameraView.THIRD_PERSON) {
              return savedView;
          }
      } catch (e) {
          console.warn("Could not read 'snakeGameplayView' from localStorage.", e);
      }
      return CameraView.FIRST_PERSON;
  });
  const [gameId, setGameId] = useState(0);
  const [visualRotation, setVisualRotation] = useState(0);
  
  // Settings and Radio State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsFromMenu, setIsSettingsFromMenu] = useState(false);
  const [isGraphicsSettingsOpen, setIsGraphicsSettingsOpen] = useState(false);
  const [isThirdPersonSettingsOpen, setIsThirdPersonSettingsOpen] = useState(false);
  const [thirdPersonCameraSettings, setThirdPersonCameraSettings] = useState<ThirdPersonCameraSettings>(() => {
      try {
          const saved = localStorage.getItem('snakeThirdPersonSettings');
          if (saved) {
              const parsed = JSON.parse(saved);
              if (typeof parsed.distance === 'number' && typeof parsed.height === 'number') {
                  return parsed;
              }
          }
      } catch (e) {
          console.warn('Could not read third person settings from localStorage.', e);
      }
      return { distance: 2.5, height: 1.2 };
  });
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(() => {
      return (localStorage.getItem('snakeGraphicsQuality') as GraphicsQuality) || 'Low';
  });
  const [isLowQualityLightingDisabledPref, setIsLowQualityLightingDisabledPref] = useState<boolean>(() => {
      return localStorage.getItem('snakeDynamicLightingDisabled') === 'true';
  });
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
  const [musicSource, setMusicSource] = useState<'default' | 'radio' | 'saved'>('default');
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(() => {
    try {
      const saved = localStorage.getItem('snake-radio-station');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [radioSearchTerm, setRadioSearchTerm] = useState(() => localStorage.getItem('snake-radio-search-term') || '');
  const [radioStations, setRadioStations] = useState<RadioBrowserStation[]>([]);
  const [isRadioLoading, setIsRadioLoading] = useState(false);
  const [radioError, setRadioError] = useState<string | null>(null);
  const [radioPlaybackError, setRadioPlaybackError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(document.visibilityState === 'visible');
  const [savedStations, setSavedStations] = useState<RadioStation[]>(() => {
    try {
      const saved = localStorage.getItem('snake-saved-stations');
      const parsed = saved ? JSON.parse(saved) : null;
      return (parsed && parsed.length > 0) ? parsed : defaultSavedStations;
    } catch { return defaultSavedStations; }
  });
  const [isBackgroundPlayEnabled, setIsBackgroundPlayEnabled] = useState<boolean>(() => {
      return localStorage.getItem('snake-background-play') === 'true';
  });

  // Pi Browser State
  const [isPiBrowser, setIsPiBrowser] = useState(false);
  const [isRotated, setIsRotated] = useState(false);
  const [isFullScreenSupported, setIsFullScreenSupported] = useState<boolean>(() => {
    return sessionStorage.getItem('snakeFullScreenUnsupported') !== 'true';
  });

  // AMI State
  const [isAmiOpen, setIsAmiOpen] = useState(false);
  const [approvedAds, setApprovedAds] = useState<ApprovedAd[]>([]);
  const [billboardData, setBillboardData] = useState<BillboardData | null>(null);
  const [promoCodes, setPromoCodes] = useState<Map<string, PromoCode>>(new Map());

  // Pi Network State
  const [piUser, setPiUser] = useState<UserDTO | null>(null);
  const [isPiAuthModalOpen, setIsPiAuthModalOpen] = useState(false);
  const [onAuthSuccessCallback, setOnAuthSuccessCallback] = useState<(() => void) | null>(null);
  const [initialOverlayToShow, setInitialOverlayToShow] = useState<string | null>(null);
  const [nonPiBrowserAction, setNonPiBrowserAction] = useState<{ intent: 'submit-score' | 'purchase-ad' | 'link-device' | 'donation'; data?: any } | null>(null);
  const [deepLinkIntent, setDeepLinkIntent] = useState<{ intent: string; data?: any } | null>(null);
  
  // Crash/Respawn/Game Over state
  const [crashOutcome, setCrashOutcome] = useState<'respawn' | 'gameOver' | null>(null);
  const [nextSnake, setNextSnake] = useState<Point3D[] | null>(null);
  const [isGameOverHudVisible, setIsGameOverHudVisible] = useState(false);

  // Linking modals
  const [isLinkDeviceModalOpen, setIsLinkDeviceModalOpen] = useState(false);
  const [isEnterCodeModalOpen, setIsEnterCodeModalOpen] = useState(false);

  // UI pulse animations
  const [showMusicPulse, setShowMusicPulse] = useState(false);
  const [showCameraPulse, setShowCameraPulse] = useState(false);
  
  // Interactive orbit view
  const [isOrbitDragging, setIsOrbitDragging] = useState(false);
  
  // External link warning modal
  const [externalLinkToConfirm, setExternalLinkToConfirm] = useState<string | null>(null);

  // In-game notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  const onOpenLinkDevice = () => setIsLinkDeviceModalOpen(true);
  const onOpenEnterCode = () => setIsEnterCodeModalOpen(true);
  
  // Career Profile & Stats
  const [isCareerProfileOpen, setIsCareerProfileOpen] = useState(false);
  const [careerStats, setCareerStats] = useState<CareerStats | null>(() => {
    try {
      const saved = localStorage.getItem('snakeCareerStats');
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error("Failed to load career stats", e); }
    return {
        totalGridTime: 0, totalDistanceTravelled: 0, allTimeHighScore: 0, highestSingleLifeScore: 0,
        personalBestLifeDuration: 0, nodesCollected: {}, portalsEntered: 0, successfulPassages: 0, failedPassages: 0,
    };
  });
  const onOpenCareerProfile = () => setIsCareerProfileOpen(true);

  // Per-Life Stats & Post-Run Debrief
  const [lifeScore, setLifeScore] = useState(0);
  const [currentLifeStats, setCurrentLifeStats] = useState<Omit<LifeStats, 'score' | 'duration'>>({ startTime: 0, nodesCollected: {}, topSpeed: 0, portalsEntered: 0, successfulPassages: 0 });
  const [lastLifeStats, setLastLifeStats] = useState<LifeStats | null>(null);
  const [isPostRunDebriefOpen, setIsPostRunDebriefOpen] = useState(false);

  const animationFrameRef = useRef<number | null>(null);
  const passageFruitRetryTimer = useRef<number | null>(null);
  const commandQueue = useRef<('left' | 'right')[]>([]);
  const pointerStartPos = useRef<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const shouldGrow = useRef(0);
  const wasAutoPaused = useRef(false);
  const boardRef = useRef<BoardRef>(null);
  const radioApiBaseUrlRef = useRef<string | null>(null);
  const musicPulseTimerRef = useRef<number | null>(null);
  const cameraPulseTimerRef = useRef<number | null>(null);
  const cameraCycleTimerRef = useRef<number | null>(null);

  const snakeRef = useRef(snake); snakeRef.current = snake;
  const fruitsRef = useRef(fruits); fruitsRef.current = fruits;
  const gameSpeedRef = useRef(gameSpeed); gameSpeedRef.current = gameSpeed;
  const layoutDetailsRef = useRef(layoutDetails); layoutDetailsRef.current = layoutDetails;
  const activeEffectsRef = useRef(activeEffects); activeEffectsRef.current = activeEffects;
  const scoreRef = useRef(score); scoreRef.current = score;
  const levelRef = useRef(level); levelRef.current = level;
  const baseGameSpeedRef = useRef(baseGameSpeed); baseGameSpeedRef.current = baseGameSpeed;
  const highScoreRef = useRef(highScore); highScoreRef.current = highScore;
  const topSpeedRef = useRef(topSpeed); topSpeedRef.current = topSpeed;
  const livesRef = useRef(lives); livesRef.current = lives;
  const gameConfigRef = useRef(gameConfig); gameConfigRef.current = gameConfig;
  const streetFruitBucketRef = useRef(streetFruitBucket); streetFruitBucketRef.current = streetFruitBucket;
  const extraLivesCollectedThisLifeRef = useRef(extraLivesCollectedThisLife); extraLivesCollectedThisLifeRef.current = extraLivesCollectedThisLife;
  const extraLivesCollectedThisGameRef = useRef(extraLivesCollectedThisGame); extraLivesCollectedThisGameRef.current = extraLivesCollectedThisGame;
  const rainOccurrencesThisGameRef = useRef(rainOccurrencesThisGame); rainOccurrencesThisGameRef.current = rainOccurrencesThisGame;
  const gameStateRef = useRef(gameState); gameStateRef.current = gameState;
  const isPausedRef = useRef(isPaused); isPausedRef.current = isPaused;
  const isCrashingRef = useRef(isCrashing); isCrashingRef.current = isCrashing;
  const crashOutcomeRef = useRef(crashOutcome); crashOutcomeRef.current = crashOutcome;
  const nextSnakeRef = useRef(nextSnake); nextSnakeRef.current = nextSnake;
  
  const lifeScoreRef = useRef(lifeScore); lifeScoreRef.current = lifeScore;
  const currentLifeStatsRef = useRef(currentLifeStats); currentLifeStatsRef.current = currentLifeStats;

  const isAnyUIOverlayOpen = useMemo(() => {
      return isAmiOpen || isLeaderboardOpen || isSubmitScoreOpen || isHowToPlayOpen || 
             isFeedbackOpen || isWhatsNewOpen || isJoinPiOpen || isCreditsOpen || isTermsOpen || 
             isPrivacyPolicyOpen || isPiAuthModalOpen || !!nonPiBrowserAction || 
             isLinkDeviceModalOpen || isEnterCodeModalOpen || isBusStopOpen || isBusStopChatOpen || 
             isSetScreenNameModalOpen || isGraphicsSettingsOpen || isSettingsOpen || 
             !!externalLinkToConfirm || isCommunityGuidelinesOpen || isMenuOpen || isCareerProfileOpen ||
             isPostRunDebriefOpen;
  }, [
      isAmiOpen, isLeaderboardOpen, isSubmitScoreOpen, isHowToPlayOpen, isFeedbackOpen,
      isWhatsNewOpen, isJoinPiOpen, isCreditsOpen, isTermsOpen, isPrivacyPolicyOpen,
      isPiAuthModalOpen, nonPiBrowserAction, isLinkDeviceModalOpen, isEnterCodeModalOpen,
      isBusStopOpen, isBusStopChatOpen, isSetScreenNameModalOpen, isGraphicsSettingsOpen,
      isSettingsOpen, externalLinkToConfirm, isCommunityGuidelinesOpen, isMenuOpen, isCareerProfileOpen,
      isPostRunDebriefOpen
  ]);
  
  const shouldPauseAnimation = useMemo(() => {
      const modalsThatPause = isAmiOpen || isLeaderboardOpen || isSubmitScoreOpen || 
             isFeedbackOpen || isWhatsNewOpen || isJoinPiOpen || isCreditsOpen || isTermsOpen || 
             isPrivacyPolicyOpen || isPiAuthModalOpen || !!nonPiBrowserAction || 
             isLinkDeviceModalOpen || isEnterCodeModalOpen || 
             isGraphicsSettingsOpen || 
             !!externalLinkToConfirm || isCommunityGuidelinesOpen || isMenuOpen || isCareerProfileOpen ||
             (isHowToPlayOpen && showHowToPlayBackdrop) || // Only pause if opened from menu
             (isSettingsOpen && isSettingsFromMenu) ||
             isPostRunDebriefOpen; // Post-run debrief should pause the background

      return modalsThatPause;
  }, [
      isAmiOpen, isLeaderboardOpen, isSubmitScoreOpen, isHowToPlayOpen, isFeedbackOpen,
      isWhatsNewOpen, isJoinPiOpen, isCreditsOpen, isTermsOpen, isPrivacyPolicyOpen,
      isPiAuthModalOpen, nonPiBrowserAction, isLinkDeviceModalOpen, isEnterCodeModalOpen,
      isGraphicsSettingsOpen, isSettingsOpen, externalLinkToConfirm, isCommunityGuidelinesOpen, isMenuOpen,
      showHowToPlayBackdrop, isSettingsFromMenu, isCareerProfileOpen, isPostRunDebriefOpen
  ]);

  useEffect(() => {
    const unsubscribe = piService.subscribe(setPiUser);
    return unsubscribe;
  }, []);

  const requestPiAuth = useCallback((intent: 'submit-score' | 'purchase-ad' | 'link-device' | 'donation', onSuccess: () => void, data?: any) => {
    if (isPiBrowser) {
        setOnAuthSuccessCallback(() => onSuccess);
        setIsPiAuthModalOpen(true);
    } else {
        setNonPiBrowserAction({ intent, data });
    }
  }, [isPiBrowser]);
  
  const handleRadioError = useCallback(() => {
    setRadioPlaybackError("No playable source was found for this station.");
  }, []);

  const handleOpenAmi = () => {
    logAdClick('View Sponsors');
    setIsAmiOpen(true);
  };
  
  const handleGraphicsQualityChange = (quality: GraphicsQuality) => {
    setGraphicsQuality(quality);
    localStorage.setItem('snakeGraphicsQuality', quality);
  };

  const handleLowQualityLightingPrefChange = (isDisabled: boolean) => {
    setIsLowQualityLightingDisabledPref(isDisabled);
    localStorage.setItem('snakeDynamicLightingDisabled', String(isDisabled));
  };

  const activeDynamicLightingDisabled = useMemo(() => {
    return graphicsQuality === 'Low' && isLowQualityLightingDisabledPref;
  }, [graphicsQuality, isLowQualityLightingDisabledPref]);

  const handleOpenSettings = () => {
    if (musicPulseTimerRef.current) {
        clearTimeout(musicPulseTimerRef.current);
        musicPulseTimerRef.current = null;
    }
    setShowMusicPulse(false);
    setIsSettingsOpen(true);
  };

  const handleLeaderboardUpdate = useCallback((allScores: LeaderboardEntry[]) => {
    const topScores = [...allScores].sort((a, b) => b.score - a.score).slice(0, 3);
    const topSpeeds = [...allScores].sort((a, b) => b.speed - a.speed).slice(0, 3);
    setBillboardData(currentData => {
        if (JSON.stringify(currentData?.topScores) !== JSON.stringify(topScores) ||
            JSON.stringify(currentData?.topSpeeds) !== JSON.stringify(topSpeeds)) {
            return { topScores, topSpeeds };
        }
        return currentData;
    });
  }, []);

  useEffect(() => {
    if ((musicSource === 'radio' || musicSource === 'saved') && currentStation) {
      audioManager.playRadio(currentStation.url, handleRadioError);
    } else {
      audioManager.stopRadio();
    }
  }, [musicSource, currentStation, handleRadioError]);

  useEffect(() => {
    if (musicSource === 'default') {
      audioManager.stopRadio();
      if (gameState === 'Welcome' || gameState === 'GameOver' || (gameState === 'Playing' && isPaused)) {
        audioManager.playLobbyMusic();
      } else if (gameState === 'Playing' && !isPaused) {
        if (isCrashing) {
          audioManager.stopBackgroundMusic();
        } else {
          audioManager.playBackgroundMusic();
        }
      } else {
        audioManager.stopAllDefaultMusic();
      }
    } else {
      if (currentStation) {
        audioManager.stopAllDefaultMusic();
      }
    }
  }, [gameState, isPaused, musicSource, isCrashing, currentStation]);
  
  useEffect(() => {
    if (flashMessage) {
      const timer = setTimeout(() => setFlashMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [flashMessage]);

  useEffect(() => {
    localStorage.setItem('snake-radio-search-term', radioSearchTerm);
  }, [radioSearchTerm]);
  
  useEffect(() => {
    try {
        localStorage.setItem('snake-saved-stations', JSON.stringify(savedStations));
    } catch (e) { console.error("Failed to save stations to localStorage", e); }
  }, [savedStations]);

  useEffect(() => {
    try {
        localStorage.setItem('snakeThirdPersonSettings', JSON.stringify(thirdPersonCameraSettings));
    } catch (e) { console.error("Failed to save third-person camera settings to localStorage", e); }
  }, [thirdPersonCameraSettings]);

  useEffect(() => {
      localStorage.setItem('snake-background-play', String(isBackgroundPlayEnabled));
      audioManager.setAllowBackgroundPlay(isBackgroundPlayEnabled);
  }, [isBackgroundPlayEnabled]);

  useEffect(() => {
    if (!screen.orientation || isPiBrowser) return;

    if (isFullScreen) {
      if (gameState === 'Playing' && !isPaused) {
        if (typeof (screen.orientation as any).lock === 'function') {
          (screen.orientation as any).lock('landscape').catch((err: any) => {});
        }
      } else {
        if (typeof screen.orientation.unlock === 'function') {
          screen.orientation.unlock();
        }
      }
    }
  }, [gameState, isPaused, isFullScreen, isPiBrowser]);

  useEffect(() => {
    const initApp = async () => {
      const hostname = window.location.hostname;
      if (window.preAppLogger) {
        window.preAppLogger.log('[App Init]', `Current hostname: ${hostname}`);
      } else {
        console.log(`[App Init] Current hostname: ${hostname}`);
      }
      
      const detectedPiBrowser = await confirmIsPiBrowser();
      setIsPiBrowser(detectedPiBrowser);
      piService.setIsPiBrowser(detectedPiBrowser);
      
      if (VERBOSE_LOGGING) {
          if (window.preAppLogger?._queue && Array.isArray(window.preAppLogger._queue)) {
              while(window.preAppLogger._queue.length > 0) {
                  const logMsg = window.preAppLogger._queue.shift();
                  if (logMsg) {
                      logger.log(logMsg);
                  }
              }
              window.preAppLogger.log = (source, ...args) => {
                  const message = args.map(String).join(' ');
                  logger.log(`${source} ${message}`);
              };
          }
      } else {
          if (window.preAppLogger) {
              window.preAppLogger._queue = [];
              window.preAppLogger.log = () => {};
          }
      }

      if (window.Pi) {
          logger.log(`App confirmed Pi SDK is initialized. Sandbox mode from config: ${PI_SANDBOX}`);
      }

      if (!detectedPiBrowser) {
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
              .catch(err => {
                logger.log(`Service Worker registration failed: ${err.message}`);
              });
          });
        }
      }
      
      logger.log("Render start: Initializing app and fetching all data.");
      
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const linkCode = urlParams.get('link');
      const adData = hashParams.get('data');
      const path = window.location.pathname.toLowerCase();
      
      if (linkCode) {
          sessionStorage.setItem('hasSeenWelcome', 'true');
          logger.log("Device link detected. Suppressing initial 'How to Play' overlay.");
      }

      if (path.startsWith('/submit-score') && window.location.hash) {
          setDeepLinkIntent({
              intent: 'submit-score',
              data: {
                  score: parseInt(hashParams.get('score') || '0', 10),
                  level: parseInt(hashParams.get('level') || '1', 10),
                  topSpeed: parseFloat(hashParams.get('speed') || '0'),
              }
          });
      } else if (path.startsWith('/start-ad-purchase')) {
          setDeepLinkIntent({ intent: 'purchase-ad' });
      } else if (path.startsWith('/continue-ad-purchase') && adData) {
        try {
            const decodedData = JSON.parse(atob(decodeURIComponent(adData)));
            sessionStorage.setItem('piAdContinuationData', JSON.stringify(decodedData));
        } catch (e) {
            logger.log(`Failed to decode ad continuation data: ${(e as Error).message}`);
            setFlashMessage("Error continuing ad purchase.");
        }
      } else if (path === '/terms') {
          setInitialOverlayToShow('terms');
      } else if (path === '/credits') {
          setInitialOverlayToShow('credits');
      } else if (path === '/privacy') {
          setInitialOverlayToShow('privacy');
      }
      
      await initFirebase();
      audioManager.init();

      const [config, ads, billboardDataResult, promos] = await Promise.all([
          fetchAndCacheGameConfig(),
          fetchApprovedAds(),
          (async () => {
              try {
                  const [mobileScores, computerScores] = await Promise.all([
                      fetchLeaderboard('mobile').catch(() => []),
                      fetchLeaderboard('computer').catch(() => [])
                  ]);
                  const allScores = [...mobileScores, ...computerScores];
                  const topScores = [...allScores].sort((a, b) => b.score - a.score).slice(0, 3);
                  const topSpeeds = [...allScores].sort((a, b) => b.speed - a.speed).slice(0, 3);
                  return { topScores, topSpeeds };
              } catch (error) {
                  logger.log(`Failed to fetch leaderboard data for billboard: ${(error as Error).message}`);
                  return null;
              }
          })(),
          fetchPromoCodes(),
          audioManager.preloadAllSounds()
      ]);
      
      audioManager.setAllowBackgroundPlay(localStorage.getItem('snake-background-play') === 'true');
      
      const effectiveConfig = config || getInitialConfig();
      const layout = generateLayoutDetails();
      
      const initialSnake = createSnakeAtStart(effectiveConfig.initialSnakeLength);
      const initialFruits = getInitialFruits(initialSnake, layout, effectiveConfig, 0);

      setApprovedAds(ads);
      setBillboardData(billboardDataResult);
      setPromoCodes(promos);
      
      setGameConfig(effectiveConfig);
      setLayoutDetails(layout);
      setSnake({ segments: initialSnake, rotation: 0 });
      setFruits(initialFruits);
      setLives(effectiveConfig.initialLives);
      setBaseGameSpeed(effectiveConfig.initialGameSpeed);
      setGameSpeed(effectiveConfig.initialGameSpeed);
      setTopSpeed(1000 / effectiveConfig.initialGameSpeed);
      setIsPassageFruitActive(initialFruits.some(f => FRUIT_CATEGORIES[f.type] === 'PASSAGE'));
      setCameraView(CameraView.ORBIT);
      
      setGameState('Welcome');
      logger.log("Render end: App is ready.");
      
      if (linkCode && !detectedPiBrowser) {
        const validate = async () => {
            try {
                setFlashMessage("Linking account...");
                await piService.validateLinkCode(linkCode);
                setFlashMessage("Account linked successfully!");
            } catch (e) {
                const message = e instanceof Error ? e.message : "Failed to link account.";
                setFlashMessage(message);
            } finally {
                window.history.replaceState({}, document.title, '/');
            }
        };
        validate();
      }
      
      if (path !== '/') {
        window.history.replaceState({}, document.title, '/');
      }
    };

    initApp();

    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  useEffect(() => {
    if (gameState !== 'Welcome' || !isPiBrowser) {
        return;
    }

    const adContinuationData = sessionStorage.getItem('piAdContinuationData');

    if (adContinuationData) {
        const timer = setTimeout(() => {
            try {
                JSON.parse(adContinuationData);
                requestPiAuth('purchase-ad', () => {
                    setIsAmiOpen(true);
                });
            } catch (e) {
                logger.log(`Error with ad continuation data: ${(e as Error).message}`);
                setFlashMessage("Error continuing ad purchase.");
                sessionStorage.removeItem('piAdContinuationData');
            }
        }, 500);
        return () => clearTimeout(timer);
    }

    if (deepLinkIntent) {
        const { intent, data } = deepLinkIntent;
        const timer = setTimeout(() => {
            requestPiAuth(intent as any, () => {
                if (intent === 'submit-score' && data) {
                    setLastGameData(data);
                    setSubmissionDetails({ isNewHighScore: false, qualifiesForLeaderboard: true });
                    setIsSubmitScoreOpen(true);
                } else if (intent === 'purchase-ad') {
                    setIsAmiOpen(true);
                }
            }, data);
        }, 500);

        setDeepLinkIntent(null);
        return () => clearTimeout(timer);
    }
  }, [gameState, isPiBrowser, deepLinkIntent, requestPiAuth, setIsAmiOpen, setFlashMessage, setLastGameData, setSubmissionDetails, setIsSubmitScoreOpen]);
  
  useEffect(() => {
      if (gameState === 'Welcome') {
          const timer = setTimeout(() => {
              setIsWelcomePanelVisible(true);
          }, 3000);
          return () => clearTimeout(timer);
      } else {
          setIsWelcomePanelVisible(false);
      }
  }, [gameState]);
  
  useEffect(() => {
    if (musicPulseTimerRef.current) clearTimeout(musicPulseTimerRef.current);
    if (cameraPulseTimerRef.current) clearTimeout(cameraPulseTimerRef.current);
    setShowMusicPulse(false);
    setShowCameraPulse(false);

    if (gameState === 'Welcome') {
        setShowMusicPulse(true);
        musicPulseTimerRef.current = window.setTimeout(() => {
            setShowMusicPulse(false);
        }, 7000);
    } else if (gameState === 'Playing') {
        setShowCameraPulse(true);
        cameraPulseTimerRef.current = window.setTimeout(() => {
            setShowCameraPulse(false);
        }, 5000);
    }

    return () => {
        if (musicPulseTimerRef.current) clearTimeout(musicPulseTimerRef.current);
        if (cameraPulseTimerRef.current) clearTimeout(cameraPulseTimerRef.current);
    };
  }, [gameState]);

  useEffect(() => {
      if (gameState === 'Welcome' && isWelcomePanelVisible) {
          if (initialOverlayToShow) {
              switch (initialOverlayToShow) {
                  case 'terms':
                      setIsTermsOpen(true);
                      break;
                  case 'credits':
                      setIsCreditsOpen(true);
                      break;
                  case 'privacy':
                      setIsPrivacyPolicyOpen(true);
                      break;
              }
              setInitialOverlayToShow(null);
              sessionStorage.setItem('hasSeenWelcome', 'true');
          } else {
              const hasSeenWelcome = sessionStorage.getItem('hasSeenWelcome');
              if (!hasSeenWelcome) {
                  const timer = setTimeout(() => {
                      setShowHowToPlayBackdrop(false);
                      setIsHowToPlayOpen(true);
                  }, 2000);
                  
                  sessionStorage.setItem('hasSeenWelcome', 'true');
                  
                  return () => clearTimeout(timer);
              }
          }
      }
  }, [gameState, isWelcomePanelVisible, initialOverlayToShow]);

  const isExpanded = (gameState === 'Welcome' && isWelcomePanelVisible) || (gameState === 'GameOver' && isGameOverHudVisible) || isPaused;
  useEffect(() => {
    if (!isExpanded) {
        setIsHudContentVisible(true);
    }
  }, [isExpanded]);

  const handleOpenExternalUrl = (url: string) => {
    setExternalLinkToConfirm(url);
  };
  
  const showNotification = useCallback((message: string, type: 'info' | 'mention') => {
    const newNotification: AppNotification = {
        id: Date.now(),
        message,
        type,
    };
    setNotifications(prev => [...prev, newNotification]);

    setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
    }, 4000);
  }, []);


  useEffect(() => {
    if (gameState !== 'Playing' || isPaused) {
      return;
    }

    const interval = setInterval(() => {
      const now = performance.now();
      setActiveEffects(prevEffects => {
        const nextEffects = prevEffects.filter(effect => {
          if (effect.duration === 0) return true;
          return now < effect.startTime + effect.duration;
        });

        if (nextEffects.length === prevEffects.length) {
          return prevEffects;
        }
        
        return nextEffects;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [gameState, isPaused]);
  
  useEffect(() => {
    if (gameState === 'Playing') {
      setCameraView(lastGameplayView);
    }
  }, [gameState, lastGameplayView]);
  
  useEffect(() => {
    if (gameState === 'GameOver' && lastGameData && isGameOverHudVisible) {
      if (lastGameData.score <= 0) return;

      const checkAndShowPopup = async () => {
        try {
          const isNewLocalHighScore = lastGameData.score === highScore;
          
          const leaderboard = await fetchLeaderboard(isMobile() ? 'mobile' : 'computer');
          const lowestScore = leaderboard.length > 0 ? leaderboard[leaderboard.length - 1].score : 0;
          
          const qualifiesForLeaderboard = (leaderboard.length < 100 || lastGameData.score > lowestScore) && lastGameData.score > 20;

          if (isNewLocalHighScore || qualifiesForLeaderboard) {
              setSubmissionDetails({ isNewHighScore: isNewLocalHighScore, qualifiesForLeaderboard });
              setIsSubmitScoreOpen(true);
          }

        } catch (error) {
          logger.log(`Failed to fetch leaderboard for score check: ${(error as Error).message}`);
          const isNewLocalHighScore = lastGameData.score === highScore;
          if (isNewLocalHighScore) {
              setSubmissionDetails({ isNewHighScore: true, qualifiesForLeaderboard: false });
              setIsSubmitScoreOpen(true);
          }
        }
      };

      setTimeout(checkAndShowPopup, 2000);
    }
  }, [gameState, lastGameData, isGameOverHudVisible, highScore]);

  useEffect(() => {
    if (clearingFruits.length === 0) return;
    const CLEAR_DURATION = 1000;
    const interval = setInterval(() => {
        const now = performance.now();
        setClearingFruits(prev => prev.filter(cf => now < cf.startTime + CLEAR_DURATION));
    }, 200);
    return () => clearInterval(interval);
  }, [clearingFruits]);

  const finalizeGameOver = useCallback(() => {
    boardRef.current?.triggerLightEvent('gameOver', {});
    if (scoreRef.current > highScoreRef.current) {
      setHighScore(scoreRef.current);
      localStorage.setItem('snakeHighScore', scoreRef.current.toString());
    }
    setLastGameData({ score: scoreRef.current, level: levelRef.current, topSpeed: topSpeedRef.current });
    setIsGameOverHudVisible(false);
    setGameState('GameOver');
    setCameraView(CameraView.ORBIT);
    if(isPiBrowser || !isFullScreenSupported) setIsRotated(false);
  }, [isPiBrowser, isFullScreenSupported]);
  
  const handleGameOverAnimationComplete = useCallback(() => {
    setTimeout(() => {
        setIsGameOverHudVisible(true);
    }, 500);
  }, []);

  const handleCrash = useCallback((crashedHead: Point3D, finalRotation: number) => {
    boardRef.current?.triggerLightEvent('crash', { position: crashedHead });
    audioManager.playCrashSound();
    setIsCrashing(true);
    
    setSnake(prevSnake => ({
      ...prevSnake,
      rotation: finalRotation
    }));
  
    const newLives = livesRef.current - 1;
    setLives(newLives);

    setCareerStats(prev => prev ? ({ ...prev, failedPassages: prev.failedPassages + 1 }) : prev);

    if (newLives >= 0) { // Changed to >= 0 to handle debrief on last life
        setCrashOutcome('respawn');
        if (newLives > 0) {
            const startingSnake = createSnakeAtStart(gameConfigRef.current!.initialSnakeLength);
            setNextSnake(startingSnake);
        }
    } else {
        setCrashOutcome('gameOver');
        setNextSnake(null);
    }

    setGameState('Crashed');

  }, []);

  const handleContinueFromDebrief = useCallback(() => {
    setIsPostRunDebriefOpen(false);
    setLastLifeStats(null);

    // This is the respawn logic
    setActiveEffects([]);
    setBaseGameSpeed(gameConfigRef.current!.initialGameSpeed);
    
    const startingSnake = nextSnakeRef.current!;
    setSnake({ segments: startingSnake, rotation: 0 });
    commandQueue.current = [];
    setExtraLivesCollectedThisLife(0);
    setVisualRotation(0);
    
    setLifeScore(0);
    setCurrentLifeStats({ startTime: performance.now(), nodesCollected: {}, topSpeed: 0, portalsEntered: 0, successfulPassages: 0 });

    const newWeather = determineWeather(extraLivesCollectedThisGameRef.current, rainOccurrencesThisGameRef.current);
    setWeather(newWeather);
    if (newWeather === 'Rain') {
        setRainOccurrencesThisGame(occurrences => occurrences + 1);
    }

    const newFruits = getInitialFruits(startingSnake, layoutDetailsRef.current!, gameConfigRef.current!, extraLivesCollectedThisGameRef.current);
    setFruits(newFruits);
    setIsPassageFruitActive(newFruits.some(f => FRUIT_CATEGORIES[f.type] === 'PASSAGE'));

    audioManager.playGameStartSound();
    audioManager.advanceTrack();
    
    setGameState('Starting');

    setTimeout(() => {
      if (gameStateRef.current === 'Starting') {
          setGameState('Playing');
      }
    }, 4000);

    setCrashOutcome(null);
    setNextSnake(null);
  }, []);

  const handleFinalizeGame = useCallback(() => {
      setIsPostRunDebriefOpen(false);
      setLastLifeStats(null);
      finalizeGameOver();
  }, [finalizeGameOver]);

  const handleEndGameFromDebrief = useCallback(() => {
    setIsPostRunDebriefOpen(false);
    setLastLifeStats(null);
    handleResetToWelcome();
  }, []);

  const handleCrashAscendAnimationComplete = useCallback(() => {
    setIsCrashing(false);

    const outcome = crashOutcomeRef.current;
    
    // Always calculate stats, whether it's a respawn or the final life.
    const duration = (performance.now() - currentLifeStatsRef.current.startTime) / 1000;
    const finalLifeStats: LifeStats = { ...currentLifeStatsRef.current, score: lifeScoreRef.current, duration };
    setLastLifeStats(finalLifeStats);

    setCareerStats(prevStats => {
        if (!prevStats) return null;
        
        const newNodesCollected: NodeCollection = { ...prevStats.nodesCollected };
        for (const key in finalLifeStats.nodesCollected) {
            const fruitType = key as unknown as FruitType;
            newNodesCollected[fruitType] = (newNodesCollected[fruitType] || 0) + finalLifeStats.nodesCollected[fruitType]!;
        }

        const updatedStats: CareerStats = {
            ...prevStats,
            totalGridTime: prevStats.totalGridTime + duration,
            allTimeHighScore: Math.max(prevStats.allTimeHighScore, scoreRef.current),
            highestSingleLifeScore: Math.max(prevStats.highestSingleLifeScore, finalLifeStats.score),
            personalBestLifeDuration: Math.max(prevStats.personalBestLifeDuration, duration),
            nodesCollected: newNodesCollected,
            portalsEntered: prevStats.portalsEntered + finalLifeStats.portalsEntered,
            successfulPassages: prevStats.successfulPassages + finalLifeStats.successfulPassages,
        };
        
        try {
            localStorage.setItem('snakeCareerStats', JSON.stringify(updatedStats));
        } catch (e) { console.error("Failed to save career stats", e); }
        
        return updatedStats;
    });

    if (outcome === 'gameOver' || livesRef.current <= 0) {
        // This is the final life, trigger the new game over sequence.
        setTimeout(() => {
            audioManager.playGameOverSound();
            setIsPostRunDebriefOpen(true);
        }, 2000);
    } else if (outcome === 'respawn') {
        // This is a regular respawn with lives left.
        setTimeout(() => {
            setIsPostRunDebriefOpen(true);
        }, 2000);
    }
  }, [finalizeGameOver]);

  const handleStartGame = useCallback(() => {
    audioManager.playGameStartSound();
    setIsPaused(false);
    setIsCrashing(false);

    audioManager.advanceTrack();
    
    const layoutForGame = generateLayoutDetails();
    setLayoutDetails(layoutForGame);
    
    const startingSnake = createSnakeAtStart(gameConfigRef.current!.initialSnakeLength);
    setSnake({ segments: startingSnake, rotation: 0 });
    
    const initialFruitsForGame = getInitialFruits(startingSnake, layoutForGame, gameConfigRef.current!, 0);
    setFruits(initialFruitsForGame);
    setClearingFruits([]);
    setIsPassageFruitActive(initialFruitsForGame.some(f => FRUIT_CATEGORIES[f.type] === 'PASSAGE'));
    
    commandQueue.current = [];
    shouldGrow.current = 0;
    setScore(0);
    setLevel(1);
    setLives(gameConfigRef.current!.initialLives);
    setBaseGameSpeed(gameConfigRef.current!.initialGameSpeed);
    setGameSpeed(gameConfigRef.current!.initialGameSpeed);
    setTopSpeed(1000 / gameConfigRef.current!.initialGameSpeed);
    setActiveEffects([]);
    setLastGameData(null);
    setIsGameOverHudVisible(false);
    setStreetFruitBucket([]);
    setExtraLivesCollectedThisLife(0);
    setExtraLivesCollectedThisGame(0);
    setVisualRotation(0);
    setLifeScore(0);
    setCurrentLifeStats({ startTime: performance.now(), nodesCollected: {}, topSpeed: 0, portalsEntered: 0, successfulPassages: 0 });
    
    const initialWeather = determineWeather(0, 0);
    setWeather(initialWeather);
    setRainOccurrencesThisGame(initialWeather === 'Rain' ? 1 : 0);
    
    setCameraView(CameraView.ORBIT); // Reset camera to a neutral state before starting.
    setGameId(id => id + 1);
    setGameState('Starting');

    setTimeout(() => {
      setGameState('Playing');
    }, 4000);
  }, []);

  const handleResetToWelcome = useCallback(() => {
    const config = gameConfigRef.current!;
    const newLayout = generateLayoutDetails();
    setLayoutDetails(newLayout);

    const startingSnake = createSnakeAtStart(config.initialSnakeLength);
    setSnake({ segments: startingSnake, rotation: 0 });
    
    const initialFruitsForGame = getInitialFruits(startingSnake, newLayout, config, 0);
    setFruits(initialFruitsForGame);
    setClearingFruits([]);
    setIsPassageFruitActive(initialFruitsForGame.some(f => FRUIT_CATEGORIES[f.type] === 'PASSAGE'));

    commandQueue.current = [];
    shouldGrow.current = 0;
    setScore(0);
    setLevel(1);
    setLives(config.initialLives);
    setBaseGameSpeed(config.initialGameSpeed);
    setGameSpeed(config.initialGameSpeed);
    setTopSpeed(1000 / config.initialGameSpeed);
    setActiveEffects([]);
    setLastGameData(null);
    
    setGameState('Welcome');
    setIsPaused(false);

    setIsGameOverHudVisible(false);
    setVisualRotation(0);
    setIsCrashing(false);
    setWeather('Clear');
    setCameraView(CameraView.ORBIT);
    if (isPiBrowser || !isFullScreenSupported) setIsRotated(false);
  }, [isPiBrowser, isFullScreenSupported]);

  const handleTurn = useCallback((direction: 'left' | 'right') => {
    if (gameState !== 'Playing' || isPaused || isCrashing) return;
    if (direction === 'left') audioManager.playTurnLeftSound(); else audioManager.playTurnRightSound();
    if (commandQueue.current.length < 2) {
      commandQueue.current.push(direction);
      setVisualRotation(rot => {
        let newRot = rot + (direction === 'left' ? Math.PI / 2 : -Math.PI / 2);
        while (newRot > Math.PI) newRot -= 2 * Math.PI;
        while (newRot <= -Math.PI) newRot += 2 * Math.PI;
        return newRot;
      });
    }
    setActiveKey(direction);
    setTimeout(() => setActiveKey(null), 150);
  }, [gameState, isPaused, isCrashing]);
  
  const handleTogglePause = useCallback(() => {
    if (gameStateRef.current !== 'Playing' || isCrashingRef.current) return;

    setIsPaused(wasPaused => {
      if (wasPaused) {
        setCameraView(lastGameplayView);
        audioManager.advanceTrack();
      }
      return !wasPaused;
    });
  }, [lastGameplayView]);

  useEffect(() => {
    const handleVisibilityChange = () => {
        const isHidden = document.visibilityState === 'hidden';
        setIsPageVisible(!isHidden);

        if (isHidden) {
            audioManager.suspend();
            if (gameStateRef.current === 'Playing' && !isPausedRef.current) {
                wasAutoPaused.current = true;
                handleTogglePause();
            }
        } else {
            audioManager.resume();
            if (wasAutoPaused.current) {
                wasAutoPaused.current = false;
                handleTogglePause();
            }
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleTogglePause]);

  const handleToggleFullScreen = useCallback(() => {
    if (isPiBrowser) return;
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            if (screen.orientation && typeof (screen.orientation as any).lock === 'function') {
                (screen.orientation as any).lock('landscape').catch((err: any) => {
                    console.warn("Could not lock screen to landscape:", err);
                });
            }
        }).catch((err) => {
            console.warn("Fullscreen request failed:", err);
            setIsFullScreenSupported(false);
            try {
                sessionStorage.setItem('snakeFullScreenUnsupported', 'true');
            } catch (e) {
                console.error("Failed to set sessionStorage for fullscreen support.", e);
            }
        });
    } else {
        if (screen.orientation && typeof screen.orientation.unlock === 'function') {
            screen.orientation.unlock();
        }
        document.exitFullscreen().catch(err => console.error(err));
    }
  }, [isPiBrowser]);
  
  const handleToggleRotate = useCallback(() => {
    setIsRotated(prev => !prev);
  }, []);
  
  const handleCycleCamera = useCallback(() => {
      const isGameplayActive = gameState === 'Playing' && !isPaused && !isCrashing;
      if (isGameplayActive) return;
      
      setCameraView(prev => {
          const currentIndex = SHOWCASE_CAMERA_CYCLE.indexOf(prev);
          const nextIndex = (currentIndex + 1) % SHOWCASE_CAMERA_CYCLE.length;
          return SHOWCASE_CAMERA_CYCLE[nextIndex];
      });
  }, [gameState, isPaused, isCrashing]);

  useEffect(() => {
    const clearCameraCycleTimer = () => {
        if (cameraCycleTimerRef.current) {
            clearTimeout(cameraCycleTimerRef.current);
            cameraCycleTimerRef.current = null;
        }
    };

    const isIdleShowcase = ((gameState === 'Welcome' && isWelcomePanelVisible) || (gameState === 'GameOver' && isGameOverHudVisible));
    
    if (isIdleShowcase && isHudContentVisible) {
        const scheduleNextCameraChange = () => {
            clearCameraCycleTimer();

            const currentIndex = SHOWCASE_CAMERA_CYCLE.indexOf(cameraView);
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % SHOWCASE_CAMERA_CYCLE.length;
            const nextView = SHOWCASE_CAMERA_CYCLE[nextIndex];
            
            let currentViewDuration = LIGHT_SHOW_DURATION;
            if (cameraView === CameraView.FIRST_PERSON || cameraView === CameraView.THIRD_PERSON) {
                currentViewDuration = LIGHT_SHOW_DURATION / 2;
            }

            cameraCycleTimerRef.current = window.setTimeout(() => {
                setCameraView(nextView);
            }, currentViewDuration);
        };
        
        scheduleNextCameraChange();
    } else {
        clearCameraCycleTimer();
    }

    return clearCameraCycleTimer;
  }, [gameState, isWelcomePanelVisible, isGameOverHudVisible, isHudContentVisible, cameraView]);

  const handleToggleGameplayView = useCallback(() => {
      if (cameraPulseTimerRef.current) {
          clearTimeout(cameraPulseTimerRef.current);
          cameraPulseTimerRef.current = null;
      }
      setShowCameraPulse(false);

      if (gameStateRef.current !== 'Playing' || isCrashingRef.current) return;
      setCameraView(prev => {
          const newView = prev === CameraView.FIRST_PERSON ? CameraView.THIRD_PERSON : CameraView.FIRST_PERSON;
          setLastGameplayView(newView);
          try {
              localStorage.setItem('snakeGameplayView', newView);
          } catch (e) {
              console.warn("Could not save 'snakeGameplayView' to localStorage.", e);
          }
          return newView;
      });
  }, []);

    const searchRadioStations = useCallback(async (term: string) => {
        if (!term.trim()) return;

        setIsRadioLoading(true);
        setRadioError(null);
        setRadioStations([]);

        try {
            const masterServerListUrls = [
                'https://de1.api.radio-browser.info/json/servers',
                'https://fr1.api.radio-browser.info/json/servers',
                'https://nl1.api.radio-browser.info/json/servers',
                'https://de2.api.radio-browser.info/json/servers',
            ].sort(() => Math.random() - 0.5);

            let servers: { name: string }[] | null = null;
            for (const url of masterServerListUrls) {
                try {
                    const serverListResponse = await fetch(url, { signal: AbortSignal.timeout(3000) });
                    if (serverListResponse.ok) {
                        const data = await serverListResponse.json();
                        if (Array.isArray(data) && data.length > 0) {
                            servers = data;
                            logger.log(`Successfully fetched server list from: ${url}`);
                            break;
                        }
                    }
                } catch (e) {
                    logger.log(`Failed to fetch server list from ${url}, trying next...`);
                }
            }
            
            if (!servers || servers.length === 0) {
                throw new Error('Could not fetch radio server list from any master server.');
            }

            const shuffledServers = servers.sort(() => Math.random() - 0.5);
            let searchSuccess = false;

            for (const server of shuffledServers) {
                const baseUrl = `https://${server.name}/json`;
                const searchUrl = `${baseUrl}/stations/byname/${encodeURIComponent(term)}?limit=50&hidebroken=true&order=clickcount&reverse=true`;
                
                try {
                    const response = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
                    if (!response.ok) throw new Error(`API request failed with status ${response.status}`);

                    const results: RadioBrowserStation[] = await response.json();
                    if (!Array.isArray(results)) throw new Error("API did not return a valid list of stations.");
                    
                    setRadioStations(results);
                    radioApiBaseUrlRef.current = baseUrl;
                    searchSuccess = true;
                    break;
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'An unknown error occurred.';
                    logger.log(`Search on ${baseUrl} failed: ${message}. Trying next server...`);
                }
            }

            if (!searchSuccess) {
                throw new Error("All available radio servers failed to respond.");
            }

        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unknown error occurred.';
            logger.log(`Could not fetch radio stations: ${message}`);
            setRadioError("Could not fetch stations. The public radio API may be temporarily down. Please try again later.");
            radioApiBaseUrlRef.current = null;
        } finally {
            setIsRadioLoading(false);
        }
    }, []);

    const handleStationSelect = useCallback((station: RadioStation) => {
        setCurrentStation(station);
        localStorage.setItem('snake-radio-station', JSON.stringify(station));

        if (audioManager.getMuteState().isMusicMuted) {
            audioManager.toggleMusicMute();
        }
    }, []);
    
    const handleMusicSourceChange = useCallback((source: 'default' | 'radio' | 'saved') => {
        setMusicSource(source);
        if (source === 'radio' && radioStations.length === 0) {
            const termToSearch = radioSearchTerm || 'hits';
            if (!radioSearchTerm) {
                setRadioSearchTerm(termToSearch);
            }
            searchRadioStations(termToSearch);
        }
    }, [radioStations.length, searchRadioStations, radioSearchTerm]);
    
    const handleToggleSaveStation = useCallback((station: RadioStation | null) => {
        if (!station) return;
        setSavedStations(prevStations => {
            const isSaved = prevStations.some(s => s.url === station.url);
            if (isSaved) {
                return prevStations.filter(s => s.url !== station.url);
            } else {
                return [...prevStations, station];
            }
        });
    }, []);
  
  const handleOpenHowToPlay = () => {
    setShowHowToPlayBackdrop(true);
    setIsHowToPlayOpen(true);
  };
  
  const handleConfirmScreenName = (name: string) => {
    const newSettings: BusStopSettings = {
      chatterName: name,
      autoRefreshOnClose: true,
      autoRefreshInterval: 5,
      notificationsOn: true,
      notifyOnMention: true,
      notifyOnNewActivity: false,
      notificationSoundOn: true,
      mutedUsers: []
    };
    try {
        localStorage.setItem('snakeBusStopSettings', JSON.stringify(newSettings));
    } catch (e) {
        console.error("Failed to save bus stop settings to localStorage", e);
    }
    setBusStopSettings(newSettings);
    setIsSetScreenNameModalOpen(false);
    setIsBusStopChatOpen(true);
  };

  const handleContinueToChat = () => {
    setIsBusStopOpen(false);
    if (busStopSettings?.chatterName && piUser) {
        setIsBusStopChatOpen(true);
    } else if (piUser) {
        setIsSetScreenNameModalOpen(true);
    } else {
        requestPiAuth('link-device', () => {
            setIsSetScreenNameModalOpen(true);
        });
    }
  };

  const handleOpenBusStop = () => {
    if (piUser && busStopSettings?.chatterName) {
        setIsBusStopChatOpen(true);
    } else {
        setIsBusStopOpen(true);
    }
  };
  
  useEffect(() => {
    if (gameState === 'Playing' && !isPaused && !isCrashing) {
        let speedMultiplier = 1.0;
        if (activeEffects.some(e => e.type === FruitType.SPEED_BOOST)) {
            speedMultiplier = 1 / gameConfigRef.current!.speedBoostFactor;
        }
        const newGameSpeed = Math.max(50, baseGameSpeed * speedMultiplier);
        setGameSpeed(newGameSpeed);
        const currentSpeedMps = 1000 / newGameSpeed;
        if (currentSpeedMps > topSpeedRef.current) setTopSpeed(currentSpeedMps);
        setCurrentLifeStats(prev => ({ ...prev, topSpeed: Math.max(prev.topSpeed, currentSpeedMps) }));
    }
  }, [gameState, isPaused, activeEffects, baseGameSpeed, isCrashing]);

  useEffect(() => {
    if (gameState !== 'Playing' || isPaused || !gameConfig) return;
    const intervalId = setInterval(() => {
      const boardFruit = fruitsRef.current.find(f => FRUIT_CATEGORIES[f.type] === 'BOARD');
      if (boardFruit && (performance.now() - boardFruit.spawnTime > gameConfig.boardFruitLifetime)) {
        setFruits(prev => prev.filter(f => f.id !== boardFruit.id));
        setBoardFruitCooldown(true);
        setTimeout(() => setBoardFruitCooldown(false), gameConfig.boardFruitCooldown);
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [gameState, isPaused, gameConfig]);

  useEffect(() => {
    if (gameState !== 'Playing' || isPaused || boardFruitCooldown || !gameConfig) return;
    const intervalId = setInterval(() => {
        if (fruitsRef.current.some(f => FRUIT_CATEGORIES[f.type] === 'BOARD')) return;
        
        const config = gameConfigRef.current!;
        const currentSpeedMps = 1000 / baseGameSpeedRef.current;
        
        let possibleBoardTypes = [FruitType.SCORE_DOUBLER, FruitType.MAGNET];

        if (currentSpeedMps >= config.slowDownSpeedThreshold) {
            if (Math.random() < config.highSpeedSpeedBoostChance) {
                possibleBoardTypes.push(FruitType.SPEED_BOOST);
            }
            for (let i = 0; i < config.slowDownFrequencyMultiplier; i++) {
                possibleBoardTypes.push(FruitType.SLOW_DOWN);
            }
        } else {
            possibleBoardTypes.push(FruitType.SPEED_BOOST);
        }

        const newType = possibleBoardTypes[Math.floor(Math.random() * possibleBoardTypes.length)];
        const newPos = getBoardSpawnPoint(snakeRef.current.segments, fruitsRef.current, layoutDetailsRef.current!);
        if (newPos) setFruits(prev => [...prev, { id: Date.now(), type: newType, position: newPos, spawnTime: performance.now() }]);
    }, gameConfig.boardFruitSpawnDelay);
    return () => clearInterval(intervalId);
  }, [gameState, isPaused, boardFruitCooldown, gameConfig]);

  useEffect(() => {
    if (gameState !== 'Playing' || isPaused || !gameConfig) {
        if (passageFruitRetryTimer.current) clearTimeout(passageFruitRetryTimer.current);
        passageFruitRetryTimer.current = null;
        return;
    }
    const attemptPassageFruitSpawn = () => {
        if (fruitsRef.current.some(f => FRUIT_CATEGORIES[f.type] === 'PASSAGE')) return;
        const newPos = getStreetPassageSpawnPoint(layoutDetailsRef.current!);
        if (newPos && isValidSpawnLocation(newPos, snakeRef.current.segments, fruitsRef.current, layoutDetailsRef.current!)) {
            let bucket = [...streetFruitBucketRef.current];
            if (bucket.length === 0) {
                const config = gameConfigRef.current!;
                const newBucketContents: FruitType[] = [];
                for(let i = 0; i < config.streetFruitBucketTripleCount; i++) newBucketContents.push(FruitType.TRIPLE);
                
                if (extraLivesCollectedThisLifeRef.current < config.maxExtraLivesPerLife && extraLivesCollectedThisGameRef.current < config.maxExtraLivesTotal) {
                    for(let i = 0; i < config.streetFruitBucketExtraLifeCount; i++) newBucketContents.push(FruitType.EXTRA_LIFE);
                }
                
                for (let i = newBucketContents.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [newBucketContents[i], newBucketContents[j]] = [newBucketContents[j], newBucketContents[i]];
                }
                bucket = newBucketContents;
            }

            const newType = bucket.pop()!;
            setStreetFruitBucket(bucket);

            setFruits(prev => [...prev, { id: Date.now(), type: newType, position: newPos, spawnTime: performance.now() }]);
            boardRef.current?.triggerLightEvent('passageFruitSpawned', { fruitType: newType });
            setIsPassageFruitActive(true);
            if (passageFruitRetryTimer.current) clearTimeout(passageFruitRetryTimer.current);
            passageFruitRetryTimer.current = null;
        } else {
            if (passageFruitRetryTimer.current) clearTimeout(passageFruitRetryTimer.current);
            passageFruitRetryTimer.current = window.setTimeout(attemptPassageFruitSpawn, gameConfig.passageFruitRetryDelay);
        }
    };
    const intervalId = setInterval(attemptPassageFruitSpawn, gameConfig.passageFruitSpawnDelay);
    return () => {
        clearInterval(intervalId);
        if (passageFruitRetryTimer.current) clearTimeout(passageFruitRetryTimer.current);
        passageFruitRetryTimer.current = null;
    };
  }, [gameState, isPaused, gameConfig]);

  useEffect(() => {
    if (gameState === 'Playing' && !isPaused && !isCrashing) {
        const passageFruit = fruitsRef.current.find(f => FRUIT_CATEGORIES[f.type] === 'PASSAGE');
        if (passageFruit) {
            boardRef.current?.triggerLightEvent('passageFruitSpawned', { fruitType: passageFruit.type });
        }
    }
  }, [gameState, isPaused, isCrashing, gameId]);

  const gameTick = useCallback(() => {
    const { segments: prevSegments, rotation: prevRotation } = snakeRef.current;
    if (prevSegments.length === 0) return;
    const command = commandQueue.current.shift();
    let nextRotation = prevRotation + (command ? (command === 'left' ? Math.PI / 2 : -Math.PI / 2) : 0);
    
    if (command) {
        boardRef.current?.triggerLightEvent('turn', {
            position: prevSegments[0],
            rotation: nextRotation,
        });
    }

    const head = prevSegments[0];
    let newHead = { x: head.x - Math.round(Math.sin(nextRotation)), y: head.y, z: head.z - Math.round(Math.cos(nextRotation)) };
    const enteredPortal = isPortalBlock(newHead, layoutDetailsRef.current!.portals);
    if (enteredPortal) {
        boardRef.current?.triggerLightEvent('portalWake', { position: { ...newHead }, portalType: enteredPortal.type });
        boardRef.current?.triggerLightEvent('portal', { position: newHead });
        audioManager.playPortalSound();
        const { pos, rot } = getPortalEmergence(enteredPortal, layoutDetailsRef.current!.portals);
        newHead = pos; 
        nextRotation = rot;
        setVisualRotation(rot);
        
        const exitPortal = layoutDetailsRef.current!.portals.find(p => p.type === enteredPortal.type && p.id !== enteredPortal.id)!;
        const exitPortalPos = getPortalAbsolutePosition(exitPortal);
        boardRef.current?.triggerLightEvent('portalWake', { position: exitPortalPos, portalType: exitPortal.type });
        setCurrentLifeStats(prev => ({ ...prev, portalsEntered: prev.portalsEntered + 1 }));
    }

    const wasInPassage = isStreetPassageBlock(head.x, head.z, layoutDetailsRef.current!.street);
    const isInPassage = isStreetPassageBlock(newHead.x, newHead.z, layoutDetailsRef.current!.street);
    if (wasInPassage && !isInPassage) {
        boardRef.current?.triggerLightEvent('snakeExitedPassage', {});
        setCurrentLifeStats(prev => ({ ...prev, successfulPassages: prev.successfulPassages + 1 }));
    }
    
    while (nextRotation > Math.PI) nextRotation -= 2 * Math.PI;
    while (nextRotation <= -Math.PI) nextRotation += 2 * Math.PI;

    if (isWall(newHead, layoutDetailsRef.current!) || prevSegments.slice(1).some(s => s.x === newHead.x && s.z === newHead.z)) {
        handleCrash(newHead, nextRotation); 
        return;
    }
    
    setCareerStats(prev => prev ? ({ ...prev, totalDistanceTravelled: prev.totalDistanceTravelled + prevSegments.length }) : prev);
    
    const isMagnetActive = activeEffectsRef.current.some(e => e.type === FruitType.MAGNET);
    const eatenFruits = fruitsRef.current.filter(f => isMagnetActive ? Math.abs(f.position.x - newHead.x) <= 1 && Math.abs(f.position.z - newHead.z) <= 1 : f.position.x === newHead.x && f.position.z === newHead.z);

    if (eatenFruits.length > 0) {
        let points = 0, growth = 0, livesGained = 0;
        const newEffects: ActiveEffect[] = [];
        const eatenIds = new Set(eatenFruits.map(f => f.id));
        const isDoublerActive = activeEffectsRef.current.some(e => e.type === FruitType.SCORE_DOUBLER);
        const isTripleActive = activeEffectsRef.current.some(e => e.type === FruitType.TRIPLE);
        const newNodesCollected: NodeCollection = {};

        eatenFruits.forEach(fruit => {
            newNodesCollected[fruit.type] = (newNodesCollected[fruit.type] || 0) + 1;
            boardRef.current?.triggerLightEvent('fruitEaten', {
                position: fruit.position,
                fruitType: fruit.type,
                isScoreDoublerActive: isDoublerActive,
                isTripleActive: isTripleActive,
                isMagnetActive: isMagnetActive,
            });
        });
        setCurrentLifeStats(prev => {
            const mergedNodes: NodeCollection = { ...prev.nodesCollected };
            for(const key in newNodesCollected) {
                const fruitType = key as unknown as FruitType;
                mergedNodes[fruitType] = (mergedNodes[fruitType] || 0) + newNodesCollected[fruitType]!;
            }
            return { ...prev, nodesCollected: mergedNodes };
        });

        const eatenAppleCount = eatenFruits.filter(f => f.type === FruitType.APPLE).length;
        if (eatenAppleCount > 0) {
            let pointsPerApple;
            if (isTripleActive && isDoublerActive) {
                pointsPerApple = 5;
            } else if (isTripleActive) {
                pointsPerApple = 3;
            } else if (isDoublerActive) {
                pointsPerApple = 2;
            } else {
                pointsPerApple = gameConfigRef.current!.appleScore;
            }
            points += eatenAppleCount * pointsPerApple;
            growth += eatenAppleCount * (isTripleActive ? 3 : 1);
            
            if (isTripleActive) audioManager.playTripleSound();
            else if (isDoublerActive) audioManager.playScoreDoublerSound();
            else if (isMagnetActive) audioManager.playMagnetSound();
            else audioManager.playAppleSound();
            
            setBaseGameSpeed(gs => {
              const currentSpeedMps = 1000 / gs;
              const speedIncreaseMps = (gameConfigRef.current!.speedIncreasePerApple / 5) * eatenAppleCount;
              const newSpeedMps = currentSpeedMps + speedIncreaseMps;
              const newInterval = 1000 / newSpeedMps;
              return Math.max(50, newInterval);
            });
        }
        
        const otherEatenFruits = eatenFruits.filter(f => f.type !== FruitType.APPLE);
        otherEatenFruits.forEach(f => {
            const getEffectDuration = (type: FruitType): number => {
              switch (type) {
                  case FruitType.SPEED_BOOST: return gameConfigRef.current!.speedBoostDuration;
                  case FruitType.MAGNET: return gameConfigRef.current!.magnetDuration;
                  case FruitType.SCORE_DOUBLER: return gameConfigRef.current!.scoreDoublerDuration;
                  case FruitType.TRIPLE: return gameConfigRef.current!.tripleDuration;
                  case FruitType.SLOW_DOWN: case FruitType.EXTRA_LIFE: return 3000;
                  default: return 0;
              }
            };

            switch (f.type) {
                case FruitType.SLOW_DOWN: 
                    setBaseGameSpeed(gs => gs + gameConfigRef.current!.slowDownEffectValue); 
                    newEffects.push({id: f.id, type: f.type, startTime: performance.now(), duration: getEffectDuration(f.type)}); 
                    audioManager.playSlowDownSound(); 
                    break;
                case FruitType.EXTRA_LIFE: 
                    livesGained++; 
                    newEffects.push({id: f.id, type: f.type, startTime: performance.now(), duration: getEffectDuration(f.type)}); 
                    audioManager.playExtraLifeSound(); 
                    break;
                default: 
                    newEffects.push({id: f.id, type: f.type, startTime: performance.now(), duration: getEffectDuration(f.type)});
                    if (f.type === FruitType.SPEED_BOOST) audioManager.playSpeedBoostSound();
                    else if (f.type === FruitType.MAGNET) audioManager.playMagnetSound();
                    else if (f.type === FruitType.SCORE_DOUBLER) audioManager.playScoreDoublerSound();
                    else if (f.type === FruitType.TRIPLE) audioManager.playTripleSound();
                    break;
            }
        });
        
        if (points > 0) {
            setLifeScore(ls => ls + points);
            setScore(s => { 
                const newS = s + points; 
                if (Math.floor(newS / gameConfigRef.current!.pointsPerLevel) > Math.floor(s / gameConfigRef.current!.pointsPerLevel)) { 
                    setLevel(l => l + 1); 
                    audioManager.playLevelUpSound();
                    boardRef.current?.triggerLightEvent('levelUp', {});
                } 
                return newS; 
            });
        }
        if (growth > 0) shouldGrow.current += growth; 
        if (livesGained > 0) {
            setLives(l => l + livesGained);
            setExtraLivesCollectedThisLife(c => c + livesGained);
            setExtraLivesCollectedThisGame(c => c + livesGained);
        }
        if (newEffects.length > 0) setActiveEffects(p => [...p.filter(e => !newEffects.some(ne => ne.type === e.type)), ...newEffects]);
        
        const fruitsToClear = fruitsRef.current.filter(f => eatenIds.has(f.id));
        if (fruitsToClear.length > 0) {
            setClearingFruits(prev => [...prev, ...fruitsToClear.map(fruit => ({ fruit, startTime: performance.now() }))]);
        }
        
        let nextFruits = fruitsRef.current.filter(f => !eatenIds.has(f.id));
        if (eatenAppleCount > 0) {
            const futureSnake = [newHead, ...snakeRef.current.segments];
            for (let i = 0; i < eatenAppleCount; i++) { 
                const p = getBoardSpawnPoint(futureSnake, nextFruits, layoutDetailsRef.current!); 
                if(p) nextFruits.push({id: Date.now() + i, type: FruitType.APPLE, position: p, spawnTime: performance.now()}); 
            } 
        }
        setFruits(nextFruits);

        const eatenPassageFruit = eatenFruits.some(f => FRUIT_CATEGORIES[f.type] === 'PASSAGE');
        if (eatenPassageFruit) {
            setIsPassageFruitActive(false);
        }
    }

    setSnake({ segments: [newHead, ...prevSegments.slice(0, prevSegments.length - (shouldGrow.current > 0 ? 0 : 1))], rotation: nextRotation });
    if (shouldGrow.current > 0) shouldGrow.current--;
  }, [handleCrash]);

  useEffect(() => {
    if (gameState !== 'Playing' || isPaused || isCrashing) {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        return;
    }

    let lastFrameTime = performance.now();
    let timeSinceLastTick = 0;

    const animationLoop = (timestamp: number) => {
        const deltaTime = timestamp - lastFrameTime;
        lastFrameTime = timestamp;
        timeSinceLastTick += deltaTime;

        const currentInterval = gameSpeedRef.current;

        while (timeSinceLastTick >= currentInterval) {
            gameTick();
            timeSinceLastTick -= currentInterval;
        }
        
        animationFrameRef.current = requestAnimationFrame(animationLoop);
    };

    lastFrameTime = performance.now();
    timeSinceLastTick = 0;
    animationFrameRef.current = requestAnimationFrame(animationLoop);

    return () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    };
  }, [gameState, isPaused, isCrashing, gameTick]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'p' || e.key === ' ') { e.preventDefault(); handleTogglePause(); return; }
      if (gameState !== 'Playing' || isPaused || isCrashing) return;
      if (e.key === 'ArrowLeft') handleTurn('left'); else if (e.key === 'ArrowRight') handleTurn('right');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleTurn, isPaused, handleTogglePause, isCrashing]);
  
  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (isAnyUIOverlayOpen) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea')) return;

    e.preventDefault();
      
    const isOrbitInteractable = cameraView === CameraView.ORBIT && isExpanded && !isHudContentVisible;
    if (isOrbitInteractable) {
        setIsOrbitDragging(true);
        pointerStartPos.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
    }

    pointerStartPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (isAnyUIOverlayOpen) return;
    if (isOrbitDragging && pointerStartPos.current) {
        const dragDelta = isRotated ? (e.clientY - pointerStartPos.current.y) : (e.clientX - pointerStartPos.current.x);
        boardRef.current?.handleOrbitDrag(dragDelta);
        pointerStartPos.current.x = e.clientX;
        pointerStartPos.current.y = e.clientY;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (isAnyUIOverlayOpen) {
        if (pointerStartPos.current) {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            pointerStartPos.current = null;
            setIsOrbitDragging(false);
        }
        return;
    }

    const wasOrbitDragging = isOrbitDragging;
    if (wasOrbitDragging) {
        setIsOrbitDragging(false);
    }
    if (!pointerStartPos.current) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    const deltaX = e.clientX - pointerStartPos.current.x;
    const deltaY = e.clientY - pointerStartPos.current.y;
    const swipeThreshold = 50;
    const tapThreshold = 10;

    if (Math.abs(deltaX) < tapThreshold && Math.abs(deltaY) < tapThreshold) {
        pointerStartPos.current = null;
        return;
    }

    pointerStartPos.current = null;

    if (isMobile() && isExpanded) {
      if (isRotated) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > swipeThreshold) {
          if (deltaX < 0 && isHudContentVisible) { setIsHudContentVisible(false); return; }
          if (deltaX > 0 && !isHudContentVisible) { setIsHudContentVisible(true); return; }
        }
      } else {
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > swipeThreshold) {
          if (deltaY < 0 && isHudContentVisible) { setIsHudContentVisible(false); return; }
          if (deltaY > 0 && !isHudContentVisible) { setIsHudContentVisible(true); return; }
        }
      }
    }
    
    if (wasOrbitDragging) return;

    const effectiveDeltaX = isRotated ? deltaY : deltaX;
    const effectiveDeltaY = isRotated ? -deltaX : deltaY;
    if (gameState !== 'Playing' || isPaused || isCrashing) return;
    if (Math.abs(effectiveDeltaX) > Math.abs(effectiveDeltaY) && Math.abs(effectiveDeltaX) > 30) {
        handleTurn(effectiveDeltaX > 0 ? 'right' : 'left');
    }
  };

  const passageFruitLocation = fruits.find(f => FRUIT_CATEGORIES[f.type] === 'PASSAGE')?.position || null;

  if (gameState === 'Loading') {
      return (
          <div className="w-full h-full bg-neutral-900 flex flex-col items-center justify-center text-white font-sans">
              <SpinnerIcon className="w-16 h-16 animate-spin text-cyan-400" />
              <p className="mt-4 text-2xl font-bold tracking-widest">LOADING...</p>
          </div>
      );
  }

  const isPlayingAndNotPaused = gameState === 'Playing' && !isPaused && !isCrashing;
  const isOrbitInteractable = cameraView === CameraView.ORBIT && isExpanded && !isHudContentVisible;
  const shouldPreventTouchScroll = !isAnyUIOverlayOpen && (isPlayingAndNotPaused || isOrbitInteractable);

  return (
    <main 
      ref={mainRef} tabIndex={-1}
      className={`relative bg-neutral-800 text-white overflow-hidden font-sans outline-none ${isRotated ? 'pi-browser-rotated' : 'w-full h-full'} ${shouldPreventTouchScroll ? 'touch-none' : ''}`}
      onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerMove={handlePointerMove}
    >
      <div aria-live="polite" aria-atomic="true" className="fixed top-4 right-4 z-[100] w-full max-w-sm space-y-2">
          {notifications.map(notification => (
              <div key={notification.id} className="p-3 rounded-lg shadow-lg text-white animate-notification" style={{ backgroundColor: notification.type === 'mention' ? 'rgba(255, 51, 204, 0.8)' : 'rgba(0, 255, 255, 0.8)', backdropFilter: 'blur(10px)' }}>
                  <p className="font-bold text-sm">{notification.type === 'mention' ? 'New Mention!' : 'New Message'}</p>
                  <p className="text-sm">{notification.message}</p>
              </div>
          ))}
      </div>
      <GameHUD
        gameState={gameState} isPaused={isPaused} onTogglePause={handleTogglePause} isFullScreen={isFullScreen} onToggleFullScreen={handleToggleFullScreen}
        score={score} level={level} lives={lives} gameSpeed={gameSpeed} onStartGame={handleStartGame}
        highScore={highScore} topSpeed={topSpeed} isWelcomePanelVisible={isWelcomePanelVisible}
        activeEffects={activeEffects} onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenSettings={() => {
            setIsSettingsFromMenu(false);
            handleOpenSettings();
        }}
        onOpenGraphicsSettings={() => setIsGraphicsSettingsOpen(true)}
        onOpenAmi={handleOpenAmi}
        onOpenHowToPlay={handleOpenHowToPlay}
        musicSource={musicSource}
        currentStation={currentStation}
        flashMessage={flashMessage}
        cameraView={cameraView}
        onCycleCamera={handleCycleCamera}
        onToggleGameplayView={handleToggleGameplayView}
        isHudContentVisible={isHudContentVisible}
        setIsHudContentVisible={setIsHudContentVisible}
        onResetToWelcome={handleResetToWelcome}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        onOpenWhatsNew={() => setIsWhatsNewOpen(true)}
        onOpenJoinPi={() => setIsJoinPiOpen(true)}
        onOpenCredits={() => setIsCreditsOpen(true)}
        onOpenTerms={() => setIsTermsOpen(true)}
        onOpenPrivacyPolicy={() => setIsPrivacyPolicyOpen(true)}
        piUser={piUser}
        requestPiAuth={requestPiAuth}
        isPiBrowser={isPiBrowser}
        isFullScreenSupported={isFullScreenSupported}
        isRotated={isRotated}
        onToggleRotate={handleToggleRotate}
        isSettingsOpen={isSettingsOpen}
        isGameOverHudVisible={isGameOverHudVisible}
        onOpenLinkDevice={onOpenLinkDevice}
        onOpenEnterCode={onOpenEnterCode}
        showMusicPulse={showMusicPulse}
        showCameraPulse={showCameraPulse}
        isThirdPersonSettingsOpen={isThirdPersonSettingsOpen}
        onToggleThirdPersonSettings={() => setIsThirdPersonSettingsOpen(p => !p)}
        thirdPersonCameraSettings={thirdPersonCameraSettings}
        onThirdPersonCameraSettingsChange={setThirdPersonCameraSettings}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        onOpenBusStop={handleOpenBusStop}
      />
      <Board
        ref={boardRef} gameState={gameState} zoom={zoom} cameraView={cameraView} lastGameplayView={lastGameplayView}
        snakeSegments={snake.segments} snakeRotation={snake.rotation} visualRotation={visualRotation}
        fruits={fruits} clearingFruits={clearingFruits} gameSpeed={gameSpeed}
        layoutDetails={layoutDetails!} isCrashing={isCrashing} isPaused={isPaused}
        isPassageFruitActive={isPassageFruitActive}
        passageFruitLocation={passageFruitLocation}
        approvedAds={approvedAds} billboardData={billboardData}
        graphicsQuality={graphicsQuality} isPageVisible={isPageVisible}
        weather={weather} score={score} level={level}
        activeEffects={activeEffects}
        crashOutcome={crashOutcome}
        onCrashAscendAnimationComplete={handleCrashAscendAnimationComplete}
        onGameOverAnimationComplete={handleGameOverAnimationComplete}
        nextSnake={nextSnake}
        isOrbitDragging={isOrbitDragging}
        thirdPersonCameraSettings={thirdPersonCameraSettings}
        isAnyModalOpen={shouldPauseAnimation}
        isDynamicLightingDisabled={activeDynamicLightingDisabled}
      />
      <Controls onTurnLeft={() => handleTurn('left')} onTurnRight={() => handleTurn('right')} gameState={gameState} activeKey={activeKey} isPaused={isPaused} isHudVisible={isHudContentVisible} />
      
      {isAmiOpen && gameConfig && <AdvertisingOverlay onClose={() => setIsAmiOpen(false)} approvedAds={approvedAds} gameConfig={gameConfig} promoCodes={promoCodes} onOpenTerms={() => setIsTermsOpen(true)} requestPiAuth={requestPiAuth} piUser={piUser} isRotated={isRotated} onOpenExternalUrl={handleOpenExternalUrl} isPiBrowser={isPiBrowser} />}
      {isLeaderboardOpen && <Leaderboard onClose={() => setIsLeaderboardOpen(false)} onLeaderboardUpdate={handleLeaderboardUpdate} isRotated={isRotated} />}
      {isSubmitScoreOpen && lastGameData && submissionDetails && <SubmitScore onClose={() => setIsSubmitScoreOpen(false)} scoreData={lastGameData} requestPiAuth={requestPiAuth} isRotated={isRotated} submissionDetails={submissionDetails} piUser={piUser} />}
      {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} musicSource={musicSource} onMusicSourceChange={handleMusicSourceChange} currentStation={currentStation} onStationSelect={handleStationSelect} radioSearchTerm={radioSearchTerm} onRadioSearchTermChange={setRadioSearchTerm} radioStations={radioStations} isRadioLoading={isRadioLoading} radioError={radioError} searchRadioStations={searchRadioStations} isRotated={isRotated} isBackgroundPlayEnabled={isBackgroundPlayEnabled} onIsBackgroundPlayEnabledChange={setIsBackgroundPlayEnabled} savedStations={savedStations} onToggleSaveStation={handleToggleSaveStation} showBackdrop={isSettingsFromMenu} radioPlaybackError={radioPlaybackError} onClearRadioPlaybackError={() => setRadioPlaybackError(null)} />}
      {isGraphicsSettingsOpen && <GraphicsSettings onClose={() => setIsGraphicsSettingsOpen(false)} currentQuality={graphicsQuality} onQualityChange={handleGraphicsQualityChange} isRotated={isRotated} isDynamicLightingDisabled={isLowQualityLightingDisabledPref} onDynamicLightingChange={handleLowQualityLightingPrefChange} />}
      {isHowToPlayOpen && <HowToPlayOverlay onClose={() => setIsHowToPlayOpen(false)} isRotated={isRotated} showBackdrop={showHowToPlayBackdrop} />}
      {isFeedbackOpen && <FeedbackOverlay onClose={() => setIsFeedbackOpen(false)} isRotated={isRotated} />}
      {isWhatsNewOpen && <WhatsNewOverlay onClose={() => setIsWhatsNewOpen(false)} isRotated={isRotated} piUser={piUser} requestPiAuth={requestPiAuth} />}
      {isJoinPiOpen && <JoinPiOverlay onClose={() => setIsJoinPiOpen(false)} isRotated={isRotated} onOpenExternalUrl={handleOpenExternalUrl} />}
      {isCreditsOpen && <CreditsOverlay onClose={() => setIsCreditsOpen(false)} isRotated={isRotated} onOpenExternalUrl={handleOpenExternalUrl} />}
      {isTermsOpen && <TermsAndConditionsOverlay onClose={() => setIsTermsOpen(false)} isRotated={isRotated} />}
      {isPrivacyPolicyOpen && <PrivacyPolicyOverlay onClose={() => setIsPrivacyPolicyOpen(false)} isRotated={isRotated} onOpenExternalUrl={handleOpenExternalUrl} />}
      {isPiAuthModalOpen && <PiAuthModal onClose={() => setIsPiAuthModalOpen(false)} onSuccess={() => { setIsPiAuthModalOpen(false); if (onAuthSuccessCallback) { onAuthSuccessCallback(); setOnAuthSuccessCallback(null); } }} isRotated={isRotated} />}
      {nonPiBrowserAction && <NonPiBrowserModal action={nonPiBrowserAction} onClose={() => setNonPiBrowserAction(null)} isRotated={isRotated} />}
      {isLinkDeviceModalOpen && <LinkDeviceModal onClose={() => setIsLinkDeviceModalOpen(false)} isRotated={isRotated} />}
      {isEnterCodeModalOpen && <EnterCodeModal onClose={() => setIsEnterCodeModalOpen(false)} onSuccess={() => { setFlashMessage('Account linked successfully!'); setIsEnterCodeModalOpen(false); }} isRotated={isRotated} />}
      {externalLinkToConfirm && <ExternalLinkWarningModal url={externalLinkToConfirm} onClose={() => setExternalLinkToConfirm(null)} onConfirm={() => { piService.openUrl(externalLinkToConfirm); setExternalLinkToConfirm(null); }} isRotated={isRotated} />}
      {isBusStopOpen && <BusStopOverlay onClose={() => setIsBusStopOpen(false)} isRotated={isRotated} piUser={piUser} isPiBrowser={isPiBrowser} onContinue={handleContinueToChat} onOpenLinkAccount={onOpenEnterCode} onOpenJoinPi={() => setIsJoinPiOpen(true)} onOpenTerms={() => setIsTermsOpen(true)} onOpenPrivacyPolicy={() => setIsPrivacyPolicyOpen(true)} onOpenCommunityGuidelines={() => setIsCommunityGuidelinesOpen(true)} />}
      {isBusStopChatOpen && piUser && busStopSettings && <BusStopChat onClose={() => setIsBusStopChatOpen(false)} isRotated={isRotated} piUser={piUser} settings={busStopSettings} onSettingsChange={setBusStopSettings} showNotification={showNotification} onOpenCommunityGuidelines={() => setIsCommunityGuidelinesOpen(true)} />}
      {isSetScreenNameModalOpen && piUser && <SetScreenNameModal onClose={() => setIsSetScreenNameModalOpen(false)} isRotated={isRotated} piUsername={piUser.username} onConfirm={handleConfirmScreenName} />}
      {isCommunityGuidelinesOpen && <CommunityGuidelinesOverlay onClose={() => setIsCommunityGuidelinesOpen(false)} isRotated={isRotated} />}
      {isMenuOpen && (
          <MenuOverlay
            onClose={() => setIsMenuOpen(false)} isPaused={isPaused} onEndGame={handleResetToWelcome}
            onOpenHowToPlay={() => { setIsHowToPlayOpen(true); setShowHowToPlayBackdrop(true); }}
            onOpenSettings={() => { setIsSettingsOpen(true); setIsSettingsFromMenu(true); }}
            onOpenGraphicsSettings={() => setIsGraphicsSettingsOpen(true)}
            
// FIX: Simplified MenuOverlay props. The MenuOverlay component handles closing itself
// via its `onClose` prop, so explicitly calling `setIsMenuOpen(false)` here was redundant.
            onOpenFeedback={() => setIsFeedbackOpen(true)}
            onOpenWhatsNew={() => setIsWhatsNewOpen(true)}
            onOpenJoinPi={() => setIsJoinPiOpen(true)}
            onOpenCredits={() => setIsCreditsOpen(true)}
            onOpenTerms={() => setIsTermsOpen(true)}
            onOpenPrivacyPolicy={() => setIsPrivacyPolicyOpen(true)}
            piUser={piUser} isRotated={isRotated} isPiBrowser={isPiBrowser}
            onOpenLinkDevice={onOpenLinkDevice} onOpenEnterCode={onOpenEnterCode} requestPiAuth={requestPiAuth}
            onOpenCareerProfile={onOpenCareerProfile}
          />
      )}
      {isCareerProfileOpen && careerStats && (
        <CareerProfile
            onClose={() => setIsCareerProfileOpen(false)}
            isRotated={isRotated}
            piUser={piUser}
            stats={careerStats}
        />
      )}
      {isPostRunDebriefOpen && lastLifeStats && (
        <PostRunDebrief
          stats={lastLifeStats}
          totalScore={score}
          livesLeft={lives}
          onContinue={handleContinueFromDebrief}
          onEndGame={lives > 0 ? handleEndGameFromDebrief : handleFinalizeGame}
          isRotated={isRotated}
        />
      )}
    </main>
  );
};

export default App;
