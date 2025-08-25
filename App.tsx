

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import AboutSpiOverlay from './components/AboutSpiOverlay';
import CreditsOverlay from './components/CreditsOverlay';
import TermsAndConditionsOverlay from './components/TermsAndConditionsOverlay';
import PrivacyPolicyOverlay from './components/PrivacyPolicyOverlay';
import PiAuthModal from './components/PiAuthModal';
import { CameraView, Point3D, GameState, Fruit, FruitType, ActiveEffect, LayoutDetails, GameConfig, RadioStation, RadioBrowserStation, ApprovedAd, BillboardData, LeaderboardEntry, GraphicsQuality, PromoCode, UserDTO } from './types';
import { BOARD_WIDTH, BOARD_DEPTH, FULL_BOARD_WIDTH, FULL_BOARD_DEPTH, FRUIT_CATEGORIES, VIEW_CYCLE } from './constants';
import audioManager from './sounds';
import { generateLayoutDetails, isWall, isPortalBlock, getPortalEmergence, getStreetPassageSpawnPoint, isValidSpawnLocation, getBoardSpawnPoint } from './components/gameLogic';
import { isMobile, isPiBrowser as checkIsPiBrowser } from './utils/device';
import { fetchLeaderboard } from './utils/leaderboard';
import { getInitialConfig, fetchAndCacheGameConfig } from './utils/gameConfig';
import { fetchApprovedAds, logAdClick, fetchPromoCodes } from './utils/sponsors';
import { SpinnerIcon } from './components/icons';
import { piService } from './utils/pi';

const WALL_THICKNESS = (FULL_BOARD_WIDTH - BOARD_WIDTH) / 2;

const createSnakeAtStart = (length: number): Point3D[] => {
  const path: Point3D[] = [];
  const startX = Math.floor(BOARD_WIDTH / 2) + WALL_THICKNESS;
  const maxZ = FULL_BOARD_DEPTH - WALL_THICKNESS - 1;
  
  const headZ = maxZ - 2;

  // First segments are on the board, leading straight to the back wall.
  // The snake's head will be at path[0], facing towards negative Z.
  path.push({ x: startX, y: 1, z: headZ });
  path.push({ x: startX, y: 1, z: headZ + 1 });
  path.push({ x: startX, y: 1, z: maxZ }); // This is z = maxZ, at the wall boundary.

  const segmentsOnBoard = path.length;
  if (length <= segmentsOnBoard) {
    return path.slice(0, length);
  }

  // The rest of the snake's body goes straight up from the wall.
  const verticalSegmentX = startX;
  const verticalSegmentZ = maxZ;
  for (let i = 0; i < length - segmentsOnBoard; i++) {
    // y starts at 2 because y=1 is the board.
    path.push({ x: verticalSegmentX, y: 1 + (i + 1), z: verticalSegmentZ });
  }

  return path;
};

const getInitialFruits = (currentSnake: Point3D[], currentLayoutDetails: LayoutDetails, config: GameConfig, totalExtraLivesCollected: number): Fruit[] => {
  const initialFruits: Fruit[] = [];
  const applePos = getBoardSpawnPoint(currentSnake, [], currentLayoutDetails);
  if (applePos) {
    initialFruits.push({ id: Date.now(), type: FruitType.APPLE, position: applePos });
  }
  // For initial spawn, we still use the simple chance, bucket will be used for subsequent spawns.
  const passagePos = getStreetPassageSpawnPoint(currentLayoutDetails);
  if (passagePos && isValidSpawnLocation(passagePos, currentSnake, initialFruits, currentLayoutDetails)) {
      let passageFruitType = Math.random() < config.extraLifeChance ? FruitType.EXTRA_LIFE : FruitType.TRIPLE;
      if (passageFruitType === FruitType.EXTRA_LIFE && totalExtraLivesCollected >= config.maxExtraLivesTotal) {
          passageFruitType = FruitType.TRIPLE;
      }
      initialFruits.push({ id: Date.now() + 1, type: passageFruitType, position: passagePos });
  }
  return initialFruits;
};


const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('Loading');
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [layoutDetails, setLayoutDetails] = useState<LayoutDetails | null>(null);
  
  const [snake, setSnake] = useState<{ segments: Point3D[], rotation: number; }>({ segments: [], rotation: 0 });
  const [fruits, setFruits] = useState<Fruit[]>([]);
  
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

  const [isPassageFruitActive, setIsPassageFruitActive] = useState(false);
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
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isJoinPiOpen, setIsJoinPiOpen] = useState(false);
  const [isAboutSpiOpen, setIsAboutSpiOpen] = useState(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const [lastGameData, setLastGameData] = useState<{ score: number; level: number; topSpeed: number; } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [cameraView, setCameraView] = useState<CameraView>(CameraView.ORBIT);
  const [gameId, setGameId] = useState(0);
  
  // Settings and Radio State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGraphicsSettingsOpen, setIsGraphicsSettingsOpen] = useState(false);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(() => {
      return (localStorage.getItem('snakeGraphicsQuality') as GraphicsQuality) || 'Medium';
  });
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
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
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(document.visibilityState === 'visible');
  const [savedStations, setSavedStations] = useState<RadioStation[]>(() => {
    try {
      const saved = localStorage.getItem('snake-saved-stations');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isBackgroundPlayEnabled, setIsBackgroundPlayEnabled] = useState<boolean>(() => {
      return localStorage.getItem('snake-background-play') === 'true';
  });

  // Pi Browser State
  const [isPiBrowser, setIsPiBrowser] = useState(false);
  const [isRotated, setIsRotated] = useState(false);

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

  const animationFrameRef = useRef<number | null>(null);
  const passageFruitRetryTimer = useRef<number | null>(null);
  const commandQueue = useRef<('left' | 'right')[]>([]);
  const pointerStartPos = useRef<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const shouldGrow = useRef(0);
  const wasAutoPaused = useRef(false);
  const boardRef = useRef<BoardRef>(null);

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
  const gameStateRef = useRef(gameState); gameStateRef.current = gameState;
  const isPausedRef = useRef(isPaused); isPausedRef.current = isPaused;
  const isCrashingRef = useRef(isCrashing); isCrashingRef.current = isCrashing;
  
  useEffect(() => {
    const unsubscribe = piService.subscribe(setPiUser);
    return unsubscribe;
  }, []);
  
  useEffect(() => {
    // When the rotation state changes, the CSS takes a moment to apply.
    // We wait for that, then manually tell the Board component to resize its canvas.
    const timer = setTimeout(() => {
      boardRef.current?.handleResize();
    }, 100); // A small delay is enough for the DOM to update.

    return () => clearTimeout(timer);
  }, [isRotated]);

  const requestPiAuth = (onSuccess: () => void) => {
    setOnAuthSuccessCallback(() => onSuccess);
    setIsPiAuthModalOpen(true);
  };
  
  const handleRadioError = useCallback(() => {
    setFlashMessage("No playable source found for station.");
  }, []);

  const handleOpenAmi = () => {
    logAdClick('View Sponsors');
    setIsAmiOpen(true);
  };
  
  const handleGraphicsQualityChange = (quality: GraphicsQuality) => {
    setGraphicsQuality(quality);
    localStorage.setItem('snakeGraphicsQuality', quality);
  };

  const handleLeaderboardUpdate = useCallback((allScores: LeaderboardEntry[]) => {
    console.log("Leaderboard opened, refreshing billboard data...");
    const topScores = [...allScores].sort((a, b) => b.score - a.score).slice(0, 3);
    const topSpeeds = [...allScores].sort((a, b) => b.speed - a.speed).slice(0, 3);
    setBillboardData(currentData => {
        // Only update if there's a material change to avoid unnecessary re-renders
        if (JSON.stringify(currentData?.topScores) !== JSON.stringify(topScores) ||
            JSON.stringify(currentData?.topSpeeds) !== JSON.stringify(topSpeeds)) {
            return { topScores, topSpeeds };
        }
        return currentData;
    });
  }, []);

  // Radio Music Effect - plays uninterrupted by game state changes
  useEffect(() => {
    if ((musicSource === 'radio' || musicSource === 'saved') && currentStation) {
      audioManager.playRadio(currentStation.url, handleRadioError);
    } else {
      audioManager.stopRadio();
    }
  }, [musicSource, currentStation, handleRadioError]);

  // Default Music Effect - handles lobby and background music
  useEffect(() => {
    if (musicSource === 'default') {
      audioManager.stopRadio(); // Ensure radio is off
      if (gameState === 'Welcome' || gameState === 'GameOver' || (gameState === 'Playing' && isPaused)) {
        audioManager.playLobbyMusic();
      } else if (gameState === 'Playing' && !isPaused) {
        if (isCrashing) {
          audioManager.stopBackgroundMusic();
        } else {
          audioManager.playBackgroundMusic();
        }
      } else { // e.g. 'Starting' or 'Loading' state
        audioManager.stopAllDefaultMusic();
      }
    } else {
      // Music source is radio, so stop all default music.
      audioManager.stopAllDefaultMusic();
    }
  }, [gameState, isPaused, musicSource, isCrashing]);
  
  // Flash message handler
  useEffect(() => {
    if (flashMessage) {
      const timer = setTimeout(() => setFlashMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [flashMessage]);

  // Persist radio search term
  useEffect(() => {
    localStorage.setItem('snake-radio-search-term', radioSearchTerm);
  }, [radioSearchTerm]);
  
  // Persist saved stations
  useEffect(() => {
    try {
        localStorage.setItem('snake-saved-stations', JSON.stringify(savedStations));
    } catch (e) { console.error("Failed to save stations to localStorage", e); }
  }, [savedStations]);

  // Persist and apply background play setting
  useEffect(() => {
      localStorage.setItem('snake-background-play', String(isBackgroundPlayEnabled));
      audioManager.setAllowBackgroundPlay(isBackgroundPlayEnabled);
  }, [isBackgroundPlayEnabled]);

  // Dynamic screen orientation management for fullscreen mode
  useEffect(() => {
    if (!screen.orientation || isPiBrowser) return;

    if (isFullScreen) {
      if (gameState === 'Playing' && !isPaused) {
        // When gameplay is active, lock to landscape
        if (typeof (screen.orientation as any).lock === 'function') {
          (screen.orientation as any).lock('landscape').catch((err: any) => {
              console.warn("Could not re-lock screen to landscape:", err);
          });
        }
      } else {
        // When in menus (paused, game over, etc.), unlock to allow portrait reading
        if (typeof screen.orientation.unlock === 'function') {
          screen.orientation.unlock();
        }
      }
    }
    // No `else` needed because `handleToggleFullScreen` handles unlocking on fullscreen exit.
  }, [gameState, isPaused, isFullScreen, isPiBrowser]);

  // Main initialization effect
  useEffect(() => {
    const isRunningInPiBrowser = checkIsPiBrowser();
    setIsPiBrowser(isRunningInPiBrowser);

    const initApp = async () => {
        console.log("Render start: Initializing app and fetching all data.");

        // Handle direct navigation to "pages"
        const path = window.location.pathname.toLowerCase();
        if (path === '/terms') {
            setInitialOverlayToShow('terms');
            window.history.replaceState({}, document.title, '/');
        } else if (path === '/credits') {
            setInitialOverlayToShow('credits');
            window.history.replaceState({}, document.title, '/');
        } else if (path === '/about') {
            setInitialOverlayToShow('about');
            window.history.replaceState({}, document.title, '/');
        } else if (path === '/privacy') {
            setInitialOverlayToShow('privacy');
            window.history.replaceState({}, document.title, '/');
        }

        // Fetch all necessary data concurrently during the loading screen.
        const [config, ads, billboardDataResult, promos] = await Promise.all([
            fetchAndCacheGameConfig(),
            fetchApprovedAds(),
            (async () => { // Wrap billboard fetch in an async function to handle errors
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
                    console.error("Failed to fetch leaderboard data for billboard:", error);
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
        console.log("Render end: App is ready.");
    };

    initApp();

    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);
  
  // Welcome HUD timer
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
  
  // Effect to handle opening overlays from a direct URL
  useEffect(() => {
      if (gameState === 'Welcome' && isWelcomePanelVisible && initialOverlayToShow) {
          switch (initialOverlayToShow) {
              case 'terms':
                  setIsTermsOpen(true);
                  break;
              case 'credits':
                  setIsCreditsOpen(true);
                  break;
              case 'about':
                  setIsAboutSpiOpen(true);
                  break;
              case 'privacy':
                  setIsPrivacyPolicyOpen(true);
                  break;
          }
          // Clear the trigger so it doesn't re-open on game over etc.
          setInitialOverlayToShow(null);
      }
  }, [gameState, isWelcomePanelVisible, initialOverlayToShow]);

  const isExpanded = (gameState === 'Welcome' && isWelcomePanelVisible) || gameState === 'GameOver' || isPaused;
  useEffect(() => {
    if (!isExpanded) {
        setIsHudContentVisible(true);
    }
  }, [isExpanded]);


  // Effect monitor for power-ups
  useEffect(() => {
    // This effect should only run when the game is actively playing.
    if (gameState !== 'Playing' || isPaused) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      setActiveEffects(prevEffects => {
        const nextEffects = prevEffects.filter(effect => {
          if (effect.duration === 0) return true; // Persistent effects
          return now < effect.startTime + effect.duration;
        });

        // Optimization: Only update state if the array has actually changed to prevent re-renders.
        if (nextEffects.length === prevEffects.length) {
          return prevEffects;
        }
        
        return nextEffects;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [gameState, isPaused]);
  
  useEffect(() => {
    if (gameState === 'GameOver' && lastGameData) {
        // If the score is too low, don't bother checking the leaderboard.
        if (lastGameData.score < 10) {
            return;
        }
        // After a delay, check if the score is high enough for the leaderboard.
        const checkLeaderboard = async () => {
            try {
                const leaderboard = await fetchLeaderboard(isMobile() ? 'mobile' : 'computer');
                const lowestScore = leaderboard.length > 0 ? leaderboard[leaderboard.length - 1].score : 0;
                // If the leaderboard has space or the score is higher than the lowest, show the submit form.
                if (leaderboard.length < 100 || lastGameData.score > lowestScore) {
                    setIsSubmitScoreOpen(true);
                }
            } catch (error) {
                // Fail silently if leaderboard check fails. The user can still play again.
                console.error("Failed to fetch leaderboard for score check:", error);
            }
        };
        setTimeout(checkLeaderboard, 2000);
    }
  }, [gameState, lastGameData]);

  const handleGameOver = useCallback(() => {
    audioManager.playGameOverSound();
    if (scoreRef.current > highScoreRef.current) {
      setHighScore(scoreRef.current);
      localStorage.setItem('snakeHighScore', scoreRef.current.toString());
    }
    setLastGameData({ score: scoreRef.current, level: levelRef.current, topSpeed: topSpeedRef.current });
    setGameState('GameOver');
    setCameraView(CameraView.ORBIT);
    if(isPiBrowser) setIsRotated(false);
  }, [isPiBrowser]);
  
  const handleCrash = useCallback((crashedHead: Point3D, finalRotation: number) => {
    audioManager.playCrashSound();
    setIsCrashing(true);
    
    // Update the snake's state to include the crashed head, making it visible during the crash sequence.
    setSnake({
        segments: [crashedHead, ...snakeRef.current.segments],
        rotation: finalRotation
    });
  
    setLives(currentLives => {
      const newLives = currentLives - 1;
      if (newLives > 0) {
        setTimeout(() => {
          setActiveEffects([]);
          setBaseGameSpeed(gameConfigRef.current!.initialGameSpeed);
          setIsCrashing(false);
          // Reset snake to its initial length on respawn.
          const startingSnake = createSnakeAtStart(gameConfigRef.current!.initialSnakeLength);
          setSnake({ segments: startingSnake, rotation: 0 });
          commandQueue.current = [];
          setExtraLivesCollectedThisLife(0);
          
          const newFruits = getInitialFruits(startingSnake, layoutDetailsRef.current!, gameConfigRef.current!, extraLivesCollectedThisGameRef.current);
          setFruits(newFruits);
          setIsPassageFruitActive(newFruits.some(f => FRUIT_CATEGORIES[f.type] === 'PASSAGE'));

          audioManager.playGameStartSound();
          setGameState('Playing');
        }, 2000);
      } else {
        setTimeout(handleGameOver, 1500);
      }
      return newLives;
    });
  }, [handleGameOver]);

  const handleStartGame = useCallback(() => {
    audioManager.playGameStartSound();
    setIsPaused(false);
    setIsCrashing(false);
    
    // Always reset the game state for a new game, including layout, snake, and fruits.
    const layoutForGame = generateLayoutDetails();
    setLayoutDetails(layoutForGame);
    
    const startingSnake = createSnakeAtStart(gameConfigRef.current!.initialSnakeLength);
    setSnake({ segments: startingSnake, rotation: 0 });
    
    const initialFruitsForGame = getInitialFruits(startingSnake, layoutForGame, gameConfigRef.current!, 0);
    setFruits(initialFruitsForGame);
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
    setStreetFruitBucket([]);
    setExtraLivesCollectedThisLife(0);
    setExtraLivesCollectedThisGame(0);
    
    setGameId(id => id + 1); // This can be used by child components to detect a new game.
    setGameState('Starting');

    // After a delay (when animation starts), set camera to FPV so it's correct when animation ends.
    setTimeout(() => {
        setCameraView(CameraView.FIRST_PERSON);
    }, 1000);

    // The Board component handles the animation. After it's done, we switch to playing.
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
    setIsPaused(false);
    setIsCrashing(false);
    setCameraView(CameraView.ORBIT);
    setGameState('Welcome');
    if (isPiBrowser) setIsRotated(false);
  }, [isPiBrowser]);

  const handleTurn = useCallback((direction: 'left' | 'right') => {
    if (gameState !== 'Playing' || isPaused || isCrashing) return;
    if (direction === 'left') audioManager.playTurnLeftSound(); else audioManager.playTurnRightSound();
    if (commandQueue.current.length < 2) commandQueue.current.push(direction);
    setActiveKey(direction);
    setTimeout(() => setActiveKey(null), 150);
  }, [gameState, isPaused, isCrashing]);
  
  const handleTogglePause = useCallback(() => {
    if (gameStateRef.current !== 'Playing' || isCrashingRef.current) return;

    setIsPaused(wasPaused => {
      // If unpausing, force the camera back to First Person view for gameplay.
      if (wasPaused) {
        setCameraView(CameraView.FIRST_PERSON);
      }
      return !wasPaused;
    });
  }, []);

  // Page Visibility API handler to pause/resume game
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
                // This is a "best effort" attempt.
                (screen.orientation as any).lock('landscape').catch((err: any) => {
                    console.warn("Could not lock screen to landscape:", err);
                });
            }
        }).catch((err) => {
            console.error("Error requesting fullscreen:", err);
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
      
      // The full camera cycle is now available when not in active gameplay.
      setCameraView(prev => {
          const currentIndex = VIEW_CYCLE.indexOf(prev);
          const nextIndex = (currentIndex + 1) % VIEW_CYCLE.length;
          return VIEW_CYCLE[nextIndex];
      });
  }, [gameState, isPaused, isCrashing]);

    const searchRadioStations = useCallback(async (term: string) => {
        if (!term.trim()) return;

        setIsRadioLoading(true);
        setRadioError(null);
        setRadioStations([]);

        const API_BASE_URL = 'https://de1.api.radio-browser.info/json';
        try {
            const url = `https://de1.api.radio-browser.info/json/stations/byname/${encodeURIComponent(term)}?limit=50&hidebroken=true&order=clickcount&reverse=true`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API request failed with status ${response.status}`);

            const results: RadioBrowserStation[] = await response.json();
            if (!Array.isArray(results)) {
                console.error("Unexpected API response:", results);
                throw new Error("API did not return a valid list of stations.");
            }
            setRadioStations(results);
        } catch (err) {
            console.error(err);
            const message = err instanceof Error ? err.message : 'An unknown error occurred.';
            setRadioError(`Could not fetch stations: ${message}`);
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
        if (source === 'radio' && !currentStation && radioStations.length === 0) {
            const termToSearch = radioSearchTerm || 'hits';
            if (!radioSearchTerm) {
                setRadioSearchTerm(termToSearch);
            }
            searchRadioStations(termToSearch);
        } else if (source === 'saved') {
            const isCurrentStationSaved = savedStations.some(s => s.url === currentStation?.url);
            if (savedStations.length > 0 && !isCurrentStationSaved) {
                handleStationSelect(savedStations[0]);
            }
        }
    }, [currentStation, radioStations.length, searchRadioStations, radioSearchTerm, savedStations, handleStationSelect]);
    
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
  
  useEffect(() => {
    if (gameState === 'Playing' && !isPaused && !isCrashing) {
        let speedMultiplier = 1.0;
        if (activeEffects.some(e => e.type === FruitType.SPEED_BOOST)) speedMultiplier = 0.5;
        const newGameSpeed = Math.max(50, baseGameSpeed * speedMultiplier);
        setGameSpeed(newGameSpeed);
        const currentSpeedMps = 1000 / newGameSpeed;
        if (currentSpeedMps > topSpeedRef.current) setTopSpeed(currentSpeedMps);
    }
  }, [gameState, isPaused, activeEffects, baseGameSpeed, isCrashing]);

  useEffect(() => {
    if (gameState !== 'Playing' || isPaused || !gameConfig) return;
    const intervalId = setInterval(() => {
      const boardFruit = fruitsRef.current.find(f => FRUIT_CATEGORIES[f.type] === 'BOARD');
      if (boardFruit && (Date.now() - boardFruit.id > gameConfig.boardFruitLifetime)) {
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
        if (newPos) setFruits(prev => [...prev, { id: Date.now(), type: newType, position: newPos }]);
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
                
                // Shuffle the bucket
                for (let i = newBucketContents.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [newBucketContents[i], newBucketContents[j]] = [newBucketContents[j], newBucketContents[i]];
                }
                bucket = newBucketContents;
            }

            const newType = bucket.pop()!;
            setStreetFruitBucket(bucket); // Update state for next spawn

            setFruits(prev => [...prev, { id: Date.now(), type: newType, position: newPos }]);
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

  const gameTick = useCallback(() => {
    const { segments: prevSegments, rotation: prevRotation } = snakeRef.current;
    if (prevSegments.length === 0) return;
    const command = commandQueue.current.shift();
    let nextRotation = prevRotation + (command ? (command === 'left' ? Math.PI / 2 : -Math.PI / 2) : 0);
    const head = prevSegments[0];
    let newHead = { x: head.x - Math.round(Math.sin(nextRotation)), y: head.y, z: head.z - Math.round(Math.cos(nextRotation)) };
    const enteredPortal = isPortalBlock(newHead, layoutDetailsRef.current!.portals);
    if (enteredPortal) {
        audioManager.playPortalSound();
        const { pos, rot } = getPortalEmergence(enteredPortal, layoutDetailsRef.current!.portals);
        newHead = pos; nextRotation = rot;
    }
    if (isWall(newHead, layoutDetailsRef.current!) || prevSegments.slice(1).some(s => s.x === newHead.x && s.z === newHead.z)) {
        handleCrash(newHead, nextRotation); 
        return;
    }
    
    const isMagnetActive = activeEffectsRef.current.some(e => e.type === FruitType.MAGNET);
    const eatenFruits = fruitsRef.current.filter(f => isMagnetActive ? Math.abs(f.position.x - newHead.x) <= 1 && Math.abs(f.position.z - newHead.z) <= 1 : f.position.x === newHead.x && f.position.z === newHead.z);

    if (eatenFruits.length > 0) {
        let points = 0, growth = 0, livesGained = 0;
        const newEffects: ActiveEffect[] = [];
        const eatenIds = new Set(eatenFruits.map(f => f.id));

        const isDoublerActive = activeEffectsRef.current.some(e => e.type === FruitType.SCORE_DOUBLER);
        const isTripleActive = activeEffectsRef.current.some(e => e.type === FruitType.TRIPLE);
        
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
              // Re-interpret speedIncreasePerApple to provide a linear increase in speed (m/s).
              // A config value of 1 now means a 0.2 m/s increase per apple.
              const speedIncreaseMps = (gameConfigRef.current!.speedIncreasePerApple / 5) * eatenAppleCount;
              const newSpeedMps = currentSpeedMps + speedIncreaseMps;
              const newInterval = 1000 / newSpeedMps;
              return Math.max(50, newInterval); // Ensure interval doesn't go below 50ms
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
                    newEffects.push({id: f.id, type: f.type, startTime: Date.now(), duration: getEffectDuration(f.type)}); 
                    audioManager.playSlowDownSound(); 
                    break;
                case FruitType.EXTRA_LIFE: 
                    livesGained++; 
                    newEffects.push({id: f.id, type: f.type, startTime: Date.now(), duration: getEffectDuration(f.type)}); 
                    audioManager.playExtraLifeSound(); 
                    break;
                default: 
                    newEffects.push({id: f.id, type: f.type, startTime: Date.now(), duration: getEffectDuration(f.type)});
                    if (f.type === FruitType.SPEED_BOOST) audioManager.playSpeedBoostSound();
                    else if (f.type === FruitType.MAGNET) audioManager.playMagnetSound();
                    else if (f.type === FruitType.SCORE_DOUBLER) audioManager.playScoreDoublerSound();
                    else if (f.type === FruitType.TRIPLE) audioManager.playTripleSound();
                    break;
            }
        });
        
        if (points > 0) {
            setScore(s => { 
                const newS = s + points; 
                if (Math.floor(newS / gameConfigRef.current!.pointsPerLevel) > Math.floor(s / gameConfigRef.current!.pointsPerLevel)) { 
                    setLevel(l => l + 1); 
                    audioManager.playLevelUpSound(); 
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
        
        let nextFruits = fruitsRef.current.filter(f => !eatenIds.has(f.id));
        if (eatenAppleCount > 0) {
            // The snake is about to grow, so its next state will include the new head and all current segments.
            // We must check for collisions against this future state to prevent spawning an apple inside the new head.
            const futureSnake = [newHead, ...snakeRef.current.segments];
            for (let i = 0; i < eatenAppleCount; i++) { 
                const p = getBoardSpawnPoint(futureSnake, nextFruits, layoutDetailsRef.current!); 
                if(p) nextFruits.push({id: Date.now() + i, type: FruitType.APPLE, position: p}); 
            } 
        }
        setFruits(nextFruits);

        if (eatenFruits.some(f => FRUIT_CATEGORIES[f.type] === 'PASSAGE')) setIsPassageFruitActive(false);
    }

    setSnake({ segments: [newHead, ...prevSegments.slice(0, prevSegments.length - (shouldGrow.current > 0 ? 0 : 1))], rotation: nextRotation });
    if (shouldGrow.current > 0) shouldGrow.current--;
  }, [handleCrash]);

  // Main Game Loop using requestAnimationFrame for smoothness
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

        // Use a while loop to catch up on missed ticks if the browser lags
        while (timeSinceLastTick >= currentInterval) {
            gameTick();
            timeSinceLastTick -= currentInterval;
        }
        
        animationFrameRef.current = requestAnimationFrame(animationLoop);
    };

    // Reset timers and start the loop
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
    if (isPiBrowser || gameState !== 'Playing' || isPaused || isCrashing || (e.target as HTMLElement).closest('button')) return;
    pointerStartPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (isPiBrowser || !pointerStartPos.current || gameState !== 'Playing' || isPaused || isCrashing) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    const deltaX = e.clientX - pointerStartPos.current.x;
    pointerStartPos.current = null;
    if (Math.abs(deltaX) > 30) handleTurn(deltaX > 0 ? 'right' : 'left');
  };

  const passageFruitLocation = fruits.find(f => FRUIT_CATEGORIES[f.type] === 'PASSAGE')?.position || null;

  if (gameState === 'Loading') {
      return (
          <div className="w-screen h-screen bg-neutral-900 flex flex-col items-center justify-center text-white font-sans">
              <SpinnerIcon className="w-16 h-16 animate-spin text-cyan-400" />
              <p className="mt-4 text-2xl font-bold tracking-widest">LOADING...</p>
          </div>
      );
  }

  return (
    <main 
      ref={mainRef} tabIndex={-1}
      className={`relative bg-neutral-800 text-white overflow-hidden font-sans touch-none outline-none ${isRotated ? 'pi-browser-rotated' : 'h-screen w-screen'}`}
      onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}
    >
      <GameHUD
        gameState={gameState} isPaused={isPaused} onTogglePause={handleTogglePause} isFullScreen={isFullScreen} onToggleFullScreen={handleToggleFullScreen}
        score={score} level={level} lives={lives} gameSpeed={gameSpeed} onStartGame={handleStartGame}
        highScore={highScore} topSpeed={topSpeed} isWelcomePanelVisible={isWelcomePanelVisible}
        activeEffects={activeEffects} onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGraphicsSettings={() => setIsGraphicsSettingsOpen(true)}
        onOpenAmi={handleOpenAmi}
        onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
        musicSource={musicSource}
        currentStation={currentStation}
        flashMessage={flashMessage}
        cameraView={cameraView}
        onCycleCamera={handleCycleCamera}
        isHudContentVisible={isHudContentVisible}
        setIsHudContentVisible={setIsHudContentVisible}
        onResetToWelcome={handleResetToWelcome}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        onOpenJoinPi={() => setIsJoinPiOpen(true)}
        onOpenAboutSpi={() => setIsAboutSpiOpen(true)}
        onOpenCredits={() => setIsCreditsOpen(true)}
        onOpenTerms={() => setIsTermsOpen(true)}
        onOpenPrivacyPolicy={() => setIsPrivacyPolicyOpen(true)}
        piUser={piUser}
        isPiBrowser={isPiBrowser}
        isRotated={isRotated}
        onToggleRotate={handleToggleRotate}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        {layoutDetails && (
          <Board 
            ref={boardRef}
            gameState={gameState} zoom={zoom} cameraView={cameraView} snakeSegments={snake.segments} snakeRotation={snake.rotation}
            fruits={fruits} gameSpeed={gameSpeed} layoutDetails={layoutDetails} isCrashing={isCrashing}
            isPassageFruitActive={isPassageFruitActive} passageFruitLocation={passageFruitLocation}
            approvedAds={approvedAds}
            billboardData={billboardData}
            graphicsQuality={graphicsQuality}
            isPageVisible={isPageVisible}
          />
        )}
      </div>
      <Controls 
        onTurnLeft={() => handleTurn('left')} 
        onTurnRight={() => handleTurn('right')} 
        gameState={gameState} 
        activeKey={activeKey} 
        isPaused={isPaused} 
        isHudVisible={isHudContentVisible}
      />
      {isAmiOpen && <AdvertisingOverlay onClose={() => setIsAmiOpen(false)} approvedAds={approvedAds} gameConfig={gameConfig} promoCodes={promoCodes} onOpenTerms={() => setIsTermsOpen(true)} requestPiAuth={requestPiAuth} piUser={piUser} isRotated={isRotated} />}
      {isLeaderboardOpen && <Leaderboard onClose={() => setIsLeaderboardOpen(false)} onLeaderboardUpdate={handleLeaderboardUpdate} isRotated={isRotated} />}
      {isSubmitScoreOpen && lastGameData && <SubmitScore scoreData={lastGameData} onClose={() => setIsSubmitScoreOpen(false)} requestPiAuth={requestPiAuth} isRotated={isRotated} />}
      {isHowToPlayOpen && <HowToPlayOverlay onClose={() => setIsHowToPlayOpen(false)} isRotated={isRotated} />}
      {isFeedbackOpen && <FeedbackOverlay onClose={() => setIsFeedbackOpen(false)} isRotated={isRotated} />}
      {isJoinPiOpen && <JoinPiOverlay onClose={() => setIsJoinPiOpen(false)} isRotated={isRotated} />}
      {isAboutSpiOpen && <AboutSpiOverlay onClose={() => setIsAboutSpiOpen(false)} isRotated={isRotated} />}
      {isCreditsOpen && <CreditsOverlay onClose={() => setIsCreditsOpen(false)} isRotated={isRotated} />}
      {isTermsOpen && <TermsAndConditionsOverlay onClose={() => setIsTermsOpen(false)} isRotated={isRotated} />}
      {isPrivacyPolicyOpen && <PrivacyPolicyOverlay onClose={() => setIsPrivacyPolicyOpen(false)} isRotated={isRotated} />}
      {isPiAuthModalOpen && <PiAuthModal onClose={() => setIsPiAuthModalOpen(false)} onSuccess={() => { setIsPiAuthModalOpen(false); onAuthSuccessCallback?.(); }} isRotated={isRotated} />}
      {isGraphicsSettingsOpen && (
          <GraphicsSettings 
              onClose={() => setIsGraphicsSettingsOpen(false)}
              currentQuality={graphicsQuality}
              onQualityChange={handleGraphicsQualityChange}
              isRotated={isRotated}
          />
      )}
      {isSettingsOpen && (
          <Settings 
              onClose={() => setIsSettingsOpen(false)}
              musicSource={musicSource}
              onMusicSourceChange={handleMusicSourceChange}
              currentStation={currentStation}
              onStationSelect={handleStationSelect}
              radioSearchTerm={radioSearchTerm}
              onRadioSearchTermChange={setRadioSearchTerm}
              radioStations={radioStations}
              isRadioLoading={isRadioLoading}
              radioError={radioError}
              searchRadioStations={searchRadioStations}
              isRotated={isRotated}
              isBackgroundPlayEnabled={isBackgroundPlayEnabled}
              onIsBackgroundPlayEnabledChange={setIsBackgroundPlayEnabled}
              savedStations={savedStations}
              onToggleSaveStation={handleToggleSaveStation}
          />
      )}
    </main>
  );
};

export default App;