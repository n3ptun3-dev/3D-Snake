
import * as THREE from 'three';
import { GameState, Point3D, FruitType, LightEventType, LightEventData, LayoutDetails, ActiveEffect } from '../types';
import { FRUIT_COLORS, FULL_BOARD_WIDTH, FULL_BOARD_DEPTH, COLORS } from '../constants';
import { isStreetPassageBlock } from './gameLogic';

interface LightEffect {
    id: number;
    type: 'ambient' | 'event' | 'passageGlow' | 'powerupPulse' | 'spotlight';
    powerupType?: FruitType;
    startTime: number;
    duration: number;
    update: (time: number, position: THREE.Vector3, index?: number, speedMps?: number) => THREE.Color | null;
    isFinished: (time: number) => boolean;
    // For tile-specific effects like the runway
    updateTile?: (time: number, gridX: number, gridZ: number) => THREE.Color | null;
}

const offsetX = -FULL_BOARD_WIDTH / 2 + 0.5;
const offsetZ = -FULL_BOARD_DEPTH / 2 + 0.5;

export class LightingSystem {
    private gridLines: THREE.LineSegments | null = null;
    private buildingEdges: THREE.InstancedMesh | null = null;
    
    private gridVertexMap: { position: THREE.Vector3; index: number }[] = [];
    private buildingInstancePositions: THREE.Vector3[] = [];

    private activeEffects: LightEffect[] = [];
    private effectIdCounter = 0;
    private ambientEffectType: 'show' | 'speed' | null = null;
    private layoutDetails: LayoutDetails | null = null;
    private streetBoundaryIndices: Set<number> = new Set();
    private isMagnetActive = false;
    private snakeHeadGridPos: { x: number; z: number } | null = null;
    private snakeHeadWorldPos: THREE.Vector3 | null = null;

    public init(grid: THREE.LineSegments, buildings: THREE.InstancedMesh, buildingInstancePositions: THREE.Vector3[], layoutDetails: LayoutDetails) {
        this.gridLines = grid;
        this.buildingEdges = buildings;
        (this.gridLines.material as THREE.LineBasicMaterial).vertexColors = true;
        this.gridVertexMap = this.mapVertices(grid.geometry);
        this.buildingInstancePositions = buildingInstancePositions;
        this.layoutDetails = layoutDetails;
        this.streetBoundaryIndices = this.precalculateStreetBoundaryVertices();
    }

    public triggerEvent(type: LightEventType, data: LightEventData) {
        const newEffects: LightEffect[] = [];
        const isMajorEvent = type === 'gameOver' || type === 'levelUp';

        if (isMajorEvent) {
            this.activeEffects = this.activeEffects.filter(e => e.type !== 'event');
        }

        switch (type) {
            case 'fruitEaten':
                if (data.position && data.fruitType !== undefined) {
                    if (data.fruitType === FruitType.MAGNET || (data.isMagnetActive && data.fruitType === FruitType.APPLE)) {
                        newEffects.push(this.createRippleEffect(data.position, FruitType.MAGNET, 0, true));
                    } else {
                        const rippleCount = data.isTripleActive ? 3 : data.isScoreDoublerActive ? 2 : 1;
                        for (let i = 0; i < rippleCount; i++) {
                            newEffects.push(this.createRippleEffect(data.position, data.fruitType, i * 120, false));
                        }
                    }
                }
                break;
            case 'portalWake':
                if (data.position && data.portalType) {
                    newEffects.push(this.createWakeEffect(data.position, data.portalType));
                }
                break;
            case 'levelUp': newEffects.push(this.createLevelUpEffect()); break;
            case 'turn':
                if (data.position && data.rotation !== undefined) {
                    newEffects.push(this.createRunwayEffect(data.position, data.rotation));
                }
                break;
            case 'passageFruitSpawned':
                if (data.fruitType !== undefined) {
                    this.activeEffects = this.activeEffects.filter(e => e.type !== 'passageGlow');
                    newEffects.push(this.createStreetPassageGlowEffect(data.fruitType));
                }
                break;
            case 'snakeExitedPassage': this.activeEffects = this.activeEffects.filter(e => e.type !== 'passageGlow'); break;
        }

        if (newEffects.length > 0) {
            this.activeEffects.push(...newEffects);
        }
    }

    public update(time: number, gameState: GameState, isPaused: boolean, speedMps: number, activePowerups: ActiveEffect[], snakeHeadPos: THREE.Vector3 | null) {
        if (!this.gridLines || !this.buildingEdges) return;
        const now = performance.now();

        this.isMagnetActive = activePowerups.some(p => p.type === FruitType.MAGNET);
        this.snakeHeadWorldPos = snakeHeadPos;
        if (snakeHeadPos) {
            this.snakeHeadGridPos = {
                x: Math.round(snakeHeadPos.x - offsetX),
                z: Math.round(snakeHeadPos.z - offsetZ),
            };
        } else {
            this.snakeHeadGridPos = null;
        }

        const isShowActive = gameState === 'Welcome' || gameState === 'GameOver' || isPaused;
        const isPlaying = gameState === 'Playing' && !isPaused;
        
        if (isShowActive) {
            if (this.ambientEffectType !== 'show') {
                this.activeEffects = this.activeEffects.filter(e => e.type !== 'ambient' && e.type !== 'passageGlow');
                this.activeEffects.push(this.createShowSequencer());
                this.ambientEffectType = 'show';
            }
        } else {
            if (this.ambientEffectType !== 'speed') {
                this.activeEffects = this.activeEffects.filter(e => e.type !== 'ambient');
                this.activeEffects.push(this.createSpeedBasedAmbientEffect());
                this.ambientEffectType = 'speed';
            }
        }

        const hasSpotlight = this.activeEffects.some(e => e.type === 'spotlight');
        if (isPlaying && !hasSpotlight) {
            this.activeEffects.push(this.createDualSpotlightEffect());
        } else if (!isPlaying && hasSpotlight) {
            this.activeEffects = this.activeEffects.filter(e => e.type !== 'spotlight');
        }

        this.syncPowerupPulses(activePowerups);

        const finishedEffects = this.activeEffects.filter(effect => effect.isFinished(now));
        if (finishedEffects.length > 0) {
            this.activeEffects = this.activeEffects.filter(effect => !effect.isFinished(now));
        }
        
        this.updateGeometryColors(now, this.gridLines.geometry, this.gridVertexMap, finishedEffects.length > 0, speedMps);
        this.updateBuildingInstanceColors(now, this.buildingEdges, this.buildingInstancePositions, finishedEffects.length > 0, speedMps);
    }
    
    public getTileEffects(gridX: number, gridZ: number, time: number): THREE.Color | null {
        const finalColor = new THREE.Color(0, 0, 0);
        let hasEffect = false;

        for (const effect of this.activeEffects) {
            if (effect.updateTile) {
                const effectColor = effect.updateTile(time, gridX, gridZ);
                if (effectColor) {
                    finalColor.add(effectColor);
                    hasEffect = true;
                }
            }
        }

        if (this.isMagnetActive && this.snakeHeadGridPos) {
            const headX = this.snakeHeadGridPos.x;
            const headZ = this.snakeHeadGridPos.z;
    
            const dx = Math.abs(gridX - headX);
            const dz = Math.abs(gridZ - headZ);
    
            // Color a 3x3 grid around the head, excluding the center tile.
            if (dx <= 1 && dz <= 1 && !(dx === 0 && dz === 0)) {
                const pulse = 0.4 + (Math.sin(time * 0.008) + 1) * 0.1;
                const magnetColor = new THREE.Color(FRUIT_COLORS[FruitType.MAGNET]).multiplyScalar(pulse);
                finalColor.add(magnetColor);
                hasEffect = true;
            }
        }

        return hasEffect ? finalColor : null;
    }

    private updateGeometryColors(time: number, geometry: THREE.BufferGeometry, vertexMap: { position: THREE.Vector3; index: number }[], forceClear: boolean, speedMps: number) {
        const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute;
        if (!colorAttribute) return;

        let needsUpdate = false;
        const tempColor = new THREE.Color();
        const finalColor = new THREE.Color();

        for (const vertex of vertexMap) {
            finalColor.setRGB(0, 0, 0);

            const passageGlowEffect = this.activeEffects.find(e => e.type === 'passageGlow');
            const ambientEffect = this.activeEffects.find(e => e.type === 'ambient');
            
            const passageColor = passageGlowEffect?.update(time, vertex.position, vertex.index, speedMps);
            if (passageColor) {
                finalColor.add(passageColor);
            } else {
                const ambientColor = ambientEffect?.update(time, vertex.position, vertex.index, speedMps);
                if (ambientColor) {
                    finalColor.add(ambientColor);
                }
            }

            const otherEffects = this.activeEffects.filter(e => e.type === 'event' || e.type === 'powerupPulse' || e.type === 'spotlight');
            for (const effect of otherEffects) {
                // The main update method is now only for grid lines and buildings, so tile-specific effects are skipped.
                if (effect.update) {
                    const effectColor = effect.update(time, vertex.position, vertex.index, speedMps);
                    if (effectColor) {
                        finalColor.add(effectColor);
                    }
                }
            }
            
            if (this.isMagnetActive && this.snakeHeadWorldPos) {
                const head = this.snakeHeadWorldPos;
                const pos = vertex.position;
                const auraRadius = 1.5;
                const tolerance = 0.01;
    
                const headTileCenterX = Math.round(head.x - offsetX) + offsetX;
                const headTileCenterZ = Math.round(head.z - offsetZ) + offsetZ;
    
                const dx = Math.abs(pos.x - headTileCenterX);
                const dz = Math.abs(pos.z - headTileCenterZ);
    
                const onXBoundary = Math.abs(dx - auraRadius) < tolerance && dz < auraRadius + tolerance;
                const onZBoundary = Math.abs(dz - auraRadius) < tolerance && dx < auraRadius + tolerance;
                
                if (onXBoundary || onZBoundary) {
                    const pulse = 0.8 + (Math.sin(time * 0.008) + 1) * 0.2;
                    const brightPurple = new THREE.Color(FRUIT_COLORS[FruitType.MAGNET]).multiplyScalar(pulse);
                    finalColor.add(brightPurple);
                }
            }

            tempColor.fromBufferAttribute(colorAttribute, vertex.index);
            if (!tempColor.equals(finalColor) || forceClear) {
                colorAttribute.setXYZ(vertex.index, finalColor.r, finalColor.g, finalColor.b);
                needsUpdate = true;
            }
        }
        
        if (needsUpdate) {
            colorAttribute.needsUpdate = true;
        }
    }

    private updateBuildingInstanceColors(time: number, instancedMesh: THREE.InstancedMesh | null, instancePositions: THREE.Vector3[], forceClear: boolean, speedMps: number) {
        if (!instancedMesh || !instancedMesh.instanceColor) return;

        let needsUpdate = false;
        const tempColor = new THREE.Color();
        const finalColor = new THREE.Color();

        for (let i = 0; i < instancedMesh.count; i++) {
            finalColor.setRGB(0,0,0);
            const position = instancePositions[i];
            if (!position) continue;
            
            const passageGlowEffect = this.activeEffects.find(e => e.type === 'passageGlow');
            const ambientEffect = this.activeEffects.find(e => e.type === 'ambient');
            
            const passageColor = passageGlowEffect?.update(time, position, i, speedMps);
            if (passageColor) {
                finalColor.add(passageColor);
            } else {
                const ambientColor = ambientEffect?.update(time, position, i, speedMps);
                if (ambientColor) {
                    finalColor.add(ambientColor);
                }
            }

            const otherEffects = this.activeEffects.filter(e => e.type === 'event' || e.type === 'powerupPulse' || e.type === 'spotlight');
             for (const effect of otherEffects) {
                if (effect.update) {
                    const effectColor = effect.update(time, position, i, speedMps);
                    if (effectColor) {
                        finalColor.add(effectColor);
                    }
                }
            }
            
            instancedMesh.getColorAt(i, tempColor);
            if (!tempColor.equals(finalColor) || forceClear) {
                instancedMesh.setColorAt(i, finalColor);
                needsUpdate = true;
            }
        }
        
        if (needsUpdate) {
            instancedMesh.instanceColor.needsUpdate = true;
        }
    }

    private syncPowerupPulses(activePowerups: ActiveEffect[]) {
        // Only Speed Boost creates a persistent pulse that modifies the ambient speed color.
        // Other power-ups only create an initial ripple effect on consumption.
        const pulseTypes = [FruitType.SPEED_BOOST];
        
        pulseTypes.forEach(type => {
            const isPowerupActive = activePowerups.some(p => p.type === type);
            const isPulseInSystem = this.activeEffects.some(e => e.type === 'powerupPulse' && e.powerupType === type);

            if (isPowerupActive && !isPulseInSystem) {
                this.activeEffects.push(this.createPowerupPulseEffect(type));
            } else if (!isPowerupActive && isPulseInSystem) {
                this.activeEffects = this.activeEffects.filter(e => !(e.type === 'powerupPulse' && e.powerupType === type));
            }
        });
    }

    private mapVertices(geometry: THREE.BufferGeometry): { position: THREE.Vector3; index: number }[] {
        const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
        if (!geometry.getAttribute('color')) {
            const colors = new Float32Array(positions.count * 3);
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }
        
        const map = [];
        for (let i = 0; i < positions.count; i++) {
            map.push({
                position: new THREE.Vector3().fromBufferAttribute(positions, i),
                index: i,
            });
        }
        return map;
    }
    
    private precalculateStreetBoundaryVertices(): Set<number> {
        const boundaryIndices = new Set<number>();
        if (!this.layoutDetails || !this.gridVertexMap) return boundaryIndices;
    
        for (const vertex of this.gridVertexMap) {
            const gridX = Math.round(vertex.position.x - offsetX);
            const gridZ = Math.round(vertex.position.z - offsetZ);
    
            const adjacentTiles = [
                { x: gridX - 1, z: gridZ - 1 },
                { x: gridX, z: gridZ - 1 },
                { x: gridX - 1, z: gridZ },
                { x: gridX, z: gridZ },
            ];
    
            const tileStreetStatus = adjacentTiles.map(tile =>
                isStreetPassageBlock(tile.x, tile.z, this.layoutDetails!.street)
            );
    
            const hasStreetTile = tileStreetStatus.some(isStreet => isStreet);
            const hasNonStreetTile = tileStreetStatus.some(isStreet => !isStreet);
    
            if (hasStreetTile && hasNonStreetTile) {
                boundaryIndices.add(vertex.index);
            }
        }
        return boundaryIndices;
    }

    private createSpeedBasedAmbientEffect(): LightEffect {
        const finalColor = new THREE.Color();
        const NEUTRAL_COLOR = new THREE.Color(COLORS.GRID_LINES);
        const COOL_COLOR = new THREE.Color(0x00ffff);
        const WARM_COLOR = new THREE.Color(0xff8c00);
        const HOT_COLOR = new THREE.Color(0xff00ff);
        
        const NEUTRAL_SPEED_THRESHOLD = 2.5; // Corresponds to initial speed of 1000/400
        const MIN_SPEED = 3.0;
        const GRADIENT_MAX_SPEED = 8.0;

        return {
            id: ++this.effectIdCounter, startTime: performance.now(), duration: Infinity, type: 'ambient',
            update: (time, position, index, speedMps = 0) => {
                let baseColor: THREE.Color;
                
                if (speedMps <= NEUTRAL_SPEED_THRESHOLD) {
                    baseColor = NEUTRAL_COLOR;
                } else if (speedMps < MIN_SPEED) {
                    const progress = (speedMps - NEUTRAL_SPEED_THRESHOLD) / (MIN_SPEED - NEUTRAL_SPEED_THRESHOLD);
                    baseColor = NEUTRAL_COLOR.clone().lerp(COOL_COLOR, progress);
                } else if (speedMps <= GRADIENT_MAX_SPEED) {
                    const progress = (speedMps - MIN_SPEED) / (GRADIENT_MAX_SPEED - MIN_SPEED);
                    baseColor = progress < 0.5 ? COOL_COLOR.clone().lerp(WARM_COLOR, progress * 2) : WARM_COLOR.clone().lerp(HOT_COLOR, (progress - 0.5) * 2);
                } else {
                    baseColor = HOT_COLOR;
                }
                const intensity = 0.15 + (Math.sin(time * 0.001 + position.z * 0.2 + position.x * 0.2) + 1) / 2 * 0.05;
                return finalColor.copy(baseColor).multiplyScalar(intensity);
            },
            isFinished: () => false,
        };
    }
    
    private createPowerupPulseEffect(fruitType: FruitType): LightEffect {
        const id = ++this.effectIdCounter;
        const color = new THREE.Color(FRUIT_COLORS[fruitType]);
        
        return {
            id,
            startTime: performance.now(),
            duration: Infinity,
            type: 'powerupPulse',
            powerupType: fruitType,
            update: (time, position, index, speedMps) => {
                const pulse = 0.15 + (Math.sin(time * 0.008) + 1) * 0.1;
                
                if (fruitType === FruitType.SPEED_BOOST) {
                    const speedEffect = this.createSpeedBasedAmbientEffect();
                    const currentSpeedColor = speedEffect.update(time, position, index, speedMps);
                    if (currentSpeedColor) {
                        return currentSpeedColor.add(color.clone().multiplyScalar(pulse));
                    }
                }
                return color.clone().multiplyScalar(pulse);
            },
            isFinished: () => false,
        };
    }

    private createGlobalPulseEffect(): LightEffect {
        let pulseColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.2);
        let lastPulseCycle = 0;

        return {
            id: ++this.effectIdCounter, startTime: performance.now(), duration: Infinity, type: 'ambient',
            update: (time) => {
                const pulseCycle = Math.floor((time * 0.002) / Math.PI);
                if (pulseCycle > lastPulseCycle) {
                    lastPulseCycle = pulseCycle;
                    pulseColor.setHSL(Math.random(), 0.8, 0.2);
                }
                const intensity = (Math.sin(time * 0.002) + 1) / 2 * 0.1 + 0.1;
                return pulseColor.clone().multiplyScalar(intensity);
            },
            isFinished: () => false,
        };
    }

    private createSparkleEffect(): LightEffect {
        const startTime = performance.now();
        const sparkleColor = new THREE.Color(0xFFDDAA); // Warm, golden yellow

        return {
            id: ++this.effectIdCounter, startTime, duration: Infinity, type: 'ambient',
            update: (time, position) => {
                const speed = 0.005;
                const spatialFrequency = 0.7; // Controls how "dense" the sparkles are
                
                // Each vertex gets a unique but deterministic phase based on its position
                const phase = time * speed + position.x * spatialFrequency + position.z * spatialFrequency;
                
                // A normal sine wave gives a slow pulse. We use pow() to sharpen the peak.
                const sineValue = (Math.sin(phase) + 1) / 2; // Normalize to 0-1 range
                const intensity = Math.pow(sineValue, 20); // High power makes it "twinkle"
                
                if (intensity < 0.01) return null; // Optimization: don't calculate for invisible lights
                
                return sparkleColor.clone().multiplyScalar(intensity);
            },
            isFinished: () => false,
        };
    }

    private createRainbowSpinnerEffect(): LightEffect {
        const startTime = performance.now();
        const finalColor = new THREE.Color();
        const center = new THREE.Vector3(0, 0, 0);

        return {
            id: ++this.effectIdCounter, startTime, duration: Infinity, type: 'ambient',
            update: (time, position) => {
                const angle = Math.atan2(position.z - center.z, position.x - center.x);
                const rotation = time * 0.0003;
                const hue = (angle + rotation) / (Math.PI * 2);
                
                const distance = position.distanceTo(center);
                const maxDist = FULL_BOARD_WIDTH / 2;
                const lightness = 0.15 + (distance / maxDist) * 0.10;

                finalColor.setHSL(hue % 1, 0.9, lightness);
                return finalColor;
            },
            isFinished: () => false,
        };
    }
    
    private createTriScannerEffect(): LightEffect {
        const scannerColors = [
            new THREE.Color(0x00ffff), // Cyan
            new THREE.Color(0x00ff00), // Green
            new THREE.Color(0xff00ff), // Magenta
        ];
        const scannerAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
        const finalColor = new THREE.Color();
        
        return {
            id: ++this.effectIdCounter, startTime: performance.now(), duration: Infinity, type: 'ambient',
            update: (time, position) => {
                const scannerAngle = time * 0.0003;
                const vertexAngle = Math.atan2(position.z, position.x);
                const beamWidth = 0.5;
                
                finalColor.setRGB(0, 0, 0);
                let totalIntensity = 0;

                for (let i = 0; i < scannerAngles.length; i++) {
                    let deltaAngle = vertexAngle - (scannerAngle + scannerAngles[i]);
                    while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
                    while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
                    
                    const intensity = Math.max(0, 1 - Math.abs(deltaAngle) / beamWidth);
                    if (intensity > 0) {
                        finalColor.add(scannerColors[i].clone().multiplyScalar(Math.pow(intensity, 2)));
                        totalIntensity += intensity;
                    }
                }
                
                return totalIntensity > 0 ? finalColor : null;
            },
            isFinished: () => false,
        };
    }

    private createPerimeterChaseEffect(): LightEffect {
        const boardHalfWidth = (FULL_BOARD_WIDTH / 2) - 0.5;
        const perimeterLength = (boardHalfWidth * 2) * 4;
        const getPerimeterCoord = (dist: number) => {
            dist = dist % perimeterLength;
            if (dist < boardHalfWidth * 2) return { x: -boardHalfWidth + dist, z: -boardHalfWidth };
            dist -= boardHalfWidth * 2;
            if (dist < boardHalfWidth * 2) return { x: boardHalfWidth, z: -boardHalfWidth + dist };
            dist -= boardHalfWidth * 2;
            if (dist < boardHalfWidth * 2) return { x: boardHalfWidth - dist, z: boardHalfWidth };
            dist -= boardHalfWidth * 2;
            return { x: -boardHalfWidth, z: boardHalfWidth - dist };
        };
        const tempVec = new THREE.Vector3();
        const startTime = performance.now();
        const chaseColor = new THREE.Color().setHSL(Math.random() * 0.08 + 0.11, 0.9, 0.6);
        return {
            id: ++this.effectIdCounter, startTime, duration: Infinity, type: 'ambient',
            update: (time, position) => {
                const chaserDist = ((time - startTime) * 0.05) % perimeterLength;
                const { x, z } = getPerimeterCoord(chaserDist);
                tempVec.set(x, position.y, z);
                const distToChaser = position.distanceTo(tempVec);
                const tailLength = 4.0;
                const intensity = Math.max(0, 1 - distToChaser / tailLength);
                return intensity > 0 ? chaseColor.clone().multiplyScalar(Math.pow(intensity, 2)) : null;
            },
            isFinished: () => false,
        };
    }

    private createStaticRainbowEffect(): LightEffect {
        const finalColor = new THREE.Color();
        const center = new THREE.Vector3(0, 0, 0);

        return {
            id: ++this.effectIdCounter, startTime: performance.now(), duration: Infinity, type: 'ambient',
            update: (time, position) => {
                const angle = Math.atan2(position.z - center.z, position.x - center.x);
                const hue = (angle) / (Math.PI * 2);
                
                const distance = position.distanceTo(center);
                const maxDist = FULL_BOARD_WIDTH / 2;
                const lightness = 0.15 + (distance / maxDist) * 0.10;

                finalColor.setHSL(hue < 0 ? 1 + hue : hue, 0.9, lightness);
                return finalColor.clone();
            },
            isFinished: () => false,
        };
    }
    
    private createBreathingEffect(colorInput?: THREE.Color): LightEffect {
        const startTime = performance.now();
        const color = colorInput || new THREE.Color(0x87CEEB); // Default to sky blue if no color is provided
        const duration = 8000; // Slow 8-second cycle
    
        return {
            id: ++this.effectIdCounter, startTime, duration: Infinity, type: 'ambient',
            update: (time) => {
                const elapsed = time - startTime;
                const progress = (elapsed % duration) / duration;
                // Use a cosine wave that starts at the peak, goes to the trough, and back. Smoother than sine for breathing.
                const intensity = (Math.cos(progress * Math.PI * 2) + 1) / 2 * 0.1 + 0.05; // Gentle pulse from 0.05 to 0.15
                return color.clone().multiplyScalar(intensity);
            },
            isFinished: () => false,
        };
    }

    private createStarlightEffect(): LightEffect {
        const startTime = performance.now();
        const stars: { x: number; z: number; startTime: number; duration: number; peak: number, color: THREE.Color }[] = [];
        const maxStars = 50;
        const spawnInterval = 200; // ms
        let lastSpawn = 0;
        const finalColor = new THREE.Color();
        
        // Sequential splash logic
        const sequenceColors = [
            new THREE.Color(0x00ffff), // Cyan/Blue
            new THREE.Color(0x00ff00), // Green
            new THREE.Color(0xff00ff), // Magenta
        ];
        let sequenceIndex = 0;
        const sequenceInterval = 3000; // 3 seconds per splash
        let lastSequenceSpawn = startTime - sequenceInterval; // Allow immediate spawn

        return {
            id: ++this.effectIdCounter, startTime, duration: Infinity, type: 'ambient',
            update: (time, position) => {
                const elapsedSinceStart = time - startTime;

                // Part 1: The sequential colored splashes.
                if (sequenceIndex < sequenceColors.length && time - lastSequenceSpawn > sequenceInterval) {
                    lastSequenceSpawn = time;
                    stars.push({
                        x: THREE.MathUtils.randFloatSpread(FULL_BOARD_WIDTH),
                        z: THREE.MathUtils.randFloatSpread(FULL_BOARD_DEPTH),
                        startTime: time,
                        duration: sequenceInterval * 0.9, // Lasts for most of the interval
                        peak: 0.8, // Make them bright
                        color: sequenceColors[sequenceIndex],
                    });
                    sequenceIndex++;
                }

                // Part 2: After the sequence, transition to more subtle, random sparkles.
                const randomSparkleStartTime = sequenceColors.length * sequenceInterval + 1000; // Start after a small delay
                if (elapsedSinceStart > randomSparkleStartTime) {
                    if (time - lastSpawn > spawnInterval && stars.length < maxStars) {
                        lastSpawn = time;
                        stars.push({
                            x: THREE.MathUtils.randFloatSpread(FULL_BOARD_WIDTH),
                            z: THREE.MathUtils.randFloatSpread(FULL_BOARD_DEPTH),
                            startTime: time,
                            duration: THREE.MathUtils.randFloat(3000, 6000),
                            peak: THREE.MathUtils.randFloat(0.3, 0.7),
                            color: new THREE.Color(0xffffff), // Just white sparkles
                        });
                    }
                }
    
                // Remove old stars that have faded out
                for (let i = stars.length - 1; i >= 0; i--) {
                    if (time > stars[i].startTime + stars[i].duration) {
                        stars.splice(i, 1);
                    }
                }
                
                finalColor.setRGB(0, 0, 0);
                let totalIntensity = 0;
    
                // Update and blend colors from existing stars
                for (const star of stars) {
                    const dist = Math.hypot(position.x - star.x, position.z - star.z);
                    const starRadius = 4.0; // Widened for noticeability
                    if (dist < starRadius) { 
                        const lifeProgress = (time - star.startTime) / star.duration;
                        const brightness = Math.sin(lifeProgress * Math.PI) * star.peak; // Fade in and out
                        const falloff = Math.pow(1 - dist / starRadius, 2);
                        finalColor.add(star.color.clone().multiplyScalar(brightness * falloff));
                        totalIntensity += brightness * falloff;
                    }
                }
    
                return totalIntensity > 0 ? finalColor : null;
            },
            isFinished: () => false,
        };
    }

    private createCenterOutwardPulse(color: THREE.Color, duration: number, waveWidth: number): LightEffect {
        const id = ++this.effectIdCounter;
        const startTime = performance.now();
        const finalColor = new THREE.Color().copy(color);
        const center = new THREE.Vector3(0, 0, 0);
    
        return {
            id, startTime, duration, type: 'event',
            update: (time, position) => {
                const elapsed = time - startTime;
                if (elapsed < 0) return null;
                const progress = elapsed / duration;
                if (progress > 1) return null;
    
                const maxDist = (FULL_BOARD_WIDTH / 2) * 1.2; // Go a bit beyond the edge
                const wavePosition = progress * maxDist;
                const distance = position.distanceTo(center);
                const delta = distance - wavePosition;
    
                if (delta <= 0 && delta > -waveWidth) {
                    const intensity = 1.0 - (Math.abs(delta) / waveWidth);
                    const fade = Math.sin(progress * Math.PI);
                    return finalColor.clone().multiplyScalar(intensity * fade);
                }
                return null;
            },
            isFinished: (time) => time > startTime + duration,
        };
    }

    private createShowSequencer(): LightEffect {
        const id = ++this.effectIdCounter;
        const startTime = performance.now();
        
        const movementDefinitions = [
            { // Movement 1: Overture - Calm, mysterious, anticipatory.
                duration: 20000,
                effectGenerators: [() => this.createBreathingEffect(), () => this.createStarlightEffect()]
            },
            { // Movement 2: Allegro - Building energy and motion.
                duration: 20000,
                effectGenerators: [() => this.createPerimeterChaseEffect(), () => this.createTriScannerEffect()]
            },
            { // Movement 3: Adagio - Lyrical, beautiful, and serene.
                duration: 24000,
                effectGenerators: [() => this.createStaticRainbowEffect()]
            },
            { // Movement 4: Finale - High energy, vibrant, and chaotic.
                duration: 20000,
                effectGenerators: [() => this.createRainbowSpinnerEffect(), () => this.createGlobalPulseEffect()]
            },
            { // Coda/Reset: A grand, cleansing pulse to end the symphony.
                duration: 4000,
                effectGenerators: [() => this.createCenterOutwardPulse(new THREE.Color(0xffffff), 4000, 8)]
            }
        ];
        const totalDuration = movementDefinitions.reduce((sum, m) => sum + m.duration, 0);
    
        // This state will be managed by the returned LightEffect
        const sequencerState = {
            currentMovementIndex: -1,
            activeEffects: [] as LightEffect[],
        };
    
        const finalColor = new THREE.Color();
    
        return {
            id, startTime, duration: Infinity, type: 'ambient',
            update: (time, position, index, speedMps) => {
                const elapsed = time - startTime;
                const cycleTime = elapsed % totalDuration;
    
                let accumulatedTime = 0;
                let nextMovementIndex = 0;
                for(const movement of movementDefinitions) {
                    if (cycleTime < accumulatedTime + movement.duration) {
                        break;
                    }
                    accumulatedTime += movement.duration;
                    nextMovementIndex++;
                }
                
                if (sequencerState.currentMovementIndex !== nextMovementIndex) {
                    sequencerState.currentMovementIndex = nextMovementIndex;
                    sequencerState.activeEffects = movementDefinitions[nextMovementIndex].effectGenerators.map(gen => gen());
                }
    
                finalColor.setRGB(0, 0, 0);
                
                // Clean up any event-type effects that have finished before updating
                sequencerState.activeEffects = sequencerState.activeEffects.filter((e: LightEffect) => !e.isFinished(time));
    
                for (const effect of sequencerState.activeEffects) {
                    const effectColor = effect.update(time, position, index, speedMps);
                    if (effectColor) {
                        finalColor.add(effectColor);
                    }
                }
                
                return finalColor.getHex() > 0 ? finalColor : null;
            },
            isFinished: () => false,
        };
    }

    private createDualSpotlightEffect(): LightEffect {
        const startTime = performance.now();
        const colors = [new THREE.Color(0x00ffff), new THREE.Color(0xff00ff)];
        const spotlights = [
            { current: new THREE.Vector3(), target: new THREE.Vector3(), radius: 5 },
            { current: new THREE.Vector3(), target: new THREE.Vector3(), radius: 5 },
        ];
        
        const boardMin = -FULL_BOARD_WIDTH / 2 + 0.5;
        const boardMax = FULL_BOARD_WIDTH / 2 - 0.5;
        
        const pickNewTarget = () => new THREE.Vector3(
            THREE.MathUtils.randFloat(boardMin, boardMax),
            0,
            THREE.MathUtils.randFloat(boardMin, boardMax)
        );

        spotlights.forEach(s => {
            s.current.copy(pickNewTarget());
            s.target.copy(pickNewTarget());
        });

        let lastMoveTime = startTime;
        const moveDuration = 3000;

        const finalColor = new THREE.Color();

        return {
            id: ++this.effectIdCounter, startTime, duration: Infinity, type: 'spotlight',
            update: (time, position) => {
                const timeSinceMove = time - lastMoveTime;

                if (timeSinceMove > moveDuration) {
                    lastMoveTime = time;
                    spotlights.forEach(s => {
                        s.current.copy(s.target);
                        s.target.copy(pickNewTarget());
                    });
                }

                const t = Math.min(timeSinceMove / moveDuration, 1.0);
                const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

                finalColor.setRGB(0, 0, 0);
                let totalIntensity = 0;

                spotlights.forEach((spotlight, i) => {
                    const lerpedPos = spotlight.current.clone().lerp(spotlight.target, easeT);
                    const distance = Math.hypot(lerpedPos.x - position.x, lerpedPos.z - position.z);

                    if (distance < spotlight.radius) {
                        const intensity = Math.pow(1 - (distance / spotlight.radius), 2);
                        finalColor.add(colors[i].clone().multiplyScalar(intensity));
                        totalIntensity += intensity;
                    }
                });

                return totalIntensity > 0 ? finalColor : null;
            },
            isFinished: () => false,
        };
    }

    private createLevelUpEffect(): LightEffect {
        const id = ++this.effectIdCounter;
        const startTime = performance.now();
        const duration = 1500;
        const color = new THREE.Color(0xffffff);
        return {
            id, startTime, duration, type: 'event',
            update: (time, position) => {
                const elapsed = time - startTime;
                const progress = elapsed / duration;
                const distance = Math.hypot(position.x, position.z);
                const waveSpeed = 40;
                const wavePosition = progress * waveSpeed;
                const waveWidth = 4.0;
                const delta = distance - wavePosition;
                if (delta <= 0 && delta > -waveWidth) {
                    const intensity = 1.0 - (Math.abs(delta) / waveWidth);
                    const fade = Math.sin(progress * Math.PI);
                    return color.clone().multiplyScalar(intensity * fade);
                }
                return null;
            },
            isFinished: (time) => time > startTime + duration,
        };
    }
    
    private createRippleEffect(origin: Point3D, fruitType: FruitType, delay: number = 0, isSpecialMagnetRipple: boolean = false): LightEffect {
        const id = ++this.effectIdCounter;
        const startTime = performance.now() + delay;
        
        // Default values
        let duration = 1000;
        let color = new THREE.Color(FRUIT_COLORS[fruitType]);
        let waveSpeed = 20;
        let waveWidth = 3.0;
        
        // Magnet-specific ripple properties
        if (isSpecialMagnetRipple) {
            duration = 2000; // Slower speed means longer duration to cover the same area.
            waveSpeed = 10; // "twice as slow"
            waveWidth = 5.0; // "nice wide band"
            color = new THREE.Color(FRUIT_COLORS[FruitType.MAGNET]); // Ensure it's purple
        }
    
        const originVec = new THREE.Vector3(origin.x + offsetX, origin.y, origin.z + offsetZ);
        
        return {
            id, startTime, duration, type: 'event',
            update: (time, position) => {
                const elapsed = time - startTime;
                if (elapsed < 0) return null;
    
                const progress = elapsed / duration;
                if (progress > 1) return null;
    
                const distance = Math.hypot(position.x - originVec.x, position.z - originVec.z);
                const wavePosition = (elapsed / 1000) * waveSpeed;
                
                const delta = distance - wavePosition;
                
                // For a band, we check if the distance is within the wave's expanding edge
                if (delta <= 0 && delta > -waveWidth) {
                    const intensity = 1.0 - (Math.abs(delta) / waveWidth);
                    const fade = 1.0 - progress;
                    
                    let finalIntensity = intensity * fade;
                    if (isSpecialMagnetRipple) {
                        // "not too bright for the bloom to wash it to white"
                        finalIntensity *= 0.7; 
                    }
                    
                    return color.clone().multiplyScalar(finalIntensity);
                }
                return null;
            },
            isFinished: (time) => time > startTime + duration,
        };
    }

    private createWakeEffect(origin: Point3D, portalType: 'Red' | 'Blue'): LightEffect {
        const id = ++this.effectIdCounter;
        const startTime = performance.now();
        const duration = 1200;
        const color = portalType === 'Red' ? new THREE.Color(0xff4444) : new THREE.Color(0x4444ff);
        const originVec = new THREE.Vector3(origin.x + offsetX, 0, origin.z + offsetZ);

        return {
            id, startTime, duration, type: 'event',
            update: (time, position) => {
                const elapsed = time - startTime;
                if (elapsed < 0) return null;
                const progress = elapsed / duration;
                const waveSpeed = 30;
                const wavePosition = progress * waveSpeed;
                const waveWidth = 2.0;
                const distance = Math.hypot(position.x - originVec.x, position.z - originVec.z);
                const delta = Math.abs(distance - wavePosition);
                
                if (delta < waveWidth / 2) {
                    const intensity = 1.0 - (delta / (waveWidth / 2));
                    const fade = Math.sin(progress * Math.PI);
                    return color.clone().multiplyScalar(intensity * fade * 1.5);
                }
                return null;
            },
            isFinished: (time) => time > startTime + duration,
        };
    }

    private createStreetPassageGlowEffect(fruitType: FruitType): LightEffect {
        const id = ++this.effectIdCounter;
        const color = fruitType === FruitType.EXTRA_LIFE ? new THREE.Color(FRUIT_COLORS[FruitType.EXTRA_LIFE]) : new THREE.Color(FRUIT_COLORS[FruitType.TRIPLE]);
        
        return {
            id,
            startTime: performance.now(),
            duration: Infinity,
            type: 'passageGlow',
            update: (time, position, index) => {
                let finalColor: THREE.Color | null = null;
    
                if (index !== undefined && this.streetBoundaryIndices.has(index)) {
                    const pulse = 0.7 + (Math.sin(time * 0.005) + 1) * 0.15;
                    finalColor = color.clone().multiplyScalar(pulse);
                }
    
                const gridX = Math.round(position.x - offsetX);
                const gridZ = Math.round(position.z - offsetZ);
                
                const isVertexInStreet = 
                    isStreetPassageBlock(gridX, gridZ, this.layoutDetails!.street) || 
                    isStreetPassageBlock(gridX - 1, gridZ, this.layoutDetails!.street) ||
                    isStreetPassageBlock(gridX, gridZ - 1, this.layoutDetails!.street) ||
                    isStreetPassageBlock(gridX - 1, gridZ - 1, this.layoutDetails!.street);
    
                if (isVertexInStreet) {
                    const pulse = 0.15 + (Math.sin(time * 0.005) + 1) * 0.05;
                    const areaColor = color.clone().multiplyScalar(pulse);
                    
                    if (finalColor) {
                        finalColor.add(areaColor);
                    } else {
                        finalColor = areaColor;
                    }
                }
    
                return finalColor;
            },
            isFinished: () => false,
        };
    }

    private createRunwayEffect(origin: Point3D, rotation: number): LightEffect {
        const id = ++this.effectIdCounter;
        const startTime = performance.now();
        const duration = 1000;
        const color = new THREE.Color(0x00ffff).multiplyScalar(1.5); // Brighter cyan
        const originGrid = { x: origin.x, z: origin.z };
        const forwardVec = { x: -Math.round(Math.sin(rotation)), z: -Math.round(Math.cos(rotation)) };
        const rightVec = { x: -forwardVec.z, z: forwardVec.x };
    
        // Common logic for calculating intensity based on position in the wave
        const calculateIntensity = (time: number, gridX: number, gridZ: number): number | null => {
            const elapsed = time - startTime;
            if (elapsed < 0) return null;
    
            const progress = elapsed / duration;
            if (progress > 1) return null;
    
            const pathLength = 20.0;
            const patchCenterDist = progress * pathLength;
            
            const relativePos = { x: gridX - originGrid.x, z: gridZ - originGrid.z };
            
            const distAlongPath = relativePos.x * forwardVec.x + relativePos.z * forwardVec.z;
            const distFromCenterline = Math.abs(relativePos.x * rightVec.x + relativePos.z * rightVec.z);
    
            const runwayWidth = 1.5;
            const patchLength = 3.0;
    
            // Make sure we are only looking forward from the turn point
            if (distAlongPath < -patchLength / 2 || distFromCenterline > runwayWidth) {
                return null;
            }
    
            const delta = Math.abs(distAlongPath - patchCenterDist);
    
            if (delta < patchLength / 2) {
                // Intensity fades as the wave moves forward and based on distance from the wave's center
                const intensity = (1 - (delta / (patchLength / 2))) * (1 - progress * 0.75);
                return intensity;
            }
            
            return null;
        };
    
        return {
            id, startTime, duration, type: 'event',
            isFinished: (time) => time > startTime + duration,
            
            // This method will be called for both grid line vertices and building instance centers
            update: (time, worldPosition) => {
                const gridX = Math.round(worldPosition.x - offsetX);
                const gridZ = Math.round(worldPosition.z - offsetZ);
    
                const intensity = calculateIntensity(time, gridX, gridZ);
                
                if (intensity !== null && intensity > 0) {
                    return color.clone().multiplyScalar(intensity);
                }
                
                return null;
            },
    
            // This method is called for the board tiles
            updateTile: (time, gridX, gridZ) => {
                const intensity = calculateIntensity(time, gridX, gridZ);
                if (intensity !== null && intensity > 0) {
                    return color.clone().multiplyScalar(intensity);
                }
                return null;
            },
        };
    }
}
