import React, { useState, useEffect, useRef } from 'react';
import { SpinnerIcon } from './icons';

// Declare google global for IMA SDK
declare global {
  interface Window {
    google: any;
  }
}

interface AdOverlayProps {
  onClose: () => void;
  placementId: string;
}

const AdOverlay: React.FC<AdOverlayProps> = ({ onClose, placementId }) => {
  const adContainerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const adsLoaderRef = useRef<any>(null);
  const adsManagerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adError, setAdError] = useState<string | null>(null);
  const [isAdBlockerSuspected, setIsAdBlockerSuspected] = useState(false);
  
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (typeof window.google === 'undefined' || typeof window.google.ima === 'undefined') {
      console.error('Google IMA SDK not loaded');
      if (isMounted.current) {
        setAdError('Ad SDK failed to load.');
        setIsLoading(false);
      }
      return;
    }

    const adContainer = adContainerRef.current;
    const videoElement = videoElementRef.current;
    if (!adContainer || !videoElement) return;

    let adsManager: any = null;

    const handleError = (adErrorEvent: any) => {
      if (!isMounted.current) return;
      
      const error = adErrorEvent.getError();
      console.error('Ad Error:', error.toString(), 'Code:', error.getCode(), 'Type:', error.getType());
      
      // Heuristic for detecting ad blockers.
      // 1009: VAST_EMPTY_RESPONSE is a strong signal from ad blockers.
      // 1012: ADS_REQUEST_NETWORK_ERROR can also be caused by network-level blockers.
      if (error.getCode() === 1009 || error.getCode() === 1012) {
        setIsAdBlockerSuspected(true);
      } else {
        setAdError('The ad could not be played due to an error.');
      }
      setIsLoading(false);
    };

    const onAdsManagerLoaded = (adsManagerLoadedEvent: any) => {
      if (!isMounted.current) return;
      const adsRenderingSettings = new window.google.ima.AdsRenderingSettings();
      adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;

      adsManager = adsManagerLoadedEvent.getAdsManager(videoElement, adsRenderingSettings);
      adsManagerRef.current = adsManager;

      const onAdEvent = () => {
        if (!isMounted.current) return;
        adsManager?.destroy();
        onClose();
      };

      adsManager.addEventListener(window.google.ima.AdEvent.Type.LOADED, () => { if (isMounted.current) setIsLoading(false); });
      adsManager.addEventListener(window.google.ima.AdEvent.Type.STARTED, () => { if (isMounted.current) setIsLoading(false); });
      adsManager.addEventListener(window.google.ima.AdEvent.Type.COMPLETE, onAdEvent);
      adsManager.addEventListener(window.google.ima.AdEvent.Type.ALL_ADS_COMPLETED, onAdEvent);
      adsManager.addEventListener(window.google.ima.AdErrorEvent.Type.AD_ERROR, handleError);

      try {
        const viewMode = document.fullscreenElement ? window.google.ima.ViewMode.FULLSCREEN : window.google.ima.ViewMode.NORMAL;
        adsManager.init(videoElement.clientWidth, videoElement.clientHeight, viewMode);
        adsManager.start();
      } catch (adError) {
        console.error('AdsManager start error:', adError);
        onClose();
      }
    };
    
    const adDisplayContainer = new window.google.ima.AdDisplayContainer(adContainer, videoElement);
    const adsLoader = new window.google.ima.AdsLoader(adDisplayContainer);
    adsLoaderRef.current = adsLoader;

    adsLoader.addEventListener(
      window.google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      onAdsManagerLoaded,
      false
    );
    adsLoader.addEventListener(
      window.google.ima.AdErrorEvent.Type.AD_ERROR,
      handleError,
      false
    );

    const adsRequest = new window.google.ima.AdsRequest();
    adsRequest.adTagUrl = `https://api.w.inmobi.com/showad/v3/${placementId}?cache_buster=${Date.now()}`;
    adsRequest.setAdWillAutoPlay(true);
    adsRequest.setAdWillPlayMuted(false);
    
    adsLoader.requestAds(adsRequest);

    return () => {
      isMounted.current = false;
      adsManagerRef.current?.destroy();
      const currentAdsLoader = adsLoaderRef.current;
      if (currentAdsLoader) {
          currentAdsLoader.removeEventListener(window.google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, onAdsManagerLoaded);
          currentAdsLoader.removeEventListener(window.google.ima.AdErrorEvent.Type.AD_ERROR, handleError);
      }
    };
  }, [placementId, onClose]);
  
  const handleManualClose = () => {
    adsManagerRef.current?.destroy();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Advertisement"
    >
      <div ref={adContainerRef} className="absolute inset-0 w-full h-full">
        <video ref={videoElementRef} playsInline className="w-full h-full bg-black" />
      </div>

      {isLoading && (
        <div className="z-10 flex flex-col items-center justify-center p-8 bg-black/50 rounded-lg">
          <SpinnerIcon className="w-12 h-12 animate-spin text-cyan-400" />
          <p className="mt-4">Loading ad...</p>
        </div>
      )}
      
      {isAdBlockerSuspected && (
        <div className="z-10 flex flex-col items-center justify-center p-8 bg-neutral-800 rounded-lg shadow-lg max-w-sm text-center m-4">
          <h3 className="text-xl font-bold text-yellow-300 mb-3">Enjoying the game?</h3>
          <p className="text-neutral-300 mb-6">
            If you enjoy this game, please consider disabling your ad blocker to support the development.
          </p>
          <button
              onClick={handleManualClose}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors"
          >
              Close
          </button>
        </div>
      )}
      
      {adError && !isAdBlockerSuspected && (
        <div className="z-10 flex flex-col items-center justify-center p-8 bg-neutral-800 rounded-lg shadow-lg max-w-sm text-center m-4">
          <h3 className="text-xl font-bold text-red-500 mb-3">Ad Error</h3>
          <p className="text-neutral-300 mb-6">{adError}</p>
          <button
              onClick={handleManualClose}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors"
          >
              Close
          </button>
        </div>
      )}
    </div>
  );
};

export default AdOverlay;