


export type GraphicsQuality = 'High' | 'Medium' | 'Low';

export type Point3D = { x: number; y: number; z: number };

export enum CameraView {
  ORBIT = 'Orbit',
  FIRST_PERSON = 'First Person',
  DRONE_1 = 'Drone 1',
  DRONE_2 = 'Drone 2',
}

export type GameState = 'Loading' | 'Welcome' | 'Starting' | 'Playing' | 'GameOver';

export enum FruitType {
  APPLE,
  SPEED_BOOST,
  SLOW_DOWN,
  MAGNET,
  SCORE_DOUBLER,
  EXTRA_LIFE,
  TRIPLE,
}

export type Fruit = {
  id: number;
  type: FruitType;
  position: Point3D;
};

export type ActiveEffect = {
  id: number;
  type: FruitType;
  startTime: number;
  duration: number;
};

export type DeviceType = 'mobile' | 'computer';

export type PortalType = 'Red' | 'Blue';

export type Portal = {
  id: string; // e.g., 'Red-0', 'Blue-1'
  type: PortalType;
  wall: 'N' | 'S' | 'E' | 'W';
  position: number; // coordinate along the 20x20 edge
};

export type AlcoveDetails = {
  wall: 'N' | 'S' | 'E' | 'W';
  door1: number;
  door2: number;
};

export type StreetPassageDetails = {
  wall: 'N' | 'S' | 'E' | 'W';
  entry: number; // coordinate along the 20x20 edge
  exit: number;
};

export type BillboardDetails = {
  x: number; // The starting grid X coordinate of the billboard base (top-left).
  z: number; // The starting grid Z coordinate of the billboard base (top-left).
  wall: 'N' | 'S' | 'E' | 'W'; // The wall it's attached to, for orientation.
};

export type FlyerDetails = {
  id: number;
  wall: 'N' | 'S' | 'E' | 'W';
  position: number; // The coordinate along the wall (e.g., x for N/S, z for E/W), now a float.
  variant: number; // e.g., 0, 1, 2 for different textures
  rotationJitter: { y: number; z: number };
  height: number; // Vertical position
  isAlcoveSpot?: boolean;
  isStreetIsland?: boolean;
};

export type BannerDetails = {
    wall: 'N' | 'S' | 'E' | 'W';
    position: number;
    height: number;
    type: 'paid' | 'cosmetic';
    isAlcoveSpot?: boolean;
    isStreetIsland?: boolean;
};

export type BuildingDetails = {
  x: number;
  z: number;
  height: number;
  type: 'regular' | 'pi-tower' | 'skyscraper-quantum' | 'transmission-tower' | 'searchlight-tower';
  roofType: 'flat' | 'apex' | 'slanted' | 'pyramid';
};

export type LayoutDetails = {
  alcove: AlcoveDetails;
  street: StreetPassageDetails;
  portals: Portal[];
  billboard: BillboardDetails;
  flyers: FlyerDetails[];
  banners: BannerDetails[];
  buildings: BuildingDetails[];
};

export type LeaderboardEntry = {
  rank: number;
  timestamp: string;
  name: string;
  score: number;
  speed: number;
  time: number; // epoch
  region: string;
  level: number;
  device?: DeviceType;
};

export interface GameConfig {
  initialGameSpeed: number;
  initialSnakeLength: number;
  initialLives: number;
  speedIncreasePerApple: number;
  slowDownEffectValue: number;
  pointsPerLevel: number;
  boardFruitSpawnDelay: number;
  passageFruitSpawnDelay: number;
  boardFruitLifetime: number;
  boardFruitCooldown: number;
  passageFruitRetryDelay: number;
  extraLifeChance: number;
  maxExtraLivesPerLife: number;
  maxExtraLivesTotal: number;
  appleScore: number;
  speedBoostDuration: number;
  magnetDuration: number;
  scoreDoublerDuration: number;
  tripleDuration: number;
  slowDownFrequencyMultiplier: number;
  slowDownSpeedThreshold: number;
  highSpeedSpeedBoostChance: number;
  streetFruitBucketTripleCount: number;
  streetFruitBucketExtraLifeCount: number;
  promoTitle?: string;
  promoDescription?: string;
}

export type RadioStation = {
  name: string;
  url: string;
  favicon: string;
};

/**
 * Type definition for station data fetched directly from the radio-browser API.
 */
export type RadioBrowserStation = {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  country: string;
};

// Types for Advertising
export type AdType = 'Billboard' | 'Poster' | 'Banner' | 'Flyer' | 'CosmeticBanner';

export type Sponsor = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
  adType: AdType;
  count?: number;
};

export type AdSubmissionData = {
    paymentId: string;
    scheduleDate: string; // YYYY-MM-DD (can be comma-separated)
    imageUrl: string;
    title: string;
    description: string;
    websiteUrl: string;
    piUsername: string;
    price: number;
    originalPrice?: number;
    adType: AdType;
    quantity: number;
    promoCode?: string;
};

export type ApprovedAd = {
  orderNumber: string;
  timestamp: string;
  scheduleDate: string;
  imageUrl: string;
  title: string;
  description: string;
  piUsername: string;
  websiteUrl: string;
  adType: AdType;
};

export type BookedSlots = {
    [date: string]: { // date is YYYY-MM-DD
        [key in AdType]?: number;
    }
};

export type BillboardData = {
  topScores: LeaderboardEntry[];
  topSpeeds: LeaderboardEntry[];
};

export type PromoCode = {
    code: string;
    type: 'BOGO' | 'DISC';
    value: number; // For BOGO: free items per paid. For DISC: percentage.
    isActive: boolean;
};

// --- Pi Network SDK Types ---

export interface UserDTO {
    uid: string;
    username: string;
}

export interface AuthResult {
    accessToken: string;
    user: UserDTO;
}

export type PiScopes = ('username' | 'payments')[];

export interface PaymentDTO {
    identifier: string; 
    user_uid: string;
    amount: number;
    memo: string;
    metadata: object;
    status: {
        developer_approved: boolean;
        transaction_verified: boolean;
        developer_completed: boolean;
        cancelled: boolean;
        user_cancelled: boolean;
    };
}

declare global {
    interface Window {
        Pi: any;
    }
}