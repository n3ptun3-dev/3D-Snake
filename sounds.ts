// A tiny, self-contained audio player using the Web Audio API for better performance and control.

const APPLE_SOUND_URL = '/audio/bonus.mp3';
const BACKGROUND_MUSIC_URL_1 = '/audio/loop_music.mp3';
const BACKGROUND_MUSIC_URL_2 = '/audio/loop_music_2.wav';
const CRASH_SOUND_URL = '/audio/crash.mp3';
const GAME_OVER_SOUND_URL = '/audio/game_over.mp3';
const LEVEL_UP_SOUND_URL = '/audio/level_up.mp3';
const TURN_LEFT_SOUND_URL = '/audio/left.mp3';
const TURN_RIGHT_SOUND_URL = '/audio/right.mp3';
const LOBBY_MUSIC_URL = '/audio/lobby.mp3';
const GAME_START_SOUND_URL = '/audio/game_start.mp3';
const PORTAL_SOUND_URL = '/audio/portal.mp3';
const EXTRA_LIFE_SOUND_URL = '/audio/extra_life.mp3';
const SCORE_DOUBLER_SOUND_URL = '/audio/double.mp3';
const TRIPLE_SOUND_URL = '/audio/triple.mp3';
const SLOW_DOWN_SOUND_URL = '/audio/slow_down.mp3';
const SPEED_BOOST_SOUND_URL = '/audio/speed_up.mp3';
const MAGNET_SOUND_URL = '/audio/magnet.mp3';

const RADIO_VOLUME = 0.2;

const audioManager = (() => {
  let audioContext: AudioContext | null = null;
  const audioCache = new Map<string, AudioBuffer>();

  let backgroundMusicSource: AudioBufferSourceNode | null = null;
  let lobbyMusicSource: AudioBufferSourceNode | null = null;

  // State to manage which music type is currently requested to be playing
  let activeMusicRequest: 'lobby' | 'background' | null = null;

  const backgroundMusicTracks = [BACKGROUND_MUSIC_URL_1, BACKGROUND_MUSIC_URL_2];
  let currentTrackIndex = 0;

  // New properties for mute controls and state management
  let musicMasterGain: GainNode | null = null;
  let sfxMasterGain: GainNode | null = null;
  let isMusicMuted = false;
  let areSfxMuted = false;
  const listeners = new Set<() => void>();

  // Radio properties
  let radioAudioElement: HTMLAudioElement | null = null;
  let radioSourceNode: MediaElementAudioSourceNode | null = null;
  let radioGainNode: GainNode | null = null;
  let isRadioPlaying = false;
  
  // New property for background play
  let allowBackgroundPlay = false;

  const init = () => {
    if (audioContext) return;
    if (typeof window !== 'undefined') {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        musicMasterGain = audioContext.createGain();
        musicMasterGain.connect(audioContext.destination);

        sfxMasterGain = audioContext.createGain();
        sfxMasterGain.connect(audioContext.destination);

        const resumeAudio = () => {
          if (audioContext?.state === 'suspended') {
            audioContext.resume();
          }
          document.removeEventListener('click', resumeAudio);
          document.removeEventListener('keydown', resumeAudio);
        };
        document.addEventListener('click', resumeAudio);
        document.addEventListener('keydown', resumeAudio);

      } catch (e) {
        console.error("Web Audio API is not supported in this browser.");
      }
    }
  };

  const notifyListeners = () => {
    listeners.forEach(cb => cb());
  };

  const playSound = async (
    url: string,
    soundType: 'music' | 'sfx',
    volume: number = 1.0,
    loop: boolean = false,
  ): Promise<AudioBufferSourceNode | null> => {
    if (!audioContext || !musicMasterGain || !sfxMasterGain) {
      console.warn("Audio context not initialized. Call init() on a user gesture.");
      return null;
    }
    
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    try {
      let buffer: AudioBuffer;
      if (audioCache.has(url)) {
        buffer = audioCache.get(url)!;
      } else {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch sound at ${url}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        buffer = await audioContext.decodeAudioData(arrayBuffer);
        audioCache.set(url, buffer);
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;

      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      
      source.connect(gainNode);
      const masterGain = soundType === 'music' ? musicMasterGain : sfxMasterGain;
      gainNode.connect(masterGain);
      
      source.start(0);
      return source;
    } catch (e) {
      console.error(`Error playing sound from ${url}:`, e);
      return null;
    }
  };

  const stopLobbyMusic = () => {
    if (lobbyMusicSource) {
      try { lobbyMusicSource.stop(); } catch(e) {}
      lobbyMusicSource = null;
    }
  };

  const stopBackgroundMusic = () => {
    if (backgroundMusicSource) {
      try { backgroundMusicSource.stop(); } catch(e) {}
      backgroundMusicSource = null;
    }
  };

  const playBackgroundMusic = async () => {
    if (activeMusicRequest === 'background' && backgroundMusicSource) return;
    
    // Clear other music requests and sources
    activeMusicRequest = 'background';
    stopLobbyMusic();
    if (backgroundMusicSource) return; // Already playing or starting
    
    const trackUrl = backgroundMusicTracks[currentTrackIndex];
    const source = await playSound(trackUrl, 'music', 0.3, true);

    // If the request changed while we were loading, stop this new source.
    if (activeMusicRequest !== 'background') {
      if (source) try { source.stop(); } catch (e) {}
      return;
    }
    
    if (source) {
      backgroundMusicSource = source;
      source.onended = () => {
          if (backgroundMusicSource === source) backgroundMusicSource = null;
      };
      currentTrackIndex = (currentTrackIndex + 1) % backgroundMusicTracks.length;
    }
  };
  
  const playLobbyMusic = async () => {
    if (activeMusicRequest === 'lobby' && lobbyMusicSource) return;

    // Clear other music requests and sources
    activeMusicRequest = 'lobby';
    stopBackgroundMusic();
    if (lobbyMusicSource) return; // Already playing or starting
    
    const source = await playSound(LOBBY_MUSIC_URL, 'music', 0.4, true);

    // If the request changed while we were loading, stop this new source.
    if (activeMusicRequest !== 'lobby') {
      if (source) try { source.stop(); } catch (e) {}
      return;
    }

    if (source) {
      lobbyMusicSource = source;
      source.onended = () => {
          if (lobbyMusicSource === source) lobbyMusicSource = null;
      };
    }
  };

  const stopAllDefaultMusic = () => {
      activeMusicRequest = null;
      stopLobbyMusic();
      stopBackgroundMusic();
  };
  
  const playGameOverSound = () => {
    const sfxSourcePromise = playSound(GAME_OVER_SOUND_URL, 'sfx', 0.5, false);
    
    if (isRadioPlaying && radioGainNode && audioContext) {
      radioGainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.2);
      sfxSourcePromise?.then(sfxSource => {
        sfxSource?.addEventListener('ended', () => {
          if (isRadioPlaying && radioGainNode && audioContext) {
            radioGainNode.gain.linearRampToValueAtTime(RADIO_VOLUME, audioContext.currentTime + 1.5);
          }
        });
      });
    }
  };

  const isMusicPlaying = () => {
    return !!(backgroundMusicSource || lobbyMusicSource || isRadioPlaying);
  };
  
  const setupRadioNode = () => {
    if (audioContext && radioAudioElement && !radioSourceNode) {
        try {
            radioSourceNode = audioContext.createMediaElementSource(radioAudioElement);
            radioGainNode = audioContext.createGain();
            radioGainNode.gain.value = RADIO_VOLUME;
            radioSourceNode.connect(radioGainNode).connect(musicMasterGain!);
        } catch (e) {
            console.error('Failed to create radio source node:', e);
        }
    }
  };

  const playRadio = (url: string, onError?: () => void) => {
    if (!audioContext || !musicMasterGain) return;
    
    stopAllDefaultMusic();

    if (!radioAudioElement) {
        radioAudioElement = new Audio();
        radioAudioElement.crossOrigin = 'anonymous';
        radioAudioElement.addEventListener('canplay', setupRadioNode);
    }

    if (radioAudioElement.src !== url) {
        radioAudioElement.src = url;
    }
    
    if (!isMusicMuted) {
        radioAudioElement.play().catch(e => {
            console.error("Radio play failed:", (e as Error).message);
            onError?.();
        });
    }
    isRadioPlaying = true;
  };

  const ALL_SOUND_URLS = [
    APPLE_SOUND_URL,
    BACKGROUND_MUSIC_URL_1,
    BACKGROUND_MUSIC_URL_2,
    CRASH_SOUND_URL,
    GAME_OVER_SOUND_URL,
    LEVEL_UP_SOUND_URL,
    TURN_LEFT_SOUND_URL,
    TURN_RIGHT_SOUND_URL,
    LOBBY_MUSIC_URL,
    GAME_START_SOUND_URL,
    PORTAL_SOUND_URL,
    EXTRA_LIFE_SOUND_URL,
    SCORE_DOUBLER_SOUND_URL,
    TRIPLE_SOUND_URL,
    SLOW_DOWN_SOUND_URL,
    SPEED_BOOST_SOUND_URL,
    MAGNET_SOUND_URL,
  ];

  const preloadAllSounds = async (): Promise<void> => {
    if (!audioContext) {
      console.warn("Audio context not initialized for preloading. Sounds will load on demand.");
      return;
    }

    const preloadPromises = ALL_SOUND_URLS.map(async (url) => {
      if (audioCache.has(url)) {
        return;
      }
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch sound at ${url}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        audioCache.set(url, buffer);
      } catch (e) {
        console.error(`Error preloading sound from ${url}:`, e);
      }
    });

    await Promise.all(preloadPromises);
    console.log("All audio files have been preloaded.");
  };

  return {
    init,
    preloadAllSounds,
    playAppleSound: () => playSound(APPLE_SOUND_URL, 'sfx', 0.5),
    playGameStartSound: () => playSound(GAME_START_SOUND_URL, 'sfx', 0.6),
    playGameOverSound,
    playCrashSound: () => playSound(CRASH_SOUND_URL, 'sfx', 0.7),
    playLevelUpSound: () => playSound(LEVEL_UP_SOUND_URL, 'sfx', 0.6),
    playTurnLeftSound: () => playSound(TURN_LEFT_SOUND_URL, 'sfx', 0.4),
    playTurnRightSound: () => playSound(TURN_RIGHT_SOUND_URL, 'sfx', 0.4),
    playPortalSound: () => playSound(PORTAL_SOUND_URL, 'sfx', 0.6),
    playExtraLifeSound: () => playSound(EXTRA_LIFE_SOUND_URL, 'sfx', 0.7),
    playScoreDoublerSound: () => playSound(SCORE_DOUBLER_SOUND_URL, 'sfx', 0.6),
    playTripleSound: () => playSound(TRIPLE_SOUND_URL, 'sfx', 0.6),
    playSlowDownSound: () => playSound(SLOW_DOWN_SOUND_URL, 'sfx', 0.6),
    playSpeedBoostSound: () => playSound(SPEED_BOOST_SOUND_URL, 'sfx', 0.6),
    playMagnetSound: () => playSound(MAGNET_SOUND_URL, 'sfx', 0.6),
    playBackgroundMusic,
    stopBackgroundMusic,
    playLobbyMusic,
    stopLobbyMusic,
    stopAllDefaultMusic,
    isMusicPlaying,
    playRadio,
    stopRadio: () => {
        if (!radioAudioElement) return;
        radioAudioElement.pause();
        radioAudioElement.src = '';
        isRadioPlaying = false;
    },
    setAllowBackgroundPlay: (allowed: boolean) => {
        allowBackgroundPlay = allowed;
    },
    suspend: () => {
        if (isRadioPlaying && allowBackgroundPlay) {
            console.log("Background radio play is active; not suspending AudioContext.");
            return;
        }
        if (audioContext && audioContext.state === 'running') {
            audioContext.suspend().catch(e => console.error("Failed to suspend AudioContext", e));
        }
    },
    resume: () => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(e => console.error("Failed to resume AudioContext", e));
        }
    },
    subscribe: (callback: () => void) => {
        listeners.add(callback);
        return () => { listeners.delete(callback); };
    },
    getMuteState: () => ({ isMusicMuted, areSfxMuted }),
    toggleMusicMute: () => {
        isMusicMuted = !isMusicMuted;
        if (musicMasterGain && audioContext) {
            musicMasterGain.gain.setValueAtTime(isMusicMuted ? 0 : 1, audioContext.currentTime);
        }

        // Also pause/play the radio element if it's the source
        if (isRadioPlaying && radioAudioElement) {
            if (isMusicMuted) {
                radioAudioElement.pause();
            } else {
                // Check src is valid before trying to play
                if (radioAudioElement.src && radioAudioElement.src !== window.location.href) {
                    radioAudioElement.play().catch(e => console.error("Radio resume failed:", e));
                }
            }
        }
        
        notifyListeners();
    },
    toggleSfxMute: () => {
        areSfxMuted = !areSfxMuted;
        if (sfxMasterGain && audioContext) {
            sfxMasterGain.gain.setValueAtTime(areSfxMuted ? 0 : 1, audioContext.currentTime);
        }
        notifyListeners();
    },
  };
})();

export default audioManager;