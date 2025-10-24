import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CameraView, Point3D, GameState, Fruit, FruitType, LayoutDetails, BillboardDetails, StreetPassageDetails, FlyerDetails, BannerDetails, ApprovedAd, BillboardData, LeaderboardEntry, BuildingDetails, GraphicsQuality, LightEventType, LightEventData, ActiveEffect, AdType, ThirdPersonCameraSettings } from '../types';
import { COLORS, FULL_BOARD_WIDTH, FULL_BOARD_DEPTH, FRUIT_COLORS, FRUIT_CATEGORIES } from '../constants';
import { isWall, isStreetPassageBlock, getPortalAbsolutePosition } from './gameLogic';
import { reportDisplayedAds } from '../utils/sponsors';
import { LightingSystem } from './lightingSystem';

interface BoardProps {
  gameState: GameState;
  zoom: number;
  cameraView: CameraView;
  lastGameplayView: CameraView;
  snakeSegments: Point3D[];
  snakeRotation: number;
  visualRotation: number;
  fruits: Fruit[];
  clearingFruits: { fruit: Fruit; startTime: number }[];
  gameSpeed: number;
  layoutDetails: LayoutDetails;
  isCrashing: boolean;
  isPaused: boolean;
  isPassageFruitActive: boolean;
  passageFruitLocation: Point3D | null;
  approvedAds: ApprovedAd[];
  billboardData: BillboardData | null;
  graphicsQuality: GraphicsQuality;
  isPageVisible: boolean;
  weather: 'Clear' | 'Rain';
  score: number;
  level: number;
  activeEffects: ActiveEffect[];
  crashOutcome: 'respawn' | 'gameOver' | null;
  onCrashAscendAnimationComplete: () => void;
  onGameOverAnimationComplete: () => void;
  nextSnake: Point3D[] | null;
  isOrbitDragging: boolean;
  thirdPersonCameraSettings: ThirdPersonCameraSettings;
  isAnyModalOpen: boolean;
  isDynamicLightingDisabled: boolean;
}

export interface BoardRef {
  handleResize: () => void;
  triggerLightEvent: (type: LightEventType, data: LightEventData) => void;
  handleOrbitDrag: (deltaX: number) => void;
}

// The layer number for the bloom effect.
const BLOOM_LAYER = 1;

const WALL_THICKNESS = (FULL_BOARD_WIDTH - 20) / 2;
const offsetX = -FULL_BOARD_WIDTH / 2 + 0.5;
const offsetZ = -FULL_BOARD_DEPTH / 2 + 0.5;

// Playable area boundaries in world coordinates for drone flight.
const PLAYABLE_AREA_MIN_X = -9.5;
const PLAYABLE_AREA_MAX_X = 9.5;
const PLAYABLE_AREA_MIN_Z = -9.5;
const PLAYABLE_AREA_MAX_Z = 9.5;
const MIN_DRONE_ALTITUDE = 2.0;

// Base type for all main drone actions
type DroneAction =
  | { type: 'IDLE' }
  | { type: 'WALL_RUN'; startPos: THREE.Vector3; endPos: THREE.Vector3; wall: 'N' | 'S' | 'E' | 'W'; }
  | { type: 'BANNER_ORBIT'; center: THREE.Vector3; radius: number; normal: THREE.Vector3; arc: number; startAngle: number; }
  | { type: 'SNAKE_ORBIT'; radius: number; arc: number; }
  | { type: 'ROTATE'; arc: number }
  | { type: 'BILLBOARD_APPROACH'; startPos: THREE.Vector3; endPos: THREE.Vector3; lookAt: THREE.Vector3 }
  | { 
      type: 'PANORAMIC_DIVE';
      phase: 'ASCENDING' | 'HOVERING' | 'ROTATING_DOWN' | 'DIVING';
      phaseStartTime: number;
      // Dive
      diveStartQuat?: THREE.Quaternion;
      diveTargetPos?: THREE.Vector3;
      diveTargetQuat?: THREE.Quaternion;
      diveCurve?: THREE.QuadraticBezierCurve3;
    };

// The main state for the drone, which encapsulates the staged approach
type DroneState = {
  startTime: number;
  
  // Start and end points for the entire action sequence
  startPos: THREE.Vector3;
  startQuat: THREE.Quaternion;
  targetPos: THREE.Vector3;
  targetQuat: THREE.Quaternion;
  
  // Durations for each phase
  approachDuration: number;
  mainActionDuration: number;
  totalDuration: number;
  arcHeight: number;
  
  // The action to perform after staging is complete
  mainAction: DroneAction;
};

const NEON_PALETTE = [
    new THREE.Color(0xff00ff).lerp(new THREE.Color(0xffffff), 0.3), // Magenta
    new THREE.Color(0x00ffff).lerp(new THREE.Color(0xffffff), 0.3), // Cyan
    new THREE.Color(0xff9900).lerp(new THREE.Color(0xffffff), 0.3), // Orange
    new THREE.Color(0x00ff00).lerp(new THREE.Color(0xffffff), 0.3), // Lime Green
    new THREE.Color(0xff33cc).lerp(new THREE.Color(0xffffff), 0.3), // Hot Pink
];

const addNeonBorderToBanner = (bannerMesh: THREE.Mesh, state: any) => {
    const oldBorder = bannerMesh.getObjectByName("neonBorder");
    if (oldBorder) bannerMesh.remove(oldBorder);

    const borderGroup = new THREE.Group();
    borderGroup.name = "neonBorder";
    const randomNeonColor = NEON_PALETTE[Math.floor(Math.random() * NEON_PALETTE.length)];
    
    const borderMat = new THREE.MeshBasicMaterial({
        color: randomNeonColor,
    });
    state.materialsToDispose.push(borderMat);

    const bannerWidth = (bannerMesh.geometry as THREE.PlaneGeometry).parameters.width;
    const bannerHeight = (bannerMesh.geometry as THREE.PlaneGeometry).parameters.height;
    const thickness = 0.02;

    const topGeo = new THREE.BoxGeometry(bannerWidth + thickness, thickness, thickness);
    const bottomGeo = new THREE.BoxGeometry(bannerWidth + thickness, thickness, thickness);
    const leftGeo = new THREE.BoxGeometry(thickness, bannerHeight, thickness);
    const rightGeo = new THREE.BoxGeometry(thickness, bannerHeight, thickness);
    state.geometriesToDispose.push(topGeo, bottomGeo, leftGeo, rightGeo);

    const topMesh = new THREE.Mesh(topGeo, borderMat);
    topMesh.position.y = bannerHeight / 2;
    const bottomMesh = new THREE.Mesh(bottomGeo, borderMat);
    bottomMesh.position.y = -bannerHeight / 2;
    const leftMesh = new THREE.Mesh(leftGeo, borderMat);
    leftMesh.position.x = -bannerWidth / 2;
    const rightMesh = new THREE.Mesh(rightGeo, borderMat);
    rightMesh.position.x = bannerWidth / 2;

    borderGroup.add(topMesh, bottomMesh, leftMesh, rightMesh);
    borderGroup.layers.set(BLOOM_LAYER);
    bannerMesh.add(borderGroup);
};

const createGlowTexture = (color: string): THREE.CanvasTexture => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0.2, color);
  gradient.addColorStop(1, 'transparent');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
};

const createShadowTexture = (): THREE.CanvasTexture => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
};

const createPortalTexture = (type: 'Red' | 'Blue'): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    
    const [color1, color2] = type === 'Red'
        ? ['#ff4d4d', '#cc0000']
        : ['#4d75ff', '#0022cc'];

    gradient.addColorStop(0.0, color1);
    gradient.addColorStop(0.5, color2);
    gradient.addColorStop(1.0, 'transparent');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};

const createBuildingTexture = (baseColor: string): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;
    context.fillStyle = baseColor;
    context.fillRect(0, 0, size, size);
    const windowSize = 4;
    const gap = 4;
    for (let y = gap; y < size; y += windowSize + gap) {
        for (let x = gap; x < size; x += windowSize + gap) {
            if (Math.random() > 0.85) {
                context.fillStyle = Math.random() > 0.3 ? '#fde047' : '#ffffff';
                context.fillRect(x, y, windowSize, windowSize);
            }
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
};

const createAdBannerTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    const width = 256;
    const height = 144; // Adjusted to 16:9 aspect ratio
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    const color1 = `hsl(${180 + Math.random() * 80}, 90%, 20%)`;
    const color2 = `hsl(${260 + Math.random() * 80}, 90%, 15%)`;
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `hsl(${180 + Math.random() * 60}, 100%, 70%)`;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.bezierCurveTo(
            Math.random() * width, Math.random() * height,
            Math.random() * width, Math.random() * height,
            Math.random() * width, Math.random() * height
        );
        ctx.stroke();
    }
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 20 + 5, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${180 + Math.random() * 60}, 100%, 80%)`;
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};

const createLowQualityFruitTexture = (type: FruitType): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    const size = 64; // A small texture size is sufficient
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const bgColor = FRUIT_COLORS[type];
    let icon: string;

    switch (type) {
        case FruitType.SPEED_BOOST: icon = '⚡️'; break;
        case FruitType.SLOW_DOWN: icon = '⏰'; break;
        case FruitType.MAGNET: icon = '🧲'; break;
        case FruitType.SCORE_DOUBLER: icon = 'x2'; break;
        case FruitType.TRIPLE: icon = 'x3'; break;
        case FruitType.EXTRA_LIFE: icon = '❤️'; break;
        default: icon = '?'; break;
    }

    // Cube background color
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
    
    // Add a subtle border to define the face
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);

    // Icon/Text
    ctx.font = type === FruitType.SCORE_DOUBLER || type === FruitType.TRIPLE
        ? `bold ${size * 0.7}px sans-serif`
        : `${size * 0.7}px sans-serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add a subtle shadow for readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(icon, size / 2, size / 2 + 2); // Small offset for better vertical centering of some chars

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};

const createFlyerTexture = (variant: number): THREE.CanvasTexture => {
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
            ctx.strokeStyle = COLORS.PLAYER_BODY;
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

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};

const createLabelTexture = (text: string): THREE.CanvasTexture => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#333';
    context.fillRect(0, 0, size, size);
    context.font = 'bold 80px sans-serif';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, size / 2, size / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};

const createHeliPadTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#4a5568'; // gray-600
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Outer circle
    ctx.strokeStyle = '#f7fafc'; // gray-100
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();

    // H
    ctx.fillStyle = '#f7fafc';
    ctx.font = `bold ${size * 0.7}px 'Arial'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', size / 2, size / 2 + size * 0.04);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};

const createDrone = (
    scene: THREE.Scene, 
    color: THREE.ColorRepresentation, 
    altitude: number,
    geometries: THREE.BufferGeometry[],
    materials: THREE.Material[]
): { group: THREE.Group; propellers: THREE.Mesh[]; light: THREE.PointLight } => {
    const droneGroup = new THREE.Group();
    
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.2, 1.0);
    geometries.push(bodyGeo);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });
    materials.push(bodyMat);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    droneGroup.add(body);

    const cameraGeo = new THREE.BoxGeometry(0.2, 0.2, 0.3);
    geometries.push(cameraGeo);
    const cameraMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.2 });
    materials.push(cameraMat);
    const cameraMesh = new THREE.Mesh(cameraGeo, cameraMat);
    cameraMesh.position.set(0, -0.15, 0.4); // Attach to bottom-front of the body
    body.add(cameraMesh);

    const propellers: THREE.Mesh[] = [];
    const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6);
    geometries.push(armGeo);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    materials.push(armMat);
    const propellerGeo = new THREE.TorusGeometry(0.3, 0.03, 3, 16);
    geometries.push(propellerGeo);
    const propellerMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 2 });
    materials.push(propellerMat);

    const positions = [ { x: 0.7, z: 0.7 }, { x: -0.7, z: 0.7 }, { x: 0.7, z: -0.7 }, { x: -0.7, z: -0.7 } ];

    positions.forEach(pos => {
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.set(pos.x, 0, pos.z);
        arm.rotation.z = Math.PI / 2;
        droneGroup.add(arm);

        const propeller = new THREE.Mesh(propellerGeo, propellerMat);
        propeller.position.set(pos.x, 0.1, pos.z);
        propeller.rotation.x = Math.PI / 2;
        propeller.layers.enable(BLOOM_LAYER);
        droneGroup.add(propeller);
        propellers.push(propeller);
    });

    const light = new THREE.PointLight(color, 5, 15);
    light.position.y = -0.5;
    droneGroup.add(light);
    
    droneGroup.position.y = altitude;
    droneGroup.scale.set(0.75, 0.75, 0.75); // Scale down the whole drone
    scene.add(droneGroup);
    
    return { group: droneGroup, propellers, light };
};

const createQuantumRooftopIcon = (state: any): THREE.Group => {
    const iconGroup = new THREE.Group();
    const extrudeSettings = { depth: 0.2, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 };
    const iconColor = 0x2563eb;
    const iconMaterial = new THREE.MeshStandardMaterial({
        color: iconColor,
        emissive: iconColor,
        emissiveIntensity: 1.2,
        metalness: 0.8,
        roughness: 0.3,
        envMapIntensity: 0.8
    });
    state.materialsToDispose.push(iconMaterial);

    // Main ring of the Q
    const qRingShape = new THREE.Shape();
    const outerRadius = 1.0;
    const innerRadius = 0.7;
    qRingShape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    qRingShape.holes.push(holePath);
    
    const qRingGeo = new THREE.ExtrudeGeometry(qRingShape, extrudeSettings);
    state.geometriesToDispose.push(qRingGeo);
    const qRingMesh = new THREE.Mesh(qRingGeo, iconMaterial);
    qRingMesh.layers.enable(BLOOM_LAYER);

    // Tail of the Q
    const qTailShape = new THREE.Shape();
    qTailShape.moveTo(-0.15, 0.3);
    qTailShape.lineTo(0.15, 0.3);
    qTailShape.lineTo(0.55, -0.3);
    qTailShape.lineTo(0.25, -0.3);
    qTailShape.closePath();

    const qTailGeo = new THREE.ExtrudeGeometry(qTailShape, { ...extrudeSettings, depth: 0.15 });
    state.geometriesToDispose.push(qTailGeo);
    const qTailMesh = new THREE.Mesh(qTailGeo, iconMaterial);
    qTailMesh.position.set(0.7, -0.7, 0);
    qTailMesh.rotation.z = -Math.PI / 4;
    qTailMesh.layers.enable(BLOOM_LAYER);
    
    iconGroup.add(qRingMesh, qTailMesh);
    
    // Stand the icon up and scale it
    iconGroup.scale.set(0.33, 0.33, 0.33);

    // Cylindrical Stand
    const standGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.4, 16);
    state.geometriesToDispose.push(standGeo);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
    state.materialsToDispose.push(standMat);
    const standMesh = new THREE.Mesh(standGeo, standMat);
    
    const assemblyGroup = new THREE.Group();
    const standHeight = 0.4;

    standMesh.position.y = standHeight / 2;
    iconGroup.position.y = standHeight + (outerRadius * 0.33);
    assemblyGroup.add(standMesh, iconGroup);

    return assemblyGroup;
}

const createScoreSlideTexture = (title: string, entries: LeaderboardEntry[], unit: 'points' | 'm/s'): THREE.CanvasTexture => {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a2a3a');
    gradient.addColorStop(1, '#101827');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    ctx.font = 'bold 36px "sans-serif"';
    ctx.fillStyle = '#facc15'; // yellow-400
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    ctx.fillText(title, width / 2, 45);
    ctx.shadowColor = 'transparent';

    ctx.font = '24px "sans-serif"';
    ctx.textAlign = 'left';

    entries.forEach((entry, index) => {
        const y = 95 + index * 45;
        const rank = index + 1;
        
        ctx.fillStyle = rank === 1 ? '#fde047' : rank === 2 ? '#e5e7eb' : rank === 3 ? '#f97316' : '#d1d5db'; // gold, silver, bronze
        ctx.font = 'bold 28px "sans-serif"';
        ctx.fillText(`${rank}.`, 40, y);
        
        ctx.font = '24px "sans-serif"';
        ctx.fillStyle = '#fff';
        ctx.fillText(entry.name.substring(0, 15), 80, y);
        
        ctx.textAlign = 'right';
        const value = unit === 'points' ? entry.score.toLocaleString() : `${entry.speed.toFixed(2)} m/s`;
        ctx.fillText(value, width - 40, y);
        ctx.textAlign = 'left';
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};

const getWallAttachmentDetails = (
    wall: 'N' | 'S' | 'E' | 'W',
    position: number,
    isAlcoveSpot: boolean,
    isStreetIsland: boolean,
): { position: THREE.Vector3, rotation: THREE.Euler } | null => {

    const posOnGrid = position + WALL_THICKNESS;
    let adjacentPlayableCell: { x: number, z: number };
    let targetWallCell: { x: number, z: number };

    if (isStreetIsland) {
        switch (wall) {
            case 'N': targetWallCell = { x: posOnGrid, z: 2 }; adjacentPlayableCell = { x: posOnGrid, z: 3 }; break;
            case 'S': targetWallCell = { x: posOnGrid, z: FULL_BOARD_DEPTH - 3 }; adjacentPlayableCell = { x: posOnGrid, z: FULL_BOARD_DEPTH - 4 }; break;
            case 'W': targetWallCell = { x: 2, z: posOnGrid }; adjacentPlayableCell = { x: 3, z: posOnGrid }; break;
            case 'E': targetWallCell = { x: FULL_BOARD_WIDTH - 3, z: posOnGrid }; adjacentPlayableCell = { x: FULL_BOARD_WIDTH - 4, z: posOnGrid }; break;
        }
    } else if (isAlcoveSpot) {
         switch (wall) {
            case 'N': targetWallCell = { x: posOnGrid, z: 1 }; adjacentPlayableCell = { x: posOnGrid, z: 2 }; break;
            case 'S': targetWallCell = { x: posOnGrid, z: FULL_BOARD_DEPTH - 2 }; adjacentPlayableCell = { x: posOnGrid, z: FULL_BOARD_DEPTH - 3 }; break;
            case 'W': targetWallCell = { x: 1, z: posOnGrid }; adjacentPlayableCell = { x: 2, z: posOnGrid }; break;
            case 'E': targetWallCell = { x: FULL_BOARD_WIDTH - 2, z: posOnGrid }; adjacentPlayableCell = { x: FULL_BOARD_WIDTH - 3, z: posOnGrid }; break;
        }
    } else {
        switch (wall) {
            case 'N': adjacentPlayableCell = { x: posOnGrid, z: WALL_THICKNESS }; targetWallCell = { x: posOnGrid, z: WALL_THICKNESS - 1 }; break;
            case 'S': adjacentPlayableCell = { x: posOnGrid, z: FULL_BOARD_DEPTH - 1 - WALL_THICKNESS }; targetWallCell = { x: posOnGrid, z: FULL_BOARD_DEPTH - WALL_THICKNESS }; break;
            case 'W': adjacentPlayableCell = { x: WALL_THICKNESS, z: posOnGrid }; targetWallCell = { x: WALL_THICKNESS - 1, z: posOnGrid }; break;
            case 'E': adjacentPlayableCell = { x: FULL_BOARD_WIDTH - 1 - WALL_THICKNESS, z: posOnGrid }; targetWallCell = { x: FULL_BOARD_WIDTH - WALL_THICKNESS, z: posOnGrid }; break;
        }
    }

    const worldPos = new THREE.Vector3(targetWallCell.x + offsetX, 0, targetWallCell.z + offsetZ);
    const rot = new THREE.Euler(0, 0, 0);
    const offset = 0.5 + 0.02;

    const dx = adjacentPlayableCell.x - targetWallCell.x;
    const dz = adjacentPlayableCell.z - targetWallCell.z;

    if (dz === 1) { worldPos.z += offset; rot.y = 0; }
    else if (dz === -1) { worldPos.z -= offset; rot.y = Math.PI; }
    else if (dx === 1) { worldPos.x += offset; rot.y = -Math.PI / 2; }
    else if (dx === -1) { worldPos.x -= offset; rot.y = Math.PI / 2; }
    
    return { position: worldPos, rotation: rot };
};

const getFlyerAttachmentDetails = (flyer: FlyerDetails): { position: THREE.Vector3, rotation: THREE.Euler } | null => {
    return getWallAttachmentDetails(flyer.wall, flyer.position, !!flyer.isAlcoveSpot, !!flyer.isStreetIsland);
};

// NEW: Refactored function for creating fruit assets
const createFruitAssetMaps = (quality: GraphicsQuality, animState: any): { geometries: Map<FruitType, THREE.BufferGeometry>, materials: Map<FruitType, THREE.Material> } => {
    const geometries = new Map<FruitType, THREE.BufferGeometry>();
    const materials = new Map<FruitType, THREE.Material>();
    const s = 0.35;
    const appleSize = s * 1.5;
    const isLow = quality === 'Low';

    // APPLE (always a box)
    geometries.set(FruitType.APPLE, new THREE.BoxGeometry(appleSize, appleSize, appleSize));
    materials.set(FruitType.APPLE, new THREE.MeshStandardMaterial({
        color: FRUIT_COLORS[FruitType.APPLE],
        emissive: FRUIT_COLORS[FruitType.APPLE],
        emissiveIntensity: isLow ? 1.5 : 0.7,
        roughness: 0.4,
        metalness: 0.1,
        transparent: !isLow,
        opacity: isLow ? 1.0 : 0.7,
    }));

    // OTHER FRUITS
    if (isLow) {
        const lowQualityGeo = new THREE.BoxGeometry(appleSize, appleSize, appleSize);
        Object.values(FruitType).filter(t => !isNaN(Number(t)) && t !== FruitType.APPLE).forEach(t => {
            const type = t as FruitType;
            geometries.set(type, lowQualityGeo); // Shared geometry
            const texture = createLowQualityFruitTexture(type);
            animState.texturesToDispose.push(texture);
            materials.set(type, new THREE.MeshStandardMaterial({
                map: texture,
                emissive: 0xffffff,
                emissiveMap: texture,
                emissiveIntensity: 0.5,
                roughness: 0.6,
                metalness: 0.1,
            }));
        });
    } else {
        geometries.set(FruitType.SPEED_BOOST, new THREE.OctahedronGeometry(s, 0));
        geometries.set(FruitType.SLOW_DOWN, new THREE.IcosahedronGeometry(s, 0));
        geometries.set(FruitType.MAGNET, new THREE.TorusGeometry(s * 0.8, s * 0.35, 8, 16));
        const starShape = new THREE.Shape();
        starShape.moveTo(0, s); starShape.lineTo(s * 0.38, s * 0.38); starShape.lineTo(s, s * 0.38); starShape.lineTo(s * 0.5, -s * 0.14); starShape.lineTo(s * 0.7, -s); starShape.lineTo(0, -s * 0.5); starShape.lineTo(-s * 0.7, -s); starShape.lineTo(-s * 0.5, -s * 0.14); starShape.lineTo(-s, s * 0.38); starShape.lineTo(-s * 0.38, s * 0.38); starShape.closePath();
        geometries.set(FruitType.SCORE_DOUBLER, new THREE.ExtrudeGeometry(starShape, { depth: s * 0.4, bevelEnabled: false }));
        const heartScale = 0.3; const heartShape = new THREE.Shape(); heartShape.moveTo(0, heartScale * 0.5); heartShape.bezierCurveTo(heartScale * 0.5, heartScale, heartScale, 0.2, 0, -heartScale * 1.5); heartShape.bezierCurveTo(-heartScale, 0.2, -heartScale * 0.5, heartScale, 0, heartScale * 0.5);
        geometries.set(FruitType.EXTRA_LIFE, new THREE.ExtrudeGeometry(heartShape, { depth: heartScale * 0.4, bevelEnabled: false }));
        geometries.set(FruitType.TRIPLE, new THREE.TorusKnotGeometry(s * 0.8, s * 0.25, 50, 8));

        Object.values(FruitType).filter(t => !isNaN(Number(t)) && t !== FruitType.APPLE).forEach(t => {
            const type = t as FruitType;
            materials.set(type, new THREE.MeshStandardMaterial({ color: FRUIT_COLORS[type], roughness: 0.3, metalness: 0.1, }));
        });
    }

    return { geometries, materials };
};


const Board = forwardRef<BoardRef, BoardProps>(({ gameState, zoom, cameraView, lastGameplayView, snakeSegments, snakeRotation, visualRotation, fruits, clearingFruits, gameSpeed, layoutDetails, isCrashing, isPaused, isPassageFruitActive, passageFruitLocation, approvedAds, billboardData, graphicsQuality, isPageVisible, weather, score, level, activeEffects, crashOutcome, onCrashAscendAnimationComplete, onGameOverAnimationComplete, nextSnake, isOrbitDragging, thirdPersonCameraSettings, isAnyModalOpen, isDynamicLightingDisabled }, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isSceneInitialized, setIsSceneInitialized] = useState(false);
  // NEW: Ref to track previous graphics quality for real-time updates.
  const prevGraphicsQualityRef = useRef<GraphicsQuality>(graphicsQuality);

  const animationRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    bloomComposer?: EffectComposer;
    finalComposer?: EffectComposer;
    camera?: THREE.PerspectiveCamera;
    scene?: THREE.Scene;
    snakeHead?: THREE.Mesh;
    snakeBody?: THREE.InstancedMesh;
    snakeTail?: THREE.Mesh;
    dummy?: THREE.Object3D;
    glowPlanes?: THREE.Mesh[];
    fruitMeshes?: Map<number, THREE.Mesh>;
    appleGlows?: Map<number, THREE.Mesh>;
    fruitShadows?: Map<number, THREE.Mesh>;
    fruitGeometries?: Map<FruitType, THREE.BufferGeometry>;
    fruitMaterials?: Map<FruitType, THREE.Material>;
    layoutGroup?: THREE.Group;
    portalGroups?: Map<string, {
        group: THREE.Group;
        orbs: THREE.Mesh[];
        energyTexture: THREE.CanvasTexture;
    }>;
    searchlightBeams?: THREE.Group[];
    searchlightTargets?: {
        currentRotation: THREE.Quaternion;
        nextRotation: THREE.Quaternion;
        startTime: number;
        duration: number;
    }[];
    animationFrameId?: number;
    animate?: () => void;
    isInitialRender: boolean;
    gameSpeed: number;
    cameraView: CameraView;
    gameState: GameState;
    isPassageFruitActive: boolean;
    isCrashing: boolean;
    isPaused: boolean;
    orbitAngle: number;
    isOrbitDragging: boolean;
    startAnim?: {
        startTime: number;
        duration: number;
        startPos: THREE.Vector3;
        startQuat: THREE.Quaternion;
        endPos: THREE.Vector3;
        endLookAt: THREE.Vector3;
    };
    crashAnim?: {
        phase: 'shake' | 'ascending' | 'holding';
        startTime: number;
        shakeDuration: number;
        ascendDuration: number;
        startPos: THREE.Vector3;
        startQuat: THREE.Quaternion;
        crashedSnakePos: THREE.Vector3;
        ascendPos: THREE.Vector3;
        ascendQuat: THREE.Quaternion;
    };
    gameOverAnim?: {
        startTime: number;
        duration: number;
        startPos: THREE.Vector3;
        startQuat: THREE.Quaternion;
        endPos: THREE.Vector3;
        endQuat: THREE.Quaternion;
    };
    
    currentSnakeSegments: Point3D[];
    prevSnakeSegments: Point3D[];
    currentSnakeRotation: number;
    prevSnakeRotation: number;
    
    visualRotation: number;
    fpvCameraQuaternion?: THREE.Quaternion;
    previousCameraView?: CameraView;
    lastFrameTime: number;
    lastTickTime: number;

    geometriesToDispose: THREE.BufferGeometry[];
    texturesToDispose: THREE.Texture[];
    materialsToDispose: THREE.Material[];
    towerLights: { light: THREE.PointLight; mesh: THREE.Mesh }[];
    rotatingIcons?: THREE.Group[];
    
    reusable?: {
        startPos: THREE.Vector3;
        endPos: THREE.Vector3;
        interpolatedPos: THREE.Vector3;
        interpolatedLookAt: THREE.Vector3;
        startQuat: THREE.Quaternion;
        endQuat: THREE.Quaternion;
        euler: THREE.Euler;
        correctionQuat: THREE.Quaternion;
        axis_x: THREE.Vector3;
        axis_y: THREE.Vector3;
        axis_z: THREE.Vector3;
        fp_camera_pos: THREE.Vector3;
        backgroundCylinder?: THREE.Mesh;
        worldPos: THREE.Vector3;
        localPos: THREE.Vector3;
        droneLookAtHelper?: THREE.Object3D;
        lookAtHelper: THREE.Vector3;
        droneForward: THREE.Vector3;
        droneUp: THREE.Vector3;
        appleGlowMaterial?: THREE.Material;
        appleGlowGeo?: THREE.PlaneGeometry;
        shadowTexture?: THREE.CanvasTexture;
        shadowGeo?: THREE.PlaneGeometry;
        boardInstance?: THREE.InstancedMesh;
        tempColor: THREE.Color;
    };
    interpolatedPositions?: THREE.Vector3[];
    fruits: Fruit[];
    clearingFruits: { fruit: Fruit; startTime: number }[];
    activeEffects: ActiveEffect[];
    bloomPass?: UnrealBloomPass;
    billboardScreen?: THREE.Mesh;
    lastBillboardUpdate?: number;
    drones?: {
        group: THREE.Group;
        propellers: THREE.Mesh[];
        light: THREE.PointLight;
    }[];
    droneTargets?: ({
        altitude: number;
        currentPosition: THREE.Vector3;
        targetPosition: THREE.Vector3;
        startTime: number;
        duration: number;
    } | {
        state?: DroneState;
    })[];
    billboardSlides?: { texture: THREE.Texture; duration: number }[];
    currentBillboardSlideIndex?: number;
    lastBillboardSlideTime?: number;
    bannerMeshes?: THREE.Mesh[];
    layoutDetails?: LayoutDetails;
    maxBuildingHeight: number;
    wallRunCycleIndex: number;
    drone0Failsafe?: {
        lastPos: THREE.Vector3;
        lastCheckTime: number;
        stuckDuration: number;
    };
    graphicsQuality: GraphicsQuality;
    lightingSystem?: LightingSystem;
    buildingEdgesMesh?: THREE.InstancedMesh;
    buildingEdgePositions?: THREE.Vector3[];
    weather: 'Clear' | 'Rain';
    score: number;
    level: number;
    rainSystem?: THREE.Points;
    dustSystem?: THREE.Points;
    roofMeshes?: THREE.Mesh[];
    originalMaterialProperties?: {
        board: { roughness: number, metalness: number };
        roofs: { roughness: number, metalness: number }[];
    };
    fog?: THREE.FogExp2;
    thirdPersonCameraSettings?: ThirdPersonCameraSettings;
    isDynamicLightingDisabled: boolean;
  }>({
    isInitialRender: true,
    gameSpeed: 500,
    cameraView: CameraView.ORBIT,
    gameState: 'Loading',
    isPassageFruitActive: false,
    isCrashing: false,
    isPaused: false,
    
    currentSnakeSegments: [],
    prevSnakeSegments: [],
    currentSnakeRotation: 0,
    prevSnakeRotation: 0,
    visualRotation: 0,

    lastTickTime: 0,
    lastFrameTime: 0,

    geometriesToDispose: [],
    texturesToDispose: [],
    materialsToDispose: [],
    towerLights: [],
    rotatingIcons: [],
    fruits: [],
    clearingFruits: [],
    activeEffects: [],
    drones: [],
    droneTargets: [],
    searchlightBeams: [],
    searchlightTargets: [],
    lastBillboardUpdate: 0,
    maxBuildingHeight: 10,
    wallRunCycleIndex: 0,
    graphicsQuality: 'Medium',
    weather: 'Clear',
    score: 0,
    level: 1,
    orbitAngle: 0,
    isOrbitDragging: false,
    isDynamicLightingDisabled: false,
  });

  const handleResize = useCallback(() => {
    const state = animationRef.current;
    const currentMount = mountRef.current;
    if (state.camera && state.renderer && currentMount) {
        const w = currentMount.clientWidth;
        const h = currentMount.clientHeight;
        state.camera.aspect = w / h;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(w, h);
        state.bloomComposer?.setSize(w, h);
        state.finalComposer?.setSize(w, h);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    handleResize,
    triggerLightEvent: (type: LightEventType, data: LightEventData) => {
        // For Low graphics quality, disable expensive event-based lights like fruit ripples and turn runways.
        if (graphicsQuality === 'Low' && (type === 'fruitEaten' || type === 'turn')) {
            return;
        }
        if (isDynamicLightingDisabled) {
            return;
        }
        animationRef.current.lightingSystem?.triggerEvent(type, data);
    },
    handleOrbitDrag: (deltaX: number) => {
        if (animationRef.current) {
            animationRef.current.orbitAngle += deltaX * 0.005;
        }
    }
  }), [handleResize, graphicsQuality, isDynamicLightingDisabled]);
  
  useEffect(() => {
    const state = animationRef.current;
    state.gameSpeed = gameSpeed;
    state.cameraView = cameraView;
    state.fruits = fruits;
    state.clearingFruits = clearingFruits;
    state.activeEffects = activeEffects;
    state.isPassageFruitActive = isPassageFruitActive;
    state.gameState = gameState;
    state.isPaused = isPaused;
    state.isCrashing = isCrashing;
    state.layoutDetails = layoutDetails;
    state.visualRotation = visualRotation;
    // state.graphicsQuality is now updated via its own effect
    state.weather = weather;
    state.score = score;
    state.level = level;
    state.isOrbitDragging = isOrbitDragging;
    state.thirdPersonCameraSettings = thirdPersonCameraSettings;
    state.isDynamicLightingDisabled = isDynamicLightingDisabled;

    if (state.currentSnakeSegments !== snakeSegments || state.currentSnakeRotation !== snakeRotation) {
        state.prevSnakeSegments = state.isInitialRender ? snakeSegments : state.currentSnakeSegments;
        state.currentSnakeSegments = snakeSegments;
        state.prevSnakeRotation = state.isInitialRender ? snakeRotation : state.currentSnakeRotation;
        state.currentSnakeRotation = snakeRotation;
        state.lastTickTime = performance.now();
        if (state.isInitialRender) state.isInitialRender = false;
    }
  }, [gameSpeed, cameraView, snakeSegments, snakeRotation, visualRotation, isCrashing, isPaused, fruits, clearingFruits, activeEffects, isPassageFruitActive, gameState, layoutDetails, weather, score, level, isOrbitDragging, thirdPersonCameraSettings, isDynamicLightingDisabled]);

  useEffect(() => {
      const state = animationRef.current;
      if (gameState === 'Starting' && snakeSegments.length > 0 && state.camera && state.reusable) {
          // FIX: Reset the FPV camera's internal rotation state when the fly-in
          // animation begins. This prevents the camera from "looking around" as it
          // slerps from its old (crashed) orientation to the new forward-facing one.
          if (state.fpvCameraQuaternion) {
            state.fpvCameraQuaternion.set(0, 0, 0, 1); // Reset to identity quaternion
          }
          
          state.startAnim = undefined;
          
          const head = snakeSegments[0];
          const headPos = new THREE.Vector3(head.x + offsetX, head.y, head.z + offsetZ);
          
          let endPos: THREE.Vector3;
          let endLookAt: THREE.Vector3;
          
          // NEW LOGIC: Determine animation target based on the preferred gameplay view.
          if (lastGameplayView === CameraView.THIRD_PERSON && state.thirdPersonCameraSettings) {
              // Calculate third-person camera position for the start of the game.
              // The initial snake rotation is 0, so its quaternion is identity.
              const initialQuaternion = new THREE.Quaternion(); 
              
              const settings = state.thirdPersonCameraSettings;
              const idealOffset = new THREE.Vector3(0, settings.height, settings.distance);
              idealOffset.applyQuaternion(initialQuaternion);
              endPos = new THREE.Vector3().copy(headPos).add(idealOffset);
              
              const idealLookAtOffset = new THREE.Vector3(0, 0, -5);
              idealLookAtOffset.applyQuaternion(initialQuaternion);
              endLookAt = new THREE.Vector3().copy(headPos).add(idealLookAtOffset);

              // FIX: Pre-set the lookAt helper to prevent a camera jump after respawn animation.
              // When the 'Starting' animation ends, the 'Playing' state's third-person
              // camera logic takes over. This ensures its lookAt target starts in the correct
              // position, avoiding a jarring `lerp` from its previous (pre-crash) state.
              if (state.reusable?.lookAtHelper) {
                  state.reusable.lookAtHelper.copy(endLookAt);
              }

          } else { // Default to FIRST_PERSON
              // Original logic for first-person view.
              const endLookAtDir = new THREE.Vector3(0, 0, -1);
              endPos = new THREE.Vector3().copy(headPos).addScaledVector(endLookAtDir, 0.4);
              endLookAt = new THREE.Vector3().copy(headPos).add(endLookAtDir);
          }
          
          const startPos = state.camera.position.clone();
          const startQuat = state.camera.quaternion.clone();

          state.startAnim = {
              startTime: performance.now() + 1000,
              duration: 3000,
              startPos,
              startQuat,
              endPos,
              endLookAt,
          };
      }
  }, [gameState, snakeSegments, lastGameplayView]);

  useEffect(() => {
    const state = animationRef.current;
    if (gameState === 'Crashed' && !state.crashAnim && state.camera && state.reusable) {
        const crashedSnakePos = new THREE.Vector3(snakeSegments[0].x + offsetX, snakeSegments[0].y, snakeSegments[0].z + offsetZ);
        const ascendPos = crashedSnakePos.clone();
        ascendPos.y = 20;

        state.crashAnim = {
            phase: 'shake',
            startTime: performance.now(),
            shakeDuration: 1500,
            ascendDuration: 2000,
            startPos: state.camera.position.clone(),
            startQuat: state.camera.quaternion.clone(),
            crashedSnakePos,
            ascendPos,
            ascendQuat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(ascendPos, crashedSnakePos, new THREE.Vector3(0, 1, 0))),
        };
    }
  }, [gameState]);

  // NEW: Effect to clean up the crash animation state when the game state changes away from 'Crashed'.
  useEffect(() => {
      const state = animationRef.current;
      if (gameState !== 'Crashed' && state.crashAnim) {
          state.crashAnim = undefined;
      }
  }, [gameState]);

  useEffect(() => {
    const state = animationRef.current;
    if (gameState === 'GameOver' && !state.crashAnim && !state.gameOverAnim && state.camera) {
        const firstOrbitPoint = new THREE.Vector3(18, 8, 0);
        const targetLookAt = new THREE.Vector3(0, 2, 0);
        const targetQuat = new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().lookAt(firstOrbitPoint, targetLookAt, new THREE.Vector3(0, 1, 0))
        );

        state.gameOverAnim = {
            startTime: performance.now(),
            duration: 2000,
            startPos: state.camera.position.clone(),
            startQuat: state.camera.quaternion.clone(),
            endPos: firstOrbitPoint,
            endQuat: targetQuat,
        };
    }
  }, [gameState]);

  useEffect(() => {
    const state = animationRef.current;
    if (isSceneInitialized && isPageVisible && !isAnyModalOpen) {
        if (!state.animationFrameId && state.animate) {
            state.animate();
        }
    } else {
        if (state.animationFrameId) {
            cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = undefined;
        }
    }
  }, [isSceneInitialized, isPageVisible, isAnyModalOpen]);

  // NEW: Effect to handle dynamic graphics quality changes for fruits.
  useEffect(() => {
    const state = animationRef.current;
    if (!isSceneInitialized || !state.scene || prevGraphicsQualityRef.current === graphicsQuality) {
        return;
    }

    // --- 1. Dispose old assets ---
    const oldGeos = new Set<THREE.BufferGeometry>();
    if (state.fruitGeometries) {
        state.fruitGeometries.forEach(geo => oldGeos.add(geo));
    }
    oldGeos.forEach(geo => geo.dispose());

    if (state.fruitMaterials) {
        state.fruitMaterials.forEach(mat => {
            if ((mat as THREE.MeshStandardMaterial).map) {
                (mat as THREE.MeshStandardMaterial).map.dispose();
            }
            mat.dispose();
        });
    }

    // --- 2. Create and assign new assets ---
    const { geometries, materials } = createFruitAssetMaps(graphicsQuality, state);
    state.fruitGeometries = geometries;
    state.fruitMaterials = materials;
    
    // --- 3. Update existing meshes ---
    if (state.fruitMeshes) {
        const allCurrentFruits = [...state.fruits, ...state.clearingFruits.map(cf => cf.fruit)];
        for (const [id, mesh] of state.fruitMeshes.entries()) {
            const fruitData = allCurrentFruits.find(f => f.id === id);
            if (fruitData) {
                const newGeo = state.fruitGeometries.get(fruitData.type);
                const newMat = state.fruitMaterials.get(fruitData.type);

                if (newGeo && newMat) {
                    mesh.geometry = newGeo;
                    mesh.material = newMat;
                }
            }
        }
    }

    // Update the state for next change detection
    state.graphicsQuality = graphicsQuality;
    prevGraphicsQualityRef.current = graphicsQuality;

  }, [graphicsQuality, isSceneInitialized]);

  // NEW: Effect to enable/disable dynamic lighting system.
  useEffect(() => {
    const state = animationRef.current;
    if (isSceneInitialized && state.lightingSystem) {
      if (isDynamicLightingDisabled) {
        state.lightingSystem.setToStatic(COLORS.GRID_LINES);
      }
      // If it's re-enabled, the animate loop will naturally repaint the dynamic colors.
    }
  }, [isSceneInitialized, isDynamicLightingDisabled]);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) {
      return;
    }
    
    let sceneCleanup: (() => void) | null = null;
    let isInitialized = false;

    const observer = new ResizeObserver(() => {
        // On the first trigger with a valid size, initialize the scene.
        if (!isInitialized && currentMount.clientWidth > 0) {
            const initScene = () => {
                const animState = animationRef.current;
                animState.graphicsQuality = graphicsQuality; // Set initial quality
                const width = currentMount.clientWidth;
                const height = currentMount.clientHeight;
                
                animState.fruitMeshes = new Map();
                animState.appleGlows = new Map();
                animState.fruitShadows = new Map();
                animState.fpvCameraQuaternion = new THREE.Quaternion();
                animState.previousCameraView = animState.cameraView;
                animState.roofMeshes = [];
                
                const scene = new THREE.Scene();
                animState.scene = scene;
        
                const skyColor = 0x294a66;
                scene.background = new THREE.Color(skyColor);

                const fog = new THREE.FogExp2(skyColor, 0.015);
                scene.fog = fog;
                animState.fog = fog;
        
                const skyGeometry = new THREE.SphereGeometry(500, 32, 16);
                const skyMaterial = new THREE.MeshBasicMaterial({ color: skyColor, side: THREE.BackSide });
                const skySphere = new THREE.Mesh(skyGeometry, skyMaterial);
                scene.add(skySphere);
        
                const starVertices = [];
                const starRadius = 490;
                const tempVec = new THREE.Vector3();
                for (let i = 0; i < 1000; i++) {
                    tempVec.set(THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(2)).normalize().multiplyScalar(starRadius * (Math.random() * 0.2 + 0.8));
                    starVertices.push(tempVec.x, tempVec.y, tempVec.z);
                }
                const starGeometry = new THREE.BufferGeometry();
                starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
                const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.7 });
                const stars = new THREE.Points(starGeometry, starMaterial);
                scene.add(stars);
                
                const cylinderRadius = 70;
                const cylinderHeight = 50;
                const cylinderGeometry = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 64, 1, true);
                const cylinderMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(skyColor).multiplyScalar(0.8), side: THREE.BackSide, transparent: true, opacity: 0.8 });
                const backgroundCylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
                backgroundCylinder.position.y = cylinderHeight / 2 - 5;
                backgroundCylinder.rotation.y = -Math.PI / 2;
                
                const welcomeCylinderRadius = 20;
                const initialScale = welcomeCylinderRadius / cylinderRadius;
                backgroundCylinder.scale.set(initialScale, 1, initialScale);

                scene.add(backgroundCylinder);
                
                if (!animState.reusable) {
                    const axis_x = new THREE.Vector3(1, 0, 0);
                    const correctionQuat = new THREE.Quaternion().setFromAxisAngle(axis_x, Math.PI / 2);
                    animState.reusable = {
                        startPos: new THREE.Vector3(),
                        endPos: new THREE.Vector3(),
                        interpolatedPos: new THREE.Vector3(),
                        interpolatedLookAt: new THREE.Vector3(),
                        startQuat: new THREE.Quaternion(),
                        endQuat: new THREE.Quaternion(),
                        euler: new THREE.Euler(),
                        correctionQuat: correctionQuat,
                        axis_x: axis_x,
                        axis_y: new THREE.Vector3(0, 1, 0),
                        axis_z: new THREE.Vector3(0, 0, 1),
                        fp_camera_pos: new THREE.Vector3(),
                        backgroundCylinder: backgroundCylinder,
                        worldPos: new THREE.Vector3(),
                        localPos: new THREE.Vector3(),
                        droneLookAtHelper: new THREE.Object3D(),
                        lookAtHelper: new THREE.Vector3(),
                        droneForward: new THREE.Vector3(),
                        droneUp: new THREE.Vector3(),
                        appleGlowMaterial: undefined,
                        shadowTexture: undefined,
                        shadowGeo: undefined,
                        boardInstance: undefined,
                        tempColor: new THREE.Color(),
                    };
                }
                animState.reusable.backgroundCylinder = backgroundCylinder;
        
        
                const textureLoader = new THREE.TextureLoader();
                textureLoader.load(
                  'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/future_bg_dark.jpg',
                  (texture) => {
                    texture.mapping = THREE.EquirectangularReflectionMapping;
                    scene.environment = texture;
                    const cylinderTexture = texture.clone();
                    cylinderTexture.needsUpdate = true;
                    cylinderTexture.wrapS = THREE.RepeatWrapping;
                    cylinderTexture.repeat.x = -1;
                    cylinderMaterial.map = cylinderTexture;
                    cylinderMaterial.color.set(0xffffff);
                    cylinderMaterial.opacity = 1.0;
                    cylinderMaterial.needsUpdate = true;
                  },
                );
        
                const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
                animState.camera = camera;
                
                const renderer = new THREE.WebGLRenderer({ antialias: true });
                renderer.setSize(width, height);
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                renderer.toneMapping = THREE.ReinhardToneMapping;
                renderer.toneMappingExposure = 1.2;
                currentMount.appendChild(renderer.domElement);
                animState.renderer = renderer;
                
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
                scene.add(ambientLight);
                const directionalLight = new THREE.DirectionalLight(0xaaccff, 0.5);
                directionalLight.position.set(15, 30, 20);
                directionalLight.castShadow = true;
                directionalLight.shadow.mapSize.width = 1024;
                directionalLight.shadow.mapSize.height = 1024;
                directionalLight.shadow.bias = -0.0001;
                directionalLight.shadow.camera.left = -15;
                directionalLight.shadow.camera.right = 15;
                directionalLight.shadow.camera.top = 15;
                directionalLight.shadow.camera.bottom = -15;
                directionalLight.shadow.camera.far = 60;
                directionalLight.shadow.camera.updateProjectionMatrix();

                scene.add(directionalLight);
        
                const droneAltitudes = [5, 8];
                const droneColors = [new THREE.Color(0xff4400), new THREE.Color(0x00aaff)];
                animState.drones = [];
                animState.droneTargets = [
                    { state: undefined },
                    { state: undefined }
                ];

                for (let i = 0; i < 2; i++) {
                    const drone = createDrone(scene, droneColors[i], droneAltitudes[i], animState.geometriesToDispose, animState.materialsToDispose);
                    animState.drones.push(drone);
                    
                    const startPos = new THREE.Vector3( (Math.random() - 0.5) * 20, droneAltitudes[i], (Math.random() - 0.5) * 20);
                    drone.group.position.copy(startPos);
                    
                    if (i === 1) { 
                        animState.droneTargets[1] = {
                            altitude: droneAltitudes[i],
                            currentPosition: startPos.clone(),
                            targetPosition: new THREE.Vector3((Math.random() - 0.5) * 20, droneAltitudes[i], (Math.random() - 0.5) * 20),
                            startTime: performance.now(),
                            duration: 8000 + Math.random() * 4000
                        };
                    } else { 
                        (animState.droneTargets[0] as { state: DroneState }).state = chooseNextDroneAction(animState, drone.group.position.clone(), drone.group.quaternion.clone());
                    }
                }

                animState.drone0Failsafe = {
                    lastPos: new THREE.Vector3(),
                    lastCheckTime: 0,
                    stuckDuration: 0,
                };
                if (animState.drones?.[0]) {
                    animState.drone0Failsafe.lastPos.copy(animState.drones[0].group.position);
                }
        
                const bloomLayer = new THREE.Layers();
                bloomLayer.set(BLOOM_LAYER);
                const headGeo = new THREE.SphereGeometry(0.18, 16, 16);
                const headMat = new THREE.MeshStandardMaterial({ color: COLORS.PLAYER_FRONT, emissive: COLORS.PLAYER_FRONT, emissiveIntensity: 0.4 });
                const snakeHead = new THREE.Mesh(headGeo, headMat);
                snakeHead.layers.enable(BLOOM_LAYER);
                scene.add(snakeHead);
                animState.snakeHead = snakeHead;
        
                const maxSegments = FULL_BOARD_WIDTH * FULL_BOARD_DEPTH;
                const segmentGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
                animState.geometriesToDispose.push(segmentGeo);
                const segmentMat = new THREE.MeshStandardMaterial({ color: COLORS.PLAYER_BODY, emissive: COLORS.PLAYER_BODY, emissiveIntensity: 0.3 });
                animState.materialsToDispose.push(segmentMat);
                const snakeBody = new THREE.InstancedMesh(segmentGeo, segmentMat, maxSegments);
                snakeBody.layers.enable(BLOOM_LAYER);
                snakeBody.frustumCulled = false;
                scene.add(snakeBody);
                animState.snakeBody = snakeBody;
                animState.dummy = new THREE.Object3D();

                const tailGeo = new THREE.ConeGeometry(0.1, 1, 8);
                animState.geometriesToDispose.push(tailGeo);
                const snakeTail = new THREE.Mesh(tailGeo, segmentMat);
                snakeTail.layers.enable(BLOOM_LAYER);
                snakeTail.visible = false;
                scene.add(snakeTail);
                animState.snakeTail = snakeTail;
        
                const glowPlanes: THREE.Mesh[] = [];
                const glowGeo = new THREE.PlaneGeometry(0.8, 0.8);

                const bodyGlowTexture = createGlowTexture(new THREE.Color(COLORS.PLAYER_BODY).multiplyScalar(1.2).getStyle());
                animState.texturesToDispose.push(bodyGlowTexture);
                const bodyGlowMat = new THREE.MeshBasicMaterial({ map: bodyGlowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
                animState.materialsToDispose.push(bodyGlowMat);

                const headGlowTexture = createGlowTexture('#ffffff');
                animState.texturesToDispose.push(headGlowTexture);
                const headGlowMat = new THREE.MeshBasicMaterial({ map: headGlowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
                animState.materialsToDispose.push(headGlowMat);
                
                for(let i = 0; i < maxSegments; i++) {
                    const plane = new THREE.Mesh(glowGeo, i === 0 ? headGlowMat : bodyGlowMat);
                    plane.rotation.x = -Math.PI / 2;
                    plane.visible = false;
                    plane.layers.enable(BLOOM_LAYER);
                    scene.add(plane);
                    glowPlanes.push(plane);
                }
                animState.glowPlanes = glowPlanes;
        
                const appleGlowGeo = new THREE.PlaneGeometry(1.5, 1.5);
                animState.geometriesToDispose.push(appleGlowGeo);
                const appleGlowColor = FRUIT_COLORS[FruitType.APPLE];
                const appleGlowTexture = createGlowTexture(new THREE.Color(appleGlowColor).getStyle());
                animState.texturesToDispose.push(appleGlowTexture);
                const appleGlowMat = new THREE.MeshBasicMaterial({
                    map: appleGlowTexture,
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                });
                animState.materialsToDispose.push(appleGlowMat);
                if (animState.reusable) {
                    animState.reusable.appleGlowMaterial = appleGlowMat;
                    animState.reusable.appleGlowGeo = appleGlowGeo;
                }

                const shadowTexture = createShadowTexture();
                animState.texturesToDispose.push(shadowTexture);
                const shadowGeo = new THREE.PlaneGeometry(0.9, 0.9);
                animState.geometriesToDispose.push(shadowGeo);
                if (animState.reusable) {
                    animState.reusable.shadowTexture = shadowTexture;
                    animState.reusable.shadowGeo = shadowGeo;
                }

                // NEW: Use the refactored function
                const { geometries, materials } = createFruitAssetMaps(animState.graphicsQuality, animState);
                animState.fruitGeometries = geometries;
                animState.fruitMaterials = materials;
        
                const renderPass = new RenderPass(scene, camera);
                const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.8, 0.4, 0.85);
                animState.bloomPass = bloomPass;
        
                const bloomComposer = new EffectComposer(renderer);
                bloomComposer.renderToScreen = false;
                bloomComposer.addPass(renderPass);
                bloomComposer.addPass(bloomPass);
                animState.bloomComposer = bloomComposer;
        
                const finalComposer = new EffectComposer(renderer);
                finalComposer.addPass(renderPass);
                const finalPass = new ShaderPass(new THREE.ShaderMaterial({ uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } }, vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`, fragmentShader: `uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main() { gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) ); }` }), 'baseTexture');
                finalPass.needsSwap = true;
                finalComposer.addPass(finalPass);
                const outputPass = new OutputPass();
                finalComposer.addPass(outputPass);
                animState.finalComposer = finalComposer;
        
                const darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
                const materialsToRestore: { [uuid: string]: THREE.Material | THREE.Material[] } = {};
                const darkenNonBloomed = (obj: THREE.Object3D) => { if ((obj as THREE.Mesh).isMesh && !bloomLayer.test(obj.layers)) { materialsToRestore[obj.uuid] = (obj as THREE.Mesh).material; (obj as THREE.Mesh).material = darkMaterial; } };
                const restoreMaterials = (obj: THREE.Object3D) => { if (materialsToRestore[obj.uuid]) { (obj as THREE.Mesh).material = materialsToRestore[obj.uuid] as THREE.Material; delete materialsToRestore[obj.uuid]; } };
                
                animState.interpolatedPositions = Array.from({ length: maxSegments }, () => new THREE.Vector3());
                
                const rainCount = 15000;
                const rainVertices = [];
                for (let i = 0; i < rainCount; i++) {
                    const x = THREE.MathUtils.randFloatSpread(100);
                    const y = THREE.MathUtils.randFloat(10, 50);
                    const z = THREE.MathUtils.randFloatSpread(100);
                    rainVertices.push(x, y, z);
                }
                const rainGeo = new THREE.BufferGeometry();
                rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainVertices, 3));
                const rainMat = new THREE.PointsMaterial({ color: 0xaaaaee, size: 0.1, transparent: true, opacity: 0.6 });
                animState.materialsToDispose.push(rainMat);
                const rainSystem = new THREE.Points(rainGeo, rainMat);
                rainSystem.visible = false;
                scene.add(rainSystem);
                animState.rainSystem = rainSystem;

                const dustCount = 1000;
                const dustVertices = [];
                for (let i = 0; i < dustCount; i++) {
                    const x = THREE.MathUtils.randFloatSpread(40);
                    const y = THREE.MathUtils.randFloat(0.5, 10);
                    const z = THREE.MathUtils.randFloatSpread(40);
                    dustVertices.push(x, y, z);
                }
                const dustGeo = new THREE.BufferGeometry();
                dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustVertices, 3));
                const dustTexture = createGlowTexture('rgba(200, 220, 255, 0.5)');
                animState.texturesToDispose.push(dustTexture);
                const dustMat = new THREE.PointsMaterial({ size: 0.15, map: dustTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 });
                animState.materialsToDispose.push(dustMat);
                const dustSystem = new THREE.Points(dustGeo, dustMat);
                scene.add(dustSystem);
                animState.dustSystem = dustSystem;
        
                const animate = () => {
                  animState.animationFrameId = requestAnimationFrame(animate);
                  
                  const now = performance.now();
                  const delta = now - animState.lastFrameTime;

                  const isGameplay = animState.gameState === 'Playing' && !animState.isPaused;
                  const targetFps = (isGameplay && animState.graphicsQuality !== 'Low') ? 60 : 30;
                  const targetInterval = 1000 / targetFps;

                  if (delta < targetInterval) {
                      return; // Skip frame
                  }
                  animState.lastFrameTime = now - (delta % targetInterval);

                  const { renderer: currentRenderer, scene: currentScene, camera: currentCamera, bloomComposer: currentBloomComposer, finalComposer } = animState;
                  if (!currentRenderer || !currentScene || !currentCamera || !finalComposer || !currentBloomComposer) return;
                  const { cameraView, snakeHead, snakeBody, snakeTail, dummy, glowPlanes, towerLights, reusable, interpolatedPositions, fruitMeshes, appleGlows, fruitShadows, searchlightBeams, searchlightTargets, fruits: currentFruits, clearingFruits, activeEffects, isPassageFruitActive, bloomPass: currentBloomPass, portalGroups, drones, droneTargets, rotatingIcons, startAnim, crashAnim, gameOverAnim, lightingSystem } = animState;
                  if (!snakeHead || !snakeBody || !dummy || !glowPlanes || !reusable || !interpolatedPositions || !fruitMeshes || !appleGlows || !fruitShadows || !currentFruits || !clearingFruits || !activeEffects || !currentBloomPass || !portalGroups) return;
                  
                  const speedMps = 1000 / animState.gameSpeed;
                  const isSnakeVisible = animState.gameState !== 'Starting' || !startAnim;
                  const snakeHeadPos = isSnakeVisible && interpolatedPositions && interpolatedPositions.length > 0 ? interpolatedPositions[0] : null;
                  
                  if (!animState.isDynamicLightingDisabled) {
                      lightingSystem?.update(now, animState.gameState, animState.isPaused, speedMps, activeEffects, snakeHeadPos);
                  }

                  const twilightColor = new THREE.Color(0x294a66);
                  const midnightColor = new THREE.Color(0x050a15);
                  const scoreForMaxDarkness = 100;
                  const scoreProgress = Math.min(animState.score / scoreForMaxDarkness, 1.0);
                  const currentColor = reusable.tempColor.copy(twilightColor).lerp(midnightColor, scoreProgress);
                  if (!currentScene.background || !(currentScene.background as THREE.Color).equals(currentColor)) {
                      currentScene.background = currentColor.clone();
                  }
                  if (currentScene.fog && !(currentScene.fog as THREE.FogExp2).color.equals(currentColor)) {
                      (currentScene.fog as THREE.FogExp2).color.copy(currentColor);
                  }
                  
                  if (animState.dustSystem && animState.dustSystem.visible) {
                      const positions = animState.dustSystem.geometry.attributes.position;
                      const time = now * 0.0001;
                      for (let i = 0; i < positions.count; i++) {
                          let y = positions.getY(i);
                          if (y > 10) {
                              // This particle has drifted off the top, so we reset it to a new
                              // random horizontal position at the bottom to maintain density.
                              positions.setX(i, THREE.MathUtils.randFloatSpread(40));
                              positions.setY(i, 0.5);
                              positions.setZ(i, THREE.MathUtils.randFloatSpread(40));
                          } else {
                              // Otherwise, we just let it drift upwards and sideways.
                              positions.setY(i, y + 0.005);
                              const initialX = (positions.array[i * 3] / 40) * Math.PI * 2;
                              const initialZ = (positions.array[i * 3 + 2] / 40) * Math.PI * 2;
                              positions.setX(i, positions.getX(i) + Math.sin(time + initialZ) * 0.01);
                              positions.setZ(i, positions.getZ(i) + Math.cos(time + initialX) * 0.01);
                          }
                      }
                      positions.needsUpdate = true;
                  }
                  if (animState.rainSystem && animState.rainSystem.visible) {
                      const positions = animState.rainSystem.geometry.attributes.position;
                      for (let i = 0; i < positions.count; i++) {
                          const y = positions.getY(i);
                          positions.setY(i, y < -10 ? 50 + Math.random() * 20 : y - 0.5);
                      }
                      positions.needsUpdate = true;
                  }
                  
                  if (reusable.backgroundCylinder) {
                      const isWelcome = animState.gameState === 'Welcome';
                      const isGameOver = animState.gameState === 'GameOver';
                      const isDroneView = animState.cameraView === CameraView.DRONE_1 || animState.cameraView === CameraView.DRONE_2;
                      const isOrbitView = animState.cameraView === CameraView.ORBIT;
                      
                      const originalCylinderRadius = 70;
                      const welcomeCylinderRadius = 20;
                      let targetScale = 1.0;
        
                      if (isWelcome || isGameOver || isDroneView || isOrbitView) {
                          targetScale = welcomeCylinderRadius / originalCylinderRadius;
                      }
                      
                      if (Math.abs(reusable.backgroundCylinder.scale.x - targetScale) > 0.001) {
                          reusable.backgroundCylinder.scale.lerp(new THREE.Vector3(targetScale, 1, targetScale), 0.15);
                      } else {
                          reusable.backgroundCylinder.scale.set(targetScale, 1, targetScale);
                      }
                  }

                  if (reusable.boardInstance && animState.layoutDetails && lightingSystem && !animState.isDynamicLightingDisabled) {
                    const boardInstance = reusable.boardInstance;
                    const layoutDetails = animState.layoutDetails;
                    
                    // Build a map of what fruits are on which coordinate lines.
                    // This is more efficient than iterating through all fruits for every single tile.
                    const highlightMap = new Map<string, Fruit[]>();
                    const allFruitsForHighlighting = [...currentFruits, ...clearingFruits.map(cf => cf.fruit)];
                    const boardFruits = allFruitsForHighlighting.filter(f => FRUIT_CATEGORIES[f.type] !== 'PASSAGE');

                    for (const fruit of boardFruits) {
                        const fx = fruit.position.x;
                        const fz = fruit.position.z;

                        for (let x = WALL_THICKNESS; x < FULL_BOARD_WIDTH - WALL_THICKNESS; x++) {
                            const key = `${x},${fz}`;
                            if (!highlightMap.has(key)) highlightMap.set(key, []);
                            highlightMap.get(key)!.push(fruit);
                        }

                        for (let z = WALL_THICKNESS; z < FULL_BOARD_DEPTH - WALL_THICKNESS; z++) {
                            const key = `${fx},${z}`;
                            if (!highlightMap.has(key)) highlightMap.set(key, []);
                            highlightMap.get(key)!.push(fruit);
                        }
                    }

                    const targetColor = reusable.tempColor;
                    for (let i = 0; i < boardInstance.count; i++) {
                        const x = Math.floor(i / FULL_BOARD_DEPTH);
                        const z = i % FULL_BOARD_DEPTH;

                        const isStreet = isStreetPassageBlock(x, z, layoutDetails.street);
                        const originalTileColor = isStreet ? COLORS.STREET : ((x + z) % 2 === 0 ? COLORS.BOARD_LIGHT : COLORS.BOARD_DARK);
                        targetColor.set(originalTileColor);

                        const tileFruits = highlightMap.get(`${x},${z}`);
                        if (tileFruits) {
                            const highlightColorsToShow: THREE.Color[] = [];
                            
                            for (const fruit of tileFruits) {
                                const clearingInfo = clearingFruits.find(cf => cf.fruit.id === fruit.id);
                                const tileDist = Math.abs(x - fruit.position.x) + Math.abs(z - fruit.position.z);
                                const waveSpeed = 30; // grid units per second

                                if (clearingInfo) {
                                    // This is a clearing wave. The highlight disappears as the wave passes.
                                    const elapsed = now - clearingInfo.startTime;
                                    const waveDist = (elapsed / 1000) * waveSpeed;
                                    
                                    // Show color only if the wave has NOT reached the tile yet.
                                    if (tileDist > waveDist) {
                                        highlightColorsToShow.push(new THREE.Color(FRUIT_COLORS[fruit.type]));
                                    }
                                } else {
                                    // This is a spawn wave. The highlight appears as the wave passes.
                                    const spawnElapsed = now - fruit.spawnTime;
                                    const waveDist = (spawnElapsed / 1000) * waveSpeed;
                                    const spawnAnimDuration = 750; // ms

                                    // Show color if the wave has passed the tile, or if the animation is over.
                                    if (spawnElapsed > spawnAnimDuration || tileDist < waveDist) {
                                         highlightColorsToShow.push(new THREE.Color(FRUIT_COLORS[fruit.type]));
                                    }
                                }
                            }

                            if (highlightColorsToShow.length > 0) {
                                const finalColor = new THREE.Color(0,0,0);
                                highlightColorsToShow.forEach(c => finalColor.add(c));
                                finalColor.multiplyScalar(1 / highlightColorsToShow.length);
                                targetColor.lerp(finalColor, 0.4);
                            }
                        }
                        
                        const runwayColor = lightingSystem.getTileEffects(x, z, now);
                        if (runwayColor) {
                            targetColor.add(runwayColor);
                        }
                
                        boardInstance.setColorAt(i, targetColor);
                    }
                
                    if (boardInstance.instanceColor) {
                        (boardInstance.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
                    }
                  }

                  if (animState.billboardSlides && animState.billboardSlides.length > 0 && animState.lastBillboardSlideTime !== undefined && animState.currentBillboardSlideIndex !== undefined) {
                    const slide = animState.billboardSlides[animState.currentBillboardSlideIndex];
                    if (slide && now - animState.lastBillboardSlideTime > slide.duration) {
                        animState.lastBillboardSlideTime = now;
                        animState.currentBillboardSlideIndex = (animState.currentBillboardSlideIndex + 1) % animState.billboardSlides.length;
                        const nextTexture = animState.billboardSlides[animState.currentBillboardSlideIndex].texture;
                        if (animState.billboardScreen) {
                            (animState.billboardScreen.material as THREE.MeshStandardMaterial).map = nextTexture;
                            (animState.billboardScreen.material as THREE.MeshStandardMaterial).emissiveMap = nextTexture;
                            (animState.billboardScreen.material as THREE.MeshStandardMaterial).needsUpdate = true;
                        }
                    }
                  }
        
                  if (gameOverAnim) {
                      const elapsed = now - gameOverAnim.startTime;
                      const t = Math.min(elapsed / gameOverAnim.duration, 1.0);
                      const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
        
                      currentCamera.position.lerpVectors(gameOverAnim.startPos, gameOverAnim.endPos, easeT);
                      currentCamera.quaternion.slerpQuaternions(gameOverAnim.startQuat, gameOverAnim.endQuat, easeT);
        
                      if (t >= 1.0) {
                          animState.gameOverAnim = undefined;
                          animState.orbitAngle = Math.atan2(gameOverAnim.endPos.z, gameOverAnim.endPos.x);
                          onGameOverAnimationComplete();
                      }
                  } else if (startAnim && now > startAnim.startTime) {
                      const elapsed = now - startAnim.startTime;
                      const t = Math.min(elapsed / startAnim.duration, 1.0);
                      const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        
                      reusable.interpolatedPos.lerpVectors(startAnim.startPos, startAnim.endPos, easeT);
                      reusable.interpolatedPos.y += Math.sin(easeT * Math.PI) * 5;
                      currentCamera.position.copy(reusable.interpolatedPos);
        
                      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(reusable.interpolatedPos, startAnim.endLookAt, new THREE.Vector3(0, 1, 0)));
                      currentCamera.quaternion.slerpQuaternions(startAnim.startQuat, targetQuat, easeT);
        
                      if (t >= 1.0) {
                          animState.startAnim = undefined;
                      }
                  } else if (animState.gameState === 'Crashed' && crashAnim) {
                      const elapsed = now - crashAnim.startTime;
                      if (crashAnim.phase === 'shake') {
                          const progress = Math.min(elapsed / crashAnim.shakeDuration, 1.0);
                          currentBloomPass.strength = 0.8 + 5 * Math.sin(progress * Math.PI);
                          
                          const shakeAmount = 0.1 * (1 - progress);
                          const posWithShake = crashAnim.startPos.clone();
                          posWithShake.x += (Math.random() - 0.5) * shakeAmount;
                          posWithShake.y += (Math.random() - 0.5) * shakeAmount;
                          currentCamera.position.copy(posWithShake);
                          currentCamera.quaternion.slerp(crashAnim.startQuat, 1.0);
                          
                          if (elapsed >= crashAnim.shakeDuration) {
                              crashAnim.phase = 'ascending';
                              crashAnim.startTime = now;
                              crashAnim.startPos.copy(currentCamera.position);
                              crashAnim.startQuat.copy(currentCamera.quaternion);
                          }
                      } else if (crashAnim.phase === 'ascending') {
                          const progress = Math.min(elapsed / crashAnim.ascendDuration, 1.0);
                          const easeT = 1 - Math.pow(1 - progress, 3); // easeOutCubic
                          currentCamera.position.lerpVectors(crashAnim.startPos, crashAnim.ascendPos, easeT);
                          currentCamera.quaternion.slerpQuaternions(crashAnim.startQuat, crashAnim.ascendQuat, easeT);
                          
                          if (progress >= 1.0) {
                              // FIX: The original condition `... || crashAnim.phase === 'holding'` was unreachable
                              // inside this block due to TypeScript's control flow analysis, causing a type error.
                              // This check ensures this logic runs only once to transition the state.
                              if (crashAnim.phase === 'ascending') {
                                  crashAnim.phase = 'holding';
                                  onCrashAscendAnimationComplete();
                              }
                          }
                      } else if (crashAnim.phase === 'holding') {
                          currentCamera.position.copy(crashAnim.ascendPos);
                          currentCamera.quaternion.copy(crashAnim.ascendQuat);
                      }
                  } else if (animState.gameState === 'Starting') {
                        // This is a transition state. Do nothing and wait for startAnim to take over.
                        // This prevents the camera from jumping to a gameplay view for one frame
                        // before the start animation begins.
                  } else if (cameraView === CameraView.ORBIT) {
                      if (!animState.isOrbitDragging) {
                        if (animState.orbitAngle === undefined) animState.orbitAngle = 0;
                        animState.orbitAngle += 0.0025;
                      }
                      const angle = animState.orbitAngle || 0;
                      currentCamera.position.set(Math.cos(angle) * 18, 8, Math.sin(angle) * 18);
                      reusable.lookAtHelper.set(0, 2, 0);
                      currentCamera.lookAt(reusable.lookAtHelper);
                  } else if (cameraView === CameraView.DRONE_1 || cameraView === CameraView.DRONE_2) {
                      const droneIndex = cameraView === CameraView.DRONE_1 ? 0 : 1;
                      const drone = drones?.[droneIndex];
                      if (drone) {
                          const droneCameraMesh = drone.group.children[0].children[0];
                          droneCameraMesh.getWorldPosition(reusable.fp_camera_pos);
                          
                          const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(drone.group.quaternion);
                          const down = new THREE.Vector3(0, -1, 0);
                          
                          let tilt = 0.3;
                          
                          const lookAtDir = new THREE.Vector3().addVectors(forward, down.multiplyScalar(tilt)).normalize();
                          reusable.lookAtHelper.copy(reusable.fp_camera_pos).add(lookAtDir);
                          
                          currentCamera.position.copy(reusable.fp_camera_pos);
                          currentCamera.lookAt(reusable.lookAtHelper);
                      }
                  } else if (cameraView === CameraView.FIRST_PERSON) {
                      if (snakeHead && animState.fpvCameraQuaternion && reusable.euler) {
                          
                          const highSpeedThreshold = 4.0;

                          let targetRotation;
                          let lerpFactor;

                          if (speedMps > highSpeedThreshold) {
                              // --- HIGH SPEED MODE ---
                              // Target is the snake's ACTUAL rotation. No look-ahead.
                              targetRotation = animState.currentSnakeRotation;
                              // The camera should be very responsive, almost locked.
                              lerpFactor = 0.5;
                          } else {
                              // --- LOW SPEED MODE ---
                              // Target is the "visual" rotation from user input for the look-ahead feel.
                              targetRotation = animState.visualRotation;
                              // The turn speed is based on game speed for a smooth, detached feel.
                              lerpFactor = Math.min(1.0, 60 / animState.gameSpeed);
                          }

                          // On first entry into this view, snap the camera immediately.
                          if (animState.previousCameraView !== CameraView.FIRST_PERSON) {
                              animState.fpvCameraQuaternion.setFromEuler(reusable.euler.set(0, targetRotation, 0));
                          }
                  
                          // Slerp from the camera's current rotation towards the new target.
                          reusable.endQuat.setFromEuler(reusable.euler.set(0, targetRotation, 0));
                          animState.fpvCameraQuaternion.slerp(reusable.endQuat, lerpFactor); 
                  
                          const headPos = reusable.fp_camera_pos; snakeHead.getWorldPosition(headPos);
                          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(animState.fpvCameraQuaternion);
                          
                          currentCamera.position.copy(headPos).addScaledVector(forward, 0.2);
                          reusable.lookAtHelper.copy(headPos).add(forward);
                          currentCamera.lookAt(reusable.lookAtHelper);
                      }
                  } else if (cameraView === CameraView.THIRD_PERSON) {
                      if(snakeHead && animState.thirdPersonCameraSettings) {
                        const settings = animState.thirdPersonCameraSettings;
                        const idealOffset = reusable.localPos.set(0, settings.height, settings.distance);
                        idealOffset.applyQuaternion(snakeHead.quaternion);
                        snakeHead.getWorldPosition(reusable.worldPos);
                        const idealPosition = reusable.worldPos.add(idealOffset);

                        const idealLookAt = reusable.startPos.set(0, 0, -5);
                        idealLookAt.applyQuaternion(snakeHead.quaternion);
                        snakeHead.getWorldPosition(reusable.endPos);
                        idealLookAt.add(reusable.endPos);
                        
                        if (animState.previousCameraView !== CameraView.THIRD_PERSON) {
                          reusable.lookAtHelper.copy(idealLookAt);
                          currentCamera.position.copy(idealPosition);
                        }
                        
                        const lerpFactor = Math.min(1.0, 32 / animState.gameSpeed);
                        currentCamera.position.lerp(idealPosition, lerpFactor);
                        reusable.lookAtHelper.lerp(idealLookAt, lerpFactor);
                        currentCamera.lookAt(reusable.lookAtHelper);
                      }
                  }
                  
                  if(!animState.crashAnim && currentBloomPass.enabled) {
                      currentBloomPass.strength = 0.8;
                  }
        
                  if (drones && droneTargets && drones.length > 0 && !startAnim) {
                      const isGameplayActive = animState.gameState === 'Playing' && !animState.isPaused;
                      const shouldFreezeDrones = isGameplayActive && animState.graphicsQuality === 'Low';
                      
                      drones.forEach((drone, i) => {
                          const isCurrentView = (i === 0 && cameraView === CameraView.DRONE_1) || (i === 1 && cameraView === CameraView.DRONE_2);
                          drone.group.visible = !isCurrentView;
                          drone.propellers.forEach(p => { p.rotation.z += 0.5; });
                          
                          if (shouldFreezeDrones) {
                              return; // Skip movement logic
                          }
                          
                          if (i === 0) {
                              const failsafe = animState.drone0Failsafe;
                              if (failsafe) {
                                  if (failsafe.lastCheckTime === 0) {
                                      failsafe.lastCheckTime = now;
                                      failsafe.lastPos.copy(drone.group.position);
                                  }
                                  const timeSinceCheck = now - failsafe.lastCheckTime;
                                  if (timeSinceCheck > 2500) {
                                      const distanceMoved = failsafe.lastPos.distanceTo(drone.group.position);
                                      if (distanceMoved < 0.2) {
                                          failsafe.stuckDuration += timeSinceCheck;
                                      } else {
                                          failsafe.stuckDuration = 0;
                                      }
                                      failsafe.lastPos.copy(drone.group.position);
                                      failsafe.lastCheckTime = now;
                                  }
                              }
                              
                              let state = (droneTargets[0] as { state?: DroneState }).state;
                              const isStuck = failsafe && failsafe.stuckDuration >= 7500;
                              const isActionExpired = state && (now - state.startTime >= state.totalDuration);
                          
                              if (!state || isActionExpired || isStuck) {
                                  let startPosForNextAction = drone.group.position.clone();
                                  let startQuatForNextAction = drone.group.quaternion.clone();
                          
                                  if (isStuck) {
                                      console.warn("Drone 0 detected as stuck, forcing a hard reset to a safe position.");
                                      
                                      // Pick a safe, central location
                                      startPosForNextAction.set(
                                          THREE.MathUtils.randFloat(-5, 5),
                                          THREE.MathUtils.randFloat(MIN_DRONE_ALTITUDE + 1, animState.maxBuildingHeight - 2),
                                          THREE.MathUtils.randFloat(-5, 5)
                                      );
                                      
                                      // Immediately teleport the drone to this new safe starting position.
                                      drone.group.position.copy(startPosForNextAction);
                          
                                      // Reset failsafe timer
                                      failsafe.stuckDuration = 0;
                                      failsafe.lastCheckTime = now;
                                      failsafe.lastPos.copy(drone.group.position);
                                  }
                          
                                  state = chooseNextDroneAction(animState, startPosForNextAction, startQuatForNextAction);
                                  (droneTargets[0] as { state: DroneState }).state = state;
                              }
                              
                              const droneObject = drone.group;
                              const elapsed = now - state.startTime;

                              if (elapsed < state.approachDuration) {
                                  const t = elapsed / state.approachDuration;
                                  const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

                                  droneObject.position.lerpVectors(state.startPos, state.targetPos, easeT);
                                  droneObject.quaternion.slerpQuaternions(state.startQuat, state.targetQuat, easeT);
                                  const arc = Math.sin(easeT * Math.PI) * state.arcHeight;
                                  droneObject.position.y += arc;
                              } 
                              else {
                                  const mainActionElapsed = elapsed - state.approachDuration;
                                  const actionState = state.mainAction;

                                  if (mainActionElapsed < 50 && actionState.type !== 'PANORAMIC_DIVE') {
                                    droneObject.position.copy(state.targetPos);
                                    droneObject.quaternion.copy(state.targetQuat);
                                  }
                                  
                                  const actionProgress = Math.min(mainActionElapsed / state.mainActionDuration, 1.0);
                                  
                                  switch (actionState.type) {
                                      case 'IDLE': droneObject.position.y = state.targetPos.y + Math.sin(mainActionElapsed * 0.001) * 0.1; break;
                                      case 'WALL_RUN': {
                                          const easedActionT = actionProgress < 0.5 ? 2 * actionProgress * actionProgress : 1 - Math.pow(-2 * actionProgress + 2, 2) / 2;
                                          droneObject.position.lerpVectors(actionState.startPos, actionState.endPos, easedActionT);
                                          const pathDirection = reusable.localPos.subVectors(actionState.endPos, actionState.startPos).normalize();
                                          const sideVector = reusable.worldPos.crossVectors(pathDirection, reusable.axis_y!).normalize();
                                          const bobbleOffset = Math.sin(actionProgress * Math.PI * 4) * 0.3;
                                          droneObject.position.addScaledVector(sideVector, bobbleOffset);
                                          break;
                                      }
                                      case 'BANNER_ORBIT': {
                                          const { center, radius, normal, arc, startAngle } = actionState;
                                          const easedActionT = actionProgress < 0.5 ? 2 * actionProgress * actionProgress : 1 - Math.pow(-2 * actionProgress + 2, 2) / 2;
                                          const angle = startAngle + easedActionT * arc;

                                          const tangent = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
                                          
                                          const orbitPos = center.clone()
                                              .addScaledVector(normal, Math.cos(angle) * radius)
                                              .addScaledVector(tangent, Math.sin(angle) * radius);
                                          
                                          droneObject.position.copy(orbitPos);
                                          droneObject.lookAt(center);
                                          break;
                                      }
                                      case 'SNAKE_ORBIT':
                                          if (!animState.snakeHead) break;
                                          const easedActionT = actionProgress < 0.5 ? 2 * actionProgress * actionProgress : 1 - Math.pow(-2 * actionProgress + 2, 2) / 2;
                                          animState.snakeHead.getWorldPosition(reusable.worldPos);
                                          const snakeAngle = easedActionT * actionState.arc;
                                          const snakeOrbitPos = reusable.localPos.set(
                                              reusable.worldPos.x + Math.cos(snakeAngle) * actionState.radius,
                                              droneObject.position.y,
                                              reusable.worldPos.z + Math.sin(snakeAngle) * actionState.radius
                                          );
                                          droneObject.position.lerp(snakeOrbitPos, 0.1);
                                          droneObject.lookAt(reusable.worldPos);
                                          break;
                                      case 'ROTATE': {
                                          const startQuatForRotation = state.targetQuat;
                                          const angle = actionProgress * actionState.arc;
                                          const rotation = new THREE.Quaternion().setFromAxisAngle(reusable.axis_y!, angle);
                                          droneObject.quaternion.copy(startQuatForRotation).multiply(rotation);
                                          break;
                                      }
                                      case 'BILLBOARD_APPROACH': {
                                          const easedActionT = actionProgress < 0.5 ? 2 * actionProgress * actionProgress : 1 - Math.pow(-2 * actionProgress + 2, 2) / 2;
                                          droneObject.position.lerpVectors(actionState.startPos, actionState.endPos, easedActionT);
                                          droneObject.lookAt(actionState.lookAt);
                                          break;
                                      }
                                      case 'PANORAMIC_DIVE': {
                                        const phaseElapsed = mainActionElapsed - actionState.phaseStartTime;

                                        if (actionState.phase === 'ASCENDING') {
                                            actionState.phase = 'HOVERING';
                                            actionState.phaseStartTime = mainActionElapsed;
                                        }

                                        if (actionState.phase === 'HOVERING') {
                                            if (phaseElapsed > 2000) {
                                                actionState.phase = 'ROTATING_DOWN';
                                                actionState.phaseStartTime = mainActionElapsed;
                                            }
                                        } else if (actionState.phase === 'ROTATING_DOWN') {
                                            const totalRotationDuration = 10000;
                                            const tiltDuration = 1000;

                                            const tiltProgress = Math.min(phaseElapsed / tiltDuration, 1.0);
                                            const tiltQuat = reusable.startQuat.setFromAxisAngle(reusable.axis_x, (Math.PI / 2) * tiltProgress);
                                            
                                            let panQuat = reusable.endQuat.identity();
                                            if (phaseElapsed > tiltDuration) {
                                                const panDuration = totalRotationDuration - tiltDuration;
                                                const panProgress = Math.min((phaseElapsed - tiltDuration) / panDuration, 1.0);
                                                panQuat.setFromAxisAngle(reusable.axis_y, Math.PI * 2 * panProgress);
                                            }
                                            droneObject.quaternion.copy(state.targetQuat).multiply(tiltQuat);
                                            droneObject.quaternion.premultiply(panQuat);

                                            if (phaseElapsed > totalRotationDuration) {
                                                actionState.phase = 'DIVING';
                                                actionState.phaseStartTime = mainActionElapsed;
                                                actionState.diveStartQuat = droneObject.quaternion.clone();

                                                const minY = MIN_DRONE_ALTITUDE;
                                                const maxY = Math.max(minY, animState.maxBuildingHeight - 3);
                                                actionState.diveTargetPos = new THREE.Vector3(
                                                    THREE.MathUtils.randFloat(PLAYABLE_AREA_MIN_X, PLAYABLE_AREA_MAX_X),
                                                    THREE.MathUtils.randFloat(minY, maxY),
                                                    THREE.MathUtils.randFloat(PLAYABLE_AREA_MIN_Z, PLAYABLE_AREA_MAX_Z)
                                                );

                                                reusable.droneLookAtHelper!.position.copy(actionState.diveTargetPos);
                                                const randomForward = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                                                reusable.droneLookAtHelper!.lookAt(actionState.diveTargetPos.clone().add(randomForward));
                                                actionState.diveTargetQuat = reusable.droneLookAtHelper!.quaternion.clone();

                                                const diveStartPos = droneObject.position.clone();
                                                const controlPoint = new THREE.Vector3().lerpVectors(diveStartPos, actionState.diveTargetPos, 0.5);
                                                controlPoint.y = Math.max(controlPoint.y, diveStartPos.y);
                                                actionState.diveCurve = new THREE.QuadraticBezierCurve3(diveStartPos, controlPoint, actionState.diveTargetPos);
                                            }
                                        } else if (actionState.phase === 'DIVING') {
                                            const diveDuration = 7000;
                                            const diveProgress = Math.min(phaseElapsed / diveDuration, 1.0);
                                            const easeT = diveProgress < 0.5 ? 4 * diveProgress * diveProgress * diveProgress : 1 - Math.pow(-2 * diveProgress + 2, 3) / 2;

                                            if (actionState.diveCurve && actionState.diveTargetQuat && actionState.diveStartQuat) {
                                                actionState.diveCurve.getPointAt(easeT, droneObject.position);
                                                droneObject.quaternion.slerpQuaternions(actionState.diveStartQuat, actionState.diveTargetQuat, easeT);
                                            }
                                        }
                                        break;
                                      }
                                  }
                              }
                              droneObject.position.x = THREE.MathUtils.clamp(droneObject.position.x, PLAYABLE_AREA_MIN_X, PLAYABLE_AREA_MAX_X);
                              droneObject.position.z = THREE.MathUtils.clamp(droneObject.position.z, PLAYABLE_AREA_MIN_Z, PLAYABLE_AREA_MAX_Z);
                              droneObject.position.y = THREE.MathUtils.clamp(droneObject.position.y, MIN_DRONE_ALTITUDE, animState.maxBuildingHeight + 5);

                          } else {
                              const targetInfo = droneTargets[i] as any;
                              let t = (now - targetInfo.startTime) / targetInfo.duration;
                              
                              if (t >= 1.0) {
                                  targetInfo.startTime = now;
                                  targetInfo.currentPosition.copy(targetInfo.targetPosition);
                                  targetInfo.duration = 6000 + Math.random() * 3000;
                  
                                  const newX = (Math.random() - 0.5) * 20;
                                  const newZ = (Math.random() - 0.5) * 20;
                                  const newAltitude = 5.0 + Math.random() * 4.0;
                                  
                                  targetInfo.targetPosition.set(newX, newAltitude, newZ);
                                  t = 0;
                              }
                              
                              const easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                              const currentPos = reusable.localPos.lerpVectors(targetInfo.currentPosition, targetInfo.targetPosition, easedT);
                              
                              reusable.droneLookAtHelper!.position.copy(drone.group.position);
                              reusable.droneLookAtHelper!.lookAt(targetInfo.targetPosition);
                              const baseTargetQuat = reusable.droneLookAtHelper!.quaternion;
                              
                              const currentForward = reusable.startPos.set(0, 0, 1).applyQuaternion(drone.group.quaternion);
                              const targetForward = reusable.endPos.set(0, 0, 1).applyQuaternion(baseTargetQuat);
                              currentForward.y = 0; targetForward.y = 0; currentForward.normalize(); targetForward.normalize();
                              
                              const turnFactor = reusable.worldPos.crossVectors(currentForward, targetForward).y;
                              const maxBank = Math.PI / 6;
                              const bankAngle = THREE.MathUtils.clamp(-turnFactor * 2.5, -maxBank, maxBank);
                              const bankQuat = reusable.startQuat.setFromAxisAngle(reusable.axis_z, bankAngle);
                              const finalTargetQuat = reusable.endQuat.copy(baseTargetQuat).multiply(bankQuat);
                              
                              drone.group.quaternion.slerp(finalTargetQuat, 0.04);
                          
                              const wobble = reusable.worldPos.set(Math.sin(now * 0.0011 + i * 2) * 0.1, Math.cos(now * 0.0009 + i * 2) * 0.15, Math.sin(now * 0.0013 + i * 2) * 0.1);
                              drone.group.position.copy(currentPos).add(wobble);
                              drone.light.intensity = 4 + Math.sin(now * 0.02 + i * 3) * 2;
                          }
                      });
                  }
        
                  if (towerLights) {
                      towerLights.forEach(tower => {
                          const intensity = (Math.sin(now * 0.004) + 1.5) * 1.5;
                          tower.light.intensity = intensity;
                          (tower.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
                      });
                  }
                  if (rotatingIcons) rotatingIcons.forEach(icon => icon.rotation.y += 0.005);
                  portalGroups.forEach(showcase => { const { orbs, energyTexture } = showcase; const [orb1, orb2] = orbs; const orbitSpeed = now * 0.003; const pulse = 1.0 + 0.1 * Math.sin(now * 0.005); orb1.position.set(Math.cos(orbitSpeed) * 0.2, 0, Math.sin(orbitSpeed) * 0.2); orb2.position.set(Math.cos(orbitSpeed + Math.PI) * 0.2, 0, Math.sin(orbitSpeed + Math.PI) * 0.2); orb1.scale.setScalar(pulse); orb2.scale.setScalar(pulse); (orb1.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + 0.5 * Math.sin(now * 0.005); (orb2.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + 0.5 * Math.sin(now * 0.005); if (energyTexture) energyTexture.offset.y -= 0.01; });
                  if (searchlightBeams && searchlightTargets) {
                      const randomQuat = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * (Math.PI / 4), Math.random() * Math.PI * 2, 0, 'YXZ'));
                      if (isPassageFruitActive && passageFruitLocation && searchlightBeams.length > 0) {
                          const beamParentGroup = searchlightBeams[0].parent as THREE.Group;
                          const targetPoint = new THREE.Vector3(passageFruitLocation.x + offsetX, passageFruitLocation.y, passageFruitLocation.z + offsetZ);
                          
                          reusable.worldPos.setFromMatrixPosition(beamParentGroup.matrixWorld);
                          const direction = reusable.localPos.subVectors(targetPoint, reusable.worldPos);
                          const horizontalDist = Math.hypot(direction.x, direction.z);
                          const angle = Math.atan2(direction.y, horizontalDist);
                          const minAngle = 30 * Math.PI / 180;
        
                          if (angle < minAngle) {
                              direction.y = horizontalDist * Math.tan(minAngle);
                              reusable.startPos.addVectors(reusable.worldPos, direction);
                              beamParentGroup.lookAt(reusable.startPos);
                          } else {
                              beamParentGroup.lookAt(targetPoint);
                          }
                      }
        
                      searchlightBeams.forEach((beamGroup, i) => {
                          beamGroup.visible = isPassageFruitActive;
                          if (isPassageFruitActive) {
                              const targetState = searchlightTargets[i];
                              if (targetState.startTime === 0) targetState.startTime = now;
                              let t = (now - targetState.startTime) / targetState.duration;
                              if (t >= 1.0) {
                                  targetState.startTime = now;
                                  targetState.currentRotation.copy(targetState.nextRotation);
                                  targetState.nextRotation = randomQuat();
                                  t = 0;
                              }
                              beamGroup.quaternion.slerpQuaternions(targetState.currentRotation, targetState.nextRotation, t);
                          }
                      });
                  }
                  const tickDuration = Math.max(50, animState.gameSpeed);
                  const timeSinceTick = now - animState.lastTickTime;
                  const interp = animState.isCrashing ? 1.0 : Math.min(timeSinceTick / tickDuration, 1.0);
                  
                  snakeHead.visible = cameraView !== CameraView.FIRST_PERSON && !startAnim;
        
                  if (isSnakeVisible) {
                      const segmentCount = animState.currentSnakeSegments.length;
                      for (let i = 0; i < segmentCount; i++) {
                          const prevSeg = animState.prevSnakeSegments[i] || animState.currentSnakeSegments[i];
                          const currSeg = animState.currentSnakeSegments[i];
                          reusable.startPos.set(prevSeg.x + offsetX, prevSeg.y, prevSeg.z + offsetZ);
                          reusable.endPos.set(currSeg.x + offsetX, currSeg.y, currSeg.z + offsetZ);
                          interpolatedPositions[i].lerpVectors(reusable.startPos, reusable.endPos, interp);
                      }
        
                      if (segmentCount > 0) {
                          snakeHead.position.copy(interpolatedPositions[0]);
                          reusable.startQuat.setFromEuler(reusable.euler.set(0, animState.prevSnakeRotation, 0));
                          reusable.endQuat.setFromEuler(reusable.euler.set(0, animState.currentSnakeRotation, 0));
                          snakeHead.quaternion.slerpQuaternions(reusable.startQuat, reusable.endQuat, interp);
                      }
        
                      const defaultUp = reusable.axis_y!;
                      let visibleCount = 0;
                      // Render all body segments except the last as cylinders
                      for (let i = 0; i < segmentCount - 2; i++) {
                          const start = interpolatedPositions[i];
                          const end = interpolatedPositions[i + 1];
                          const distance = start.distanceTo(end);
                          const isInvisible = distance > 2.0;
        
                          if (!isInvisible) {
                              dummy.position.lerpVectors(start, end, 0.5);
                              const direction = reusable.localPos.subVectors(end, start).normalize();
                              if (direction.lengthSq() > 0.001) {
                                dummy.quaternion.setFromUnitVectors(defaultUp, direction);
                              }
                              dummy.updateMatrix();
                              snakeBody.setMatrixAt(visibleCount, dummy.matrix);
                              visibleCount++;
                          }
                      }
                      snakeBody.count = visibleCount;
                      snakeBody.instanceMatrix.needsUpdate = true;

                      // Position the cone as a "cap" on the last segment
                      if (snakeTail) {
                        if (segmentCount > 1) {
                            const start = interpolatedPositions[segmentCount - 2];
                            const end = interpolatedPositions[segmentCount - 1];
                            const distance = start.distanceTo(end);
                            const isInvisible = distance > 2.0;

                            if (!isInvisible) {
                                snakeTail.visible = true;
                                const direction = reusable.localPos.subVectors(end, start).normalize();
                                if (direction.lengthSq() > 0.001) {
                                    snakeTail.quaternion.setFromUnitVectors(defaultUp, direction);
                                }
                                // Position cone so its tip is at the 'end' point.
                                // Cone origin is at half height. It points along +Y. Height is 1. Tip is at y=0.5.
                                // After quaternion rotation, tip is at origin + direction*0.5.
                                // We want tip at 'end'. So origin should be at 'end' - direction*0.5.
                                snakeTail.position.copy(end).addScaledVector(direction, -0.5);
                            } else {
                                snakeTail.visible = false;
                            }
                        } else {
                            snakeTail.visible = false;
                        }
                      }
        
                      for (let i = segmentCount; i < glowPlanes.length; i++) {
                          if(glowPlanes[i]) glowPlanes[i].visible = false;
                      }
        
                      const isMagnetActive = activeEffects?.some(e => e.type === FruitType.MAGNET);
                      if (isMagnetActive) {
                          const pulse = 1.0 + Math.sin(now * 0.005) * 0.2;
                          glowPlanes.forEach(p => p.scale.set(pulse, pulse, 1));
                      } else {
                          if (glowPlanes[0] && glowPlanes[0].scale.x !== 1.0) {
                               glowPlanes.forEach(p => p.scale.set(1, 1, 1));
                          }
                      }

                      if (glowPlanes[0]) {
                          if (segmentCount > 0) {
                              glowPlanes[0].position.set(interpolatedPositions[0].x, 0.52, interpolatedPositions[0].z);
                              glowPlanes[0].visible = true;
                          } else {
                              glowPlanes[0].visible = false;
                          }
                      }

                      for (let i = 1; i < segmentCount; i++) {
                         const glowPart = glowPlanes[i];
                          if(glowPart) {
                              const pos = interpolatedPositions[i];
                              const prevPos = interpolatedPositions[i-1];
                              const distance = pos.distanceTo(prevPos);
                              const isInvisible = distance > 2.0;
                              glowPart.position.set(pos.x, 0.52, pos.z);
                              glowPart.visible = !isInvisible;
                              
                              if (i === segmentCount - 1 && !isMagnetActive) {
                                glowPart.scale.set(0.6, 0.6, 0.6);
                              } else if (!isMagnetActive) {
                                glowPart.scale.set(1, 1, 1);
                              }
                          }
                      }

                  } else {
                      snakeBody.count = 0;
                      snakeBody.instanceMatrix.needsUpdate = true;
                      if (snakeTail) snakeTail.visible = false;
                      glowPlanes.forEach(p => p.visible = false);
                  }
                  
                  const existingFruitIds = new Set<number>();
                  currentFruits.forEach(fruitData => {
                      existingFruitIds.add(fruitData.id);
                      let fruitMesh = fruitMeshes.get(fruitData.id);
                      let fruitShadow = fruitShadows.get(fruitData.id);

                      if (!fruitMesh) {
                          const geo = animState.fruitGeometries?.get(fruitData.type);
                          const mat = animState.fruitMaterials?.get(fruitData.type);
                          if (geo && mat && reusable?.shadowGeo && reusable.shadowTexture) {
                              fruitMesh = new THREE.Mesh(geo, mat);
                              fruitMesh.position.set(fruitData.position.x + offsetX, fruitData.position.y, fruitData.position.z + offsetZ);
                              fruitMesh.layers.enable(BLOOM_LAYER);
                              currentScene.add(fruitMesh);
                              fruitMeshes.set(fruitData.id, fruitMesh);

                              const shadowMaterial = new THREE.MeshBasicMaterial({
                                  map: reusable.shadowTexture,
                                  transparent: true,
                                  color: FRUIT_COLORS[fruitData.type],
                                  depthWrite: false,
                              });
                              animState.materialsToDispose.push(shadowMaterial);
                              
                              fruitShadow = new THREE.Mesh(reusable.shadowGeo, shadowMaterial);
                              fruitShadow.position.set(
                                  fruitData.position.x + offsetX,
                                  0.51,
                                  fruitData.position.z + offsetZ
                              );
                              fruitShadow.rotation.x = -Math.PI / 2;
                              currentScene.add(fruitShadow);
                              fruitShadows.set(fruitData.id, fruitShadow);
                              
                              if (fruitData.type === FruitType.APPLE && reusable?.appleGlowMaterial && reusable.appleGlowGeo) {
                                  const glowPlane = new THREE.Mesh(reusable.appleGlowGeo, reusable.appleGlowMaterial);
                                  glowPlane.rotation.x = -Math.PI / 2;
                                  glowPlane.position.set(fruitData.position.x + offsetX, 0.52, fruitData.position.z + offsetZ);
                                  glowPlane.layers.enable(BLOOM_LAYER);
                                  currentScene.add(glowPlane);
                                  appleGlows.set(fruitData.id, glowPlane);
                              }
                          }
                      }
                      if (fruitMesh) {
                          fruitMesh.rotation.y += 0.01;
                          let baseHeight = 1.0;
                          if (fruitData.type === FruitType.TRIPLE) {
                              baseHeight = 1.15;
                          }
                          const newY = baseHeight + Math.sin(now * 0.002 + fruitData.id) * 0.1;
                          fruitMesh.position.y = newY;

                          if (fruitShadow) {
                              fruitShadow.position.x = fruitMesh.position.x;
                              fruitShadow.position.z = fruitMesh.position.z;
                              const scale = THREE.MathUtils.mapLinear(newY, baseHeight - 0.1, baseHeight + 0.1, 0.9, 1.1);
                              fruitShadow.scale.set(scale, scale, scale);
                              (fruitShadow.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.mapLinear(newY, baseHeight - 0.1, baseHeight + 0.1, 0.7, 1.0);
                          }
                          
                          if (fruitData.type === FruitType.APPLE) {
                              const glowPlane = appleGlows.get(fruitData.id);
                              if (glowPlane) {
                                  glowPlane.position.x = fruitMesh.position.x;
                                  glowPlane.position.z = fruitMesh.position.z;
                                  const scale = THREE.MathUtils.mapLinear(newY, baseHeight - 0.1, baseHeight + 0.1, 0.95, 1.05);
                                  glowPlane.scale.set(scale, scale, scale);
                              }
                          }
                      }
                  });
                  for (const [id, mesh] of fruitMeshes.entries()) {
                      if (!existingFruitIds.has(id)) {
                          currentScene.remove(mesh);
                          fruitMeshes.delete(id);
                          
                          const shadowPlane = fruitShadows.get(id);
                          if (shadowPlane) {
                              currentScene.remove(shadowPlane);
                              (shadowPlane.material as THREE.Material).dispose();
                              fruitShadows.delete(id);
                          }
                          
                          const glowPlane = appleGlows.get(id);
                          if (glowPlane) {
                              currentScene.remove(glowPlane);
                              appleGlows.delete(id);
                          }
                      }
                  }
                  
                  if (animState.bloomPass?.enabled) {
                      currentScene.background = null; 
                      currentScene.traverse(darkenNonBloomed); 
                      currentBloomComposer.render(); 
                      currentScene.traverse(restoreMaterials); 
                      currentScene.background = new THREE.Color(skyColor); 
                      finalComposer.render();
                  } else {
                      currentRenderer.render(currentScene, currentCamera);
                  }

                  if (animState.previousCameraView !== cameraView) {
                      animState.previousCameraView = cameraView;
                  }
                };
                animState.animate = animate;
                // animate(); This is the problematic call, we let the useEffect handle it.
        
                sceneCleanup = () => {
                    if (animState.animationFrameId) cancelAnimationFrame(animState.animationFrameId);
                    if(animState.scene) {
                        animState.scene.traverse(object => {
                          if (object instanceof THREE.Mesh) {
                            if (object.geometry) object.geometry.dispose();
                            if (Array.isArray(object.material)) {
                              object.material.forEach(m => m.dispose());
                            } else if (object.material) {
                              if ((object.material as THREE.MeshStandardMaterial).map) {
                                  (object.material as THREE.MeshStandardMaterial).map?.dispose();
                              }
                              object.material.dispose();
                            }
                          }
                        });
                    }
                    animState.renderer?.dispose();
                    if (currentMount && animState.renderer?.domElement) {
                        try {
                            currentMount.removeChild(animState.renderer.domElement);
                        } catch (e) {
                            // Ignore if already removed
                        }
                    }
                    animState.renderer = undefined;
                };

                setIsSceneInitialized(true);
            };
            initScene();
            isInitialized = true;
        }

        // On every trigger, resize the canvas.
        handleResize();
    });

    observer.observe(currentMount);

    return () => {
      observer.disconnect();
      if (sceneCleanup) {
        sceneCleanup();
      }
    };
  }, [handleResize]); 

  useEffect(() => {
    const state = animationRef.current;
    if (!isSceneInitialized || !state.reusable?.boardInstance || !state.roofMeshes) {
        return;
    }

    const boardMaterial = state.reusable.boardInstance.material as THREE.MeshStandardMaterial;

    if (!state.originalMaterialProperties) {
        state.originalMaterialProperties = {
            board: { roughness: boardMaterial.roughness, metalness: boardMaterial.metalness },
            roofs: state.roofMeshes.map(r => ({
                roughness: (r.material as THREE.MeshStandardMaterial).roughness,
                metalness: (r.material as THREE.MeshStandardMaterial).metalness,
            }))
        };
    }
    
    const showParticles = graphicsQuality !== 'Low';

    if (weather === 'Rain') {
        boardMaterial.roughness = 0.1;
        boardMaterial.metalness = 0.9;
        state.roofMeshes.forEach(roof => {
            (roof.material as THREE.MeshStandardMaterial).roughness = 0.1;
            (roof.material as THREE.MeshStandardMaterial).metalness = 0.8;
        });
        if (state.rainSystem) state.rainSystem.visible = showParticles;
        if (state.dustSystem) state.dustSystem.visible = false;
    } else {
        const originals = state.originalMaterialProperties;
        boardMaterial.roughness = originals.board.roughness;
        boardMaterial.metalness = originals.board.metalness;
        state.roofMeshes.forEach((roof, i) => {
            if (originals.roofs[i]) {
                (roof.material as THREE.MeshStandardMaterial).roughness = originals.roofs[i].roughness;
                (roof.material as THREE.MeshStandardMaterial).metalness = originals.roofs[i].metalness;
            }
        });
        if (state.rainSystem) state.rainSystem.visible = false;
        if (state.dustSystem) state.dustSystem.visible = showParticles;
    }
    
    boardMaterial.needsUpdate = true;
    state.roofMeshes.forEach(roof => { (roof.material as THREE.MeshStandardMaterial).needsUpdate = true; });

  }, [weather, isSceneInitialized, graphicsQuality]);

  useEffect(() => {
    const state = animationRef.current;
    if (!isSceneInitialized || !state.scene || !layoutDetails) {
        return;
    }

    if (state.layoutGroup) {
        state.scene.remove(state.layoutGroup);
        state.layoutGroup.traverse(object => {
            if (object instanceof THREE.Mesh) {
                if(object.geometry) object.geometry.dispose();
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else if(object.material) {
                    if ((object.material as THREE.MeshStandardMaterial).map) {
                        (object.material as THREE.MeshStandardMaterial).map?.dispose();
                    }
                    object.material.dispose();
                }
            }
        });
    }

    state.geometriesToDispose.forEach(g => g.dispose());
    state.materialsToDispose.forEach(m => {
        if (m instanceof THREE.MeshStandardMaterial && m.map) m.map.dispose();
        m.dispose();
    });
    state.texturesToDispose.forEach(t => t.dispose());
    
    state.geometriesToDispose = [];
    state.materialsToDispose = [];
    state.texturesToDispose = [];
    state.towerLights = [];
    state.rotatingIcons = [];
    state.searchlightBeams = [];
    state.searchlightTargets = [];
    state.billboardScreen = undefined;
    state.portalGroups = new Map();
    state.bannerMeshes = [];
    state.buildingEdgesMesh = undefined;
    state.buildingEdgePositions = [];

    const layoutGroup = new THREE.Group();
    state.layoutGroup = layoutGroup;
    state.scene.add(layoutGroup);
    
    const textureLoader = new THREE.TextureLoader();

    const createAspectCorrectTexture = (
        texture: THREE.Texture,
        planeWidth: number,
        planeHeight: number,
        backgroundColor: string | null
    ): THREE.CanvasTexture => {
        const planeAspect = planeWidth / planeHeight;
        const image = texture.image;
        const imageAspect = image.width / image.height;

        const canvasWidth = 512;
        const canvasHeight = Math.round(canvasWidth / planeAspect);

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d')!;

        if (backgroundColor) {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        let drawWidth, drawHeight, drawX, drawY;

        if (imageAspect > planeAspect) {
            drawWidth = canvasWidth;
            drawHeight = canvasWidth / imageAspect;
            drawX = 0;
            drawY = (canvasHeight - drawHeight) / 2;
        } else {
            drawHeight = canvasHeight;
            drawWidth = canvasHeight * imageAspect;
            drawX = (canvasWidth - drawWidth) / 2;
            drawY = 0;
        }

        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

        const canvasTexture = new THREE.CanvasTexture(canvas);
        state.texturesToDispose.push(canvasTexture);
        return canvasTexture;
    };

    const brickGeometry = new THREE.BoxGeometry(1, 1, 1);
    state.geometriesToDispose.push(brickGeometry);
    
    const buildingColors = ['#1a1a2e', '#222228', '#1a2e2e'];
    const wallMaterials = buildingColors.map(color => {
        const texture = createBuildingTexture(color);
        state.texturesToDispose.push(texture);
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0.1 });
        state.materialsToDispose.push(material);
        return material;
    });

    const roofGeometries: { apex: THREE.BufferGeometry[], slanted: THREE.BufferGeometry[], pyramid: THREE.BufferGeometry[] } = { apex: [], slanted: [], pyramid: [] };
    const extrudeSettings = { depth: 1, bevelEnabled: false };
    [Math.PI / 6, Math.PI / 4].forEach(angle => { const shape = new THREE.Shape(); shape.moveTo(-0.5, 0); shape.lineTo(0, Math.tan(angle) * 0.5); shape.lineTo(0.5, 0); shape.closePath(); const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings); geo.translate(0, 0, -0.5); roofGeometries.apex.push(geo); state.geometriesToDispose.push(geo); });
    [Math.PI / 8, Math.PI / 6].forEach(angle => { const shape = new THREE.Shape(); shape.moveTo(-0.5, 0); shape.lineTo(-0.5, Math.tan(angle)); shape.lineTo(0.5, 0); shape.closePath(); const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings); geo.translate(0, 0, -0.5); roofGeometries.slanted.push(geo); state.geometriesToDispose.push(geo); });
    [0.6, 1.0].forEach(height => { const geo = new THREE.ConeGeometry(0.5 * Math.SQRT2, height, 4); geo.rotateY(Math.PI / 4); geo.translate(0, height / 2, 0); roofGeometries.pyramid.push(geo); state.geometriesToDispose.push(geo); });
    const portalBubbleMaterial = new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.1, roughness: 0.1, metalness: 0.9, transmission: 0.9, ior: 1.5, envMapIntensity: 1, depthWrite: false });
    state.materialsToDispose.push(portalBubbleMaterial);
    
    const buildingEdgeVertices: number[] = [];
    const collectEdgeVertices = (mesh: THREE.Mesh, targetArray: number[]) => {
        const edges = new THREE.EdgesGeometry(mesh.geometry);
        const posAttr = edges.getAttribute('position');
        mesh.updateWorldMatrix(true, false);
        for (let i = 0; i < posAttr.count; i++) {
            const vertex = new THREE.Vector3().fromBufferAttribute(posAttr, i);
            vertex.applyMatrix4(mesh.matrixWorld);
            targetArray.push(vertex.x, vertex.y, vertex.z);
        }
        state.geometriesToDispose.push(edges);
    };

    const boardMaterial = new THREE.MeshStandardMaterial({ metalness: 0.8, roughness: 0.1 });
    state.materialsToDispose.push(boardMaterial);
    const boardInstance = new THREE.InstancedMesh(brickGeometry, boardMaterial, FULL_BOARD_WIDTH * FULL_BOARD_DEPTH);
    boardInstance.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let x = 0; x < FULL_BOARD_WIDTH; x++) {
      for (let z = 0; z < FULL_BOARD_DEPTH; z++) {
        dummy.position.set(x + offsetX, 0, z + offsetZ);
        dummy.updateMatrix();
        boardInstance.setMatrixAt(x * FULL_BOARD_DEPTH + z, dummy.matrix);
        const isStreet = layoutDetails ? isStreetPassageBlock(x, z, layoutDetails.street) : false;
        const tileColor = isStreet ? COLORS.STREET : ((x + z) % 2 === 0 ? COLORS.BOARD_LIGHT : COLORS.BOARD_DARK);
        boardInstance.setColorAt(x * FULL_BOARD_DEPTH + z, color.set(tileColor));
      }
    }
    layoutGroup.add(boardInstance);
    if(state.reusable) {
        state.reusable.boardInstance = boardInstance;
    }


    const gridHelper = new THREE.GridHelper(FULL_BOARD_WIDTH, FULL_BOARD_WIDTH, COLORS.GRID_LINES, COLORS.GRID_LINES);
    gridHelper.position.set(0, 0.51, 0); 
    (gridHelper.material as THREE.LineBasicMaterial).vertexColors = true;
    gridHelper.layers.enable(BLOOM_LAYER);
    layoutGroup.add(gridHelper);
    
    const addBuildingColumn = (x: number, z: number, height: number, roofType: 'flat' | 'apex' | 'slanted' | 'pyramid' = 'flat') => { const buildingGeo = new THREE.BoxGeometry(1, height, 1); state.geometriesToDispose.push(buildingGeo); const materialIndex = Math.floor(Math.random() * wallMaterials.length); const buildingMaterial = wallMaterials[materialIndex]; const buildingMesh = new THREE.Mesh(buildingGeo, buildingMaterial); buildingMesh.position.set(x + offsetX, 0.5 + height / 2, z + offsetZ); buildingMesh.castShadow = true; buildingMesh.receiveShadow = true; const buildingColorHex = buildingColors[materialIndex]; const roofColor = new THREE.Color(buildingColorHex).multiplyScalar(0.9); const roofMaterial = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.9, metalness: 0.1, }); state.materialsToDispose.push(roofMaterial); let roofMesh: THREE.Mesh; if (roofType === 'flat') { const roofGeo = new THREE.PlaneGeometry(1, 1); state.geometriesToDispose.push(roofGeo); roofMesh = new THREE.Mesh(roofGeo, roofMaterial); roofMesh.rotation.x = -Math.PI / 2; roofMesh.position.y = height / 2 + 0.001; } else if (roofType === 'pyramid') { const geoPool = roofGeometries.pyramid; const roofGeo = geoPool[Math.floor(Math.random() * geoPool.length)]; roofMesh = new THREE.Mesh(roofGeo, roofMaterial); roofMesh.position.y = height / 2; } else {
      const geoPool = roofType === 'apex' ? roofGeometries.apex : roofGeometries.slanted;
      const roofGeo = geoPool[Math.floor(Math.random() * geoPool.length)];
      roofMesh = new THREE.Mesh(roofGeo, roofMaterial);
      roofMesh.position.y = height / 2;
      if (Math.random() < 0.5) { roofMesh.rotation.y = Math.PI / 2; }
    } buildingMesh.add(roofMesh); collectEdgeVertices(buildingMesh, buildingEdgeVertices); layoutGroup.add(buildingMesh); if(state.roofMeshes) { state.roofMeshes.push(roofMesh) }; return buildingMesh; };
    const addTransmissionTower = (x: number, z: number) => { const towerGroup = new THREE.Group(); towerGroup.position.set(x + offsetX, 0.5, z + offsetZ); const materialIndex = Math.floor(Math.random() * wallMaterials.length); const randomMaterial = wallMaterials[materialIndex]; const baseHeight = 1; const baseGeo = new THREE.BoxGeometry(1, baseHeight, 1); state.geometriesToDispose.push(baseGeo); const base = new THREE.Mesh(baseGeo, randomMaterial); base.position.y = baseHeight / 2; const roofGeo = new THREE.PlaneGeometry(0.95, 0.95); state.geometriesToDispose.push(roofGeo); const roofMaterial = new THREE.MeshStandardMaterial({ color: buildingColors[materialIndex], roughness: 0.8, metalness: 0.1 }); state.materialsToDispose.push(roofMaterial); const roofMesh = new THREE.Mesh(roofGeo, roofMaterial); roofMesh.rotation.x = -Math.PI / 2; roofMesh.position.y = baseHeight / 2 + 0.01; base.add(roofMesh); if(state.roofMeshes) { state.roofMeshes.push(roofMesh) }; towerGroup.add(base); const coneHeight = 4; const coneGeo = new THREE.ConeGeometry(0.4, coneHeight, 8); state.geometriesToDispose.push(coneGeo); const cone = new THREE.Mesh(coneGeo, randomMaterial); cone.position.y = baseHeight + coneHeight / 2; towerGroup.add(cone); const lightColor = 0xff2222; const light = new THREE.PointLight(lightColor, 2, 3); light.position.y = baseHeight + coneHeight + 0.2; const lightMeshGeo = new THREE.SphereGeometry(0.05, 8, 8); state.geometriesToDispose.push(lightMeshGeo); const lightMeshMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: lightColor, emissiveIntensity: 1, toneMapped: false }); state.materialsToDispose.push(lightMeshMat); const lightMesh = new THREE.Mesh(lightMeshGeo, lightMeshMat); lightMesh.position.copy(light.position); lightMesh.layers.enable(BLOOM_LAYER); towerGroup.add(lightMesh); state.towerLights.push({ light, mesh: lightMesh }); towerGroup.add(light); collectEdgeVertices(base, buildingEdgeVertices); collectEdgeVertices(cone, buildingEdgeVertices); layoutGroup.add(towerGroup); return towerGroup; };
    const addSkyscraper = (x: number, z: number, height: number, logoUrl: string) => { const buildingMesh = addBuildingColumn(x, z, height, 'flat'); const rooftopIcon = createQuantumRooftopIcon(state); rooftopIcon.position.y = height / 2; buildingMesh.add(rooftopIcon); state.rotatingIcons?.push(rooftopIcon); textureLoader.load(logoUrl, (texture) => { state.texturesToDispose.push(texture); const aspectRatio = texture.image.width / texture.image.height; const logoSize = 2.2; const logoWidth = aspectRatio >= 1 ? logoSize : logoSize * aspectRatio; const logoHeight = aspectRatio < 1 ? logoSize : logoSize / aspectRatio; const logoMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }); state.materialsToDispose.push(logoMaterial); const logoGeometry = new THREE.PlaneGeometry(logoWidth, logoHeight); state.geometriesToDispose.push(logoGeometry); const logoMesh = new THREE.Mesh(logoGeometry, logoMaterial); logoMesh.position.y = height / 2 - logoHeight / 2 - 0.2; const offset = 0.51; if (x < WALL_THICKNESS) { logoMesh.position.x = offset; logoMesh.rotation.y = Math.PI / 2; } else if (x >= FULL_BOARD_WIDTH - WALL_THICKNESS) { logoMesh.position.x = -offset; logoMesh.rotation.y = -Math.PI / 2; } else if (z < WALL_THICKNESS) { logoMesh.position.z = offset; logoMesh.rotation.y = 0; } else { logoMesh.position.z = -offset; logoMesh.rotation.y = Math.PI; } buildingMesh.add(logoMesh); }); return buildingMesh; };
    const addSnakeTower = (x: number, z: number, height: number, logoUrl: string) => { const buildingMesh = addBuildingColumn(x, z, height, 'flat'); const helipadTexture = createHeliPadTexture(); state.texturesToDispose.push(helipadTexture); const helipadGeo = new THREE.CircleGeometry(0.4, 32); state.geometriesToDispose.push(helipadGeo); const helipadMat = new THREE.MeshStandardMaterial({ map: helipadTexture, roughness: 0.7 }); state.materialsToDispose.push(helipadMat); const helipadMesh = new THREE.Mesh(helipadGeo, helipadMat); helipadMesh.rotation.x = -Math.PI / 2; helipadMesh.position.y = height / 2 + 0.01; helipadMesh.receiveShadow = true; if(state.roofMeshes) state.roofMeshes.push(helipadMesh); buildingMesh.add(helipadMesh); const lightGeo = new THREE.SphereGeometry(0.03, 8, 8); state.geometriesToDispose.push(lightGeo); const lightColor = 0xff0000; const lightMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: lightColor, emissiveIntensity: 1.5, toneMapped: false }); state.materialsToDispose.push(lightMat); const lightPositions = [ new THREE.Vector3(0.42, 0, 0), new THREE.Vector3(-0.42, 0, 0), new THREE.Vector3(0, 0, 0.42), new THREE.Vector3(0, 0, -0.42), ]; lightPositions.forEach(pos => { const lightMesh = new THREE.Mesh(lightGeo, lightMat); lightMesh.position.copy(pos); lightMesh.position.y = height / 2 + 0.02; lightMesh.layers.enable(BLOOM_LAYER); buildingMesh.add(lightMesh); }); textureLoader.load(logoUrl, (texture) => { state.texturesToDispose.push(texture); const aspectRatio = texture.image.width / texture.image.height; const logoWidth = 0.95; const logoHeight = logoWidth / aspectRatio; const logoMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true }); state.materialsToDispose.push(logoMaterial); const logoGeometry = new THREE.PlaneGeometry(logoWidth, logoHeight); state.geometriesToDispose.push(logoGeometry); const logoYPosition = height / 2 - logoHeight / 2 - 0.1; const offset = 0.51; const sides = [ { position: new THREE.Vector3(0, logoYPosition, offset), rotation: new THREE.Euler(0, 0, 0) }, { position: new THREE.Vector3(0, logoYPosition, -offset), rotation: new THREE.Euler(0, Math.PI, 0) }, { position: new THREE.Vector3(offset, logoYPosition, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0) }, { position: new THREE.Vector3(-offset, logoYPosition, 0), rotation: new THREE.Euler(0, -Math.PI / 2, 0) } ]; sides.forEach(side => { const logoMesh = new THREE.Mesh(logoGeometry, logoMaterial); logoMesh.position.copy(side.position); logoMesh.rotation.copy(side.rotation); buildingMesh.add(logoMesh); }); }); return buildingMesh; };
    const addSearchlightTower = (x: number, z: number) => { const height = 4; const buildingMesh = addBuildingColumn(x, z, height, 'flat'); const searchlightBaseGroup = new THREE.Group(); searchlightBaseGroup.position.y = height / 2; buildingMesh.add(searchlightBaseGroup); const lightColor = 0xffffaa; const createBeam = (xOffset: number): THREE.Group => { const beamGroup = new THREE.Group(); beamGroup.position.x = xOffset; const beamHeight = 30; const beamGeo = new THREE.CylinderGeometry(0.01, 0.2, beamHeight, 8, 1, true); state.geometriesToDispose.push(beamGeo); const beamMat = new THREE.MeshBasicMaterial({ color: lightColor, transparent: true, opacity: 0.15, side: THREE.DoubleSide }); state.materialsToDispose.push(beamMat); const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.y = beamHeight / 2; beamGroup.add(beam); const baseGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8); state.geometriesToDispose.push(baseGeo); const baseMat = new THREE.MeshStandardMaterial({color: '#444444'}); state.materialsToDispose.push(baseMat); const base = new THREE.Mesh(baseGeo, baseMat); base.position.y = 0.1; beamGroup.add(base); return beamGroup; }; const beam1 = createBeam(-0.2); const beam2 = createBeam(0.2); searchlightBaseGroup.add(beam1, beam2); state.searchlightBeams = [beam1, beam2]; state.searchlightTargets = []; const randomQuat = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * (Math.PI / 4), Math.random() * Math.PI * 2, 0, 'YXZ')); for (let i = 0; i < 2; i++) state.searchlightTargets.push({ currentRotation: randomQuat(), nextRotation: randomQuat(), startTime: 0, duration: 4000 + Math.random() * 3000, }); };
    const addBillboard = (details: BillboardDetails, parentObject: THREE.Object3D) => {
      const { x: startX, z: startZ, wall } = details;
      const chamberHeight = 1;
      const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.1 });
      state.materialsToDispose.push(roofMaterial);
      for (let i = 0; i < 3; i++) {
        const gridX = (wall === 'N' || wall === 'S') ? startX + i : startX;
        const gridZ = (wall === 'W' || wall === 'E') ? startZ + i : startZ;
        const baseGeo = new THREE.BoxGeometry(1, chamberHeight, 1);
        state.geometriesToDispose.push(baseGeo);
        const materialIndex = Math.floor(Math.random() * wallMaterials.length);
        const baseMaterial = wallMaterials[materialIndex];
        const baseMesh = new THREE.Mesh(baseGeo, baseMaterial);
        baseMesh.position.set(gridX + offsetX, 0.5 + chamberHeight / 2, gridZ + offsetZ);
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        const roofGeo = new THREE.PlaneGeometry(1.01, 1.01);
        state.geometriesToDispose.push(roofGeo);
        const roofMesh = new THREE.Mesh(roofGeo, roofMaterial);
        roofMesh.rotation.x = -Math.PI / 2;
        roofMesh.position.y = chamberHeight / 2 + 0.01;
        baseMesh.add(roofMesh);
        if(state.roofMeshes) { state.roofMeshes.push(roofMesh) };
        collectEdgeVertices(baseMesh, buildingEdgeVertices);
        parentObject.add(baseMesh);
      }
      const billboardGroup = new THREE.Group();
      parentObject.add(billboardGroup);
      let centerGridX, centerGridZ;
      if (wall === 'N' || wall === 'S') {
        centerGridX = startX + 1;
        centerGridZ = startZ;
      } else {
        centerGridX = startX;
        centerGridZ = startZ + 1;
      }
      billboardGroup.position.set(centerGridX + offsetX, 0.5 + chamberHeight, centerGridZ + offsetZ);
      let rotationY = 0;
      if (wall === 'S') rotationY = Math.PI;
      else if (wall === 'W') rotationY = Math.PI / 2;
      else if (wall === 'E') rotationY = -Math.PI / 2;
      billboardGroup.rotation.y = rotationY;
      const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.8 });
      state.materialsToDispose.push(frameMaterial);
      const frameWidth = 2.8, frameHeight = 1.6, frameDepth = 0.15;
      const frameGeo = new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth);
      state.geometriesToDispose.push(frameGeo);
      const frameMesh = new THREE.Mesh(frameGeo, frameMaterial);
      frameMesh.position.y = frameHeight / 2;
      billboardGroup.add(frameMesh);
      const screenGeo = new THREE.PlaneGeometry(2.5, 1.25);
      state.geometriesToDispose.push(screenGeo);
      const adTexture = createAdBannerTexture();
      state.texturesToDispose.push(adTexture);
      const screenMaterial = new THREE.MeshStandardMaterial({
        map: adTexture,
        emissive: 0xffffff,
        emissiveMap: adTexture,
        emissiveIntensity: 0.6,
      });
      state.materialsToDispose.push(screenMaterial);
      const screenMesh = new THREE.Mesh(screenGeo, screenMaterial);
      screenMesh.userData = { adType: 'Billboard' };
      screenMesh.position.y = frameMesh.position.y;
      screenMesh.position.z = frameDepth / 2 + 0.01;
      billboardGroup.add(screenMesh);
      state.billboardScreen = screenMesh;
      const neonColor = 0x00ffff;
      const neonMaterial = new THREE.MeshBasicMaterial({ color: neonColor });
      state.materialsToDispose.push(neonMaterial);
      const borderThickness = 0.05;
      const horizontalGeo = new THREE.BoxGeometry(frameWidth, borderThickness, borderThickness);
      state.geometriesToDispose.push(horizontalGeo);
      const verticalGeo = new THREE.BoxGeometry(borderThickness, frameHeight - borderThickness * 2, borderThickness);
      state.geometriesToDispose.push(verticalGeo);
      const topBorder = new THREE.Mesh(horizontalGeo, neonMaterial);
      topBorder.position.set(0, frameHeight / 2 - borderThickness / 2, frameDepth / 2 + 0.02);
      const bottomBorder = new THREE.Mesh(horizontalGeo, neonMaterial);
      bottomBorder.position.set(0, -frameHeight / 2 + borderThickness / 2, frameDepth / 2 + 0.02);
      const leftBorder = new THREE.Mesh(verticalGeo, neonMaterial);
      leftBorder.position.set(-frameWidth / 2 + borderThickness / 2, 0, frameDepth / 2 + 0.02);
      const rightBorder = new THREE.Mesh(verticalGeo, neonMaterial);
      rightBorder.position.set(frameWidth / 2 - borderThickness / 2, 0, frameDepth / 2 + 0.02);
      [topBorder, bottomBorder, leftBorder, rightBorder].forEach(border => {
        border.layers.enable(BLOOM_LAYER);
        frameMesh.add(border);
      });
    };
    
    const addPoster = (details: StreetPassageDetails, parentObject: THREE.Object3D) => {
        const { wall, entry, exit } = details;
        const posterHeight = 1.1;
        const posterWidth = posterHeight * (9 / 16);
        const posterY = 0.5 + posterHeight / 2 + 0.1;

        const posterGeo = new THREE.PlaneGeometry(posterWidth, posterHeight);
        state.geometriesToDispose.push(posterGeo);
        
        const placeholderMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x111111,
            emissive: 0x000000,
            side: THREE.DoubleSide
        });
        state.materialsToDispose.push(placeholderMaterial);

        const poster1 = new THREE.Mesh(posterGeo, placeholderMaterial);
        const poster2 = new THREE.Mesh(posterGeo, placeholderMaterial.clone());
        state.materialsToDispose.push(poster2.material as THREE.Material);

        poster1.userData = { adType: 'Poster' };
        poster2.userData = { adType: 'Poster' };

        const zFightOffset = 0.02;
        const minPos = Math.min(entry, exit) + WALL_THICKNESS;
        const maxPos = Math.max(entry, exit) + WALL_THICKNESS;

        if (wall === 'N' || wall === 'S') {
            const passageZ = (wall === 'N') ? (1.0 + offsetZ) : ((FULL_BOARD_DEPTH - 2.0) + offsetZ);
            
            poster1.position.set((minPos - 1) + offsetX + 0.5 + zFightOffset, posterY, passageZ);
            poster1.rotation.y = -Math.PI / 2;
            
            poster2.position.set((maxPos + 1) + offsetX - 0.5 - zFightOffset, posterY, passageZ);
            poster2.rotation.y = Math.PI / 2;

        } else {
            const passageX = (wall === 'W') ? (1.0 + offsetX) : ((FULL_BOARD_WIDTH - 2.0) + offsetX);

            poster1.position.set(passageX, posterY, (minPos - 1) + offsetZ + 0.5 + zFightOffset);
            poster1.rotation.y = 0;
            
            poster2.position.set(passageX, posterY, (maxPos + 1) + offsetZ - 0.5 - zFightOffset);
            poster2.rotation.y = Math.PI;
        }

        if (wall === 'N' || wall === 'S') {
            poster1.scale.x = -1;
            poster2.scale.x = -1;
        }

        parentObject.add(poster1, poster2);
    };

    let maxHeight = 0;
    layoutDetails.buildings.forEach(b => { if (b.height > maxHeight) maxHeight = b.height; });
    state.maxBuildingHeight = maxHeight + 1;

    layoutDetails.buildings.forEach(building => {
        const { x, z, height, type, roofType } = building;
        const snakeLogoUrl = 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/snakes.png';
        const quantumLogoUrl = 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Quantum%20Industries%20Logo.png';
        switch (type) {
            case 'snake-tower': addSnakeTower(x, z, height, snakeLogoUrl); break;
            case 'skyscraper-quantum': addSkyscraper(x, z, height, quantumLogoUrl); break;
            case 'transmission-tower': addTransmissionTower(x, z); break;
            case 'searchlight-tower': addSearchlightTower(x, z); break;
            case 'regular': addBuildingColumn(x, z, height, roofType); break;
        }
    });
    
    if (layoutDetails.banners) {
        const paidBannerGeo = new THREE.PlaneGeometry(0.9, 0.9 * (9 / 16));
        state.geometriesToDispose.push(paidBannerGeo);
        const cosmeticBannerGeo = new THREE.PlaneGeometry(1.4, 1.4 * 9 / 16);
        state.geometriesToDispose.push(cosmeticBannerGeo);

        const cosmeticAdTexture = createAdBannerTexture();
        state.texturesToDispose.push(cosmeticAdTexture);
        const cosmeticBannerMaterial = new THREE.MeshStandardMaterial({
            map: cosmeticAdTexture,
            emissive: 0xffffff,
            emissiveMap: cosmeticAdTexture,
            emissiveIntensity: 0.4,
            side: THREE.DoubleSide
        });
        state.materialsToDispose.push(cosmeticBannerMaterial);

        const paidBannerMaterial = new THREE.MeshStandardMaterial({
            map: cosmeticAdTexture,
            emissive: 0xffffff,
            emissiveMap: cosmeticAdTexture,
            emissiveIntensity: 0.6,
            color: 0xffffff,
            side: THREE.DoubleSide
        });
        state.materialsToDispose.push(paidBannerMaterial);
        
        layoutDetails.banners.forEach(banner => {
            const attachment = getWallAttachmentDetails(banner.wall, banner.position, !!banner.isAlcoveSpot, !!banner.isStreetIsland);
            if (!attachment) return;

            const isPaid = banner.type === 'paid';
            const material = isPaid ? paidBannerMaterial.clone() : cosmeticBannerMaterial.clone();
            state.materialsToDispose.push(material);

            let bannerObject: THREE.Object3D;
            let meshForDrone: THREE.Mesh;

            if (isPaid) {
                const mesh = new THREE.Mesh(paidBannerGeo, material);
                mesh.userData = { adType: 'Banner' };
                addNeonBorderToBanner(mesh, state);
                bannerObject = mesh;
                meshForDrone = mesh;
            } else {
                const bannerGroup = new THREE.Group();
                bannerGroup.userData = { adType: 'CosmeticBanner' };

                const bannerMesh = new THREE.Mesh(cosmeticBannerGeo, material);
                bannerMesh.layers.enable(BLOOM_LAYER);
                bannerGroup.add(bannerMesh);

                const poleHeight = 1.2;
                const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, poleHeight, 8);
                state.geometriesToDispose.push(poleGeo);
                const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.8 });
                state.materialsToDispose.push(poleMat);
                
                const bannerHeight = (cosmeticBannerGeo.parameters as any).height;
                const spacer = 0.05;
                const isFlipped = banner.wall === 'E' || banner.wall === 'W';
                const poleZOffset = isFlipped ? spacer : -spacer;

                const pole1 = new THREE.Mesh(poleGeo, poleMat);
                pole1.position.set(-0.5, bannerHeight / 2 - poleHeight / 2, poleZOffset);
                const pole2 = pole1.clone();
                pole2.position.x = 0.5;

                bannerGroup.add(pole1, pole2);
                bannerObject = bannerGroup;
                meshForDrone = bannerMesh;
            }

            bannerObject.position.copy(attachment.position);
            bannerObject.position.y = banner.height;
            bannerObject.rotation.copy(attachment.rotation);

            if (banner.wall === 'E' || banner.wall === 'W') {
                bannerObject.scale.x = -1;
            }
            
            layoutGroup.add(bannerObject);
            if (state.bannerMeshes) {
                state.bannerMeshes.push(meshForDrone);
            }
        });
    }

    if (layoutDetails.flyers) {
        const flyerGeo = new THREE.PlaneGeometry(0.5, 0.5);
        state.geometriesToDispose.push(flyerGeo);
        const flyerTextures = [createFlyerTexture(0), createFlyerTexture(1), createFlyerTexture(2)];
        state.texturesToDispose.push(...flyerTextures);
        const flyerMaterials = flyerTextures.map(tex => {
            const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide });
            state.materialsToDispose.push(mat);
            return mat;
        });

        layoutDetails.flyers.forEach(flyer => {
            const attachment = getFlyerAttachmentDetails(flyer);
            if (!attachment) return;

            const material = flyerMaterials[flyer.variant] || flyerMaterials[0];
            const mesh = new THREE.Mesh(flyerGeo, material.clone());
            state.materialsToDispose.push(mesh.material as THREE.Material);
            mesh.userData = { adType: 'Flyer' };
            
            mesh.position.copy(attachment.position);
            mesh.position.y = flyer.height;

            const baseRotation = attachment.rotation;
            mesh.rotation.set(0, baseRotation.y + flyer.rotationJitter.y, flyer.rotationJitter.z);

            if (flyer.wall === 'E' || flyer.wall === 'W') {
                mesh.rotation.y += Math.PI;
            }
            
            // FIX: Offset flyer slightly from the wall to prevent z-fighting with lighting effects.
            const offsetVector = new THREE.Vector3(0, 0, 0.02); // Small forward offset
            // Apply the mesh's final rotation to the offset vector to push it in the correct direction.
            offsetVector.applyQuaternion(mesh.quaternion);
            mesh.position.add(offsetVector);
            
            layoutGroup.add(mesh);
        });
    }

    addBillboard(layoutDetails.billboard, layoutGroup);
    addPoster(layoutDetails.street, layoutGroup);

    const portalFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2, envMapIntensity: 0.5 }); state.materialsToDispose.push(portalFrameMaterial); const createPortalShowcase = (portalType: 'Red' | 'Blue') => { const portalGroup = new THREE.Group(); const topCapGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32); state.geometriesToDispose.push(topCapGeo); const topCap = new THREE.Mesh(topCapGeo, portalFrameMaterial); topCap.position.y = 0.4; portalGroup.add(topCap); const baseGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32); state.geometriesToDispose.push(baseGeo); const base = new THREE.Mesh(baseGeo, portalFrameMaterial); base.position.y = -0.45; portalGroup.add(base); const energyGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.7, 32, 1, true); state.geometriesToDispose.push(energyGeo); const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 128; const ctx = canvas.getContext('2d')!; ctx.strokeStyle = portalType === 'Red' ? '#ff8080' : '#80b3ff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.5; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.moveTo(Math.random() * 32, 0); ctx.lineTo(Math.random() * 32, 128); ctx.stroke(); } const energyTexture = new THREE.CanvasTexture(canvas); energyTexture.wrapS = THREE.RepeatWrapping; energyTexture.wrapT = THREE.RepeatWrapping; state.texturesToDispose.push(energyTexture); const energyMat = new THREE.MeshBasicMaterial({ map: energyTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); state.materialsToDispose.push(energyMat); const energyCylinder = new THREE.Mesh(energyGeo, energyMat); portalGroup.add(energyCylinder); const orbRadius = 0.15; const orbGeometry = new THREE.SphereGeometry(orbRadius, 16, 16); state.geometriesToDispose.push(orbGeometry); const orbTexture = createPortalTexture(portalType); state.texturesToDispose.push(orbTexture); const orbMaterial = new THREE.MeshStandardMaterial({ emissiveMap: orbTexture, emissive: 0xffffff, emissiveIntensity: 1.5, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, }); state.materialsToDispose.push(orbMaterial); const orb1 = new THREE.Mesh(orbGeometry, orbMaterial); orb1.layers.enable(BLOOM_LAYER); portalGroup.add(orb1); const orb2 = new THREE.Mesh(orbGeometry, orbMaterial.clone()); state.materialsToDispose.push(orb2.material as THREE.Material); orb2.layers.enable(BLOOM_LAYER); portalGroup.add(orb2); portalGroup.visible = false; return { group: portalGroup, orbs: [orb1, orb2], energyTexture }; };
    
    layoutDetails.portals.forEach(portal => {
        const showcase = createPortalShowcase(portal.type);
        const pos = getPortalAbsolutePosition(portal);
        showcase.group.position.set(pos.x + offsetX, 1.05, pos.z + offsetZ);
        showcase.group.visible = true;
        layoutGroup.add(showcase.group);
        state.portalGroups!.set(portal.id, showcase);
    });

    if (buildingEdgeVertices.length > 0) {
        const tubeRadius = 0.02;
        const tubeGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, 1, 8);
        state.geometriesToDispose.push(tubeGeo);
    
        const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        state.materialsToDispose.push(tubeMat);
    
        const numEdges = buildingEdgeVertices.length / 6;
        const buildingNeonTubes = new THREE.InstancedMesh(tubeGeo, tubeMat, numEdges);
        if(buildingNeonTubes.instanceColor) buildingNeonTubes.instanceColor.setUsage(THREE.DynamicDrawUsage);
        buildingNeonTubes.layers.enable(BLOOM_LAYER);
        layoutGroup.add(buildingNeonTubes);
        
        state.buildingEdgePositions = [];
        const p1 = new THREE.Vector3();
        const p2 = new THREE.Vector3();
        const tubeDummy = new THREE.Object3D();
        const defaultUp = new THREE.Vector3(0, 1, 0);
    
        for (let i = 0; i < numEdges; i++) {
            p1.fromArray(buildingEdgeVertices, i * 6);
            p2.fromArray(buildingEdgeVertices, i * 6 + 3);
    
            const length = p1.distanceTo(p2);
            if (length < 0.01) continue;
    
            tubeDummy.position.lerpVectors(p1, p2, 0.5);
            state.buildingEdgePositions.push(tubeDummy.position.clone());
    
            const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
            tubeDummy.quaternion.setFromUnitVectors(defaultUp, direction);
            tubeDummy.scale.set(1, length, 1);
            
            tubeDummy.updateMatrix();
            buildingNeonTubes.setMatrixAt(i, tubeDummy.matrix);
            buildingNeonTubes.setColorAt(i, new THREE.Color(COLORS.GRID_LINES));
        }
        
        buildingNeonTubes.instanceMatrix.needsUpdate = true;
        if (buildingNeonTubes.instanceColor) {
            buildingNeonTubes.instanceColor.needsUpdate = true;
        }
        state.buildingEdgesMesh = buildingNeonTubes;
    }

    const lightingSystem = new LightingSystem();
    if(state.buildingEdgesMesh && state.buildingEdgePositions) {
        lightingSystem.init(gridHelper, state.buildingEdgesMesh, state.buildingEdgePositions, layoutDetails);
    }
    state.lightingSystem = lightingSystem;

    if (approvedAds) {
        const today = new Date().toISOString().slice(0, 10);
        
        const todaysPaidAds = approvedAds.filter(ad => !ad.orderNumber.includes('sys') && ad.scheduleDate === today);
        const systemAds = approvedAds.filter(ad => ad.orderNumber.includes('sys'));
        const displayedPaidOrderNumbers: string[] = [];

        const availableSlots: { [key in AdType]?: THREE.Mesh[] } = { Billboard: [], Poster: [], Banner: [], Flyer: [], CosmeticBanner: [] };
        state.layoutGroup?.traverse(child => {
            if ((child instanceof THREE.Mesh || child instanceof THREE.Group) && child.userData.adType) {
                const adType = child.userData.adType as AdType;
                if (availableSlots[adType]) {
                    if (child instanceof THREE.Group) {
                        const meshToTexture = child.children.find(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.PlaneGeometry) as THREE.Mesh;
                        if (meshToTexture) availableSlots[adType]!.push(meshToTexture);
                    } else if (child instanceof THREE.Mesh) {
                        availableSlots[adType]!.push(child);
                    }
                }
            }
        });
        Object.values(availableSlots).forEach(slots => {
            if (slots) { for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[slots[i], slots[j]] = [slots[j], slots[i]]; } }
        });

        const applyAdToMesh = (mesh: THREE.Mesh, ad: ApprovedAd) => {
             const material = mesh.material as THREE.MeshStandardMaterial;
             textureLoader.load(ad.imageUrl, texture => {
                  state.texturesToDispose.push(texture);
                  const planeGeo = mesh.geometry as THREE.PlaneGeometry;
                  const isFlyerOrPoster = ad.adType === 'Flyer' || ad.adType === 'Poster';
                  const backgroundColor = isFlyerOrPoster ? null : (ad.adType === 'CosmeticBanner' ? 'white' : 'black');
                  
                  const canvasTexture = createAspectCorrectTexture(texture, planeGeo.parameters.width, planeGeo.parameters.height, backgroundColor);

                  if (material.map) material.map.dispose();
                  material.map = canvasTexture;
                  material.emissiveMap = canvasTexture;
                  material.transparent = isFlyerOrPoster;
                  material.alphaTest = isFlyerOrPoster ? 0.1 : 0;
                  material.emissiveIntensity = ad.adType === 'Banner' || ad.adType === 'Billboard' ? 0.6 : 0.5;
                  material.color.set(0xffffff);
                  material.needsUpdate = true;
                  
                  if (ad.adType === 'CosmeticBanner') {
                      mesh.layers.disable(BLOOM_LAYER);
                  }
             }, undefined, () => console.error(`Failed to load ad image: ${ad.imageUrl}`));
        };
        
        todaysPaidAds.forEach(ad => {
            const slotsForType = availableSlots[ad.adType];
            if (slotsForType && slotsForType.length > 0) {
                const slotMesh = slotsForType.pop()!;
                applyAdToMesh(slotMesh, ad);
                displayedPaidOrderNumbers.push(ad.orderNumber);
            }
        });
        
        systemAds.forEach(ad => {
            const slotsForType = availableSlots[ad.adType];
            if (slotsForType && slotsForType.length > 0) {
                const slotMesh = slotsForType.pop()!;
                applyAdToMesh(slotMesh, ad);
            }
        });

        const remainingPosterSlots = availableSlots['Poster'] || [];
        if (remainingPosterSlots.length > 0) {
            const defaultPosterUrls = [
                'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/go%20forward.jpg',
                'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/speed%20cola.jpg'
            ];

            const applyDefaultPoster = (mesh: THREE.Mesh, url: string) => {
                const material = mesh.material as THREE.MeshStandardMaterial;
                textureLoader.load(url, texture => {
                    state.texturesToDispose.push(texture);
                    const planeGeo = mesh.geometry as THREE.PlaneGeometry;
                    const canvasTexture = createAspectCorrectTexture(texture, planeGeo.parameters.width, planeGeo.parameters.height, 'white');
                    if (material.map) material.map.dispose();
                    material.map = canvasTexture;
                    material.emissiveMap = canvasTexture;
                    material.emissiveIntensity = 0.5;
                    material.color.set(0xffffff);
                    material.needsUpdate = true;
                }, undefined, () => console.error(`Failed to load default poster: ${url}`));
            };

            remainingPosterSlots.forEach((slot, index) => {
                if (index < defaultPosterUrls.length) {
                    applyDefaultPoster(slot, defaultPosterUrls[index % defaultPosterUrls.length]);
                }
            });
        }
        
        const setupSlideshow = async () => {
            if (!state.billboardScreen) return;
            const slides: { texture: THREE.Texture; duration: number }[] = [];
            const billboardPaidAd = todaysPaidAds.find(ad => ad.adType === 'Billboard');
            const billboardSystemAd = systemAds.find(ad => ad.adType === 'Billboard');
            const primaryAd = billboardPaidAd || billboardSystemAd;

            const billboardGeo = state.billboardScreen.geometry as THREE.PlaneGeometry;
            
            const processAndAddSlide = async (url: string, duration: number) => {
                try {
                    const loadedTexture = await textureLoader.loadAsync(url);
                    state.texturesToDispose.push(loadedTexture);
                    const canvasTexture = createAspectCorrectTexture(
                        loadedTexture,
                        billboardGeo.parameters.width,
                        billboardGeo.parameters.height,
                        'black'
                    );
                    slides.push({ texture: canvasTexture, duration });
                } catch (e) {
                    console.error(`Failed to load slide image: ${url}`, e);
                }
            };
    
            await processAndAddSlide('https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Snake%20banner.jpg', 10000);
    
            if (billboardData && billboardData.topScores.length > 0) {
                const scoreTexture = createScoreSlideTexture('HIGH SCORES', billboardData.topScores, 'points');
                slides.push({ texture: scoreTexture, duration: 10000 });
                state.texturesToDispose.push(scoreTexture);
            }
    
            if (billboardData && billboardData.topSpeeds.length > 0) {
                const speedTexture = createScoreSlideTexture('FASTEST SNAKES', billboardData.topSpeeds, 'm/s');
                slides.push({ texture: speedTexture, duration: 10000 });
                state.texturesToDispose.push(speedTexture);
            }
    
            if (primaryAd) {
                await processAndAddSlide(primaryAd.imageUrl, 30000);
                if (billboardPaidAd && !displayedPaidOrderNumbers.includes(billboardPaidAd.orderNumber)) {
                    displayedPaidOrderNumbers.push(billboardPaidAd.orderNumber);
                }
            } else {
                await processAndAddSlide('https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Spi%20vs%20Spi%20Coming%20Soon.png', 10000);
            }

            state.billboardSlides = slides;
            
            if (state.billboardSlides.length > 0) {
                const material = state.billboardScreen.material as THREE.MeshStandardMaterial;
                material.map = state.billboardSlides[0].texture;
                material.emissiveMap = state.billboardSlides[0].texture;
                material.needsUpdate = true;
                state.currentBillboardSlideIndex = 0;
                state.lastBillboardSlideTime = performance.now();
            }
        };
        setupSlideshow();
        
        if (displayedPaidOrderNumbers.length > 0) {
            reportDisplayedAds([...new Set(displayedPaidOrderNumbers)]);
        }
    }
  }, [isSceneInitialized, layoutDetails, approvedAds, billboardData]);

  useEffect(() => {
    const state = animationRef.current;
    if (!isSceneInitialized || !state.renderer || !state.bloomPass || !state.scene || !state.fruitMaterials) {
        return;
    }

    const { renderer, scene, bloomPass } = state;
    const directionalLight = scene.getObjectByProperty('isDirectionalLight', true) as THREE.DirectionalLight;
    if (!directionalLight) return;
    
    const enableShadows = graphicsQuality === 'High';
    const enableBloom = graphicsQuality === 'High' || graphicsQuality === 'Medium';

    if (renderer.shadowMap.enabled !== enableShadows) {
        renderer.shadowMap.enabled = enableShadows;
        scene.traverse(obj => {
            if (obj instanceof THREE.Mesh && obj.material) {
                const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                materials.forEach(mat => mat.needsUpdate = true);
            }
        });
    }
    directionalLight.castShadow = enableShadows;
    const shadowMapSize = 1024;
    if (directionalLight.shadow.mapSize.width !== shadowMapSize && enableShadows) {
        directionalLight.shadow.mapSize.width = shadowMapSize;
        directionalLight.shadow.mapSize.height = shadowMapSize;
        if (directionalLight.shadow.map) {
            directionalLight.shadow.map.dispose();
            directionalLight.shadow.map = null;
        }
    }
    
    bloomPass.enabled = enableBloom;
    if (enableBloom) {
        const { width, height } = renderer.getSize(new THREE.Vector2());
        bloomPass.resolution.set(width, height);
        bloomPass.strength = 0.8;
        bloomPass.radius = 0.4;
        bloomPass.threshold = 0.3;
    }

    const appleMat = state.fruitMaterials.get(FruitType.APPLE) as THREE.MeshStandardMaterial;
    if (appleMat) {
        const isLowQuality = graphicsQuality === 'Low';
        appleMat.emissiveIntensity = isLowQuality ? 1.5 : 0.7;
        appleMat.transparent = !isLowQuality;
        appleMat.opacity = isLowQuality ? 1.0 : 0.7;
        appleMat.needsUpdate = true;
    }

  }, [graphicsQuality, isSceneInitialized]);

  return <div ref={mountRef} className="w-full h-full" />;
});

function chooseNextDroneAction(animState: any, startPos: THREE.Vector3, startQuat: THREE.Quaternion): DroneState {
    const { bannerMeshes, snakeHead, layoutDetails, maxBuildingHeight, reusable, billboardScreen } = animState;
    if (!layoutDetails || !reusable) {
      const idleAction = { type: 'IDLE' } as DroneAction;
      return { startTime: performance.now(), startPos, startQuat, targetPos: startPos, targetQuat: startQuat, approachDuration: 0, mainActionDuration: 2000, totalDuration: 2000, arcHeight: 0, mainAction: idleAction };
    }

    const actions = [
        { name: 'MOVING', weight: 15 },
        { name: 'WALL_RUN', weight: 12 },
        { name: 'BANNER_ORBIT', weight: bannerMeshes && bannerMeshes.length > 0 ? 18 : 0 },
        { name: 'BILLBOARD', weight: billboardScreen ? 12 : 0 },
        { name: 'SNAKE_ORBIT', weight: animState.gameState === 'Playing' && snakeHead ? 10 : 0 },
        { name: 'PANORAMIC_DIVE', weight: 5 },
        { name: 'ROTATE_LEFT_360', weight: 3 },
        { name: 'ROTATE_RIGHT_360', weight: 3 },
        { name: 'ROTATE_LEFT_180', weight: 4 },
        { name: 'ROTATE_RIGHT_180', weight: 4 },
        { name: 'ROTATE_LEFT_90', weight: 5 },
        { name: 'ROTATE_RIGHT_90', weight: 5 },
        { name: 'IDLE', weight: 2 },
    ];

    const totalWeight = actions.reduce((sum, action) => sum + action.weight, 0);
    let random = Math.random() * totalWeight;
    let choice = 'IDLE';
    for (const action of actions) {
        if (random < action.weight) { choice = action.name; break; }
        random -= action.weight;
    }

    if (choice === 'BILLBOARD' && !billboardScreen) choice = 'MOVING';
    if (choice === 'BANNER_ORBIT' && (!bannerMeshes || bannerMeshes.length === 0)) choice = 'MOVING';

    let mainAction: DroneAction;
    let targetPos = new THREE.Vector3();
    let approachDuration = 0;
    let mainActionDuration = 3000 + Math.random() * 5000;
    let arcHeight = 0.5 + Math.random();

    switch (choice) {
        case 'WALL_RUN': {
            const walls = ['N', 'S', 'E', 'W'] as const;
            const wall = walls[animState.wallRunCycleIndex];
            animState.wallRunCycleIndex = (animState.wallRunCycleIndex + 1) % 4;
            
            const trackOffset = 1.8;
            const altitude = 1.8;
            const goForward = Math.random() > 0.2;

            let point1 = new THREE.Vector3();
            let point2 = new THREE.Vector3();

            if (wall === 'N') { point1.set(PLAYABLE_AREA_MIN_X + 1, altitude, PLAYABLE_AREA_MIN_Z + trackOffset); point2.set(PLAYABLE_AREA_MAX_X - 1, altitude, PLAYABLE_AREA_MIN_Z + trackOffset); }
            else if (wall === 'S') { point1.set(PLAYABLE_AREA_MAX_X - 1, altitude, PLAYABLE_AREA_MAX_Z - trackOffset); point2.set(PLAYABLE_AREA_MIN_X + 1, altitude, PLAYABLE_AREA_MAX_Z - trackOffset); }
            else if (wall === 'W') { point1.set(PLAYABLE_AREA_MIN_X + trackOffset, altitude, PLAYABLE_AREA_MAX_Z - 1); point2.set(PLAYABLE_AREA_MIN_X + trackOffset, altitude, PLAYABLE_AREA_MIN_Z + 1); }
            else { point1.set(PLAYABLE_AREA_MAX_X - trackOffset, altitude, PLAYABLE_AREA_MIN_Z + 1); point2.set(PLAYABLE_AREA_MAX_X - trackOffset, altitude, PLAYABLE_AREA_MAX_Z - 1); }
            
            const runStart = goForward ? point1 : point2;
            const runEnd = goForward ? point2 : point1;
            
            targetPos.copy(runStart);
            mainAction = { type: 'WALL_RUN', startPos: runStart, endPos: runEnd, wall: wall };
            approachDuration = (startPos.distanceTo(targetPos) / 3.0) * 1000;
            mainActionDuration = 30000;
            break;
        }

        case 'BANNER_ORBIT': {
            if (!bannerMeshes || bannerMeshes.length === 0) { mainAction = { type: 'IDLE' }; targetPos.copy(startPos); break; }
            const banner = bannerMeshes[Math.floor(Math.random() * bannerMeshes.length)];
            const center = new THREE.Vector3();
            banner.getWorldPosition(center);
            
            const normal = new THREE.Vector3(0, center.y, 0).sub(center);
            normal.y = 0;
            normal.normalize();

            const radius = 2.0;
            const arcDirection = Math.random() > 0.5 ? 1 : -1;
            const arc = (Math.PI * 2 / 3) * arcDirection;
            const startAngle = -arc / 2;

            const tangent = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
            const orbitStartPos = center.clone()
                .addScaledVector(normal, Math.cos(startAngle) * radius)
                .addScaledVector(tangent, Math.sin(startAngle) * radius);
            
            orbitStartPos.y = THREE.MathUtils.clamp(center.y, MIN_DRONE_ALTITUDE, maxBuildingHeight - 1);
            orbitStartPos.x = THREE.MathUtils.clamp(orbitStartPos.x, PLAYABLE_AREA_MIN_X, PLAYABLE_AREA_MAX_X);
            orbitStartPos.z = THREE.MathUtils.clamp(orbitStartPos.z, PLAYABLE_AREA_MIN_Z, PLAYABLE_AREA_MAX_Z);

            targetPos.copy(orbitStartPos);
            mainAction = { type: 'BANNER_ORBIT', center, radius, normal, arc, startAngle };
            approachDuration = (startPos.distanceTo(targetPos) / 4.0) * 1000;
            mainActionDuration = 10000;
            break;
        }

        case 'BILLBOARD': {
            if (!billboardScreen) { mainAction = { type: 'IDLE' }; targetPos.copy(startPos); break; }
            const billboardLookAt = new THREE.Vector3();
            billboardScreen.getWorldPosition(billboardLookAt);

            const worldQuaternion = new THREE.Quaternion();
            billboardScreen.getWorldQuaternion(worldQuaternion);
            const billboardNormal = new THREE.Vector3(0, 0, 2).applyQuaternion(worldQuaternion);

            const cruiseEndPos = billboardLookAt.clone().addScaledVector(billboardNormal, 2.0);
            const cruiseStartPos = billboardLookAt.clone().addScaledVector(billboardNormal, 7.0);
            
            const frameHeight = 1.6;
            const topOfBillboardY = billboardLookAt.y + (frameHeight / 1.5);
            cruiseEndPos.y = topOfBillboardY;
            cruiseStartPos.y = topOfBillboardY;

            targetPos.copy(cruiseStartPos);
            mainAction = { type: 'BILLBOARD_APPROACH', startPos: cruiseStartPos, endPos: cruiseEndPos, lookAt: billboardLookAt };
            approachDuration = (startPos.distanceTo(targetPos) / 3.5) * 1000;
            mainActionDuration = 8000;
            break;
        }

        case 'SNAKE_ORBIT':
            if (!snakeHead) { mainAction = { type: 'IDLE' }; targetPos.copy(startPos); break; }
            snakeHead.getWorldPosition(reusable.worldPos);
            const newRadius = 6.0;
            targetPos.set(reusable.worldPos.x + newRadius, THREE.MathUtils.clamp(startPos.y, MIN_DRONE_ALTITUDE, maxBuildingHeight - 1), reusable.worldPos.z);
            mainAction = { type: 'SNAKE_ORBIT', radius: newRadius, arc: Math.PI * 1.5 };
            approachDuration = (startPos.distanceTo(targetPos) / 4.0) * 1000;
            mainActionDuration = 8000;
            break;

        case 'PANORAMIC_DIVE': {
            const highAltitude = maxBuildingHeight + 5;
            targetPos.set(0, highAltitude, 0);
            mainAction = {
                type: 'PANORAMIC_DIVE',
                phase: 'ASCENDING',
                phaseStartTime: 0,
            };
            approachDuration = 6000;
            mainActionDuration = 2000 + 10000 + 7000;
            arcHeight = 2.0;
            break;
        }

        case 'ROTATE_LEFT_360': case 'ROTATE_RIGHT_360':
        case 'ROTATE_LEFT_180': case 'ROTATE_RIGHT_180':
        case 'ROTATE_LEFT_90':  case 'ROTATE_RIGHT_90': {
            let arc = 0;
            if (choice.includes('LEFT')) arc = 1;
            if (choice.includes('RIGHT')) arc = -1;
            if (choice.includes('90')) arc *= Math.PI / 2;
            if (choice.includes('180')) arc *= Math.PI;
            if (choice.includes('360')) arc *= Math.PI * 2;
            mainAction = { type: 'ROTATE', arc };
            targetPos.copy(startPos);
            approachDuration = 0;
            mainActionDuration = Math.abs(arc / (Math.PI * 2)) * 5000;
            break;
        }
            
        case 'IDLE':
            mainAction = { type: 'IDLE' };
            targetPos.copy(startPos);
            approachDuration = 0;
            break;

        default: // MOVING
            const minY = MIN_DRONE_ALTITUDE;
            const maxY = Math.max(minY, maxBuildingHeight - 3);
            targetPos.set(
                THREE.MathUtils.randFloat(PLAYABLE_AREA_MIN_X, PLAYABLE_AREA_MAX_X),
                THREE.MathUtils.randFloat(minY, maxY),
                THREE.MathUtils.randFloat(PLAYABLE_AREA_MIN_Z, PLAYABLE_AREA_MAX_Z)
            );
            mainAction = { type: 'IDLE' };
            approachDuration = (startPos.distanceTo(targetPos) / 2.5) * 1000;
            mainActionDuration = 2000 + Math.random() * 2000;
            break;
    }
    
    let targetQuat: THREE.Quaternion;
    if (startPos.distanceTo(targetPos) < 0.1) {
        targetQuat = startQuat.clone();
    } else {
        let lookAtPoint: THREE.Vector3;
        if (choice === 'BANNER_ORBIT') { lookAtPoint = (mainAction as any).center; }
        else if (choice === 'BILLBOARD') { lookAtPoint = (mainAction as any).lookAt; }
        else if (choice === 'WALL_RUN') {
            const wall = (mainAction as any).wall;
            const lookAtDir = new THREE.Vector3();
            if (wall === 'N') lookAtDir.set(0, 0, -1);
            else if (wall === 'S') lookAtDir.set(0, 0, 1);
            else if (wall === 'W') lookAtDir.set(-1, 0, 0);
            else lookAtDir.set(1, 0, 0);
            lookAtPoint = targetPos.clone().add(lookAtDir);
        } else {
            lookAtPoint = reusable.localPos.subVectors(targetPos, startPos).normalize().add(targetPos);
        }
        reusable.droneLookAtHelper!.position.copy(targetPos);
        reusable.droneLookAtHelper!.lookAt(lookAtPoint);
        targetQuat = reusable.droneLookAtHelper!.quaternion.clone();
    }

    const totalDuration = approachDuration + mainActionDuration;

    return {
        startTime: performance.now(),
        startPos, startQuat,
        targetPos, targetQuat,
        approachDuration,
        mainActionDuration,
        totalDuration,
        arcHeight,
        mainAction
    };
};

export default Board;