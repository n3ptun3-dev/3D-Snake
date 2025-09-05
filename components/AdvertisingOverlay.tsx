import React, { useState, useEffect, useMemo } from 'react';
import { AdType, Sponsor, AdSubmissionData, BookedSlots, ApprovedAd, GameConfig, PromoCode, UserDTO } from '../types';
import { submitAd, generatePaymentId, logAdClick, fetchBookedSlots, confirmPayment } from '../utils/sponsors';
import { XIcon, SpinnerIcon, MegaphoneIcon, CalendarIcon, CopyIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import HowItWorksOverlay from './HowItWorksOverlay';
import { piService } from '../utils/pi';

interface AdvertisingOverlayProps {
  onClose: () => void;
  approvedAds: ApprovedAd[];
  gameConfig: GameConfig | null;
  promoCodes: Map<string, PromoCode>;
  onOpenTerms: () => void;
  requestPiAuth: (onSuccess: () => void) => void;
  piUser: UserDTO | null;
  isRotated: boolean;
}

// Helper function to get the correct price from the game config
const getAdPrice = (type: AdType, config: GameConfig): number => {
    switch (type) {
        case 'Billboard': return config.priceBillboard;
        case 'Poster': return config.pricePoster;
        case 'Banner': return config.priceBanner;
        case 'Flyer': return config.priceFlyer;
        case 'CosmeticBanner': return 0;
        default: return 0;
    }
};

// Helper function to generate flyer images as data URLs
const generateFlyerDataUrl = (variant: number): string => {
    const canvas = document.createElement('canvas');
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f5e8d0'; // Old paper color
    ctx.fillRect(0, 0, size, size);

    // Add some noise/texture to the paper
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 500; i++) {
        ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    switch (variant) {
        case 0: // Wanted Snake
            ctx.font = 'bold 24px "Courier New", monospace';
            ctx.fillStyle = '#333';
            ctx.fillText('WANTED', size / 2, 20);
            
            ctx.font = '16px "Courier New", monospace';
            ctx.fillText('For being', size / 2, size - 20);

            ctx.font = '16px "Courier New", monospace';
            ctx.fillText('too long', size / 2, size - 10);
            
            // Draw a simple snake
            ctx.strokeStyle = '#00ffff'; // COLORS.PLAYER_BODY
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(27, 70);
            ctx.bezierCurveTo(50, 40, 80, 100, 100, 60);
            ctx.stroke();
            break;
        case 1: // Quantum Cola
            ctx.font = 'bold 28px "Impact", sans-serif';
            ctx.fillStyle = '#e11d48'; // Red
            ctx.save();
            ctx.translate(size / 2, size / 2 - 10);
            ctx.rotate(-0.1);
            ctx.fillText('QUANTUM', 0, 0);
            ctx.restore();
            
            ctx.font = 'bold 48px "Impact", sans-serif';
            ctx.fillStyle = '#2563eb'; // Blue
            ctx.save();
            ctx.translate(size / 2, size / 2 + 25);
            ctx.rotate(0.05);
            ctx.fillText('COLA', 0, 0);
            ctx.restore();
            
            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#555';
            ctx.fillText('Tastes like the future!', size/2, size - 12);
            break;
        case 2: // Missing Cat
            ctx.font = 'bold 28px sans-serif';
            ctx.fillStyle = '#111';
            ctx.fillText('MISSING', size / 2, 22);

            // Simple cat drawing
            ctx.fillStyle = '#5a5a5a';
            ctx.beginPath();
            ctx.arc(size/2, 60, 20, 0, Math.PI * 2); // head
            ctx.fill();
            ctx.beginPath(); // left ear
            ctx.moveTo(size/2 - 20, 45); ctx.lineTo(size/2 - 10, 30); ctx.lineTo(size/2, 45);
            ctx.fill();
            ctx.beginPath(); // right ear
            ctx.moveTo(size/2 + 20, 45); ctx.lineTo(size/2 + 10, 30); ctx.lineTo(size/2, 45);
            ctx.fill();

            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#333';
            ctx.fillText('Answers to "Glitch"', size / 2, 95);
            ctx.fillText('Last seen near a portal', size / 2, 110);
            break;
    }
    
    // Add border
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, size, size);

    return canvas.toDataURL();
};

const SponsorDetailModal: React.FC<{ sponsor: Sponsor; onClose: () => void; isRotated: boolean; }> = ({ sponsor, onClose, isRotated }) => {
    const [isImagePopupOpen, setIsImagePopupOpen] = useState(false);

    const handleVisitWebsite = () => {
        if (sponsor.websiteUrl && sponsor.websiteUrl !== '#') {
            logAdClick('Website', sponsor.name);
        }
    };
    
    const containerClasses = isRotated
        ? 'w-[90%] max-w-md h-auto max-h-[95%]'
        : 'w-full max-w-md max-h-[90dvh]';

    return (
        <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="sponsor-detail-title">
                <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col ${containerClasses}`} onClick={e => e.stopPropagation()}>
                    <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
                        <h2 id="sponsor-detail-title" className="text-xl font-bold text-cyan-300 truncate pr-4">{sponsor.name}</h2>
                        <button onClick={onClose} className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors" aria-label="Close">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </header>
                    <div className="flex-grow overflow-y-auto p-4 sm:p-6">
                        <img 
                          src={sponsor.imageUrl} 
                          alt={`${sponsor.name} logo`} 
                          className="w-full h-48 object-contain rounded-md bg-black/20 mb-4 cursor-pointer"
                          onClick={() => setIsImagePopupOpen(true)}
                        />
                        <p className="text-neutral-300 whitespace-pre-wrap">{sponsor.description}</p>
                    </div>
                    {sponsor.websiteUrl && sponsor.websiteUrl !== '#' && (
                        <footer className="p-4 border-t border-neutral-700 flex-shrink-0">
                            <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={handleVisitWebsite} className="block w-full text-center px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors text-lg">
                                Visit Website
                            </a>
                        </footer>
                    )}
                </div>
            </div>
            {isImagePopupOpen && (
                <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setIsImagePopupOpen(false)}>
                    <img src={sponsor.imageUrl} alt={`${sponsor.name} logo`} className="max-w-full max-h-full object-contain" />
                    <button onClick={() => setIsImagePopupOpen(false)} className="absolute top-4 right-4 p-2 rounded-full text-white bg-black/50 hover:bg-black/80" aria-label="Close image view">
                        <XIcon className="w-8 h-8" />
                    </button>
                </div>
            )}
        </>
    );
};


const AdvertisingOverlay: React.FC<AdvertisingOverlayProps> = ({ onClose, approvedAds, gameConfig, promoCodes, onOpenTerms, requestPiAuth, piUser, isRotated }) => {
    const [view, setView] = useState<'list' | 'select_type' | 'calendar' | 'form' | 'payment' | 'thank_you'>('list');
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showPromoPopup, setShowPromoPopup] = useState(false);
    const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

    // State for the submission flow
    const [selectedType, setSelectedType] = useState<AdType | null>(null);
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [formCache, setFormCache] = useState<Omit<AdSubmissionData, 'paymentId' | 'scheduleDate' | 'adType' | 'price' | 'originalPrice' | 'piUsername'> | null>(null);
    const [submissionData, setSubmissionData] = useState<AdSubmissionData | null>(null);
    const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);
    const [bookedSlots, setBookedSlots] = useState<BookedSlots>({});

    useEffect(() => {
        const promoSeen = sessionStorage.getItem('promoSeen');
        if (!promoSeen && gameConfig?.promoTitle && gameConfig?.promoDescription) {
            setShowPromoPopup(true);
            sessionStorage.setItem('promoSeen', 'true');
        }
    }, [gameConfig]);

    useEffect(() => {
        if (view === 'list') {
            setLoading(true);
            const today = new Date().toISOString().slice(0, 10);
            
            // Filter for today's ads AND filter out placeholder/system ads
            const todaysAds = approvedAds.filter(ad => ad.scheduleDate === today && !ad.orderNumber.includes('sys'));

            const groupedAds = new Map<string, { ad: ApprovedAd; count: number }>();
            todaysAds.forEach(ad => {
                const key = `${ad.title}_${ad.imageUrl}`;
                if (groupedAds.has(key)) {
                    groupedAds.get(key)!.count++;
                } else {
                    groupedAds.set(key, { ad, count: 1 });
                }
            });

            const paidSponsors: Sponsor[] = Array.from(groupedAds.values()).map(({ ad, count }) => ({
                id: ad.orderNumber,
                name: ad.title,
                description: ad.description,
                imageUrl: ad.imageUrl,
                websiteUrl: ad.websiteUrl,
                adType: ad.adType,
                count,
            }));

            const placeholders: Sponsor[] = [];
            const adTypesPresent = new Set(paidSponsors.map(s => s.adType));

            if (!adTypesPresent.has('Billboard')) {
                placeholders.push({
                    id: 'sp_placeholder_billboard', name: "Spi vs Spi: ELINT HEIST", adType: 'Billboard',
                    description: "Every Pioneer becomes a spy in this MMO game hub where you steal ELINT, defend your own, and play mini-games to dominate the network.",
                    imageUrl: "https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Spi%20vs%20Spi%20Coming%20Soon.png",
                    websiteUrl: "https://n3ptun3-dev.github.io/Spi-vs-Spi/"
                });
            }
            if (!adTypesPresent.has('Poster')) {
                placeholders.push(
                    { id: 'sp_placeholder_poster1', name: 'SPEED Cola', description: 'The official drink of fast snakes everywhere. Grab a can and feel the rush!', adType: 'Poster', imageUrl: 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/speed%20cola.jpg', websiteUrl: '#' },
                    { id: 'sp_placeholder_poster2', name: 'Go Forward Foundation', description: 'Supporting snakes who only know one direction: forward. Join the movement.', adType: 'Poster', imageUrl: 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/go%20forward.jpg', websiteUrl: '#' }
                );
            }
            if (!adTypesPresent.has('Banner')) {
                placeholders.push({
                    id: 'sp_placeholder_banner', name: "Join the Pioneers. Shape the Future.", adType: 'Banner',
                    description: `This isn't about getting rich overnight. This is about building something real, together.\n\nThe Pi Network is a social crypto project, a unified effort to create a digital currency that's accessible to everyone, everywhere.\n\nWe're not just mining coins on our phones; we're joining a global community of people who believe in a future where we have a say in our own financial destiny.\n\nBy joining with my link, you're not just getting a bonus Pi coin, you're becoming a founding member of a new digital economy.\n\nYou're part of the team, a team that's pioneering the next step in the future of finance. This is for all of us, by all of us.`,
                    imageUrl: 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/pi_future.jpg',
                    websiteUrl: 'https://minepi.com/n3ptun3'
                });
            }

            const displayList = [...paidSponsors, ...placeholders];

            const sortOrder: Record<AdType, number> = { 'Billboard': 0, 'Poster': 1, 'Banner': 2, 'Flyer': 3, 'CosmeticBanner': 4 };
            displayList.sort((a, b) => {
                if (a.adType !== b.adType) return sortOrder[a.adType] - sortOrder[b.adType];
                return (b.count || 1) - (a.count || 1);
            });

            const defaultFlyers: Sponsor[] = [
                { id: 'sp_flyer_wanted', name: "WANTED: The Snake", description: 'Wanted for crimes against geometry and excessive length. Has been observed consuming everything in sight without discrimination. Approach with caution, may attempt to surround you.', adType: 'Flyer', imageUrl: generateFlyerDataUrl(0), websiteUrl: '#' },
                { id: 'sp_flyer_cola', name: "Quantum Cola", description: 'Tastes like the future! Now with more fizz and a hint of temporal paradox.', adType: 'Flyer', imageUrl: generateFlyerDataUrl(1), websiteUrl: '#' },
                { id: 'sp_flyer_missing', name: "Missing: Glitch the Cat", description: 'Last seen entering a blue portal. Answers to "Glitch". Reward offered.', adType: 'Flyer', imageUrl: generateFlyerDataUrl(2), websiteUrl: '#' },
            ];

            setSponsors([...displayList, ...defaultFlyers]);
            setLoading(false);
        }
    }, [view, approvedAds]);

    const handleSelectType = (type: AdType) => {
        setSelectedType(type);
        setView('calendar');
    };

    const handleDatesConfirm = (dates: string[]) => {
        setSelectedDates(dates);
        setView('form');
    };

    const handleFormSubmit = async (formData: Omit<AdSubmissionData, 'adType' | 'price' | 'scheduleDate' | 'paymentId' | 'originalPrice' | 'piUsername'>) => {
        if (!selectedType || selectedDates.length === 0 || !piUser || !gameConfig) return;

        setLoading(true);
        setFormCache(formData);
        const paymentId = generatePaymentId(formData.title);
        
        // --- Calculate bonus dates and final schedule ---
        const findNextAvailableDate = (startDate: Date, adType: AdType, currentBookedSlots: BookedSlots, maxQuantity: number, quantityToAdd: number): Date => {
            let currentDate = new Date(startDate);
            while (true) {
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                const dateString = currentDate.toISOString().slice(0, 10);
                const slotsBooked = currentBookedSlots[dateString]?.[adType] || 0;
                if (slotsBooked + quantityToAdd <= maxQuantity) {
                    return currentDate;
                }
            }
        };
        const MAX_QUANTITY_PER_DAY: Record<AdType, number> = { Billboard: 1, Poster: 2, Banner: 22, Flyer: 22, CosmeticBanner: 0 };
        const maxQuantity = MAX_QUANTITY_PER_DAY[selectedType];
        
        const promo = promoCodes.get(formData.promoCode?.toUpperCase() || '');
        let bonusDates: string[] = [];
        
        if (promo && promo.isActive && promo.type === 'BOGO' && selectedDates.length > 0) {
            const paidSlots = selectedDates.length * formData.quantity;
            const freeSlots = paidSlots * promo.value;
            const numFreeDays = Math.floor(freeSlots / formData.quantity);

            const lastSelectedDate = new Date(selectedDates[selectedDates.length - 1] + 'T00:00:00Z');
            let currentDate = lastSelectedDate;
            const tempBookedSlots = JSON.parse(JSON.stringify(bookedSlots));
            selectedDates.forEach(d => {
                if(!tempBookedSlots[d]) tempBookedSlots[d] = {};
                tempBookedSlots[d][selectedType] = (tempBookedSlots[d][selectedType] || 0) + formData.quantity;
            });

            for (let i = 0; i < numFreeDays; i++) {
                currentDate = findNextAvailableDate(currentDate, selectedType, tempBookedSlots, maxQuantity, formData.quantity);
                const dateString = currentDate.toISOString().slice(0, 10);
                bonusDates.push(dateString);
                if (!tempBookedSlots[dateString]) tempBookedSlots[dateString] = {};
                tempBookedSlots[dateString][selectedType] = (tempBookedSlots[dateString][selectedType] || 0) + formData.quantity;
            }
        }
        
        const allDates = [...selectedDates, ...bonusDates].sort();
        const scheduleDateString = allDates.join(',');
        
        // --- Calculate price ---
        const pricePerUnit = getAdPrice(selectedType, gameConfig);
        const basePrice = pricePerUnit * formData.quantity * selectedDates.length;
        let finalPrice = basePrice;
        let originalPrice: number | undefined = undefined;

        if (promo && promo.isActive) {
            if (promo.type === 'DISC') {
                finalPrice = basePrice * (1 - (promo.value / 100));
                originalPrice = basePrice;
            }
            // For BOGO, finalPrice is basePrice, which is handled by default. The value is in the free dates.
        }
        
        setLoading(false);
        
        const finalData: AdSubmissionData = {
            ...formData,
            paymentId,
            price: finalPrice,
            originalPrice,
            scheduleDate: scheduleDateString,
            adType: selectedType,
            quantity: formData.quantity,
            piUsername: piUser.username,
        };

        setSubmissionData(finalData);
        setView('payment');
    };

    const handlePaymentConfirm = async (data: AdSubmissionData) => {
        // The payment screen now handles the Pi transaction and backend confirmation.
        // This function is called upon success.
        setView('thank_you');
        setTimeout(() => {
            setView('list');
        }, 5000);
    };

    const handlePaymentBack = () => {
        setSubmissionData(null);
        setView('form');
    };

    const handleAdvertiseClick = async () => {
        const proceed = async () => {
            setLoading(true);
            try {
                const slots = await fetchBookedSlots();
                setBookedSlots(slots);
                setView('select_type');
            } catch (err) {
                setError("Could not load advertising data. Please try again later.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (!piUser) {
            requestPiAuth(proceed);
        } else {
            await proceed();
        }
    };


    const renderContent = () => {
        if (!gameConfig) {
            return <div className="flex justify-center items-center h-full"><p className="text-neutral-400">Loading configuration...</p></div>
        }
        if (loading && view !== 'list') {
             return <div className="flex justify-center items-center h-full"><SpinnerIcon className="w-10 h-10 animate-spin text-cyan-400" /></div>
        }
        switch (view) {
            case 'list':
                return <SponsorList sponsors={sponsors} loading={loading} error={error} onSponsorClick={(sponsor) => { logAdClick('Viewed', sponsor.name); setSelectedSponsor(sponsor); }} />;
            case 'select_type':
                return <AdTypeSelection onSelect={handleSelectType} onBack={() => setView('list')} gameConfig={gameConfig} />;
            case 'calendar':
                if (!selectedType) return null;
                return <Calendar onConfirmDates={handleDatesConfirm} onBack={() => setView('select_type')} adType={selectedType} bookedSlots={bookedSlots} />;
            case 'form':
                if (!selectedType || selectedDates.length === 0) return null;
                return <AdForm onSubmit={handleFormSubmit} onBack={() => setView('calendar')} adType={selectedType} selectedDates={selectedDates} initialData={formCache} promoCodes={promoCodes} onOpenTerms={onOpenTerms} bookedSlots={bookedSlots} piUser={piUser} gameConfig={gameConfig} />;
            case 'payment':
                if (!submissionData) return null;
                return <PaymentScreen data={submissionData} onConfirm={handlePaymentConfirm} onBack={handlePaymentBack} promoCodes={promoCodes} onOpenTerms={onOpenTerms} gameConfig={gameConfig} />;
            case 'thank_you':
                return <ThankYouScreen />;
            default:
                return null;
        }
    };

    const containerClasses = isRotated
        ? 'h-[95%] w-[90%] max-w-[750px]'
        : 'w-full max-w-2xl h-[90dvh] max-h-[750px]';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4" role="dialog" aria-modal="true">
            <div className={`relative bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-cyan-300">
                        Advertising
                    </h2>
                    <div className="flex items-center gap-2 sm:gap-4">
                        {view === 'list' && (
                             <button onClick={handleAdvertiseClick} className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-bold rounded-lg text-sm transition-transform transform hover:scale-105">
                                Advertise With Us
                            </button>
                        )}
                        {(view === 'select_type' || view === 'calendar' || view === 'form') && (
                            <button onClick={() => setIsHowItWorksOpen(true)} className="text-sm text-cyan-400 hover:text-cyan-300 underline">
                                How It Works
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors" aria-label="Close">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>
                <div className="flex-grow overflow-y-auto">
                    {renderContent()}
                    {selectedSponsor && <SponsorDetailModal sponsor={selectedSponsor} onClose={() => setSelectedSponsor(null)} isRotated={isRotated} />}
                </div>
                
                {showPromoPopup && gameConfig?.promoTitle && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex items-center justify-center p-4">
                        <div className="bg-neutral-800 border border-yellow-400 rounded-lg max-w-sm w-full text-center shadow-2xl animate-fade-in flex flex-col max-h-[80vh]">
                            <div className="flex-grow overflow-y-auto p-6">
                                <h3 className="text-xl font-bold text-yellow-300 break-words">{gameConfig.promoTitle}</h3>
                                <p className="mt-4 text-neutral-200 whitespace-pre-wrap text-center">{gameConfig.promoDescription}</p>
                            </div>
                            <div className="p-6 pt-2 flex-shrink-0">
                                <button 
                                    onClick={() => setShowPromoPopup(false)} 
                                    className="w-full px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-800 focus:ring-cyan-400"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isHowItWorksOpen && <HowItWorksOverlay onClose={() => setIsHowItWorksOpen(false)} isRotated={isRotated} />}
            </div>
        </div>
    );
};

const SponsorList: React.FC<{ sponsors: Sponsor[]; loading: boolean; error: string | null; onSponsorClick: (sponsor: Sponsor) => void; }> = ({ sponsors, loading, error, onSponsorClick }) => {
    const getTierStyle = (adType: AdType) => {
        switch (adType) {
            case 'Billboard': return 'border-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20';
            case 'Poster': return 'border-gray-400 bg-gray-400/10 hover:bg-gray-400/20';
            case 'Banner': return 'border-orange-500 bg-orange-600/10 hover:bg-orange-600/20';
            case 'Flyer': return 'border-sky-500 bg-sky-600/10 hover:bg-sky-600/20';
            default: return 'border-neutral-700 bg-neutral-800/20 hover:bg-neutral-700/40';
        }
    };

    return (
        <div className="p-4 sm:p-6 h-full flex flex-col">
            <div className="flex-grow overflow-y-auto pr-2">
                <h3 className="text-lg font-bold text-white mb-4">Our Valued Sponsors</h3>
                {loading && <div className="flex justify-center items-center h-40"><SpinnerIcon className="w-10 h-10 animate-spin text-cyan-400" /></div>}
                {error && <p className="text-red-400">{error}</p>}
                {!loading && !error && (
                    <ul className="space-y-3">
                        {sponsors.map(sponsor => (
                            <li key={sponsor.id} onClick={() => onSponsorClick(sponsor)} className={`p-4 rounded-lg border-l-4 transition-colors cursor-pointer ${getTierStyle(sponsor.adType)}`}>
                                <div className="flex items-start gap-4">
                                    <img src={sponsor.imageUrl} alt={`${sponsor.name} logo`} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md bg-black/20 flex-shrink-0" />
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-white text-base sm:text-lg">{sponsor.name}</h4>
                                            <span className="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-black/30 text-neutral-300">{sponsor.count && sponsor.count > 1 ? `${sponsor.count}x ` : ''}{sponsor.adType}</span>
                                        </div>
                                        <p className="text-sm text-neutral-300 mt-1 line-clamp-2">{sponsor.description}</p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

const AdTypeSelection: React.FC<{ onSelect: (type: AdType) => void; onBack: () => void; gameConfig: GameConfig; }> = ({ onSelect, onBack, gameConfig }) => {
    const adTypes: { type: AdType; image: string; description: string; specs: string; }[] = [
        { type: 'Billboard', image: 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/billboard_preview.png', description: 'Premium placement, one per day.', specs: '16:9 Landscape / Black BG' },
        { type: 'Poster', image: 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/poster_preview.png', description: 'High visibility, two per day.', specs: '9:16 Portrait / Black BG' },
        { type: 'Banner', image: 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/banner_preview.png', description: 'Placed on buildings and structures.', specs: '16:9 Landscape / Black BG' },
        { type: 'Flyer', image: 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/flyer_preview.png', description: 'Affixed to perimeter walls.', specs: '1:1 Square / Transparent BG' },
    ];

    return (
        <div className="p-4 sm:p-6">
            <h3 className="text-lg font-bold text-white mb-4">Choose Your Ad Type</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {adTypes.map(({ type, image, description, specs }) => (
                    <button key={type} onClick={() => onSelect(type)} className="text-left bg-neutral-800 hover:bg-neutral-700/80 p-4 rounded-lg border border-neutral-700 hover:border-cyan-400 transition-all group">
                        <img src={image} alt={`${type} preview`} className="w-full aspect-square object-cover rounded-md mb-3" />
                        <h4 className="text-lg font-bold text-white group-hover:text-cyan-300">{type}</h4>
                        <p className="text-sm text-neutral-400">{description}</p>
                        <p className="text-sm text-neutral-400 mt-1">{specs}</p>
                        <p className="text-base font-bold text-yellow-300 mt-2">{getAdPrice(type, gameConfig)} Pi / unit / day</p>
                    </button>
                ))}
            </div>
            <button onClick={onBack} className="mt-6 text-sm text-neutral-400 hover:text-white underline">
                &larr; Back to sponsors
            </button>
        </div>
    );
};

const Calendar: React.FC<{ onConfirmDates: (dates: string[]) => void; onBack: () => void; adType: AdType; bookedSlots: BookedSlots; }> = ({ onConfirmDates, onBack, adType, bookedSlots }) => {
    const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const selectedDateSet = new Set(selectedDates);

    const startOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
    const endOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0);
    const daysInMonth = endOfMonth.getDate();
    const startDayOfWeek = startOfMonth.getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const MAX_QUANTITY_PER_DAY: Record<AdType, number> = { Billboard: 1, Poster: 2, Banner: 22, Flyer: 22, CosmeticBanner: 0 };

    const handleDayClick = (day: number) => {
        const clickedDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), day);
        if (clickedDate < today) return;

        const year = clickedDate.getFullYear();
        const month = (clickedDate.getMonth() + 1).toString().padStart(2, '0');
        const dayOfMonth = clickedDate.getDate().toString().padStart(2, '0');
        const dateString = `${year}-${month}-${dayOfMonth}`;
        
        const slotsBooked = bookedSlots[dateString]?.[adType] || 0;
        const maxSlots = MAX_QUANTITY_PER_DAY[adType];
        if (slotsBooked >= maxSlots) return;

        const newSelectedDates = new Set(selectedDates);

        if (newSelectedDates.has(dateString)) {
            newSelectedDates.delete(dateString);
        } else {
            newSelectedDates.add(dateString);
        }
        
        setSelectedDates(Array.from(newSelectedDates).sort());
    };
    
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: startDayOfWeek });

    return (
        <div className="p-4 sm:p-6 flex flex-col h-full">
            <div className="flex-grow">
                <h3 className="text-lg font-bold text-white mb-1">Select Dates for your <span className="text-yellow-300">{adType}</span></h3>
                <p className="text-sm text-neutral-400 mb-4">Choose one or more available days to run your ad.</p>
                <div className="bg-neutral-800 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1))} className="p-2 rounded-full hover:bg-white/10"><ChevronLeftIcon className="w-5 h-5" /></button>
                        <h4 className="font-bold text-lg text-white">{currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
                        <button onClick={() => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1))} className="p-2 rounded-full hover:bg-white/10"><ChevronRightIcon className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-400 mb-2">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {blanks.map((_, i) => <div key={`blank-${i}`} />)}
                        {days.map(day => {
                            const d = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), day);
                            const year = d.getFullYear();
                            const month = (d.getMonth() + 1).toString().padStart(2, '0');
                            const dayOfMonth = d.getDate().toString().padStart(2, '0');
                            const dString = `${year}-${month}-${dayOfMonth}`;
                            const isPast = d < today;
                            const isSelected = selectedDateSet.has(dString);
                            const slotsBooked = bookedSlots[dString]?.[adType] || 0;
                            const slotsAvailable = MAX_QUANTITY_PER_DAY[adType] - slotsBooked;
                            const isFull = slotsAvailable <= 0;

                            return (
                                <button key={day} onClick={() => handleDayClick(day)} disabled={isPast || isFull}
                                    className={`relative w-10 h-10 rounded-full text-sm transition-colors flex items-center justify-center
                                        ${isPast ? 'text-neutral-600 cursor-not-allowed' : 'text-white'}
                                        ${isSelected ? 'bg-cyan-500 hover:bg-cyan-600' : isPast ? '' : isFull ? 'bg-red-900/50 text-neutral-500 cursor-not-allowed' : 'bg-neutral-700 hover:bg-neutral-600'}
                                    `}
                                >
                                    {day}
                                    {!isPast && !isFull && !isSelected && <span className="absolute -bottom-1 -right-1 text-[8px] bg-green-500 text-black font-bold rounded-full px-1">{slotsAvailable}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="flex-shrink-0 pt-4 mt-4 pb-4">
                 <div className="flex gap-4">
                    <button onClick={onBack} className="flex-1 py-2 px-4 bg-neutral-600 hover:bg-neutral-500 rounded-lg text-white font-bold transition-colors">Back</button>
                    <button onClick={() => onConfirmDates(selectedDates)} disabled={selectedDates.length === 0} className="flex-1 py-2 px-4 bg-green-700 hover:bg-green-800 rounded-lg text-white font-bold transition-colors disabled:opacity-50 disabled:bg-green-700/50">
                       Next ({selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'})
                    </button>
                </div>
            </div>
        </div>
    );
};

type AdFormFields = Omit<AdSubmissionData, 'paymentId'|'scheduleDate'|'adType'|'price'|'originalPrice'|'piUsername'>;

/**
 * NOTE FOR FINE-TUNING PREVIEW:
 * This object controls the appearance of the live ad preview.
 * - backgroundUrl: The in-game screenshot for the ad space.
 * - flyerWallUrl: A special background for flyers when an image is provided.
 * - positioning: Values are percentages. Adjust top, left, width, and height to perfectly align the user's image with the ad space in the background screenshot.
 * - rotation: The rotation in degrees (primarily for flyers).
 * - overlayOpacity: A value from 0 (transparent) to 1 (black) to soften bright images, mimicking in-game lighting.
 */
const PREVIEW_CONFIG: Record<AdType, {
    backgroundUrl: string;
    flyerWallUrl?: string;
    positioning: { top: string; left: string; width: string; height: string; };
    rotation: number;
    overlayOpacity: number;
}> = {
    Billboard: {
        backgroundUrl: 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/billboard_set_preview.jpg',
        positioning: { top: '20%', left: '18%', width: '65%', height: '45%' },
        rotation: 0,
        overlayOpacity: 0.4,
    },
    Poster: {
        backgroundUrl: 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/poster_set_preview.jpg',
        positioning: { top: '9%', left: '35%', width: '29%', height: '71%' },
        rotation: 0,
        overlayOpacity: 0.4,
    },
    Banner: {
        backgroundUrl: 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/banner_set_preview.jpg',
        positioning: { top: '16.3%', left: '30%', width: '41.5%', height: '30.7%' },
        rotation: 0,
        overlayOpacity: 0.4,
    },
    Flyer: {
        backgroundUrl: 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/flyer_set_preview.jpg',
        flyerWallUrl: 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/flyer_set_wall_preview.jpg',
        positioning: { top: '31%', left: '44%', width: '45%', height: '45%' },
        rotation: -5,
        overlayOpacity: 0.0,
    },
    CosmeticBanner: { // Fallback, not selectable
        backgroundUrl: '',
        positioning: { top: '0%', left: '0%', width: '0%', height: '0%' },
        rotation: 0,
        overlayOpacity: 0,
    }
};

const AdForm: React.FC<{
    onSubmit: (data: AdFormFields) => void;
    onBack: () => void;
    adType: AdType;
    selectedDates: string[];
    initialData: AdFormFields | null;
    promoCodes: Map<string, PromoCode>;
    onOpenTerms: () => void;
    bookedSlots: BookedSlots;
    piUser: UserDTO | null;
    gameConfig: GameConfig;
}> = ({ onSubmit, onBack, adType, selectedDates, initialData, promoCodes, onOpenTerms, bookedSlots, piUser, gameConfig }) => {
    const [formData, setFormData] = useState<AdFormFields>(initialData || {
        imageUrl: '',
        title: '',
        description: '',
        websiteUrl: '',
        quantity: 1,
        promoCode: '',
    });
    const [promoStatus, setPromoStatus] = useState<{ type: 'valid' | 'invalid' | 'idle', message: string }>({ type: 'idle', message: ''});
    const [bonusDates, setBonusDates] = useState<string[]>([]);
    const isDummy = piService.isDummyMode();
    
    const isBillboard = adType === 'Billboard';
    const numDays = selectedDates.length;
    const MAX_QUANTITY_PER_DAY: Record<AdType, number> = { Billboard: 1, Poster: 2, Banner: 22, Flyer: 22, CosmeticBanner: 0 };
    
    const effectiveMaxQuantity = useMemo(() => {
        if (!selectedDates.length) {
            return MAX_QUANTITY_PER_DAY[adType];
        }
        const availableSlotsPerDay = selectedDates.map(date => {
            const booked = bookedSlots[date]?.[adType] || 0;
            return MAX_QUANTITY_PER_DAY[adType] - booked;
        });
        return Math.max(0, Math.min(...availableSlotsPerDay));
    }, [selectedDates, bookedSlots, adType]);

    useEffect(() => {
        // When max quantity changes (e.g., date selection changes), adjust the current quantity if it's too high.
        if (formData.quantity > effectiveMaxQuantity) {
            setFormData(fd => ({ ...fd, quantity: effectiveMaxQuantity > 0 ? effectiveMaxQuantity : 1 }));
        }
    }, [effectiveMaxQuantity, formData.quantity]);

    useEffect(() => {
        if (isBillboard) {
            setFormData(fd => ({ ...fd, quantity: 1 }));
        } else if (!initialData) {
            // On mount or adType change (without initial data), reset quantity but respect the max available.
            const initialQuantity = Math.min(1, effectiveMaxQuantity > 0 ? effectiveMaxQuantity : 1);
            setFormData(fd => ({ ...fd, quantity: initialQuantity, promoCode: '' }));
        }
    }, [adType, numDays, initialData, isBillboard, effectiveMaxQuantity]);

    useEffect(() => {
        const findNextAvailableDate = (startDate: Date, adType: AdType, currentBookedSlots: BookedSlots, maxQuantity: number, quantityToAdd: number): Date => {
            let currentDate = new Date(startDate);
            while (true) {
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                const dateString = currentDate.toISOString().slice(0, 10);
                const slotsBooked = currentBookedSlots[dateString]?.[adType] || 0;
                if (slotsBooked + quantityToAdd <= maxQuantity) {
                    return currentDate;
                }
            }
        };

        const promo = promoCodes.get(formData.promoCode?.toUpperCase() || '');
        if (promo && promo.isActive && promo.type === 'BOGO' && selectedDates.length > 0) {
            const paidSlots = selectedDates.length * formData.quantity;
            const freeSlots = paidSlots * promo.value;
            const numFreeDays = Math.floor(freeSlots / formData.quantity);

            const lastSelectedDate = new Date(selectedDates[selectedDates.length - 1] + 'T00:00:00Z');
            
            let currentDate = lastSelectedDate;
            const newBonusDates: string[] = [];
            const tempBookedSlots = JSON.parse(JSON.stringify(bookedSlots));
            selectedDates.forEach(d => {
                if(!tempBookedSlots[d]) tempBookedSlots[d] = {};
                tempBookedSlots[d][adType] = (tempBookedSlots[d][adType] || 0) + formData.quantity;
            });
            
            for (let i = 0; i < numFreeDays; i++) {
                currentDate = findNextAvailableDate(currentDate, adType, tempBookedSlots, MAX_QUANTITY_PER_DAY[adType], formData.quantity);
                const dateString = currentDate.toISOString().slice(0, 10);
                newBonusDates.push(dateString);

                if (!tempBookedSlots[dateString]) tempBookedSlots[dateString] = {};
                tempBookedSlots[dateString][adType] = (tempBookedSlots[dateString][adType] || 0) + formData.quantity;
            }
            setBonusDates(newBonusDates);
            setPromoStatus({ type: 'valid', message: `Success! You get ${numFreeDays} free day(s).` });
        } else {
            setBonusDates([]);
            if (promo && promo.isActive && promo.type === 'DISC') {
                setPromoStatus({ type: 'valid', message: `Success! ${promo.value}% discount applied.` });
            } else if (formData.promoCode) {
                setPromoStatus({ type: 'invalid', message: 'Invalid or expired promo code.' });
            } else {
                setPromoStatus({ type: 'idle', message: '' });
            }
        }
    }, [formData.promoCode, formData.quantity, selectedDates, promoCodes, adType, bookedSlots]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        if (name === 'imageUrl') {
            const match = value.match(/<img[^>]+src="([^">]+)"/);
            const extractedUrl = match ? match[1] : value;
            setFormData({ ...formData, [name]: extractedUrl });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = parseInt(e.target.value, 10);
        if (isNaN(value) || value < 1) value = 1;
        if (value > effectiveMaxQuantity) value = effectiveMaxQuantity;
        setFormData({ ...formData, quantity: value });
    };

    const handlePromoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const code = e.target.value;
        setFormData({ ...formData, promoCode: code });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };
    
    const fieldConfigs: { name: keyof Omit<AdFormFields, 'quantity' | 'promoCode' | 'piUsername'>; label: string; type: 'text' | 'url' | 'textarea'; required: boolean }[] = [
        { name: 'imageUrl', label: 'Image URL or HTML Embed Code', type: 'url', required: true },
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'description', label: 'Description', type: 'textarea', required: false },
        { name: 'websiteUrl', label: 'Website URL', type: 'url', required: false },
    ];
    
    const pricePerUnit = getAdPrice(adType, gameConfig);
    const basePrice = pricePerUnit * formData.quantity * numDays;
    let finalPrice = basePrice;
    
    if (formData.promoCode && promoStatus.type === 'valid') {
        const promo = promoCodes.get(formData.promoCode.toUpperCase());
        if (promo) {
            if (promo.type === 'DISC') {
                finalPrice = basePrice * (1 - promo.value / 100);
            }
        }
    }

    const totalPrice = finalPrice.toFixed(2);
    const formattedDates = selectedDates.map(dstr => {
        const [year, month, day] = dstr.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', timeZone: 'UTC'});
    }).join(', ');
    const formattedBonusDates = bonusDates.map(dstr => {
        const [year, month, day] = dstr.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', timeZone: 'UTC'});
    }).join(', ');
    
    const config = PREVIEW_CONFIG[adType];
    const hasImage = !!formData.imageUrl;
    let backgroundUrl = config.backgroundUrl;
    if (adType === 'Flyer' && hasImage && config.flyerWallUrl) {
        backgroundUrl = config.flyerWallUrl;
    }
    const showWhiteBg = hasImage && adType !== 'Flyer';

    return (
        <div className="p-4 sm:p-6">
             <h3 className="text-lg font-bold text-white mb-1">Details for your <span className="text-yellow-300">{adType}</span> Ad</h3>
             <p className="text-sm text-neutral-400 mb-4">On dates: {formattedDates}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {fieldConfigs.map(field => {
                         const isTextarea = field.type === 'textarea';
                         const props = {
                            name: field.name,
                            id: field.name,
                            value: formData[field.name as keyof typeof formData],
                            onChange: handleChange,
                            required: field.required,
                            className: "w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400 transition-colors",
                            placeholder: field.label
                         };
                         return <div key={field.name}>
                            <label htmlFor={field.name} className="block text-sm font-medium text-neutral-300 mb-1">{field.label}{field.required && ' *'}</label>
                            {isTextarea ? <textarea {...props} rows={2} /> : <input type={field.type} {...props} />}
                         </div>
                    })}
                    
                    <div>
                        <label htmlFor="piUsername" className="block text-sm font-medium text-neutral-300 mb-1">Pi Username</label>
                        <input type="text" id="piUsername" value={piUser?.username || 'Authenticating...'} readOnly
                            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-neutral-400 focus:outline-none" />
                    </div>

                     <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-neutral-300 mb-1">Quantity per day (max {effectiveMaxQuantity})</label>
                        <input type="number" id="quantity" name="quantity" value={formData.quantity} onChange={handleQuantityChange} min="1" max={effectiveMaxQuantity}
                         className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400 transition-colors disabled:bg-neutral-700"
                         disabled={isBillboard || effectiveMaxQuantity <= 1} />
                    </div>

                    <div>
                        <label htmlFor="promoCode" className="block text-sm font-medium text-neutral-300 mb-1">Promo Code (optional)</label>
                        <input type="text" id="promoCode" name="promoCode" value={formData.promoCode} onChange={handlePromoChange}
                            className={`w-full px-3 py-2 bg-neutral-800 border rounded-md text-white placeholder-neutral-500 focus:outline-none transition-colors ${
                                promoStatus.type === 'valid' ? 'border-green-500' : promoStatus.type === 'invalid' ? 'border-red-500' : 'border-neutral-600'
                            } focus:border-cyan-400`}
                            placeholder="Enter code"
                        />
                        {promoStatus.message && <p className={`text-xs mt-1 ${promoStatus.type === 'valid' ? 'text-green-400' : 'text-red-400'}`}>{promoStatus.message}</p>}
                        {bonusDates.length > 0 && (
                            <div className="mt-1 text-xs text-green-400">
                                <p className="font-bold">Your free ad days will be:</p>
                                <p>{formattedBonusDates}</p>
                            </div>
                        )}
                    </div>

                    <div className="text-xs text-neutral-500">
                        By submitting, you agree to our{' '}
                        <button type="button" onClick={onOpenTerms} className="underline hover:text-cyan-400 transition-colors">
                            Terms and Conditions
                        </button>
                        .
                    </div>
                    <div className="flex gap-4 pt-2">
                        <button type="button" onClick={onBack} className="flex-1 py-2 px-4 bg-neutral-600 hover:bg-neutral-500 rounded-lg text-white font-bold transition-colors">Back</button>
                        <button type="submit" disabled={!formData.imageUrl || !formData.title} className="flex-1 py-2 px-4 bg-green-700 hover:bg-green-800 rounded-lg text-white font-bold transition-colors disabled:opacity-50 disabled:bg-green-700/50">Pay {totalPrice} Pi</button>
                    </div>
                     {isDummy && (
                        <p className="text-center text-xs text-yellow-400 pt-2">
                            <strong>Test Mode:</strong> No real Pi will be charged. Feel free to test the submission process.
                        </p>
                    )}
                </form>
                <div className="space-y-4">
                     <h4 className="text-base font-bold text-white">Live Preview</h4>
                     <div className="relative w-full rounded-lg border border-neutral-600 overflow-hidden">
                        <img 
                            src={backgroundUrl} 
                            alt={`${adType} preview background`} 
                            className="block w-full h-auto object-contain"
                        />
                        {hasImage && (
                            <div
                                className="absolute"
                                style={{
                                    top: config.positioning.top,
                                    left: config.positioning.left,
                                    width: config.positioning.width,
                                    height: config.positioning.height,
                                    transform: `rotate(${config.rotation}deg)`
                                }}
                            >
                                {showWhiteBg && (
                                    <div className="absolute inset-0 bg-black"></div>
                                )}
                                <img 
                                    src={formData.imageUrl} 
                                    alt="Ad preview" 
                                    className="relative w-full h-full object-contain"
                                    onError={(e) => e.currentTarget.src = 'https://i.imgur.com/gG5Zqg1.png'}
                                />
                                <div 
                                    className="absolute inset-0 bg-black pointer-events-none" 
                                    style={{ opacity: config.overlayOpacity }}
                                ></div>
                            </div>
                        )}
                        {!hasImage && (
                             <div className="absolute inset-0 flex items-center justify-center">
                                 <span className="text-neutral-500 text-sm"> </span>
                             </div>
                        )}
                     </div>
                     <p className="text-xs text-neutral-400">This is a representation of your ad in-game. Final appearance may vary.</p>
                </div>
            </div>
        </div>
    );
};

const ThankYouScreen: React.FC = () => (
    <div className="p-6 text-center flex flex-col items-center justify-center h-full">
        <h3 className="text-2xl font-bold text-green-400 mb-2">Thank You!</h3>
        <p className="text-neutral-300">Your submission has been received.</p>
        <p className="text-neutral-300 mt-2">It will be scheduled for display pending approval.</p>
        <SpinnerIcon className="w-10 h-10 animate-spin text-cyan-400 mx-auto mt-6" />
        <p className="mt-2 text-sm text-neutral-400">Returning to sponsor list...</p>
    </div>
);


interface PaymentScreenProps {
  data: AdSubmissionData;
  onConfirm: (data: AdSubmissionData) => Promise<void>;
  onBack: () => void;
  promoCodes: Map<string, PromoCode>;
  onOpenTerms: () => void;
  gameConfig: GameConfig;
}

const PaymentScreen: React.FC<PaymentScreenProps> = ({ data, onConfirm, onBack, promoCodes, onOpenTerms, gameConfig }) => {
    const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const isDummy = piService.isDummyMode();

    const handlePayClick = async () => {
        setStatus('submitting');
        setError(null);
    
        try {
            // Step 1: Submit the ad data to the Google Form to create the record.
            // This is the "fire-and-forget" part of the process.
            await submitAd(data);
    
            // Step 2: Initiate the Pi Payment flow.
            const paymentData = {
                amount: data.price,
                memo: data.paymentId, // This is crucial for matching the payment.
                metadata: { 
                    title: data.title,
                    adType: data.adType,
                    dates: data.scheduleDate,
                },
            };
    
            const callbacks = {
                onReadyForServerApproval: (paymentId: string) => {
                    // This is called when the payment is created. In a full backend setup,
                    // we'd notify our server to approve it. In the sandbox, it can auto-approve.
                    // We've already submitted the form, so no action is needed here for our flow.
                    console.log('Pi Payment ready for server approval:', paymentId);
                },
                onReadyForServerCompletion: async (payment: any) => {
                    // This is called after the user confirms the payment in the Pi dialog.
                    console.log('Pi Payment ready for server completion:', payment);
                    try {
                        // Step 3: Call our backend to confirm the payment, which updates the spreadsheet.
                        await confirmPayment(payment.identifier); // payment.identifier is the paymentId
                        // This onConfirm prop will change the view to the "Thank You" screen.
                        await onConfirm(data);
                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
                        setError(`Failed to confirm payment with our server. Please contact support with your Payment ID: ${data.paymentId}. Error: ${errorMessage}`);
                        setStatus('error');
                    }
                },
                onCancel: () => {
                    setStatus('idle');
                    setError('Payment was cancelled.');
                },
                onError: (error: any) => {
                    setStatus('error');
                    setError(error.message || 'An unknown error occurred during payment.');
                    console.error('Pi Payment Error:', error);
                },
            };
            
            piService.createPayment(paymentData, callbacks);
    
        } catch (e) {
            // This catches errors from the initial `submitAd` call.
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(`Failed to prepare your ad for payment. Please try again. Error: ${errorMessage}`);
            setStatus('error');
        }
    };
    

    const allDates = data.scheduleDate.split(',');
    const totalQuantity = data.quantity * allDates.length;

    const formattedDates = allDates.map(dstr => {
        const [year, month, day] = dstr.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', timeZone: 'UTC'});
    }).join(', ');
    
    let promoMessage: string | null = null;
    if (data.promoCode) {
        const promo = promoCodes.get(data.promoCode.toUpperCase());
        if (promo && promo.isActive) {
            if (promo.type === 'BOGO') {
                const pricePerUnit = getAdPrice(data.adType, gameConfig);
                const bonusDays = allDates.length - (data.originalPrice !== undefined ? (data.originalPrice / (pricePerUnit * data.quantity)) : allDates.length);
                if (bonusDays > 0) {
                    promoMessage = `Promo applied! Includes ${bonusDays} bonus day(s).`;
                }
            } else if (promo.type === 'DISC') {
                promoMessage = `Promo applied! (${promo.value}% Off)`;
            }
        }
    }

    return (
        <div className="p-4 sm:p-6 text-center">
            <h3 className="text-2xl font-bold text-yellow-300 mb-2">Confirm Your Order</h3>
            <p className="text-neutral-300 mb-4">Please review your ad details before proceeding to payment.</p>
            
            <div className="bg-neutral-800 rounded-lg p-4 max-w-sm mx-auto text-left space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-neutral-400">Ad Type:</span> <span className="font-bold text-white">{data.adType}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">Quantity per day:</span> <span className="font-bold text-white">{data.quantity}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">Total Slots:</span> <span className="font-bold text-white">{totalQuantity}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">Dates:</span> <span className="font-bold text-white text-right break-words">{formattedDates}</span></div>
                <hr className="border-neutral-700 my-2" />
                {data.originalPrice && (
                    <div className="flex justify-between text-neutral-400 line-through"><span >Subtotal:</span> <span>{data.originalPrice.toFixed(2)} Pi</span></div>
                )}
                 {promoMessage && (
                    <div className="flex justify-between text-green-400"><span>Discount:</span> <span>{promoMessage}</span></div>
                )}
                <div className="flex justify-between text-xl"><span className="text-neutral-300">Total Cost:</span> <span className="font-bold text-yellow-300">{data.price.toFixed(2)} Pi</span></div>
            </div>
            
            <p className="text-xs text-neutral-500 mt-4">
                By proceeding, you agree to the{' '}
                <button type="button" onClick={onOpenTerms} className="underline hover:text-cyan-400 transition-colors">
                    Terms and Conditions
                </button>
                . All payments are final.
            </p>
            {error && <p className="text-red-400 mt-4">{error}</p>}

            <div className="flex gap-4 mt-6">
                 <button onClick={onBack} disabled={status === 'submitting'} className="flex-1 py-3 px-4 bg-neutral-600 hover:bg-neutral-500 rounded-lg text-white font-bold transition-colors disabled:opacity-50">Back</button>
                <button onClick={handlePayClick} disabled={status === 'submitting'} className="flex-1 py-3 px-4 bg-yellow-500 hover:bg-yellow-600 rounded-lg text-black font-bold transition-colors disabled:opacity-50 disabled:bg-yellow-500/50 flex items-center justify-center">
                    {status === 'submitting' ? <SpinnerIcon className="w-6 h-6 animate-spin" /> : `Pay ${data.price.toFixed(2)} Pi`}
                </button>
            </div>
             {isDummy && (
                <p className="text-center text-xs text-yellow-400 mt-4">
                    <strong>Test Mode:</strong> No real Pi will be charged. This is a simulated transaction for testing purposes.
                </p>
            )}
        </div>
    );
};


export default AdvertisingOverlay;