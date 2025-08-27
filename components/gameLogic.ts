import { Point3D, Fruit, LayoutDetails, AlcoveDetails, StreetPassageDetails, Portal, BillboardDetails, FlyerDetails, BannerDetails, BuildingDetails } from '../types';
import { BOARD_WIDTH, BOARD_DEPTH, FULL_BOARD_WIDTH, FULL_BOARD_DEPTH } from '../constants';

const WALL_THICKNESS = (FULL_BOARD_WIDTH - BOARD_WIDTH) / 2;

/**
 * Checks if a given coordinate is part of the recessed alcove passage.
 */
export const isAlcoveBlock = (x: number, z: number, details: AlcoveDetails): boolean => {
  const { wall, door1, door2 } = details;
  const minDoor = Math.min(door1, door2) + WALL_THICKNESS;
  const maxDoor = Math.max(door1, door2) + WALL_THICKNESS;

  switch (wall) {
    case 'N': return z === 2 && x >= minDoor && x <= maxDoor;
    case 'S': return z === FULL_BOARD_DEPTH - 3 && x >= minDoor && x <= maxDoor;
    case 'W': return x === 2 && z >= minDoor && z <= maxDoor;
    case 'E': return x === FULL_BOARD_WIDTH - 3 && z >= minDoor && z <= maxDoor;
  }
  return false;
};

/**
 * Checks if a given coordinate is part of the U-shaped street passage.
 */
export const isStreetPassageBlock = (x: number, z: number, details: StreetPassageDetails): boolean => {
  const { wall, entry, exit } = details;
  const minPos = Math.min(entry, exit) + WALL_THICKNESS;
  const maxPos = Math.max(entry, exit) + WALL_THICKNESS;

  switch (wall) {
    case 'N': return (z === 1 && x >= minPos && x <= maxPos) || (z === 2 && (x === minPos || x === maxPos));
    case 'S': return (z === FULL_BOARD_DEPTH - 2 && x >= minPos && x <= maxPos) || (z === FULL_BOARD_DEPTH - 3 && (x === minPos || x === maxPos));
    case 'W': return (x === 1 && z >= minPos && z <= maxPos) || (x === 2 && (z === minPos || z === maxPos));
    case 'E': return (x === FULL_BOARD_WIDTH - 2 && z >= minPos && z <= maxPos) || (x === FULL_BOARD_WIDTH - 3 && (z === minPos || z === maxPos));
  }
  return false;
};

/**
 * Checks if a coordinate is part of the billboard base.
 */
export const isBillboardBlock = (x: number, z: number, details: BillboardDetails): boolean => {
  if (!details) return false;
  const { x: startX, z: startZ, wall } = details;
  if (wall === 'N' || wall === 'S') {
    return z === startZ && x >= startX && x < startX + 3;
  } else { // W or E
    return x === startX && z >= startZ && z < startZ + 3;
  }
};


/**
 * Checks if a given coordinate is a portal block.
 * @returns The Portal object if it's a portal block, otherwise null.
 */
export const isPortalBlock = (p: Point3D, portals: Portal[]): Portal | null => {
  for (const portal of portals) {
    const { wall, position } = portal;
    const absPos = position + WALL_THICKNESS;

    let isMatch = false;
    switch (wall) {
      case 'N': isMatch = p.z === 2 && p.x === absPos; break;
      case 'S': isMatch = p.z === FULL_BOARD_DEPTH - 3 && p.x === absPos; break;
      case 'W': isMatch = p.x === 2 && p.z === absPos; break;
      case 'E': isMatch = p.x === FULL_BOARD_WIDTH - 3 && p.z === absPos; break;
    }
    if (isMatch) return portal;
  }
  return null;
};

/**
 * Gets the absolute board coordinates of a portal block for rendering.
 */
export const getPortalAbsolutePosition = (details: Portal): Point3D => {
  const { wall, position } = details;
  const absPos = position + WALL_THICKNESS;
  
  switch (wall) {
    case 'N': return { x: absPos, y: 1, z: 2 };
    case 'S': return { x: absPos, y: 1, z: FULL_BOARD_DEPTH - 3 };
    case 'W': return { x: 2, y: 1, z: absPos };
    case 'E': return { x: FULL_BOARD_WIDTH - 3, y: 1, z: absPos };
  }
};

/**
 * Provides the exact emergence position and rotation for a snake exiting a portal.
 */
export const getPortalEmergence = (enteredPortal: Portal, allPortals: Portal[]): { pos: Point3D, rot: number } => {
    const exitPortal = allPortals.find(p => p.type === enteredPortal.type && p.id !== enteredPortal.id)!;
    
    const { wall, position } = exitPortal;
    const absPos = position + WALL_THICKNESS;

    // Note on rotation based on game tick logic `newHead = { x: head.x - sin(rot), z: head.z - cos(rot) }`:
    // 0:           Moves towards -Z (North)
    // Math.PI:     Moves towards +Z (South)
    // Math.PI / 2: Moves towards -X (West)
    // -Math.PI / 2: Moves towards +X (East)
    
    switch (wall) {
        case 'N': // Emerges from North wall (low Z), moving South (away from wall, towards +Z).
            return { pos: { x: absPos, y: 1, z: 3 }, rot: Math.PI };
        case 'S': // Emerges from South wall (high Z), moving North (away from wall, towards -Z).
            return { pos: { x: absPos, y: 1, z: FULL_BOARD_DEPTH - 4 }, rot: 0 };
        case 'W': // Emerges from West wall (low X), moving East (away from wall, towards +X).
            return { pos: { x: 3, y: 1, z: absPos }, rot: -Math.PI / 2 };
        case 'E': // Emerges from East wall (high X), moving West (away from wall, towards -X).
            return { pos: { x: FULL_BOARD_WIDTH - 4, y: 1, z: absPos }, rot: Math.PI / 2 };
    }
}

/**
 * Checks if a given coordinate corresponds to a solid wall block.
 * This is the non-traversable perimeter part.
 */
export const isWall = (p: Point3D, layoutDetails: Omit<LayoutDetails, 'flyers' | 'banners' | 'buildings'> | null): boolean => {
  if (!layoutDetails) {
    return p.x < WALL_THICKNESS || p.x >= FULL_BOARD_WIDTH - WALL_THICKNESS || 
           p.z < WALL_THICKNESS || p.z >= FULL_BOARD_DEPTH - WALL_THICKNESS;
  }

  // The secret chamber below the billboard is not a wall.
  if (isBillboardBlock(p.x, p.z, layoutDetails.billboard)) {
    return false;
  }

  const isPerimeter = p.x < WALL_THICKNESS || p.x >= FULL_BOARD_WIDTH - WALL_THICKNESS || 
                      p.z < WALL_THICKNESS || p.z >= FULL_BOARD_DEPTH - WALL_THICKNESS;

  if (!isPerimeter) return false; // Not in a wall area at all

  const inAlcove = isAlcoveBlock(p.x, p.z, layoutDetails.alcove);
  const inStreet = isStreetPassageBlock(p.x, p.z, layoutDetails.street);
  const inPortal = !!isPortalBlock(p, layoutDetails.portals);
  
  // It's a solid wall if it's on the perimeter AND not part of any defined passage.
  return !inAlcove && !inStreet && !inPortal;
};


/**
 * Generates random details for all wall features on four different walls.
 */
export const generateLayoutDetails = (): LayoutDetails => {
    const walls = ['N', 'S', 'E', 'W'] as const;
    const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    const shuffledWalls = shuffle([...walls]);

    const wallAssignments = {
      street: shuffledWalls[0],
      alcove: shuffledWalls[1],
      doublePortal: shuffledWalls[2],
      billboard: shuffledWalls[3],
    };

    const playableWallLength = BOARD_WIDTH; // 20
    const minGap = 5;

    const makePassage = (wall: string) => {
        const pos1 = Math.floor(Math.random() * (playableWallLength - minGap - 2));
        const pos2 = pos1 + minGap + 1 + Math.floor(Math.random() * (playableWallLength - (pos1 + minGap + 1) - 1));
        return { pos1, pos2 };
    };
    const alcovePassage = makePassage(wallAssignments.alcove);
    const streetPassage = makePassage(wallAssignments.street);
    const alcove: AlcoveDetails = { wall: wallAssignments.alcove, door1: alcovePassage.pos1, door2: alcovePassage.pos2 };
    const street: StreetPassageDetails = { wall: wallAssignments.street, entry: streetPassage.pos1, exit: streetPassage.pos2 };

    const billboardStartPos = Math.floor(Math.random() * (playableWallLength - 3));
    let billboard: BillboardDetails;
    const billboardWall = wallAssignments.billboard;
    // Place billboard base on the *inner* side of the perimeter wall, facing the play area
    if (billboardWall === 'N') {
        billboard = { x: billboardStartPos + WALL_THICKNESS, z: WALL_THICKNESS - 1, wall: 'N' };
    } else if (billboardWall === 'S') {
        billboard = { x: billboardStartPos + WALL_THICKNESS, z: FULL_BOARD_DEPTH - WALL_THICKNESS, wall: 'S' };
    } else if (billboardWall === 'W') {
        billboard = { x: WALL_THICKNESS - 1, z: billboardStartPos + WALL_THICKNESS, wall: 'W' };
    } else { // E
        billboard = { x: FULL_BOARD_WIDTH - WALL_THICKNESS, z: billboardStartPos + WALL_THICKNESS, wall: 'E' };
    }

    const portals: Portal[] = [];
    const findAvailablePortalSpot = (wall: string, takenSpots: number[] = []) => {
        let pos;
        let isOccupied = false;
        do {
            isOccupied = false;
            pos = Math.floor(Math.random() * playableWallLength);
            if (takenSpots.some(p => Math.abs(p-pos) < 2)) isOccupied = true;
        } while (isOccupied);
        return pos;
    };
    const doublePortalWall = wallAssignments.doublePortal;
    const p1 = findAvailablePortalSpot(doublePortalWall);
    const p2 = findAvailablePortalSpot(doublePortalWall, [p1]);
    portals.push({ id: 'Red-0', type: 'Red', wall: doublePortalWall, position: p1 });
    portals.push({ id: 'Blue-0', type: 'Blue', wall: doublePortalWall, position: p2 });
    const findSpotOnPassageWall = (passageDetails: AlcoveDetails | StreetPassageDetails) => {
        const passageMin = 'door1' in passageDetails ? Math.min(passageDetails.door1, passageDetails.door2) : Math.min(passageDetails.entry, passageDetails.exit);
        const passageMax = 'door1' in passageDetails ? Math.max(passageDetails.door1, passageDetails.door2) : Math.max(passageDetails.entry, passageDetails.exit);
        const availableSpots: number[] = [];
        for (let i = 0; i < playableWallLength; i++) {
            if (i < passageMin || i > passageMax) availableSpots.push(i);
        }
        return availableSpots[Math.floor(Math.random() * availableSpots.length)];
    };
    const p3 = findSpotOnPassageWall(street);
    portals.push({ id: 'Red-1', type: 'Red', wall: street.wall, position: p3 });
    const p4 = findSpotOnPassageWall(alcove);
    portals.push({ id: 'Blue-1', type: 'Blue', wall: alcove.wall, position: p4 });
    
    const buildings: BuildingDetails[] = [];
    const occupiedSpots: { [key in 'N' | 'S' | 'E' | 'W']: Set<number> } = { N: new Set(), S: new Set(), E: new Set(), W: new Set() };
    const markOccupied = (wall: 'N'|'S'|'E'|'W', position: number, buffer: number = 1) => {
        for (let i = position - buffer; i <= position + buffer; i++) {
            if (i >= 0 && i < playableWallLength) occupiedSpots[wall].add(i);
        }
    };
    [...portals].forEach(p => markOccupied(p.wall, p.position));
    [alcove, street].forEach(p => {
        const start = 'door1' in p ? p.door1 : p.entry;
        const end = 'door1' in p ? p.door2 : p.exit;
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) occupiedSpots[p.wall].add(i);
    });
    const bStart = billboard.wall === 'N' || billboard.wall === 'S' ? billboard.x - WALL_THICKNESS : billboard.z - WALL_THICKNESS;
    for(let i = bStart; i < bStart + 3; i++) markOccupied(billboard.wall, i, 2);

    const partialLayoutForWallCheck = { alcove, street, portals, billboard };
    const perimeterBlocks: {x: number, z: number}[] = []; 
    for (let x = 0; x < FULL_BOARD_WIDTH; x++) {
        for (let z = 0; z < FULL_BOARD_DEPTH; z++) {
            if (isWall({ x, y: 1, z }, partialLayoutForWallCheck)) {
                perimeterBlocks.push({ x, z });
            }
        }
    }

    const skyscraperPlacements = new Map<number, 'snake' | 'quantum'>();
    const availableForSkyscraper = Array.from(Array(perimeterBlocks.length).keys());
    if (availableForSkyscraper.length > 1) {
      for (let i = availableForSkyscraper.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [availableForSkyscraper[i], availableForSkyscraper[j]] = [availableForSkyscraper[j], availableForSkyscraper[i]]; }
      const index1 = availableForSkyscraper.pop()!;
      skyscraperPlacements.set(index1, 'snake');
      const pos1 = perimeterBlocks[index1];
      const secondIndexPosition = availableForSkyscraper.findIndex(idx => { const pos2 = perimeterBlocks[idx]; return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.z - pos2.z) > 1; });
      let index2;
      if (secondIndexPosition !== -1) index2 = availableForSkyscraper.splice(secondIndexPosition, 1)[0];
      else index2 = availableForSkyscraper.pop()!;
      skyscraperPlacements.set(index2, 'quantum');
    }

    const regularBuildingIndices = perimeterBlocks.map((_, i) => i).filter(i => !skyscraperPlacements.has(i)); for (let i = regularBuildingIndices.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [regularBuildingIndices[i], regularBuildingIndices[j]] = [regularBuildingIndices[j], regularBuildingIndices[i]]; } const towerIndices = new Set(regularBuildingIndices.slice(0, 4));
    const passageWall = street.wall; let searchlightTowerIndex = -1; const searchlightCandidatesIndices = regularBuildingIndices.filter(i => { if (towerIndices.has(i)) return false; const p = perimeterBlocks[i]; if (passageWall === 'N') return p.z < WALL_THICKNESS; if (passageWall === 'S') return p.z >= FULL_BOARD_DEPTH - WALL_THICKNESS; if (passageWall === 'W') return p.x < WALL_THICKNESS; if (passageWall === 'E') return p.x >= FULL_BOARD_WIDTH - WALL_THICKNESS; return false; }); if (searchlightCandidatesIndices.length > 0) { const randomIndexInCandidates = Math.floor(Math.random() * searchlightCandidatesIndices.length); searchlightTowerIndex = searchlightCandidatesIndices[randomIndexInCandidates]; }
    
    perimeterBlocks.forEach((pos, index) => {
        let building: BuildingDetails;
        if (skyscraperPlacements.has(index)) {
            const variant = skyscraperPlacements.get(index)!;
            building = { x: pos.x, z: pos.z, height: 6, type: variant === 'snake' ? 'snake-tower' : 'skyscraper-quantum', roofType: 'flat' };
        } else if (index === searchlightTowerIndex) {
            building = { x: pos.x, z: pos.z, height: 4, type: 'searchlight-tower', roofType: 'flat' };
        } else if (towerIndices.has(index)) {
            building = { x: pos.x, z: pos.z, height: 1, type: 'transmission-tower', roofType: 'flat' };
        } else {
            const { x, z } = pos;
            const innerX1 = WALL_THICKNESS - 1;
            const innerX2 = FULL_BOARD_WIDTH - WALL_THICKNESS;
            const innerZ1 = WALL_THICKNESS - 1;
            const innerZ2 = FULL_BOARD_DEPTH - WALL_THICKNESS;
            const outerX1 = 0;
            const outerX2 = FULL_BOARD_WIDTH - 1;
            const outerZ1 = 0;
            const outerZ2 = FULL_BOARD_DEPTH - 1;
            
            let layer: 'inner' | 'middle' | 'outer';
            if (x === innerX1 || x === innerX2 || z === innerZ1 || z === innerZ2) {
                layer = 'inner';
            } else if (x === outerX1 || x === outerX2 || z === outerZ1 || z === outerZ2) {
                layer = 'outer';
            } else {
                layer = 'middle';
            }

            let height: number;
            switch (layer) {
                case 'inner':
                    height = 1.0 + Math.random() * 1.5; // Range [1.0, 2.5]
                    break;
                case 'middle':
                    height = 1.5 + Math.random() * 2.0; // Range [1.5, 3.5]
                    break;
                case 'outer':
                    height = 1.5 + Math.random() * 3.0; // Range [1.5, 4.5]
                    break;
            }

            const roofRand = Math.random();
            let roofType: BuildingDetails['roofType'];
            if (roofRand < 0.5) roofType = 'flat';
            else if (roofRand < 0.625) roofType = 'apex';
            else if (roofRand < 0.75) roofType = 'slanted';
            else roofType = 'pyramid';
            building = { x: pos.x, z: pos.z, height, type: 'regular', roofType };
        }
        buildings.push(building);
    });

    const buildingMap = new Map<string, BuildingDetails>();
    buildings.forEach(b => buildingMap.set(`${b.x},${b.z}`, b));
    
    const banners: BannerDetails[] = [];
    const spotsByWall: { [key in 'N'|'S'|'E'|'W']: { wall: 'N'|'S'|'E'|'W', position: number, isAlcoveSpot?: boolean, isStreetIsland?: boolean }[] } = { N: [], S: [], E: [], W: [] };
    walls.forEach(wall => {
        for (let i = 1; i < playableWallLength - 1; i++) if (!occupiedSpots[wall].has(i)) spotsByWall[wall].push({ wall, position: i });
        if (wall === alcove.wall) {
            const minDoor = Math.min(alcove.door1, alcove.door2);
            const maxDoor = Math.max(alcove.door1, alcove.door2);
            for (let i = minDoor + 1; i < maxDoor; i++) spotsByWall[wall].push({ wall, position: i, isAlcoveSpot: true });
        }
        if (wall === street.wall) {
            const minEntry = Math.min(street.entry, street.exit);
            const maxEntry = Math.max(street.entry, street.exit);
            for (let i = minEntry + 1; i < maxEntry; i++) spotsByWall[wall].push({ wall, position: i, isStreetIsland: true });
        }
    });
    walls.forEach(wall => { spotsByWall[wall] = shuffle(spotsByWall[wall]); });
    const paidBannerCounts = shuffle([5, 5, 6, 6]);
    walls.forEach((wall, index) => {
        const count = paidBannerCounts[index];
        for (let i = 0; i < count; i++) {
            const spot = spotsByWall[wall].pop();
            if (spot) banners.push({ type: 'paid', wall: spot.wall, position: spot.position, height: 1.5 + Math.random() * 0.4, isAlcoveSpot: spot.isAlcoveSpot, isStreetIsland: spot.isStreetIsland });
        }
    });

    // --- COSMETIC BANNER PLACEMENT ---
    const cosmeticBannerSpots: { wall: 'N'|'S'|'E'|'W', position: number, isAlcoveSpot?: boolean, isStreetIsland?: boolean }[] = [];
    const cosmeticBannerCount = 6;

    const availableCosmeticSpotsByWall: { [key in 'N'|'S'|'E'|'W']: { wall: 'N'|'S'|'E'|'W', position: number, isAlcoveSpot?: boolean, isStreetIsland?: boolean }[] } = { N: [], S: [], E: [], W: [] };
    walls.forEach(wall => {
        for (let i = 0; i < playableWallLength; i++) {
            if (occupiedSpots[wall].has(i)) continue;

            let buildingX: number, buildingZ: number;
            const posOnGrid = i + WALL_THICKNESS;
            switch(wall) {
                case 'N': buildingX = posOnGrid; buildingZ = WALL_THICKNESS - 1; break;
                case 'S': buildingX = posOnGrid; buildingZ = FULL_BOARD_DEPTH - WALL_THICKNESS; break;
                case 'W': buildingX = WALL_THICKNESS - 1; buildingZ = posOnGrid; break;
                case 'E': buildingX = FULL_BOARD_WIDTH - WALL_THICKNESS; buildingZ = posOnGrid; break;
            }
            const building = buildingMap.get(`${buildingX},${buildingZ}`);
            
            if (building && building.type === 'regular' && building.height >= 2.5) {
                availableCosmeticSpotsByWall[wall].push({ wall, position: i });
            }
        }

        if (wall === alcove.wall) {
            const minDoor = Math.min(alcove.door1, alcove.door2);
            const maxDoor = Math.max(alcove.door1, alcove.door2);
            for (let i = minDoor + 1; i < maxDoor; i++) {
                 availableCosmeticSpotsByWall[wall].push({ wall, position: i, isAlcoveSpot: true });
            }
        }
        if (wall === street.wall) {
            const minEntry = Math.min(street.entry, street.exit);
            const maxEntry = Math.max(street.entry, street.exit);
            for (let i = minEntry + 1; i < maxEntry; i++) {
                 availableCosmeticSpotsByWall[wall].push({ wall, position: i, isStreetIsland: true });
            }
        }
    });

    for (let i = 0; i < cosmeticBannerCount; i++) {
        const wallsWithSpots = walls.filter(w => availableCosmeticSpotsByWall[w].length > 0);
        if (wallsWithSpots.length === 0) break;

        const randomWall = wallsWithSpots[Math.floor(Math.random() * wallsWithSpots.length)];
        const spotIndex = Math.floor(Math.random() * availableCosmeticSpotsByWall[randomWall].length);
        const chosenSpot = availableCosmeticSpotsByWall[randomWall][spotIndex];

        cosmeticBannerSpots.push(chosenSpot);

        const positionToRemove = chosenSpot.position;
        availableCosmeticSpotsByWall[randomWall] = availableCosmeticSpotsByWall[randomWall].filter(
            spot => Math.abs(spot.position - positionToRemove) > 1
        );
    }

    for (const spot of cosmeticBannerSpots) {
        let height: number;
        if (spot.isAlcoveSpot || spot.isStreetIsland) {
            height = 2.5;
        } else {
            let buildingX: number, buildingZ: number;
            const posOnGrid = spot.position + WALL_THICKNESS;
            switch(spot.wall) {
                case 'N': buildingX = posOnGrid; buildingZ = WALL_THICKNESS - 1; break;
                case 'S': buildingX = posOnGrid; buildingZ = FULL_BOARD_DEPTH - WALL_THICKNESS; break;
                case 'W': buildingX = WALL_THICKNESS - 1; buildingZ = posOnGrid; break;
                case 'E': buildingX = FULL_BOARD_WIDTH - WALL_THICKNESS; buildingZ = posOnGrid; break;
            }
            const building = buildingMap.get(`${buildingX},${buildingZ}`);
            if (building) {
                const buildingTopY = 0.5 + building.height;
                const bannerHalfHeight = 0.3; // Cosmetic banner height is 0.6
                height = buildingTopY - bannerHalfHeight - 0.1;
            } else {
                height = 2.5;
            }
        }
        banners.push({ type: 'cosmetic', wall: spot.wall, position: spot.position, height, isAlcoveSpot: spot.isAlcoveSpot, isStreetIsland: spot.isStreetIsland });
    }
    
    // --- ROBUST FLYER GENERATION LOGIC ---
    const flyers: FlyerDetails[] = [];
    const flyerCounts = shuffle([5, 5, 6, 6]);
    let flyerIdCounter = 0;
    const flyerWidth = 0.5;
    const minFlyerGap = 0.2;

    walls.forEach((wall, wallIndex) => {
        const flyersToPlaceOnThisWall = flyerCounts[wallIndex];
        
        // Step 1: Define all non-flyable zones for this wall
        const noFlyZones: { start: number; end: number }[] = [];
        noFlyZones.push({ start: -1, end: 0.5 }); // Wall start edge
        noFlyZones.push({ start: playableWallLength - 0.5, end: playableWallLength + 1 }); // Wall end edge
        portals.forEach(p => { if (p.wall === wall) noFlyZones.push({ start: p.position - 1, end: p.position + 1 }); });

        if (billboard.wall === wall) {
            const start = billboard.wall === 'N' || billboard.wall === 'S' ? billboard.x - WALL_THICKNESS : billboard.z - WALL_THICKNESS;
            noFlyZones.push({ start: start - 0.5, end: start + 3 + 0.5 });
        }
        
        [alcove, street].forEach(p => {
            if (p.wall === wall) {
                const start = 'door1' in p ? p.door1 : p.entry;
                const end = 'door1' in p ? p.door2 : p.exit;
                // Add a single no-fly zone for the entire passage opening on the outer wall
                noFlyZones.push({ start: Math.min(start, end) - 0.5, end: Math.max(start, end) + 0.5 });
            }
        });

        // Step 2: Calculate all flyable segments for this wall (outer, alcove, street island)
        const wallFlyableSegments: { wall: 'N'|'S'|'E'|'W', start: number, end: number, isAlcoveSpot?: boolean, isStreetIsland?: boolean }[] = [];

        // 2a. Calculate standard flyable zones on the OUTER wall
        noFlyZones.sort((a, b) => a.start - b.start);
        let lastEnd = 0;
        noFlyZones.forEach(zone => {
            if (zone.start > lastEnd) {
                wallFlyableSegments.push({ wall, start: lastEnd, end: zone.start });
            }
            lastEnd = Math.max(lastEnd, zone.end);
        });
        if (lastEnd < playableWallLength) {
            wallFlyableSegments.push({ wall, start: lastEnd, end: playableWallLength });
        }
        
        // 2b. Add special INDENTED flyable zones
        if (wall === alcove.wall) {
            const minDoor = Math.min(alcove.door1, alcove.door2);
            const maxDoor = Math.max(alcove.door1, alcove.door2);
            if (maxDoor > minDoor) {
                wallFlyableSegments.push({ wall, start: minDoor, end: maxDoor, isAlcoveSpot: true });
            }
        }
        if (wall === street.wall) {
            const minEntry = Math.min(street.entry, street.exit);
            const maxEntry = Math.max(street.entry, street.exit);
            if (maxEntry > minEntry + 1) {
                wallFlyableSegments.push({ wall, start: minEntry + 1, end: maxEntry - 1, isStreetIsland: true });
            }
        }
        
        // Step 3: Distribute this wall's flyers across its available segments
        const segmentsWithSpace = wallFlyableSegments.filter(s => s.end - s.start > flyerWidth);
        for (let i = 0; i < flyersToPlaceOnThisWall; i++) {
            if (segmentsWithSpace.length === 0) break;

            const totalLength = segmentsWithSpace.reduce((sum, seg) => sum + (seg.end - seg.start - flyerWidth), 0);
            if (totalLength <= 0) break;

            let random = Math.random() * totalLength;
            let chosenSegmentIndex = -1;
            let position = 0;

            for (let j = 0; j < segmentsWithSpace.length; j++) {
                const seg = segmentsWithSpace[j];
                const length = seg.end - seg.start - flyerWidth;
                if (random < length) {
                    chosenSegmentIndex = j;
                    position = seg.start + flyerWidth / 2 + random;
                    break;
                }
                random -= length;
            }

            if (chosenSegmentIndex > -1) {
                const seg = segmentsWithSpace[chosenSegmentIndex];
                flyers.push({
                    id: flyerIdCounter++,
                    wall: seg.wall,
                    position,
                    variant: Math.floor(Math.random() * 3),
                    rotationJitter: { y: (Math.random() - 0.5) * 0.2, z: (Math.random() - 0.5) * 0.2 },
                    height: 0.8 + Math.random() * 0.2, // Raised slightly
                    isAlcoveSpot: seg.isAlcoveSpot,
                    isStreetIsland: seg.isStreetIsland,
                });

                const spaceToCarve = flyerWidth + minFlyerGap;
                const newNoFlyStart = position - spaceToCarve / 2;
                const newNoFlyEnd = position + spaceToCarve / 2;

                const newZones: typeof segmentsWithSpace = [];
                if (newNoFlyStart > seg.start) newZones.push({ ...seg, end: newNoFlyStart });
                if (newNoFlyEnd < seg.end) newZones.push({ ...seg, start: newNoFlyEnd });
                
                segmentsWithSpace.splice(chosenSegmentIndex, 1, ...newZones.filter(s => s.end - s.start > flyerWidth));
            }
        }
    });

    return { alcove, street, portals, billboard, flyers, banners, buildings };
};


/**
 * Gets a specific, deterministic spawn point within the street passage.
 * This point is intended to be hidden from the main board view.
 */
export const getStreetPassageSpawnPoint = (layoutDetails: LayoutDetails): Point3D | null => {
    if (!layoutDetails) return null;
    const { wall, entry, exit } = layoutDetails.street;
    
    const midPoint = Math.floor((entry + exit) / 2) + WALL_THICKNESS;

    switch (wall) {
        case 'N':
            return { x: midPoint, y: 1, z: 1 };
        case 'S':
            return { x: midPoint, y: 1, z: FULL_BOARD_DEPTH - 2 };
        case 'W':
            return { x: 1, y: 1, z: midPoint };
        case 'E':
            return { x: FULL_BOARD_WIDTH - 2, y: 1, z: midPoint };
    }
    return null; // Should not be reached
};

/**
 * Gets a random valid spawn point on the main board or alcoves, but not in the street passage.
 */
export const getBoardSpawnPoint = (snake: Point3D[], fruits: Fruit[], layoutDetails: LayoutDetails): Point3D | null => {
    let newPos: Point3D;
    let attempts = 0;
    do {
        newPos = {
            x: Math.floor(Math.random() * FULL_BOARD_WIDTH),
            y: 1,
            z: Math.floor(Math.random() * FULL_BOARD_DEPTH),
        };
        attempts++;
        if (attempts > 100) return null; // Avoid infinite loop
    } while (
        isStreetPassageBlock(newPos.x, newPos.z, layoutDetails.street) || 
        isBillboardBlock(newPos.x, newPos.z, layoutDetails.billboard) ||
        !isValidSpawnLocation(newPos, snake, fruits, layoutDetails)
    );
    return newPos;
}

/**
 * Checks if a potential spawn location is valid (not on a wall, snake, or other fruit).
 */
export const isValidSpawnLocation = (pos: Point3D, snake: Point3D[], fruits: Fruit[], layoutDetails: LayoutDetails): boolean => {
    if (isWall(pos, layoutDetails)) return false;
    if (isPortalBlock(pos, layoutDetails.portals)) return false;
    if (snake.some(seg => seg.x === pos.x && seg.z === pos.z)) return false;
    if (fruits.some(f => f.position.x === pos.x && f.position.z === pos.z)) return false;
    
    return true;
};