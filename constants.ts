import { CameraView, FruitType } from './types';

export const BOARD_WIDTH = 20;
export const BOARD_DEPTH = 20;
export const FULL_BOARD_WIDTH = 26;
export const FULL_BOARD_DEPTH = 26;

export const COLORS = {
  BOARD_DARK: '#0a0a0a', // neutral-950
  BOARD_LIGHT: '#1f1f1f', // dark gray
  STROKE: '#171717',     // neutral-900
  PLAYER_BODY: '#00ffff', // cyan
  PLAYER_FRONT: '#ffffff', // white
  GRID_LINES: '#4b5563',  // gray-600
  STREET: '#4a4a4a', // Dark asphalt gray for passages
};

export const FRUIT_COLORS: Record<FruitType, string> = {
    [FruitType.APPLE]: '#f472b6',         // pink-400
    [FruitType.SPEED_BOOST]: '#facc15',   // yellow-400
    [FruitType.SLOW_DOWN]: '#22d3ee',     // cyan-400
    [FruitType.MAGNET]: '#c084fc',        // purple-400
    [FruitType.SCORE_DOUBLER]: '#f59e0b',  // amber-500
    [FruitType.EXTRA_LIFE]: '#ef4444',    // red-500
    [FruitType.TRIPLE]: '#4ade80', // green-400
};

export const FRUIT_CATEGORIES: Record<FruitType, 'NORMAL' | 'BOARD' | 'PASSAGE'> = {
    [FruitType.APPLE]: 'NORMAL',
    [FruitType.SPEED_BOOST]: 'BOARD',
    [FruitType.SLOW_DOWN]: 'BOARD',
    [FruitType.MAGNET]: 'BOARD',
    [FruitType.SCORE_DOUBLER]: 'BOARD',
    [FruitType.EXTRA_LIFE]: 'PASSAGE',
    [FruitType.TRIPLE]: 'PASSAGE',
};

export const VIEW_CYCLE: CameraView[] = [
  CameraView.FIRST_PERSON,
  CameraView.ORBIT,
  CameraView.DRONE_1,
  CameraView.DRONE_2,
];