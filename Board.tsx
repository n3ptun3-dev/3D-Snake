

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CameraView, Point3D, GameState, Fruit, FruitType, Portal, PortalType, LayoutDetails, BillboardDetails, StreetPassageDetails, FlyerDetails } from '../types';
import { COLORS, FULL_BOARD_WIDTH, FULL_BOARD_DEPTH, FRUIT_COLORS } from '../constants';
import { isWall, isStreetPassageBlock, getPortalAbsolutePosition } from './gameLogic';

interface BoardProps {
  gameState: GameState;
  zoom: number;
  cameraView: CameraView;
  snakeSegments: Point3D[];
  snakeRotation: number;
  fruits: Fruit[];
  gameSpeed: number;
  layoutDetails: LayoutDetails;
  isCrashing: boolean;
  isPassageFruitActive: boolean;
  passageFruitLocation: Point3D | null;
}

// The layer number for the bloom effect.
const BLOOM_LAYER = 1;

// User-adjustable: Controls the background cylinder radius on the Game Over screen.
// I've set it to 40, but you can change it here to fine-tune the look.
const GAME_OVER_CYLINDER_RADIUS = 40;

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

const createPortalTexture = (type: PortalType): THREE.CanvasTexture => {
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
    const height = 128;
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

const createPosterTexture = (variant: 'A' | 'B'): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    const width = 180; // 9 * 20
    const height = 320; // 16 * 20
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    if (variant === 'A') {
        // Poster A design: Blue, "GO FORWARD"
        ctx.fillStyle = '#1d4ed8'; // blue-700
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#60a5fa'; // blue-400
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, width - 10, height - 10);

        ctx.font = 'bold 90px sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.save();
        ctx.translate(width/2, height * 0.4);
        ctx.beginPath();
        ctx.moveTo(0, -height * 0.25);
        ctx.lineTo(-width * 0.3, 0);
        ctx.lineTo(width * 0.3, 0);
        ctx.closePath();
        ctx.fillStyle = '#facc15'; // yellow-400
        ctx.fill();
        ctx.restore();
        
        ctx.fillText('GO', width / 2, height * 0.65);
        ctx.font = '30px sans-serif';
        ctx.fillText('FORWARD', width / 2, height * 0.75);

    } else {
        // Poster B design: Red, "SPEED"
        ctx.fillStyle = '#be123c'; // rose-700
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#fb7185'; // rose-400
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, width - 10, height - 10);
        
        ctx.font = 'italic bold 100px "Impact", "Arial Black", sans-serif';
        ctx.fillStyle = '#fde047'; // yellow-300
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(-0.1);
        ctx.fillText('SPEED', 0, 0);
        ctx.restore();

        // Speed lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 15; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * width, Math.random() * height);
            ctx.lineTo(Math.random() * width, Math.random() * height);
            ctx.stroke();
        }
    }

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
            ctx.fillText('For being too long', size / 2, size - 15);
            
            // Draw a simple snake
            ctx.strokeStyle = COLORS.PLAYER_BODY;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(30, 80);
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
    cameraMesh.position.y = -0.15; // Attach to bottom of the body
    cameraMesh.rotation.y = Math.PI; // Flip 180 degrees to face forward
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
    iconGroup.rotation.x = Math.PI / 2;
    iconGroup.scale.set(0.33, 0.33, 0.33);

    // Cylindrical Stand
    const standGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.4, 16);
    state.geometriesToDispose.push(standGeo);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
    state.materialsToDispose.push(standMat);
    const standMesh = new THREE.Mesh(standGeo, standMat);
    
    // This is the group that will be added to the building and rotated.
    // It contains both the stand and the icon, positioned relative to each other.
    const assemblyGroup = new THREE.Group();
    const standHeight = 0.4;

    // Position stand so its base is at the group's origin
    standMesh.position.y = standHeight / 2;
    
    // Position icon on top of the stand
    iconGroup.position.y = standHeight + (outerRadius * 0.33);
    
    assemblyGroup.add(standMesh, iconGroup);

    return assemblyGroup;
}


const Board: React.FC<BoardProps> = ({ gameState, zoom, cameraView, snakeSegments, snakeRotation, fruits, gameSpeed, layoutDetails, isCrashing, isPassageFruitActive, passageFruitLocation }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const animationRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    bloomComposer?: EffectComposer;
    finalComposer?: EffectComposer;
    camera?: THREE.PerspectiveCamera;
    scene?: THREE.Scene;
    snakeHead?: THREE.Mesh;
    bodySegments?: THREE.Mesh[];
    glowPlanes?: THREE.Mesh[];
    fruitMeshes?: Map<number, THREE.Mesh>;
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
    isInitialRender: boolean;
    gameSpeed: number;
    cameraView: CameraView;
    gameState: GameState;
    isPassageFruitActive: boolean;
    isCrashing: boolean;
    orbitStartTime?: number;
    startAnim?: {
        startTime: number;
        duration: number;
        startPos: THREE.Vector3;
        startLookAt: THREE.Vector3;
        endPos: THREE.Vector3;
        endLookAt: THREE.Vector3;
    };
    
    currentSnakeSegments: Point3D[];
    prevSnakeSegments: Point3D[];
    currentSnakeRotation: number;
    prevSnakeRotation: number;
    
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
        fp_camera_pos: THREE.Vector3;
        backgroundCylinder?: THREE.Mesh;
        worldPos: THREE.Vector3;
        localPos: THREE.Vector3;
        droneLookAtHelper?: THREE.Object3D;
        lookAtHelper: THREE.Vector3;
    };
    interpolatedPositions?: THREE.Vector3[];
    crashEffect?: { startTime: number };
    fruits: Fruit[];
    bloomPass?: UnrealBloomPass;
    billboardScreens?: { texture: THREE.CanvasTexture; material: THREE.MeshStandardMaterial }[];
    lastBillboardUpdate?: number;
    drones?: {
        group: THREE.Group;
        propellers: THREE.Mesh[];
        light: THREE.PointLight;
    }[];
    droneTargets?: {
        altitude: number;
        currentPosition: THREE.Vector3;
        targetPosition: THREE.Vector3;
        startTime: number;
        duration: number;
    }[];
  }>({
    isInitialRender: true,
    gameSpeed: 500,
    cameraView: CameraView.ORBIT,
    gameState: 'Loading',
    isPassageFruitActive: false,
    isCrashing: false,
    
    currentSnakeSegments: [],
    prevSnakeSegments: [],
    currentSnakeRotation: 0,
    prevSnakeRotation: 0,

    lastTickTime: 0,

    geometriesToDispose: [],
    texturesToDispose: [],
    materialsToDispose: [],
    towerLights: [],
    rotatingIcons: [],
    fruits: [],
    drones: [],
    droneTargets: [],
    searchlightBeams: [],
    searchlightTargets: [],
    billboardScreens: [],
    lastBillboardUpdate: 0,
  });

  const WALL_THICKNESS = (FULL_BOARD_WIDTH - 20) / 2;
  const offsetX = -FULL_BOARD_WIDTH / 2 + 0.5;
  const offsetZ = -FULL_BOARD_DEPTH / 2 + 0.5;
  
  // This useEffect updates the animation state from props. It's the bridge from React to Three.js loop.
  useEffect(() => {
    const state = animationRef.current;
    state.gameSpeed = gameSpeed;
    state.cameraView = cameraView;
    state.fruits = fruits;
    state.isPassageFruitActive = isPassageFruitActive;
    state.gameState = gameState;

    if (state.currentSnakeSegments !== snakeSegments || state.currentSnakeRotation !== snakeRotation) {
        state.prevSnakeSegments = state.isInitialRender ? snakeSegments : state.currentSnakeSegments;
        state.currentSnakeSegments = snakeSegments;
        state.prevSnakeRotation = state.isInitialRender ? snakeRotation : state.currentSnakeRotation;
        state.currentSnakeRotation = snakeRotation;
        state.lastTickTime = performance.now();
        if (state.isInitialRender) state.isInitialRender = false;
    }
    
    if (isCrashing && !state.isCrashing) {
        state.crashEffect = { startTime: performance.now() };
        state.isCrashing = true;
    } else if (!isCrashing && state.isCrashing) {
        state.crashEffect = undefined;
        state.isCrashing = false;
    }
  }, [gameSpeed, cameraView, snakeSegments, snakeRotation, isCrashing, fruits, isPassageFruitActive, gameState]);
  
  // This useEffect handles the fly-in animation when the game starts.
  useEffect(() => {
      const state = animationRef.current;
      if (gameState === 'Starting' && snakeSegments.length > 0 && state.camera) {
          state.startAnim = undefined; // Clear any previous animation state
          
          const head = snakeSegments[0];
          const headPos = new THREE.Vector3(head.x + offsetX, head.y, head.z + offsetZ);
          
          // Final destination: FPV
          const lookAtDir = new THREE.Vector3(0, 0, -1);
          const endPos = new THREE.Vector3().copy(headPos).addScaledVector(lookAtDir, 0.4);
          const endLookAt = new THREE.Vector3().copy(headPos).add(lookAtDir);
          
          // Starting point: current camera position
          const startPos = state.camera.position.clone();
          const startLookAt = state.reusable!.lookAtHelper.clone();

          // Animation will begin after a 1s delay and last 3s
          state.startAnim = {
              startTime: performance.now() + 1000,
              duration: 3000,
              startPos,
              startLookAt,
              endPos,
              endLookAt,
          };
      }
  }, [gameState, snakeSegments, offsetX, offsetZ]);

  // This useEffect runs once to initialize the Three.js scene, renderer, camera, etc.
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    let sceneCleanup: (() => void) | null = null;

    const initScene = () => {
        const width = currentMount.clientWidth;
        const height = currentMount.clientHeight;
        
        const animState = animationRef.current;
        
        animState.fruitMeshes = new Map();
        
        const scene = new THREE.Scene();
        animState.scene = scene;

        const skyColor = 0x294a66;
        scene.background = new THREE.Color(skyColor);

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
                fp_camera_pos: new THREE.Vector3(),
                backgroundCylinder: backgroundCylinder,
                worldPos: new THREE.Vector3(),
                localPos: new THREE.Vector3(),
                droneLookAtHelper: new THREE.Object3D(),
                lookAtHelper: new THREE.Vector3(),
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
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.bias = -0.0001;
        scene.add(directionalLight);

        const droneAltitudes = [5, 7];
        const droneColors = [new THREE.Color(0xff4400), new THREE.Color(0x00aaff)];
        animState.drones = [];
        animState.droneTargets = [];
        for (let i = 0; i < 2; i++) {
            const drone = createDrone(scene, droneColors[i], droneAltitudes[i], animState.geometriesToDispose, animState.materialsToDispose);
            animState.drones.push(drone);
            
            const startPos = new THREE.Vector3( (Math.random() - 0.5) * 20, droneAltitudes[i], (Math.random() - 0.5) * 20);
            drone.group.position.copy(startPos);
            
            animState.droneTargets.push({
                altitude: droneAltitudes[i],
                currentPosition: startPos.clone(),
                targetPosition: new THREE.Vector3( (Math.random() - 0.5) * 20, droneAltitudes[i], (Math.random() - 0.5) * 20),
                startTime: performance.now(),
                duration: 8000 + Math.random() * 4000
            });
        }

        const bloomLayer = new THREE.Layers();
        bloomLayer.set(BLOOM_LAYER);
        const headGeo = new THREE.SphereGeometry(0.2, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: COLORS.PLAYER_FRONT, emissive: COLORS.PLAYER_FRONT, emissiveIntensity: 0.8 });
        const snakeHead = new THREE.Mesh(headGeo, headMat);
        snakeHead.layers.enable(BLOOM_LAYER);
        scene.add(snakeHead);
        animState.snakeHead = snakeHead;

        const maxSegments = FULL_BOARD_WIDTH * FULL_BOARD_DEPTH;
        const bodySegments: THREE.Mesh[] = [];
        const segmentGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
        const segmentMat = new THREE.MeshStandardMaterial({ color: COLORS.PLAYER_BODY, emissive: COLORS.PLAYER_BODY, emissiveIntensity: 0.6 });
        for (let i = 0; i < maxSegments; i++) {
            const segment = new THREE.Mesh(segmentGeo, segmentMat);
            segment.visible = false;
            segment.layers.enable(BLOOM_LAYER);
            scene.add(segment);
            bodySegments.push(segment);
        }
        animState.bodySegments = bodySegments;

        const glowPlanes: THREE.Mesh[] = [];
        const glowTexture = createGlowTexture(new THREE.Color(COLORS.PLAYER_BODY).multiplyScalar(1.2).getStyle());
        const glowGeo = new THREE.PlaneGeometry(1.0, 1.0);
        const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        for(let i = 0; i < maxSegments; i++) {
            const plane = new THREE.Mesh(glowGeo, glowMat);
            plane.rotation.x = -Math.PI / 2;
            plane.visible = false;
            plane.layers.enable(BLOOM_LAYER);
            scene.add(plane);
            glowPlanes.push(plane);
        }
        animState.glowPlanes = glowPlanes;

        const fruitGeometries = new Map<FruitType, THREE.BufferGeometry>();
        const fruitMaterials = new Map<FruitType, THREE.Material>();
        const s = 0.35;
        fruitGeometries.set(FruitType.APPLE, new THREE.BoxGeometry(s*1.5, s*1.5, s*1.5));
        fruitGeometries.set(FruitType.SPEED_BOOST, new THREE.ConeGeometry(s, s*2, 4));
        fruitGeometries.set(FruitType.SLOW_DOWN, new THREE.IcosahedronGeometry(s, 0));
        fruitGeometries.set(FruitType.MAGNET, new THREE.TorusGeometry(s, s*0.4, 8, 16));
        const starShape = new THREE.Shape();
        starShape.moveTo(0, s); starShape.lineTo(s*0.38, s*0.38); starShape.lineTo(s, s*0.38); starShape.lineTo(s*0.5, -s*0.14); starShape.lineTo(s*0.7, -s); starShape.lineTo(0, -s*0.5); starShape.lineTo(-s*0.7, -s); starShape.lineTo(-s*0.5, -s*0.14); starShape.lineTo(-s, s*0.38); starShape.lineTo(-s*0.38, s*0.38); starShape.closePath();
        fruitGeometries.set(FruitType.SCORE_DOUBLER, new THREE.ExtrudeGeometry(starShape, { depth: s*0.4, bevelEnabled: false }));
        const heartScale = 0.3; const heartShape = new THREE.Shape(); heartShape.moveTo(0, heartScale * 0.5); heartShape.bezierCurveTo(heartScale * 0.5, heartScale, heartScale, 0.2, 0, -heartScale * 1.5); heartShape.bezierCurveTo(-heartScale, 0.2, -heartScale * 0.5, heartScale, 0, heartScale * 0.5);
        fruitGeometries.set(FruitType.EXTRA_LIFE, new THREE.ExtrudeGeometry(heartShape, { depth: heartScale*0.4, bevelEnabled: false }));
        fruitGeometries.set(FruitType.TRIPLE, new THREE.TorusKnotGeometry(s * 0.8, s * 0.25, 50, 8));
        Object.values(FruitType).filter(t => !isNaN(Number(t))).forEach(t => {
            const type = t as FruitType;
            const color = FRUIT_COLORS[type];
            let material;
            if (type === FruitType.APPLE) material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.1 });
            else material = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1, });
            fruitMaterials.set(type, material);
        });
        animState.fruitGeometries = fruitGeometries;
        animState.fruitMaterials = fruitMaterials;

        const renderPass = new RenderPass(scene, camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.8, 0.4, 0.3);
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

        const animate = () => {
          animState.animationFrameId = requestAnimationFrame(animate);
          const { renderer: currentRenderer, scene: currentScene, camera: currentCamera, bloomComposer: currentBloomComposer, finalComposer } = animState;
          if (!currentRenderer || !currentScene || !currentCamera || !finalComposer || !currentBloomComposer) return;
          const { cameraView, snakeHead, bodySegments, glowPlanes, towerLights, reusable, interpolatedPositions, fruitMeshes, searchlightBeams, searchlightTargets, fruits: currentFruits, isPassageFruitActive, bloomPass: currentBloomPass, portalGroups, drones, droneTargets, rotatingIcons, startAnim } = animState;
          if (!snakeHead || !bodySegments || !glowPlanes || !reusable || !interpolatedPositions || !fruitMeshes || !currentFruits || !currentBloomPass || !portalGroups) return;
          const now = performance.now();
          const isSnakeVisible = animState.gameState !== 'Starting' && !startAnim;
          
          if (reusable.backgroundCylinder) {
              const isIntro = animState.gameState === 'Welcome';
              const isGameOver = animState.gameState === 'GameOver';
              const originalCylinderRadius = 70; // The radius used at creation
              let targetScale = 1.0;

              if (isIntro) {
                  targetScale = 20 / originalCylinderRadius;
              } else if (isGameOver) {
                  targetScale = GAME_OVER_CYLINDER_RADIUS / originalCylinderRadius;
              }
              
              if (Math.abs(reusable.backgroundCylinder.scale.x - targetScale) > 0.001) {
                  // Using lerp for a smoother transition in and out of the game over state
                  reusable.backgroundCylinder.scale.lerp(new THREE.Vector3(targetScale, 1, targetScale), 0.03);
              }
          }

          if (startAnim && now > startAnim.startTime) {
              const elapsed = now - startAnim.startTime;
              const t = Math.min(elapsed / startAnim.duration, 1.0);
              const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

              reusable.interpolatedPos.lerpVectors(startAnim.startPos, startAnim.endPos, easeT);
              reusable.interpolatedPos.y += Math.sin(easeT * Math.PI) * 5; // Add vertical arc
              currentCamera.position.copy(reusable.interpolatedPos);

              reusable.interpolatedLookAt.lerpVectors(startAnim.startLookAt, startAnim.endLookAt, easeT);
              currentCamera.lookAt(reusable.interpolatedLookAt);

              if (t >= 1.0) {
                  animState.startAnim = undefined;
              }
          }
          else if (cameraView === CameraView.ORBIT) {
              if (!animState.orbitStartTime) animState.orbitStartTime = now;
              const orbitElapsed = now - (animState.orbitStartTime || now);
              const angle = orbitElapsed * 0.0002;
              currentCamera.position.set(Math.cos(angle) * 18, 8, Math.sin(angle) * 18);
              reusable.lookAtHelper.set(0, 2, 0);
              currentCamera.lookAt(reusable.lookAtHelper);
          } else if (cameraView === CameraView.DRONE_1 || cameraView === CameraView.DRONE_2) {
              const droneIndex = cameraView === CameraView.DRONE_1 ? 0 : 1;
              const drone = drones?.[droneIndex];
              if (drone) {
                  drone.group.getWorldPosition(reusable.fp_camera_pos);
                  
                  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(drone.group.quaternion);
                  const down = new THREE.Vector3(0, -1, 0);
                  
                  const lookAtDir = new THREE.Vector3().addVectors(forward, down.multiplyScalar(0.7)).normalize();
                  reusable.lookAtHelper.copy(reusable.fp_camera_pos).add(lookAtDir);
                  
                  currentCamera.position.copy(reusable.fp_camera_pos);
                  currentCamera.lookAt(reusable.lookAtHelper);
              }
          } else if (cameraView === CameraView.FIRST_PERSON) {
              if(snakeHead) {
                  const headPos = reusable.fp_camera_pos; snakeHead.getWorldPosition(headPos);
                  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(snakeHead.quaternion);
                  currentCamera.position.copy(headPos).addScaledVector(forward, 0.4);
                  reusable.lookAtHelper.copy(headPos).add(forward);
                  currentCamera.lookAt(reusable.lookAtHelper);
              }
          }
          
          if (animState.crashEffect) {
              const elapsed = now - animState.crashEffect.startTime;
              const progress = Math.min(elapsed / 1500, 1.0);
              currentBloomPass.strength = 0.8 + 5 * Math.sin(progress * Math.PI);
              if (animState.gameState !== 'GameOver') {
                  currentCamera.rotation.z = Math.sin(now * 0.1) * 0.05 * (1 - progress);
              }
          } else {
              currentBloomPass.strength = 0.8;
          }

          if (drones && droneTargets && drones.length > 0 && !startAnim) {
              drones.forEach((drone, i) => {
                  const isCurrentView = (i === 0 && cameraView === CameraView.DRONE_1) || (i === 1 && cameraView === CameraView.DRONE_2);
                  drone.group.visible = !isCurrentView;

                  const targetInfo = droneTargets[i];
                  drone.propellers.forEach(p => { p.rotation.z += 0.5; });
                  let t = (now - targetInfo.startTime) / targetInfo.duration;
                  
                  if (t >= 1.0) {
                      targetInfo.startTime = now;
                      targetInfo.currentPosition.copy(targetInfo.targetPosition);
                      
                      if (i === 0) { // Drone 0: Calm pilot (Red/Orange)
                          targetInfo.duration = 8000 + Math.random() * 4000;
                          const newAltitude = 2 + Math.random() * 3; // Range [2, 5]
                          targetInfo.targetPosition.set( (Math.random() - 0.5) * 20, newAltitude, (Math.random() - 0.5) * 20 );
                      } else { // Drone 1: Aggressive pilot (Blue)
                          targetInfo.duration = 6000 + Math.random() * 3000;
                          const newX = (Math.random() - 0.5) * 35;
                          const newZ = (Math.random() - 0.5) * 35;

                          const isCurrentOverPerimeter = Math.abs(targetInfo.currentPosition.x) > 10 || Math.abs(targetInfo.currentPosition.z) > 10;
                          const isTargetOverPerimeter = Math.abs(newX) > 10 || Math.abs(newZ) > 10;
                          let newAltitude;
                          if (isCurrentOverPerimeter || isTargetOverPerimeter) {
                              newAltitude = 7.0 + Math.random() * 2.0; // High range [7.0, 9.0]
                          } else {
                              newAltitude = 5.0 + Math.random() * 4.0; // Full range [5.0, 9.0]
                          }
                          targetInfo.targetPosition.set(newX, newAltitude, newZ);
                      }
                      t = 0;
                  }
                  
                  const easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                  const currentPos = new THREE.Vector3().lerpVectors(targetInfo.currentPosition, targetInfo.targetPosition, easedT);
                  
                  if (reusable.droneLookAtHelper) {
                      reusable.droneLookAtHelper.position.copy(drone.group.position);
                      reusable.droneLookAtHelper.lookAt(targetInfo.targetPosition);
          
                      if (i === 1) { // Blue drone with banking
                          const baseTargetQuat = reusable.droneLookAtHelper.quaternion;
                          const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(drone.group.quaternion);
                          const targetForward = new THREE.Vector3(0, 0, -1).applyQuaternion(baseTargetQuat);
          
                          currentForward.y = 0;
                          targetForward.y = 0;
                          currentForward.normalize();
                          targetForward.normalize();
                          
                          const turnFactor = new THREE.Vector3().crossVectors(currentForward, targetForward).y;
                          const maxBank = Math.PI / 6; // 30 degrees
                          const bankAngle = THREE.MathUtils.clamp(-turnFactor * 2.5, -maxBank, maxBank);
          
                          const bankQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), bankAngle);
                          const finalTargetQuat = baseTargetQuat.clone().multiply(bankQuat);
                          
                          drone.group.quaternion.slerp(finalTargetQuat, 0.04);
                      } else { // Orange drone, calm movement
                          drone.group.quaternion.slerp(reusable.droneLookAtHelper.quaternion, 0.05);
                      }
                  }
          
                  // Subtle wobble for realism
                  const wobble = new THREE.Vector3(
                      Math.sin(now * 0.0011 + i * 2) * 0.1,
                      Math.cos(now * 0.0009 + i * 2) * 0.15,
                      Math.sin(now * 0.0013 + i * 2) * 0.1
                  );
                  drone.group.position.copy(currentPos).add(wobble);
                  drone.light.intensity = 4 + Math.sin(now * 0.02 + i * 3) * 2;
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
          if (animState.billboardScreens && (now - (animState.lastBillboardUpdate || 0) > 1000)) { animState.lastBillboardUpdate = now; animState.billboardScreens.forEach(screen => { const newTexture = createAdBannerTexture(); if (screen.material.map) screen.material.map.dispose(); screen.material.map = newTexture; screen.material.emissiveMap = newTexture; }); }
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
          const tickDuration = Math.max(50, animState.gameSpeed); const timeSinceTick = now - animState.lastTickTime; const interp = animState.isCrashing ? 0 : Math.min(timeSinceTick / tickDuration, 1.0);
          const segmentCount = animState.currentSnakeSegments.length;
          
          snakeHead.visible = cameraView !== CameraView.FIRST_PERSON && !startAnim;

          if (isSnakeVisible) {
              for (let i = 0; i < segmentCount; i++) {
                  const prevSeg = animState.prevSnakeSegments[i] || animState.currentSnakeSegments[i];
                  const currSeg = animState.currentSnakeSegments[i];
                  reusable.startPos.set(prevSeg.x + offsetX, prevSeg.y, prevSeg.z + offsetZ);
                  reusable.endPos.set(currSeg.x + offsetX, currSeg.y, currSeg.z + offsetZ);
                  interpolatedPositions[i].lerpVectors(reusable.startPos, reusable.endPos, interp);
              }
              
              if (segmentCount > 2) {
                  const tail = interpolatedPositions[segmentCount - 1];
                  const tailJoint = interpolatedPositions[segmentCount - 2];
                  const prevJoint = interpolatedPositions[segmentCount - 3];
                  if (tailJoint.distanceTo(prevJoint) < 1.1) {
                      tail.copy(tailJoint).add(reusable.localPos.subVectors(tailJoint, prevJoint));
                  }
              }

              if (segmentCount > 0) {
                  snakeHead.position.copy(interpolatedPositions[0]);
                  reusable.startQuat.setFromEuler(reusable.euler.set(0, animState.prevSnakeRotation, 0));
                  reusable.endQuat.setFromEuler(reusable.euler.set(0, animState.currentSnakeRotation, 0));
                  snakeHead.quaternion.slerpQuaternions(reusable.startQuat, reusable.endQuat, interp);
              }

              for (let i = 0; i < bodySegments.length; i++) {
                  if (i < segmentCount - 1) {
                      const currentPart = bodySegments[i];
                      const glowPart = glowPlanes[i + 1];
                      const start = interpolatedPositions[i];
                      const end = interpolatedPositions[i + 1];
                      const distance = start.distanceTo(end);
                      const isInvisible = distance > 2.0;
                      currentPart.position.lerpVectors(start, end, 0.5);
                      currentPart.lookAt(end);
                      currentPart.quaternion.multiply(reusable.correctionQuat);
                      currentPart.visible = !isInvisible;
                      glowPart.position.set(end.x, 0.52, end.z);
                      glowPart.visible = !isInvisible;
                  } else {
                      bodySegments[i].visible = false;
                      if (glowPlanes[i + 1]) glowPlanes[i + 1].visible = false;
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
          }
          
          if (!isSnakeVisible && animState.gameState !== 'Starting') {
            bodySegments.forEach(s => s.visible = false);
            glowPlanes.forEach(p => p.visible = false);
          }
          
          const existingFruitIds = new Set<number>(); currentFruits.forEach(fruitData => { existingFruitIds.add(fruitData.id); let fruitMesh = fruitMeshes.get(fruitData.id); if (!fruitMesh) { const geo = animState.fruitGeometries?.get(fruitData.type); const mat = animState.fruitMaterials?.get(fruitData.type); if (geo && mat) { fruitMesh = new THREE.Mesh(geo, mat); fruitMesh.castShadow = true; fruitMesh.position.set(fruitData.position.x + offsetX, fruitData.position.y, fruitData.position.z + offsetZ); fruitMesh.layers.enable(BLOOM_LAYER); currentScene.add(fruitMesh); fruitMeshes.set(fruitData.id, fruitMesh); } } if (fruitMesh) { fruitMesh.rotation.y += 0.01; let baseHeight = 1.0; if (fruitData.type === FruitType.TRIPLE) { baseHeight = 1.15; } fruitMesh.position.y = baseHeight + Math.sin(now * 0.002 + fruitData.id) * 0.1; } }); for (const [id, mesh] of fruitMeshes.entries()) if (!existingFruitIds.has(id)) { currentScene.remove(mesh); fruitMeshes.delete(id); }
          
          currentScene.background = null; currentScene.traverse(darkenNonBloomed); currentBloomComposer.render(); currentScene.traverse(restoreMaterials); currentScene.background = new THREE.Color(skyColor); finalComposer.render();
        };
        animate();

        const handleResize = () => {
            const state = animationRef.current;
            if (state.camera && state.renderer && currentMount) {
                const w = currentMount.clientWidth;
                const h = currentMount.clientHeight;
                state.camera.aspect = w / h;
                state.camera.updateProjectionMatrix();
                state.renderer.setSize(w, h);
                state.bloomComposer?.setSize(w, h);
                state.finalComposer?.setSize(w, h);
            }
        };
        window.addEventListener('resize', handleResize);

        sceneCleanup = () => {
            window.removeEventListener('resize', handleResize);
            if (animState.animationFrameId) cancelAnimationFrame(animState.animationFrameId);
            scene.traverse(object => {
              if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                if (Array.isArray(object.material)) {
                  object.material.forEach(m => m.dispose());
                } else {
                  object.material.dispose();
                }
              }
            });
            animState.renderer?.dispose();
            if (currentMount && animState.renderer?.domElement) {
                currentMount.removeChild(animState.renderer.domElement);
            }
        };
    };

    const resizeObserver = new ResizeObserver(entries => {
        if (entries[0] && entries[0].contentRect.width > 0 && !animationRef.current.renderer) {
            initScene();
        }
    });
    resizeObserver.observe(currentMount);

    return () => {
        resizeObserver.disconnect();
        if (sceneCleanup) sceneCleanup();
    };
  }, []); // Runs only once on mount

  // This useEffect rebuilds the layout when layoutDetails changes
  useEffect(() => {
    const state = animationRef.current;
    if (!state.scene || !layoutDetails) return;

    // Clean up previous layout
    if (state.layoutGroup) {
        state.scene.remove(state.layoutGroup);
        state.layoutGroup.traverse(object => {
            if (object instanceof THREE.Mesh) {
                if(object.geometry) object.geometry.dispose();
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else if(object.material) {
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
    state.billboardScreens = [];
    state.portalGroups = new Map();

    const layoutGroup = new THREE.Group();
    state.layoutGroup = layoutGroup;
    state.scene.add(layoutGroup);
    
    const textureLoader = new THREE.TextureLoader();

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
    const wallLineMaterial = new THREE.LineBasicMaterial({ color: 0x374151, linewidth: 2 });
    state.materialsToDispose.push(wallLineMaterial);
    const boardMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.1 });
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
    const gridHelper = new THREE.GridHelper(FULL_BOARD_WIDTH, FULL_BOARD_WIDTH, COLORS.GRID_LINES, COLORS.GRID_LINES);
    gridHelper.position.set(0, 0.51, 0); 
    layoutGroup.add(gridHelper);
    const addBuildingColumn = (x: number, z: number, height: number, roofType: 'flat' | 'apex' | 'slanted' | 'pyramid' = 'flat') => { const buildingGeo = new THREE.BoxGeometry(1, height, 1); state.geometriesToDispose.push(buildingGeo); const materialIndex = Math.floor(Math.random() * wallMaterials.length); const buildingMaterial = wallMaterials[materialIndex]; const buildingMesh = new THREE.Mesh(buildingGeo, buildingMaterial); buildingMesh.position.set(x + offsetX, 0.5 + height / 2, z + offsetZ); buildingMesh.castShadow = true; buildingMesh.receiveShadow = true; const buildingColorHex = buildingColors[materialIndex]; const roofColor = new THREE.Color(buildingColorHex).multiplyScalar(0.9); const roofMaterial = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.9, metalness: 0.1, }); state.materialsToDispose.push(roofMaterial); let roofMesh: THREE.Mesh; if (roofType === 'flat') { const roofGeo = new THREE.PlaneGeometry(1, 1); state.geometriesToDispose.push(roofGeo); roofMesh = new THREE.Mesh(roofGeo, roofMaterial); roofMesh.rotation.x = -Math.PI / 2; roofMesh.position.y = height / 2 + 0.001; } else if (roofType === 'pyramid') { const geoPool = roofGeometries.pyramid; const roofGeo = geoPool[Math.floor(Math.random() * geoPool.length)]; roofMesh = new THREE.Mesh(roofGeo, roofMaterial); roofMesh.position.y = height / 2; } else { const geoPool = roofType === 'apex' ? roofGeometries.apex : roofGeometries.slanted; const roofGeo = geoPool[Math.floor(Math.random() * geoPool.length)]; roofMesh = new THREE.Mesh(roofGeo, roofMaterial); roofMesh.position.y = height / 2; if (Math.random() < 0.5) { roofMesh.rotation.y = Math.PI / 2; } } buildingMesh.add(roofMesh); const edges = new THREE.EdgesGeometry(buildingMesh.geometry); state.geometriesToDispose.push(edges); const line = new THREE.LineSegments(edges, wallLineMaterial); buildingMesh.add(line); layoutGroup.add(buildingMesh); return buildingMesh; };
    const addTransmissionTower = (x: number, z: number) => { const towerGroup = new THREE.Group(); towerGroup.position.set(x + offsetX, 0.5, z + offsetZ); const materialIndex = Math.floor(Math.random() * wallMaterials.length); const randomMaterial = wallMaterials[materialIndex]; const baseHeight = 1; const baseGeo = new THREE.BoxGeometry(1, baseHeight, 1); state.geometriesToDispose.push(baseGeo); const base = new THREE.Mesh(baseGeo, randomMaterial); base.position.y = baseHeight / 2; const baseEdges = new THREE.EdgesGeometry(base.geometry); state.geometriesToDispose.push(baseEdges); base.add(new THREE.LineSegments(baseEdges, wallLineMaterial)); const roofGeo = new THREE.PlaneGeometry(1.01, 1.01); state.geometriesToDispose.push(roofGeo); const roofMaterial = new THREE.MeshStandardMaterial({ color: buildingColors[materialIndex], roughness: 0.8, metalness: 0.1 }); state.materialsToDispose.push(roofMaterial); const roofMesh = new THREE.Mesh(roofGeo, roofMaterial); roofMesh.rotation.x = -Math.PI / 2; roofMesh.position.y = baseHeight / 2 + 0.01; base.add(roofMesh); towerGroup.add(base); const coneHeight = 3; const coneGeo = new THREE.ConeGeometry(0.6, coneHeight, 8); state.geometriesToDispose.push(coneGeo); const cone = new THREE.Mesh(coneGeo, randomMaterial); cone.position.y = baseHeight + coneHeight / 2; towerGroup.add(cone); const lightColor = 0xff2222; const light = new THREE.PointLight(lightColor, 2, 3); light.position.y = baseHeight + coneHeight + 0.2; const lightMeshGeo = new THREE.SphereGeometry(0.05, 8, 8); state.geometriesToDispose.push(lightMeshGeo); const lightMeshMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: lightColor, emissiveIntensity: 1, toneMapped: false }); state.materialsToDispose.push(lightMeshMat); const lightMesh = new THREE.Mesh(lightMeshGeo, lightMeshMat); lightMesh.position.copy(light.position); lightMesh.layers.enable(BLOOM_LAYER); towerGroup.add(lightMesh); state.towerLights.push({ light, mesh: lightMesh }); towerGroup.add(light); layoutGroup.add(towerGroup); return towerGroup; };
    const addAdBanner = (buildingMesh: THREE.Mesh, x: number, z: number, buildingHeight: number) => { const bannerTexture = createAdBannerTexture(); state.texturesToDispose.push(bannerTexture); const bannerMaterial = new THREE.MeshBasicMaterial({ map: bannerTexture, transparent: false, side: THREE.DoubleSide }); state.materialsToDispose.push(bannerMaterial); const bannerGeometry = new THREE.PlaneGeometry(1, 0.5); state.geometriesToDispose.push(bannerGeometry); const bannerMesh = new THREE.Mesh(bannerGeometry, bannerMaterial); bannerMesh.position.y = (Math.random() * 0.5 - 0.25) * buildingHeight; const offset = 0.51; if (x < WALL_THICKNESS) { bannerMesh.position.x = offset; bannerMesh.rotation.y = Math.PI / 2; } else if (x >= FULL_BOARD_WIDTH - WALL_THICKNESS) { bannerMesh.position.x = -offset; bannerMesh.rotation.y = -Math.PI / 2; } else if (z < WALL_THICKNESS) { bannerMesh.position.z = offset; bannerMesh.rotation.y = 0; } else { bannerMesh.position.z = -offset; bannerMesh.rotation.y = Math.PI; } buildingMesh.add(bannerMesh); };
    const addSkyscraper = (x: number, z: number, height: number, logoUrl: string) => { const buildingMesh = addBuildingColumn(x, z, height, 'flat'); const rooftopIcon = createQuantumRooftopIcon(state); rooftopIcon.position.y = height / 2; buildingMesh.add(rooftopIcon); state.rotatingIcons?.push(rooftopIcon); textureLoader.load(logoUrl, (texture) => { state.texturesToDispose.push(texture); const aspectRatio = texture.image.width / texture.image.height; const logoSize = 2.2; const logoWidth = aspectRatio >= 1 ? logoSize : logoSize * aspectRatio; const logoHeight = aspectRatio < 1 ? logoSize : logoSize / aspectRatio; const logoMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }); state.materialsToDispose.push(logoMaterial); const logoGeometry = new THREE.PlaneGeometry(logoWidth, logoHeight); state.geometriesToDispose.push(logoGeometry); const logoMesh = new THREE.Mesh(logoGeometry, logoMaterial); logoMesh.position.y = height / 2 - logoHeight / 2 - 0.2; const offset = 0.51; if (x < WALL_THICKNESS) { logoMesh.position.x = offset; logoMesh.rotation.y = Math.PI / 2; } else if (x >= FULL_BOARD_WIDTH - WALL_THICKNESS) { logoMesh.position.x = -offset; logoMesh.rotation.y = -Math.PI / 2; } else if (z < WALL_THICKNESS) { logoMesh.position.z = offset; logoMesh.rotation.y = 0; } else { logoMesh.position.z = -offset; logoMesh.rotation.y = Math.PI; } buildingMesh.add(logoMesh); }); return buildingMesh; };
    const addPiTower = (x: number, z: number, height: number, logoUrl: string) => { const buildingMesh = addBuildingColumn(x, z, height, 'flat'); const helipadTexture = createHeliPadTexture(); state.texturesToDispose.push(helipadTexture); const helipadGeo = new THREE.CircleGeometry(0.4, 32); state.geometriesToDispose.push(helipadGeo); const helipadMat = new THREE.MeshStandardMaterial({ map: helipadTexture, roughness: 0.7 }); state.materialsToDispose.push(helipadMat); const helipadMesh = new THREE.Mesh(helipadGeo, helipadMat); helipadMesh.rotation.x = -Math.PI / 2; helipadMesh.position.y = height / 2 + 0.01; helipadMesh.receiveShadow = true; buildingMesh.add(helipadMesh); const lightGeo = new THREE.SphereGeometry(0.03, 8, 8); state.geometriesToDispose.push(lightGeo); const lightMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff0000, emissiveIntensity: 1.5, toneMapped: false }); state.materialsToDispose.push(lightMat); const lightPositions = [ new THREE.Vector3(0.42, 0, 0), new THREE.Vector3(-0.42, 0, 0), new THREE.Vector3(0, 0, 0.42), new THREE.Vector3(0, 0, -0.42), ]; lightPositions.forEach(pos => { const lightMesh = new THREE.Mesh(lightGeo, lightMat); lightMesh.position.copy(pos); lightMesh.position.y = height / 2 + 0.02; lightMesh.layers.enable(BLOOM_LAYER); buildingMesh.add(lightMesh); }); textureLoader.load(logoUrl, (texture) => { state.texturesToDispose.push(texture); const aspectRatio = texture.image.width / texture.image.height; const logoWidth = 0.95; const logoHeight = logoWidth / aspectRatio; const logoMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true }); state.materialsToDispose.push(logoMaterial); const logoGeometry = new THREE.PlaneGeometry(logoWidth, logoHeight); state.geometriesToDispose.push(logoGeometry); const logoYPosition = height / 2 - logoHeight / 2 - 0.1; const offset = 0.51; const sides = [ { position: new THREE.Vector3(0, logoYPosition, offset), rotation: new THREE.Euler(0, 0, 0) }, { position: new THREE.Vector3(0, logoYPosition, -offset), rotation: new THREE.Euler(0, Math.PI, 0) }, { position: new THREE.Vector3(offset, logoYPosition, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0) }, { position: new THREE.Vector3(-offset, logoYPosition, 0), rotation: new THREE.Euler(0, -Math.PI / 2, 0) } ]; sides.forEach(side => { const logoMesh = new THREE.Mesh(logoGeometry, logoMaterial); logoMesh.position.copy(side.position); logoMesh.rotation.copy(side.rotation); buildingMesh.add(logoMesh); }); }); return buildingMesh; };
    const addSearchlightTower = (x: number, z: number) => { const height = 4; const buildingMesh = addBuildingColumn(x, z, height, 'flat'); const searchlightBaseGroup = new THREE.Group(); searchlightBaseGroup.position.y = height / 2; buildingMesh.add(searchlightBaseGroup); const lightColor = 0xffffaa; const createBeam = (xOffset: number): THREE.Group => { const beamGroup = new THREE.Group(); beamGroup.position.x = xOffset; const beamHeight = 30; const beamGeo = new THREE.CylinderGeometry(0.01, 0.2, beamHeight, 8, 1, true); state.geometriesToDispose.push(beamGeo); const beamMat = new THREE.MeshBasicMaterial({ color: lightColor, transparent: true, opacity: 0.15, side: THREE.DoubleSide }); state.materialsToDispose.push(beamMat); const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.y = beamHeight / 2; beamGroup.add(beam); const baseGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8); state.geometriesToDispose.push(baseGeo); const baseMat = new THREE.MeshStandardMaterial({color: '#444444'}); state.materialsToDispose.push(baseMat); const base = new THREE.Mesh(baseGeo, baseMat); base.position.y = 0.1; beamGroup.add(base); return beamGroup; }; const beam1 = createBeam(-0.2); const beam2 = createBeam(0.2); searchlightBaseGroup.add(beam1, beam2); state.searchlightBeams = [beam1, beam2]; state.searchlightTargets = []; const randomQuat = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * (Math.PI / 4), Math.random() * Math.PI * 2, 0, 'YXZ')); for (let i = 0; i < 2; i++) state.searchlightTargets.push({ currentRotation: randomQuat(), nextRotation: randomQuat(), startTime: 0, duration: 4000 + Math.random() * 3000, }); };
    const addBillboard = (details: BillboardDetails, parentObject: THREE.Object3D) => { const { x: startX, z: startZ, wall } = details; const chamberHeight = 1; const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.1 }); state.materialsToDispose.push(roofMaterial); for (let i = 0; i < 3; i++) { const gridX = (wall === 'N' || wall === 'S') ? startX + i : startX; const gridZ = (wall === 'W' || 'E') ? startZ + i : startZ; const baseGeo = new THREE.BoxGeometry(1, chamberHeight, 1); state.geometriesToDispose.push(baseGeo); const materialIndex = Math.floor(Math.random() * wallMaterials.length); const baseMaterial = wallMaterials[materialIndex]; const baseMesh = new THREE.Mesh(baseGeo, baseMaterial); baseMesh.position.set(gridX + offsetX, 0.5 + chamberHeight / 2, gridZ + offsetZ); baseMesh.castShadow = true; baseMesh.receiveShadow = true; const roofGeo = new THREE.PlaneGeometry(1.01, 1.01); state.geometriesToDispose.push(roofGeo); const roofMesh = new THREE.Mesh(roofGeo, roofMaterial); roofMesh.rotation.x = -Math.PI / 2; roofMesh.position.y = chamberHeight / 2 + 0.01; baseMesh.add(roofMesh); const edges = new THREE.EdgesGeometry(baseMesh.geometry); state.geometriesToDispose.push(edges); const line = new THREE.LineSegments(edges, wallLineMaterial); baseMesh.add(line); parentObject.add(baseMesh); } const billboardGroup = new THREE.Group(); parentObject.add(billboardGroup); let centerGridX, centerGridZ; if (wall === 'N' || wall === 'S') { centerGridX = startX + 1; centerGridZ = startZ; } else { centerGridX = startX; centerGridZ = startZ + 1; } billboardGroup.position.set(centerGridX + offsetX, 0.5 + chamberHeight, centerGridZ + offsetZ); let rotationY = 0; if (wall === 'S') rotationY = Math.PI; else if (wall === 'W') rotationY = Math.PI / 2; else if (wall === 'E') rotationY = -Math.PI / 2; billboardGroup.rotation.y = rotationY; const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.8 }); state.materialsToDispose.push(frameMaterial); const frameWidth = 2.8, frameHeight = 1.6, frameDepth = 0.15; const frameGeo = new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth); state.geometriesToDispose.push(frameGeo); const frameMesh = new THREE.Mesh(frameGeo, frameMaterial); frameMesh.position.y = frameHeight / 2; billboardGroup.add(frameMesh); const screenGeo = new THREE.PlaneGeometry(2.5, 1.25); state.geometriesToDispose.push(screenGeo); const adTexture = createAdBannerTexture(); state.texturesToDispose.push(adTexture); const screenMaterial = new THREE.MeshStandardMaterial({ map: adTexture, emissive: 0xffffff, emissiveMap: adTexture, emissiveIntensity: 0.8, }); state.materialsToDispose.push(screenMaterial); const screenMesh = new THREE.Mesh(screenGeo, screenMaterial); screenMesh.position.y = frameMesh.position.y; screenMesh.position.z = frameDepth / 2 + 0.01; screenMesh.layers.enable(BLOOM_LAYER); billboardGroup.add(screenMesh); state.billboardScreens?.push({ texture: adTexture, material: screenMaterial }); const neonColor = 0x00ffff; const neonMaterial = new THREE.MeshBasicMaterial({ color: neonColor }); state.materialsToDispose.push(neonMaterial); const borderThickness = 0.05; const horizontalGeo = new THREE.BoxGeometry(frameWidth, borderThickness, borderThickness); state.geometriesToDispose.push(horizontalGeo); const verticalGeo = new THREE.BoxGeometry(borderThickness, frameHeight - borderThickness * 2, borderThickness); state.geometriesToDispose.push(verticalGeo); const topBorder = new THREE.Mesh(horizontalGeo, neonMaterial); topBorder.position.set(0, frameHeight / 2 - borderThickness / 2, frameDepth / 2 + 0.02); const bottomBorder = new THREE.Mesh(horizontalGeo, neonMaterial); bottomBorder.position.set(0, -frameHeight / 2 + borderThickness / 2, frameDepth / 2 + 0.02); const leftBorder = new THREE.Mesh(verticalGeo, neonMaterial); leftBorder.position.set(-frameWidth / 2 + borderThickness / 2, 0, frameDepth / 2 + 0.02); const rightBorder = new THREE.Mesh(verticalGeo, neonMaterial); rightBorder.position.set(frameWidth / 2 - borderThickness / 2, 0, frameDepth / 2 + 0.02); [topBorder, bottomBorder, leftBorder, rightBorder].forEach(border => { border.layers.enable(BLOOM_LAYER); frameMesh.add(border); }); const createSpotlight = (xOffset: number) => { const spotlight = new THREE.SpotLight(0xffffff, 3, 10, Math.PI / 8, 0.5, 1); spotlight.position.set(xOffset, 0.2, 0.5); spotlight.castShadow = true; spotlight.target = screenMesh; billboardGroup.add(spotlight, spotlight.target); }; createSpotlight(-0.8); createSpotlight(0.8); };
    const addPoster = (details: StreetPassageDetails, parentObject: THREE.Object3D) => {
        const { wall, entry, exit } = details;
        const minPos = Math.min(entry, exit) + WALL_THICKNESS;
        const maxPos = Math.max(entry, exit) + WALL_THICKNESS;
        const Z_FIGHT_OFFSET = 0.01; // Small offset to prevent z-fighting

        const posterHeight = 1.1;
        const posterWidth = posterHeight * (9 / 16);
        const posterY = 0.5 + posterHeight / 2;

        const posterGeo = new THREE.PlaneGeometry(posterWidth, posterHeight);
        state.geometriesToDispose.push(posterGeo);

        const textureA = createPosterTexture('A');
        const textureB = createPosterTexture('B');
        state.texturesToDispose.push(textureA, textureB);

        const materialA = new THREE.MeshStandardMaterial({ map: textureA, emissive: 0xffffff, emissiveMap: textureA, emissiveIntensity: 0.5 });
        const materialB = new THREE.MeshStandardMaterial({ map: textureB, emissive: 0xffffff, emissiveMap: textureB, emissiveIntensity: 0.5 });
        state.materialsToDispose.push(materialA, materialB);

        const poster1 = new THREE.Mesh(posterGeo, materialA);
        const poster2 = new THREE.Mesh(posterGeo, materialB);
        poster1.layers.enable(BLOOM_LAYER);
        poster2.layers.enable(BLOOM_LAYER);

        let pos1: THREE.Vector3, rot1: THREE.Euler, pos2: THREE.Vector3, rot2: THREE.Euler;

        switch (wall) {
            case 'N':
            case 'S':
                // Corridor runs along X-axis. Posters are on walls at minPos-1 and maxPos+1.
                const zCorridor = (wall === 'N') ? 1 : FULL_BOARD_DEPTH - 2;
                
                // Poster 1 is on the wall of the building at (minPos-1). Faces East (+X).
                pos1 = new THREE.Vector3(minPos + offsetX - 0.5 + Z_FIGHT_OFFSET, posterY, zCorridor + offsetZ);
                rot1 = new THREE.Euler(0, Math.PI / 2, 0);

                // Poster 2 is on the wall of the building at (maxPos+1). Faces West (-X).
                pos2 = new THREE.Vector3(maxPos + offsetX + 0.5 - Z_FIGHT_OFFSET, posterY, zCorridor + offsetZ);
                rot2 = new THREE.Euler(0, -Math.PI / 2, 0);
                break;
            
            case 'W':
            case 'E':
                // Corridor runs along Z-axis. Posters are on walls at minPos-1 and maxPos+1.
                const xCorridor = (wall === 'W') ? 1 : FULL_BOARD_WIDTH - 2;
                
                // Poster 1 is on the wall of the building at (minPos-1). Faces South (+Z).
                pos1 = new THREE.Vector3(xCorridor + offsetX, posterY, minPos + offsetZ - 0.5 + Z_FIGHT_OFFSET);
                rot1 = new THREE.Euler(0, 0, 0);

                // Poster 2 is on the wall of the building at (maxPos+1). Faces North (-Z).
                pos2 = new THREE.Vector3(xCorridor + offsetX, posterY, maxPos + offsetZ + 0.5 - Z_FIGHT_OFFSET);
                rot2 = new THREE.Euler(0, Math.PI, 0);

                poster1.material = materialB; // Swap textures for variety
                poster2.material = materialA;
                break;
        }

        poster1.position.copy(pos1);
        poster1.rotation.copy(rot1);
        poster2.position.copy(pos2);
        poster2.rotation.copy(rot2);
        parentObject.add(poster1, poster2);
    };
    const perimeterBlocks: {x: number, z: number}[] = []; for (let x = 0; x < FULL_BOARD_WIDTH; x++) for (let z = 0; z < FULL_BOARD_DEPTH; z++) if (isWall({ x, y: 1, z }, layoutDetails)) perimeterBlocks.push({ x, z });
    const piLogoUrl = 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Pi%20Network%20icon.png';
    const logoUrls = [ piLogoUrl, 'https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Quantum%20Industries%20Logo.png' ]; const skyscraperPlacements = new Map<number, string>(); const availableForSkyscraper = Array.from(Array(perimeterBlocks.length).keys()); if (availableForSkyscraper.length > 1) { for (let i = availableForSkyscraper.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [availableForSkyscraper[i], availableForSkyscraper[j]] = [availableForSkyscraper[j], availableForSkyscraper[i]]; } const index1 = availableForSkyscraper.pop()!; skyscraperPlacements.set(index1, logoUrls[0]); const pos1 = perimeterBlocks[index1]; const secondIndexPosition = availableForSkyscraper.findIndex(idx => { const pos2 = perimeterBlocks[idx]; return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.z - pos2.z) > 1; }); let index2; if (secondIndexPosition !== -1) index2 = availableForSkyscraper.splice(secondIndexPosition, 1)[0]; else index2 = availableForSkyscraper.pop()!; skyscraperPlacements.set(index2, logoUrls[1]); }
    const regularBuildingIndices = perimeterBlocks.map((_, i) => i).filter(i => !skyscraperPlacements.has(i)); for (let i = regularBuildingIndices.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [regularBuildingIndices[i], regularBuildingIndices[j]] = [regularBuildingIndices[j], regularBuildingIndices[i]]; } const towerIndices = new Set(regularBuildingIndices.slice(0, 4));
    const passageWall = layoutDetails.street.wall; let searchlightTowerIndex = -1; const searchlightCandidatesIndices = regularBuildingIndices.filter(i => { if (towerIndices.has(i)) return false; const p = perimeterBlocks[i]; if (passageWall === 'N') return p.z < WALL_THICKNESS; if (passageWall === 'S') return p.z >= FULL_BOARD_DEPTH - WALL_THICKNESS; if (passageWall === 'W') return p.x < WALL_THICKNESS; if (passageWall === 'E') return p.x >= FULL_BOARD_WIDTH - WALL_THICKNESS; return false; }); if (searchlightCandidatesIndices.length > 0) { const randomIndexInCandidates = Math.floor(Math.random() * searchlightCandidatesIndices.length); searchlightTowerIndex = searchlightCandidatesIndices[randomIndexInCandidates]; }
    perimeterBlocks.forEach((pos, index) => { if (skyscraperPlacements.has(index)) { const skyscraperHeight = 6; const url = skyscraperPlacements.get(index)!; url === piLogoUrl ? addPiTower(pos.x, pos.z, skyscraperHeight, url) : addSkyscraper(pos.x, pos.z, skyscraperHeight, url); } else if (index === searchlightTowerIndex) { addSearchlightTower(pos.x, pos.z); } else if (towerIndices.has(index)) { addTransmissionTower(pos.x, pos.z); } else { const rand = Math.random(); const height = rand < 0.1 ? 1 : 1.5 + Math.random() * 3; const roofRand = Math.random(); let roofType: 'flat' | 'apex' | 'slanted' | 'pyramid'; if (roofRand < 0.5) { roofType = 'flat'; } else if (roofRand < 0.625) { roofType = 'apex'; } else if (roofRand < 0.75) { roofType = 'slanted'; } else { roofType = 'pyramid'; } const buildingMesh = addBuildingColumn(pos.x, pos.z, height, roofType); if (height > 2 && Math.random() < 0.25) addAdBanner(buildingMesh, pos.x, pos.z, height); } });
    addBillboard(layoutDetails.billboard, layoutGroup);
    addPoster(layoutDetails.street, layoutGroup);
    
    // Add Flyers
    if (layoutDetails.flyers) {
        const flyerTextures = [createFlyerTexture(0), createFlyerTexture(1), createFlyerTexture(2)];
        state.texturesToDispose.push(...flyerTextures);
        const flyerGeo = new THREE.PlaneGeometry(0.5, 0.5);
        state.geometriesToDispose.push(flyerGeo);
        
        const flyerMaterials = flyerTextures.map(tex => {
            const mat = new THREE.MeshStandardMaterial({
                map: tex,
                roughness: 0.9,
                metalness: 0.1,
                side: THREE.DoubleSide,
            });
            state.materialsToDispose.push(mat);
            return mat;
        });

        layoutDetails.flyers.forEach(flyer => {
            if (flyer.variant >= flyerMaterials.length) return;
            const material = flyerMaterials[flyer.variant];
            const mesh = new THREE.Mesh(flyerGeo, material);

            let x, z, rotY;
            const y = 1.2; // Snake's eye height
            const zFightOffset = 0.02;

            switch (flyer.wall) {
                case 'N':
                    x = flyer.position + offsetX;
                    z = (WALL_THICKNESS - 1 + offsetZ) + 0.5 + zFightOffset;
                    rotY = 0;
                    break;
                case 'S':
                    x = flyer.position + offsetX;
                    z = (FULL_BOARD_DEPTH - WALL_THICKNESS + offsetZ) - 0.5 - zFightOffset;
                    rotY = Math.PI;
                    break;
                case 'W':
                    x = (WALL_THICKNESS - 1 + offsetX) + 0.5 + zFightOffset;
                    z = flyer.position + offsetZ;
                    rotY = Math.PI / 2;
                    break;
                case 'E':
                    x = (FULL_BOARD_WIDTH - WALL_THICKNESS + offsetX) - 0.5 - zFightOffset;
                    z = flyer.position + offsetZ;
                    rotY = -Math.PI / 2;
                    break;
            }

            mesh.position.set(x, y, z);
            mesh.rotation.set(0, rotY + flyer.rotationJitter.y, flyer.rotationJitter.z);
            layoutGroup.add(mesh);
        });
    }

    const portalFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2, envMapIntensity: 0.5 }); state.materialsToDispose.push(portalFrameMaterial); const createPortalShowcase = (portalType: PortalType) => { const portalGroup = new THREE.Group(); const topCapGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32); state.geometriesToDispose.push(topCapGeo); const topCap = new THREE.Mesh(topCapGeo, portalFrameMaterial); topCap.position.y = 0.4; portalGroup.add(topCap); const baseGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32); state.geometriesToDispose.push(baseGeo); const base = new THREE.Mesh(baseGeo, portalFrameMaterial); base.position.y = -0.45; portalGroup.add(base); const energyGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.7, 32, 1, true); state.geometriesToDispose.push(energyGeo); const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 128; const ctx = canvas.getContext('2d')!; ctx.strokeStyle = portalType === 'Red' ? '#ff8080' : '#80b3ff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.5; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.moveTo(Math.random() * 32, 0); ctx.lineTo(Math.random() * 32, 128); ctx.stroke(); } const energyTexture = new THREE.CanvasTexture(canvas); energyTexture.wrapS = THREE.RepeatWrapping; energyTexture.wrapT = THREE.RepeatWrapping; state.texturesToDispose.push(energyTexture); const energyMat = new THREE.MeshBasicMaterial({ map: energyTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); state.materialsToDispose.push(energyMat); const energyCylinder = new THREE.Mesh(energyGeo, energyMat); portalGroup.add(energyCylinder); const orbRadius = 0.15; const orbGeometry = new THREE.SphereGeometry(orbRadius, 16, 16); state.geometriesToDispose.push(orbGeometry); const orbTexture = createPortalTexture(portalType); state.texturesToDispose.push(orbTexture); const orbMaterial = new THREE.MeshStandardMaterial({ emissiveMap: orbTexture, emissive: 0xffffff, emissiveIntensity: 1.5, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, }); state.materialsToDispose.push(orbMaterial); const orb1 = new THREE.Mesh(orbGeometry, orbMaterial); orb1.layers.enable(BLOOM_LAYER); portalGroup.add(orb1); const orb2 = new THREE.Mesh(orbGeometry, orbMaterial.clone()); state.materialsToDispose.push(orb2.material as THREE.Material); orb2.layers.enable(BLOOM_LAYER); portalGroup.add(orb2); portalGroup.visible = false; return { group: portalGroup, orbs: [orb1, orb2], energyTexture }; };
    
    layoutDetails.portals.forEach(portal => {
        const showcase = createPortalShowcase(portal.type);
        const pos = getPortalAbsolutePosition(portal);
        showcase.group.position.set(pos.x + offsetX, 1.05, pos.z + offsetZ);
        showcase.group.visible = true; // Portals are visible by default
        layoutGroup.add(showcase.group);
        state.portalGroups!.set(portal.id, showcase);
    });

  }, [layoutDetails, offsetX, offsetZ]);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default Board;