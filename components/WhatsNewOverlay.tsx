import React, { useState, useEffect, useRef } from 'react';
import { XIcon, SparklesIcon, RocketIcon, CoffeeTeacupIcon, CoffeeMugSmallIcon, CoffeeMugMediumIcon, CoffeeMugLargeIcon, CoffeeMugXLargeIcon, SpinnerIcon } from './icons';
import { UserDTO } from '../types';
import { piService } from '../utils/pi';
import { BACKEND_URL, DUMMY_MODE } from '../config';

interface WhatsNewOverlayProps {
    onClose: () => void;
    isRotated: boolean;
    piUser: UserDTO | null;
    requestPiAuth: (intent: 'submit-score' | 'purchase-ad' | 'link-device' | 'donation', onSuccess: () => void, data?: any) => void;
}

const WhatsNewOverlay: React.FC<WhatsNewOverlayProps> = ({ onClose, isRotated, piUser, requestPiAuth }) => {
    const [activeTab, setActiveTab] = useState<'new' | 'next' | 'vision'>('new');

    const containerClasses = isRotated
        ? 'h-[95%] w-[90%] max-w-2xl'
        : 'h-[90%] w-[95%] max-w-lg';

    // This reusable component contains the entire "Buy a coffee" donation flow.
    const DonationSection = () => {
        const [selectedTier, setSelectedTier] = useState<number | null>(null);
        const [customAmount, setCustomAmount] = useState('');
        const [paymentStatus, setPaymentStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
        const [paymentError, setPaymentError] = useState('');
        const scrollContainerRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            if (scrollContainerRef.current) {
                // Scroll to the far right to show the custom option by default on narrow screens
                scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
            }
        }, []);

        const handleTierSelect = (amount: number) => {
            setSelectedTier(amount);
            setCustomAmount('');
        };

        const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            // Allow only numbers and one decimal point
            if (/^\d*\.?\d{0,7}$/.test(value)) {
                setCustomAmount(value);
                setSelectedTier(null);
            }
        };

        const finalAmount = selectedTier !== null ? selectedTier : parseFloat(customAmount) || 0;
        const isButtonDisabled = finalAmount <= 0 || paymentStatus === 'loading';

        const handleBuyCoffee = () => {
            if (isButtonDisabled) return;

            const makePayment = async () => {
                if (!piUser) return; // Should not happen if button is enabled
                setPaymentStatus('loading');
                setPaymentError('');

                try {
                    // 1. Create a donation order on the backend
                    const orderResponse = await fetch(`${BACKEND_URL}/createDonation`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            piUsername: piUser.username,
                            amount: finalAmount,
                            dummyMode: DUMMY_MODE,
                        }),
                    });
                    const orderData = await orderResponse.json();
                    if (!orderResponse.ok) {
                        throw new Error(orderData.error || 'Failed to create donation order.');
                    }
                    const paymentId = orderData.paymentId;

                    // 2. Initiate Pi Payment
                    const paymentData = {
                        amount: finalAmount,
                        memo: paymentId,
                        metadata: { type: 'donation', user: piUser.username },
                    };

                    const callbacks = {
                        onReadyForServerCompletion: async () => {
                            setPaymentStatus('success');
                        },
                        onCancel: () => {
                            setPaymentStatus('idle');
                        },
                        onError: (error: Error) => {
                            setPaymentError(error.message || 'An unknown error occurred during payment.');
                            setPaymentStatus('error');
                        },
                    };

                    piService.createPayment(paymentData, paymentId, callbacks);

                } catch (e) {
                    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
                    setPaymentError(message);
                    setPaymentStatus('error');
                }
            };
            
            if (piUser) {
                makePayment();
            } else {
                requestPiAuth('donation', makePayment);
            }
        };

        const coffeeTiers = [
            { amount: 0.5, Icon: CoffeeTeacupIcon },
            { amount: 1, Icon: CoffeeMugSmallIcon },
            { amount: 3, Icon: CoffeeMugMediumIcon },
            { amount: 5, Icon: CoffeeMugLargeIcon },
        ];
        
        if (paymentStatus === 'success') {
            return (
                 <div className="mt-8 text-center">
                    <h3 className="text-xl font-bold text-green-400">Thank You!</h3>
                    <p className="text-neutral-300 mt-2">Your support means the world and helps keep the servers running and the updates coming. Cheers!</p>
                </div>
            );
        }

        return (
            <div className="pt-6 mt-6 border-t border-neutral-700 text-center">
                <h4 className="text-xl font-bold text-cyan-400">Like what we do?</h4>
                <p className="mt-2 text-neutral-300 max-w-md mx-auto">If you enjoy the game and believe in our vision, you can show your support by buying the dev a virtual coffee. Every bit helps fuel future updates and new features!</p>

                <div ref={scrollContainerRef} className="overflow-x-auto pb-2 -mb-2">
                    <div className="flex justify-start sm:justify-center items-end gap-2 sm:gap-4 mt-6 min-w-max px-4 sm:px-0">
                        {coffeeTiers.map(({ amount, Icon }) => (
                            <button key={amount} onClick={() => handleTierSelect(amount)} className={`flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition-all ${selectedTier === amount ? 'border-cyan-400 bg-cyan-500/20' : 'border-transparent hover:bg-white/10'}`}>
                                <Icon className={`w-10 h-10 sm:w-12 sm:h-12 ${selectedTier === amount ? 'text-cyan-300' : 'text-neutral-400'}`} />
                                <span className={`text-sm font-bold ${selectedTier === amount ? 'text-white' : 'text-neutral-300'}`}>{amount} π</span>
                            </button>
                        ))}
                        <div className={`flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition-all ${selectedTier === null ? 'border-cyan-400 bg-cyan-500/20' : 'border-transparent'}`}>
                            <CoffeeMugXLargeIcon className={`w-10 h-10 sm:w-12 sm:h-12 ${selectedTier === null ? 'text-cyan-300' : 'text-neutral-400'}`} />
                            <input
                                type="text"
                                inputMode="decimal"
                                value={customAmount}
                                onChange={handleCustomAmountChange}
                                placeholder="Custom"
                                className="w-16 bg-transparent border-b border-neutral-500 text-center text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
                            />
                        </div>
                    </div>
                </div>

                 <div className="mt-6">
                    <button
                        onClick={handleBuyCoffee}
                        disabled={isButtonDisabled}
                        className="px-8 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:bg-yellow-500/50 disabled:cursor-not-allowed flex items-center justify-center min-w-[200px] mx-auto"
                    >
                        {paymentStatus === 'loading' ? <SpinnerIcon className="w-6 h-6 animate-spin" /> : `Buy the Dev a Coffee`}
                    </button>
                    {paymentError && <p className="text-red-400 mt-2 text-sm">{paymentError}</p>}
                </div>
            </div>
        );
    };

    const TabButton: React.FC<{ tabId: 'new' | 'next' | 'vision'; label: string; }> = ({ tabId, label }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`flex-1 p-3 text-sm sm:text-base font-semibold border-b-2 transition-colors ${
                activeTab === tabId
                    ? 'border-cyan-400 text-white'
                    : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
            aria-pressed={activeTab === tabId}
        >
            {label}
        </button>
    );

    const BulletPoint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <li className="flex items-start gap-3">
            <span className="mt-1 flex-shrink-0 text-cyan-400">
                <SparklesIcon className="w-4 h-4" />
            </span>
            <span>{children}</span>
        </li>
    );

    const WhatsNewContent = () => (
        <div className="space-y-4">
            <p className="text-neutral-300">We've been busy shipping updates thanks to your amazing feedback!</p>
            
            <p className="text-sm text-neutral-400 font-semibold">October 15, 2025</p>
            <ul className="space-y-3 text-neutral-200 text-sm">
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Smarter Frame Rate Management:</strong> We've optimized the rendering engine for a smoother experience for everyone. Gameplay on 'High' and 'Medium' settings now targets a fluid 60 FPS, while all menus and gameplay on the 'Low' graphics setting are capped at a power-saving 30 FPS. This ensures maximum performance where it counts and better battery life on all devices.
                </BulletPoint>
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Optimized 'Low' Graphics Models:</strong> To significantly boost performance on a wider range of devices, all power-ups in the 'Low' graphics setting now appear as simple, high-contrast cubes. Each cube features a unique icon, making them easy to identify at a glance while being extremely cheap to render.
                </BulletPoint>
            </ul>

            <p className="text-sm text-neutral-400 font-semibold">October 10, 2025</p>
            <ul className="space-y-3 text-neutral-200 text-sm">
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Introducing The Bus Stop:</strong> We are incredibly proud to launch our cozy, real-time chatroom! The Bus Stop is a neon-drenched social hub where grid runners can chill between sessions, connect with other runners, and watch the city go by together. Pull up a seat and join the conversation!
                </BulletPoint>
            </ul>

            <p className="text-sm text-neutral-400 font-semibold">October 8, 2025</p>
            <ul className="space-y-3 text-neutral-200 text-sm">
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Customizable Third-Person Camera:</strong> You now have full control! When in third-person view, a new cog icon appears. Click it to open a settings panel where you can use sliders to adjust the camera's distance and height in real-time. The game will automatically pause, allowing you to find the perfect angle without any pressure.
                </BulletPoint>
            </ul>

            <p className="text-sm text-neutral-400 font-semibold">August 14, 2025</p>
            <ul className="space-y-3 text-neutral-200 text-sm">
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">New Camera View:</strong> Added a dynamic third-person camera for a new gameplay perspective.
                </BulletPoint>
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Smoother Controls:</strong> Revamped the first-person camera to turn independently from the snake's grid-based movement. This creates a natural "look-ahead" effect, making controls feel incredibly smooth and responsive.
                </BulletPoint>
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Enhanced Depth Perception:</strong> Added dynamic shadows under the snake and all nodes, making it easier to judge their position on the grid.
                </BulletPoint>
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Improved Visibility:</strong> Adjusted the primary Data Node's material, adding transparency to reduce glare.
                </BulletPoint>
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Gameplay Tweak:</strong> Slightly increased the snake's initial speed for a more engaging start.
                </BulletPoint>
                 <BulletPoint>
                    <strong className="font-bold text-yellow-300">First-Time Help:</strong> The "How to Play" guide now automatically appears on your first visit to help you get started.
                </BulletPoint>
                 <BulletPoint>
                    <strong className="font-bold text-yellow-300">New Name, New Vibe:</strong> The game is now officially "3D Snake: Neon Grid Runner"!
                </BulletPoint>
                 <BulletPoint>
                    <strong className="font-bold text-yellow-300">Play on Any Device:</strong> Link your Pi account from the Pi Browser to play on a computer or TV! Enjoy fullscreen, submit high scores, and manage ads, with secure payments handled seamlessly back in the Pi Browser.
                </BulletPoint>
                 <BulletPoint>
                    <strong className="font-bold text-yellow-300">Mobile HUD Gestures:</strong> Swipe up or down on menus to collapse/expand the panel for a better view.
                </BulletPoint>
                 <BulletPoint>
                    <strong className="font-bold text-yellow-300">Interactive Orbit Camera:</strong> While in the orbit view (non-gameplay), you can now swipe left and right (or click and drag with a mouse) to manually rotate the camera.
                </BulletPoint>
                 <BulletPoint>
                    <strong className="font-bold text-yellow-300">Rotated Swipe Controls:</strong> When playing in the Pi Browser's rotated (landscape) mode, camera orbit swipe controls now correctly align with the screen orientation.
                </BulletPoint>
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Pi Network Invitation:</strong> A "Join Pi Network" option is now available in the menu for users playing outside the Pi ecosystem.
                </BulletPoint>
            </ul>
            <DonationSection />
        </div>
    );

    const WhatsNextContent = () => (
        <div className="space-y-4">
            <p className="text-neutral-300">We're committed to the long-term growth of the game and its utility within the Pi ecosystem. Here's a sneak peek at what we're working on!</p>
             <ul className="space-y-4 text-neutral-200 text-sm">
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Expanded Graphics & Performance Options:</strong> We designed 3D Snake to be a beautiful, high-performance experience, rendering at up to 60 frames per second. We also recognize that this may not be optimal for every device. A top priority is to expand the graphics and resource settings, ensuring that every Pioneer can enjoy a smooth and responsive gameplay experience, regardless of their hardware.
                </BulletPoint>
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">New Game Modes:</strong> Get ready for mind-bending puzzles and unique challenge levels that will test your snake skills in entirely new ways.
                </BulletPoint>
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Social Sharing Integration:</strong> We're making it easy to show off your new high scores! Soon, you'll be able to share your achievements directly to social media, challenging friends and spreading the word about 3D Snake.
                </BulletPoint>
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Multi-Language Support:</strong> To make 3D Snake truly ready for a global audience, we will be implementing support for multiple languages across the entire user interface.
                </BulletPoint>
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Scalable Backend Infrastructure:</strong> We strategically developed the working prototype with Google Sheets as a no-cost, secure backend. Our next step is to migrate this to a robust, scalable solution like Firebase Firestore. This will ensure the app can support the entire Pi network with near-real-time leaderboard updates and ad submissions.
                </BulletPoint>
                 <BulletPoint>
                    <strong className="font-bold text-yellow-300">Dynamic Ad Marketplace:</strong> We're evolving the ad system from fixed-price slots to a real-time bidding marketplace. This will allow users to compete for premium ad slots, creating a fair, transparent, and market-driven value for in-game advertising space.
                </BulletPoint>
                <BulletPoint>
                    <strong className="font-bold text-yellow-300">Future Blockchain Integration (Ad Slot Tokenization):</strong> We are exploring the tokenization of ad slots. This would represent each ad slot (e.g., "Billboard for Pi2Day") as a unique digital asset (NFT) on the Pi blockchain. This innovation would enable a true secondary market where users can trade, sell, or lease their ad slots, creating a robust and decentralized micro-economy right inside the game.
                </BulletPoint>
            </ul>
            <DonationSection />
        </div>
    );

    const OurVisionContent = () => (
        <div className="space-y-4 text-neutral-300 text-sm">
            <div className="text-center mb-6">
                <RocketIcon className="w-16 h-16 text-cyan-400 mb-4 mx-auto" />
                <h3 className="text-2xl font-bold text-yellow-300">More Than a Game</h3>
            </div>
            <p>
                At its core, <strong className="font-bold text-yellow-300">creativity</strong> is the human superpower. It's that unexplainable spark that separates us, allowing us to build, dream, and innovate in ways no other creature can. My core philosophy is to harness this spark by constantly seeking <strong className="font-bold text-yellow-300">connection</strong>, the threads between the powerful digital tools of our age and the universal rhythms of human experience.
            </p>
            <p>
                <strong className="font-bold text-yellow-300">Innovation</strong> isn't just about creating something from nothing; it's about seeing a classic idea and reimagining it through a modern lens. 3D Snake: Neon Grid Runner is born from this mindset. It’s more than a nostalgic game wrapped in a neon aesthetic, it's a practical demonstration of this connection.
            </p>
            <p>
                But <strong className="font-bold text-white">the true vision extends beyond the gameplay.</strong> We understand that for the Pi Network to truly flourish, it needs more than just internal utility. The most powerful pi apps will be those that act as a bridge, a vibrant, welcoming gateway for the world outside. 
            </p>
            <p>
                <strong className="font-bold text-yellow-300">Our goal</strong> is for someone who has never even heard of Pi to play this game for its sheer entertainment value, and through that enjoyable experience, seamlessly discover the real-world power and potential of this decentralized currency.
            </p>
            <p>
                This is what it means to be '<strong className="font-bold text-white">More Than a Game</strong>.' It's an on-ramp, a playful first step into the Pi ecosystem, designed to prove the utility of a decentralized future, one neon grid at a time.
            </p>
            <DonationSection />
        </div>
    );

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center font-sans p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whats-new-title"
        >
            <div className={`bg-neutral-900/90 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col ${containerClasses}`}>
                <header className="flex items-center justify-between p-4 border-b border-neutral-700 flex-shrink-0">
                    <h2 id="whats-new-title" className="text-xl font-bold text-white">Development Updates</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Close development updates"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex items-stretch border-b border-neutral-700 flex-shrink-0">
                    <TabButton tabId="new" label="What's New" />
                    <TabButton tabId="next" label="What's Next" />
                    <TabButton tabId="vision" label="Our Vision" />
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 sm:p-6">
                    {activeTab === 'new' && <WhatsNewContent />}
                    {activeTab === 'next' && <WhatsNextContent />}
                    {activeTab === 'vision' && <OurVisionContent />}
                </div>
            </div>
        </div>
    );
};

export default WhatsNewOverlay;
