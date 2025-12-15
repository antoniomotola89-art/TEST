

import { TileType, EntityType, VillagerJob, BiomeType } from '../types';
import { WORLD_WIDTH, WORLD_HEIGHT, BIOME_CONFIG, BIOME_RANGES } from '../constants';
import { Noise } from '../utils/procedural';
import { GameEngine } from './GameEngine'; 

export class WorldGenerator {

  static getBiome(x: number): BiomeType {
      if (x >= BIOME_RANGES[BiomeType.OUTSKIRTS].start && x < BIOME_RANGES[BiomeType.OUTSKIRTS].end) return BiomeType.OUTSKIRTS;
      if (x >= BIOME_RANGES[BiomeType.INDUSTRIAL].start && x < BIOME_RANGES[BiomeType.INDUSTRIAL].end) return BiomeType.INDUSTRIAL;
      return BiomeType.GARBAGE_WASTES;
  }

  static generate(engine: GameEngine): TileType[][] {
    const tiles: TileType[][] = Array(WORLD_HEIGHT)
      .fill(null)
      .map(() => Array(WORLD_WIDTH).fill(TileType.AIR));

    const noise = new Noise(Math.random());
    const caveNoise = new Noise(Math.random() + 100);
    const cavernNoise = new Noise(Math.random() + 200); 

    const surfaceHeights = new Array(WORLD_WIDTH).fill(0);
    
    // Generate Surface
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const biome = this.getBiome(x);
      let heightMod = 0;
      let roughness = 0.5;

      if (biome === BiomeType.INDUSTRIAL) {
          heightMod = 5; 
          roughness = 0.2;
      } else if (biome === BiomeType.GARBAGE_WASTES) {
          heightMod = -5;
          roughness = 0.8;
      }

      const nx = x / 150; 
      const h = BIOME_CONFIG.surfaceLevel + heightMod + noise.octave(nx, 3, roughness) * 15;
      surfaceHeights[x] = Math.floor(Math.max(10, Math.min(h, WORLD_HEIGHT - 20)));
    }

    for (let x = 0; x < WORLD_WIDTH; x++) {
      const surfaceY = surfaceHeights[x];
      const biome = this.getBiome(x);

      if (biome === BiomeType.OUTSKIRTS) {
          if (Math.random() < 0.05 && x > 5 && x < WORLD_WIDTH - 5) {
              if (Math.abs(surfaceHeights[x] - surfaceHeights[x+1]) < 2) {
                  this.generateTree(tiles, x, surfaceY - 1);
              }
          }
      } else if (biome === BiomeType.INDUSTRIAL) {
          if (Math.random() < 0.03) {
              for(let i=1; i<6; i++) tiles[surfaceY-i][x] = TileType.POLE;
          }
      } else if (biome === BiomeType.GARBAGE_WASTES) {
           if (Math.random() < 0.05) {
               tiles[surfaceY-1][x] = TileType.OLD_WORLD_DEBRIS;
           }
      }

      for (let y = 0; y < WORLD_HEIGHT; y++) {
        if (y < surfaceY) {
            // Sky
        } else if (y === surfaceY) {
          if (biome === BiomeType.INDUSTRIAL) tiles[y][x] = TileType.CONCRETE;
          else if (biome === BiomeType.GARBAGE_WASTES) tiles[y][x] = Math.random() > 0.5 ? TileType.DIRT : TileType.OLD_WORLD_DEBRIS;
          else tiles[y][x] = TileType.GRASS;
        } else if (y > surfaceY && y < surfaceY + Math.random() * 4 + 2) {
          if (biome === BiomeType.INDUSTRIAL) tiles[y][x] = TileType.FACTORY_METAL;
          else tiles[y][x] = TileType.DIRT;
        } else if (y >= WORLD_HEIGHT - 2) {
          tiles[y][x] = TileType.BEDROCK;
        } else {
          const wormCaveVal = caveNoise.octave((x / 15) + (y / 10), 2, 0.4);
          const cavernVal = cavernNoise.octave((x / 50) + (y / 40), 2, 0.5); 

          if ((wormCaveVal > 0.45 && y > surfaceY + 5) || (cavernVal > 0.6 && y > surfaceY + 15)) {
              tiles[y][x] = TileType.AIR;
          } else {
              if (biome === BiomeType.INDUSTRIAL && Math.random() < 0.3) {
                  tiles[y][x] = TileType.FACTORY_METAL;
              } else {
                  const oreRand = Math.random();
                  if (oreRand < 0.02) tiles[y][x] = TileType.ORE_GOLD;
                  else if (oreRand < 0.06) tiles[y][x] = TileType.ORE_IRON;
                  else if (oreRand < 0.08 && y > surfaceY + 20) tiles[y][x] = TileType.OLD_WORLD_DEBRIS;
                  else tiles[y][x] = TileType.STONE;
              }
          }
        }
      }
    }

    // Decor Pass
    for(let x = 0; x < WORLD_WIDTH; x++) {
        for(let y = 0; y < WORLD_HEIGHT; y++) {
            const biome = this.getBiome(x);
            if (tiles[y][x] === TileType.AIR && y + 1 < WORLD_HEIGHT && tiles[y+1][x] === TileType.GRASS) {
                if (Math.random() < 0.2) tiles[y][x] = TileType.DEAD_BUSH;
            }
            if (tiles[y][x] === TileType.AIR && y - 1 >= 0 && (tiles[y-1][x] === TileType.FACTORY_METAL || tiles[y-1][x] === TileType.CONCRETE)) {
                 if (biome === BiomeType.INDUSTRIAL && Math.random() < 0.05) {
                     tiles[y][x] = TileType.HANGING_WIRES;
                     if (Math.random() < 0.5 && y+1 < WORLD_HEIGHT) tiles[y+1][x] = TileType.HANGING_WIRES;
                 }
            }
        }
    }

    this.placeStructures(tiles, engine, surfaceHeights);
    this.placeVillages(tiles, surfaceHeights, engine);

    // SAFETY BEDROCK PASS - Prevents falling out of the world
    for(let x=0; x < WORLD_WIDTH; x++) {
        tiles[WORLD_HEIGHT - 1][x] = TileType.BEDROCK;
        tiles[WORLD_HEIGHT - 2][x] = TileType.BEDROCK;
        tiles[WORLD_HEIGHT - 3][x] = TileType.BEDROCK;
    }

    return tiles;
  }

  static safeSet(tiles: TileType[][], x: number, y: number, type: TileType) {
      if (y >= 0 && y < WORLD_HEIGHT && x >= 0 && x < WORLD_WIDTH) {
          tiles[y][x] = type;
      }
  }

  // Ensures the structure sits on flat ground, preventing floating or burying.
  static flattenTerrain(tiles: TileType[][], x: number, width: number, floorY: number) {
      const padding = 2;
      for (let ix = x - padding; ix < x + width + padding; ix++) {
          if (ix >= 0 && ix < WORLD_WIDTH) {
              // Set the floor
              this.safeSet(tiles, ix, floorY, tiles[floorY][ix] === TileType.CONCRETE ? TileType.CONCRETE : TileType.DIRT);
              
              // Clear air above
              for (let iy = 0; iy < 30; iy++) {
                  if (floorY - iy - 1 >= 0) this.safeSet(tiles, ix, floorY - iy - 1, TileType.AIR);
              }

              // Fill foundation below
              for (let iy = 1; iy < 10; iy++) {
                  if (floorY + iy < WORLD_HEIGHT) {
                      const existing = tiles[floorY + iy][ix];
                      if (existing === TileType.AIR || existing === TileType.GRASS || existing === TileType.DEAD_BUSH) {
                          this.safeSet(tiles, ix, floorY + iy, TileType.DIRT);
                      }
                  }
              }
          }
      }
  }

  static generateTree(tiles: TileType[][], x: number, rootY: number) {
    const height = Math.floor(Math.random() * 4) + 6;
    for (let i = 0; i < height; i++) {
        if (rootY - i >= 0) tiles[rootY - i][x] = TileType.TREE_LOG; 
    }
    for (let ly = rootY - height + 1; ly > rootY - height - 4; ly--) {
        for (let lx = x - 2; lx <= x + 2; lx++) {
            if (lx >= 0 && lx < WORLD_WIDTH && ly >= 0) {
                 if (tiles[ly][lx] === TileType.AIR) tiles[ly][lx] = TileType.TREE_LEAVES;
            }
        }
    }
  }

  static placeStructures(tiles: TileType[][], engine: GameEngine, heights: number[]) {
      const wasteStart = BIOME_RANGES[BiomeType.GARBAGE_WASTES].start;
      const wasteEnd = BIOME_RANGES[BiomeType.GARBAGE_WASTES].end;
      
      const safeBottom = WORLD_HEIGHT - 10; // Ensure structures don't break bedrock

      const numRuins = 4;
      for(let i=0; i<numRuins; i++) {
          const ruinX = Math.floor(Math.random() * (wasteEnd - wasteStart - 20)) + wasteStart;
          // Ruins height ~10. Clamp Y.
          const maxY = safeBottom - 12;
          const minY = 50;
          const ruinY = Math.floor(Math.random() * (maxY - minY)) + minY; 
          this.buildRuins(tiles, ruinX, ruinY);
          engine.ruinLocations.push(ruinX);
      }

      const indStart = BIOME_RANGES[BiomeType.INDUSTRIAL].start;
      const indEnd = BIOME_RANGES[BiomeType.INDUSTRIAL].end;
      const numFactories = 5;

      for(let i=0; i<numFactories; i++) {
          const fx = Math.floor(Math.random() * (indEnd - indStart - 40)) + indStart + 20;
          // Factory height ~12.
          const maxY = safeBottom - 15;
          const minY = 60;
          const fy = Math.floor(Math.random() * (maxY - minY)) + minY;
          this.buildFactory(tiles, fx, fy, engine);
          engine.factoryLocations.push(fx);
      }

      const numLabs = 4;
      for(let i=0; i<numLabs; i++) {
        const labX = Math.floor(Math.random() * (WORLD_WIDTH - 40)) + 20;
        // Lab height ~8.
        const maxY = safeBottom - 10;
        const minY = 40;
        const labY = Math.floor(Math.random() * (maxY - minY)) + minY;
        this.buildLab(tiles, labX, labY);
        engine.labLocations.push(labX);
      }

      const outStart = BIOME_RANGES[BiomeType.OUTSKIRTS].start;
      const outEnd = BIOME_RANGES[BiomeType.OUTSKIRTS].end;
      for(let i=0; i<3; i++) {
          const ox = Math.floor(Math.random() * (outEnd - outStart - 40)) + outStart + 20;
          const oy = heights[ox];
          if (oy < WORLD_HEIGHT/3) { 
              this.flattenTerrain(tiles, ox-4, 8, oy);
              this.buildObservatory(tiles, ox, oy, engine);
          }
      }

      const vaultX = 700; 
      const vaultY = WORLD_HEIGHT - 15;
      this.buildVault(tiles, vaultX, vaultY);
      engine.vaultLocation = vaultX;
  }

  static buildRuins(tiles: TileType[][], x: number, y: number) {
      const w = 14; const h = 10;
      for(let dy=-1; dy<=h; dy++) for(let dx=-w/2 - 1; dx<=w/2 + 1; dx++) this.safeSet(tiles, x+dx, y+dy, TileType.AIR);
      for(let dx=-w/2; dx<=w/2; dx++) { this.safeSet(tiles, x+dx, y+h, TileType.ANCIENT_BRICK); this.safeSet(tiles, x+dx, y, TileType.ANCIENT_BRICK); }
      for(let dy=0; dy<=h; dy++) { this.safeSet(tiles, x-w/2, y+dy, TileType.ANCIENT_BRICK); this.safeSet(tiles, x+w/2, y+dy, TileType.ANCIENT_BRICK); }
      this.safeSet(tiles, x, y+h-1, TileType.ALTAR);
      this.safeSet(tiles, x-4, y+h-1, TileType.TORCH);
      this.safeSet(tiles, x+4, y+h-1, TileType.TORCH);
  }

  static buildLab(tiles: TileType[][], x: number, y: number) {
      const w = 16; const h = 8;
      for(let dy=-1; dy<=h; dy++) for(let dx=-w/2 - 1; dx<=w/2 + 1; dx++) this.safeSet(tiles, x+dx, y+dy, TileType.AIR);
      for(let dx=-w/2; dx<=w/2; dx++) { this.safeSet(tiles, x+dx, y+h, TileType.LAB_WALL); this.safeSet(tiles, x+dx, y, TileType.LAB_WALL); }
      for(let dy=0; dy<=h; dy++) { this.safeSet(tiles, x-w/2, y+dy, TileType.LAB_WALL); this.safeSet(tiles, x+w/2, y+dy, TileType.LAB_WALL); }
      this.safeSet(tiles, x, y+h-1, TileType.SERVER_TERMINAL);
  }

  static buildFactory(tiles: TileType[][], x: number, y: number, engine: GameEngine) {
      const w = 24; const h = 12;
      for(let dy=-1; dy<=h; dy++) for(let dx=-w/2 - 1; dx<=w/2 + 1; dx++) this.safeSet(tiles, x+dx, y+dy, TileType.AIR);
      for(let dx=-w/2; dx<=w/2; dx++) { this.safeSet(tiles, x+dx, y+h, TileType.FACTORY_METAL); this.safeSet(tiles, x+dx, y, TileType.FACTORY_METAL); }
      for(let dy=0; dy<=h; dy++) { this.safeSet(tiles, x-w/2, y+dy, TileType.FACTORY_METAL); this.safeSet(tiles, x+w/2, y+dy, TileType.FACTORY_METAL); }
      for(let dx=-w/4; dx<=w/4; dx++) this.safeSet(tiles, x+dx, y+h-4, TileType.FACTORY_METAL);

      engine.spawnEntity(EntityType.DRONE, (x-4)*16, (y+4)*16);
      engine.spawnEntity(EntityType.SCRAP_WALKER, (x+4)*16, (y+h-2)*16);
      this.safeSet(tiles, x, y+h-2, TileType.SERVER_TERMINAL);
  }

  static buildObservatory(tiles: TileType[][], x: number, y: number, engine: GameEngine) {
      const h = 15; const w = 8;
      for(let dy=0; dy<h; dy++) {
          this.safeSet(tiles, x-w/2, y-dy, TileType.PLANK);
          this.safeSet(tiles, x+w/2, y-dy, TileType.PLANK);
          if (dy % 5 === 0) for(let dx=-w/2+1; dx<w/2; dx++) this.safeSet(tiles, x+dx, y-dy, TileType.PLANK);
      }
      for(let dx=-w/2; dx<=w/2; dx++) this.safeSet(tiles, x+dx, y, TileType.PLANK);
      for(let dx=-w/2-1; dx<=w/2+1; dx++) this.safeSet(tiles, x+dx, y-h, TileType.ANCIENT_BRICK);
      this.safeSet(tiles, x, y-h-1, TileType.TELESCOPE);
      engine.spawnEntity(EntityType.VILLAGER, x*16, (y-h-2)*16, VillagerJob.UNEMPLOYED, x*16, (y-h-2)*16);
  }

  static buildVault(tiles: TileType[][], x: number, y: number) {
      const w = 20; const h = 10;
      for(let dy=-1; dy<=h; dy++) for(let dx=-w/2 - 1; dx<=w/2 + 1; dx++) this.safeSet(tiles, x+dx, y+dy, TileType.AIR);
      for(let dx=-w/2; dx<=w/2; dx++) { this.safeSet(tiles, x+dx, y+h, TileType.BEDROCK); this.safeSet(tiles, x+dx, y, TileType.FACTORY_METAL); }
      for(let dy=0; dy<=h; dy++) { this.safeSet(tiles, x-w/2, y+dy, TileType.FACTORY_METAL); this.safeSet(tiles, x+w/2, y+dy, TileType.FACTORY_METAL); }
      this.safeSet(tiles, x, y+h-1, TileType.CONCRETE);
      this.safeSet(tiles, x, y+h-2, TileType.TEDDY_BEAR); 
      this.safeSet(tiles, x-5, y+h-1, TileType.SERVER_TERMINAL);
      this.safeSet(tiles, x+5, y+h-1, TileType.SERVER_TERMINAL);
  }

  static placeVillages(tiles: TileType[][], heights: number[], engine: GameEngine) {
      const outStart = BIOME_RANGES[BiomeType.OUTSKIRTS].start;
      const outEnd = BIOME_RANGES[BiomeType.OUTSKIRTS].end;
      const numVillages = 3;
      const minSpacing = 40; 
      
      let attempts = 0;
      let placed = 0;

      while(placed < numVillages && attempts < 20) {
        attempts++;
        const siteX = Math.floor(Math.random() * (outEnd - outStart - 100)) + outStart + 20;
        
        // Simple check for nearby existing villages (could be improved with a list)
        
        const structureCount = Math.floor(Math.random() * 3) + 3;
        let currentX = siteX;
        
        for (let j = 0; j < structureCount; j++) {
            if (currentX < outEnd - 20) {
                // Find highest point in this section to flatten correctly
                // or just take center height
                let floorY = heights[currentX];
                
                // Pick structure type
                const rand = Math.random();
                let width = 0;
                
                if (rand < 0.25) {
                    width = 12;
                    // Check bounds & flatten
                    floorY = heights[currentX + 6]; 
                    this.flattenTerrain(tiles, currentX, width, floorY);
                    this.buildFarm(tiles, currentX, floorY, engine);
                } else if (rand < 0.5) {
                    width = 10;
                    floorY = heights[currentX + 5];
                    this.flattenTerrain(tiles, currentX, width, floorY);
                    this.buildBlacksmith(tiles, currentX, floorY, engine);
                } else if (rand < 0.7) {
                    width = 14;
                    floorY = heights[currentX + 7];
                    this.flattenTerrain(tiles, currentX, width, floorY);
                    this.buildLibrary(tiles, currentX, floorY, engine);
                } else {
                    width = 8;
                    floorY = heights[currentX + 4];
                    this.flattenTerrain(tiles, currentX, width, floorY);
                    this.buildHouse(tiles, currentX, floorY, engine);
                }
                
                // Advance X to prevent overlap
                currentX += width + 4; // Width + spacing
            }
        }
        placed++;
      }
  }

  static buildHouse(tiles: TileType[][], x: number, floorY: number, engine: GameEngine) {
      const w = 8; const h = 6;
      for(let dx=0; dx<w; dx++) this.safeSet(tiles, x+dx, floorY, TileType.PLANK);
      for(let dy=1; dy<=h; dy++) { this.safeSet(tiles, x, floorY-dy, TileType.WOOD); this.safeSet(tiles, x+w-1, floorY-dy, TileType.WOOD); }
      for(let dx=-1; dx<=w; dx++) this.safeSet(tiles, x+dx, floorY-h-1, TileType.PLANK);
      this.safeSet(tiles, x+2, floorY-1, TileType.WORKBENCH);
      this.safeSet(tiles, x+w-2, floorY-2, TileType.TORCH);
      this.safeSet(tiles, x, floorY-1, TileType.DOOR_CLOSED);
      this.safeSet(tiles, x, floorY-2, TileType.DOOR_CLOSED);
      
      const spawnX = (x+4)*16;
      const spawnY = (floorY-2)*16;
      engine.spawnEntity(EntityType.VILLAGER, spawnX, spawnY, VillagerJob.UNEMPLOYED, spawnX, spawnY);
  }

  static buildFarm(tiles: TileType[][], x: number, floorY: number, engine: GameEngine) {
      const w = 12;
      for(let dx=0; dx<w; dx++) { this.safeSet(tiles, x+dx, floorY, TileType.DIRT); this.safeSet(tiles, x+dx, floorY-1, TileType.WHEAT); }
      this.safeSet(tiles, x+6, floorY, TileType.AIR); 
      
      const spawnX = (x+2)*16;
      const spawnY = (floorY-2)*16;
      engine.spawnEntity(EntityType.VILLAGER, spawnX, spawnY, VillagerJob.FARMER, spawnX, spawnY);
  }

  static buildBlacksmith(tiles: TileType[][], x: number, floorY: number, engine: GameEngine) {
      const w = 10; const h = 6;
      for(let dx=0; dx<w; dx++) this.safeSet(tiles, x+dx, floorY, TileType.STONE);
      for(let dy=1; dy<=h; dy++) { this.safeSet(tiles, x, floorY-dy, TileType.STONE); this.safeSet(tiles, x+w-1, floorY-dy, TileType.STONE); }
      for(let dx=-1; dx<=w; dx++) this.safeSet(tiles, x+dx, floorY-h-1, TileType.ANCIENT_BRICK);
      this.safeSet(tiles, x+2, floorY-1, TileType.ANVIL);
      this.safeSet(tiles, x+w-2, floorY-1, TileType.ORE_IRON);
      this.safeSet(tiles, x+w-2, floorY-2, TileType.TORCH);
      
      const spawnX = (x+5)*16;
      const spawnY = (floorY-2)*16;
      engine.spawnEntity(EntityType.VILLAGER, spawnX, spawnY, VillagerJob.BLACKSMITH, spawnX, spawnY);
  }

  static buildLibrary(tiles: TileType[][], x: number, floorY: number, engine: GameEngine) {
      const w = 14; const h = 7;
      // Floor
      for(let dx=0; dx<w; dx++) this.safeSet(tiles, x+dx, floorY, TileType.STONE);
      // Walls
      for(let dy=1; dy<=h; dy++) { 
          this.safeSet(tiles, x, floorY-dy, TileType.WOOD); 
          this.safeSet(tiles, x+w-1, floorY-dy, TileType.WOOD); 
      }
      // Roof
      for(let dx=-1; dx<=w; dx++) this.safeSet(tiles, x+dx, floorY-h-1, TileType.PLANK);
      
      // Interior
      this.safeSet(tiles, x+2, floorY-1, TileType.BOOKSHELF);
      this.safeSet(tiles, x+2, floorY-2, TileType.BOOKSHELF);
      this.safeSet(tiles, x+3, floorY-1, TileType.BOOKSHELF);
      this.safeSet(tiles, x+w-3, floorY-1, TileType.BOOKSHELF);
      this.safeSet(tiles, x+w-3, floorY-2, TileType.BOOKSHELF);

      this.safeSet(tiles, x+w/2, floorY-1, TileType.LECTERN);
      this.safeSet(tiles, x+w/2, floorY-2, TileType.TORCH);
      
      this.safeSet(tiles, x, floorY-1, TileType.DOOR_CLOSED);
      this.safeSet(tiles, x, floorY-2, TileType.DOOR_CLOSED);

      const spawnX = (x+7)*16;
      const spawnY = (floorY-2)*16;
      engine.spawnEntity(EntityType.VILLAGER, spawnX, spawnY, VillagerJob.LIBRARIAN, spawnX, spawnY);
  }
}