import { TileType, Player, GameEventListener, InventoryItem, ItemType, GameEvent, Entity, EntityType, CraftingRecipe, MiningState, Quest, Particle, VillagerJob, VillagerState, AIState, Projectile, Equipment, BiomeType } from '../types';
import { 
    TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT, GRAVITY, 
    JUMP_FORCE, MOVE_SPEED, FRICTION, TERMINAL_VELOCITY,
    MAX_HEALTH, FALL_DAMAGE_THRESHOLD, FALL_DAMAGE_MULTIPLIER, DAY_LENGTH, RENDER_SCALE, TILE_HARDNESS, SIDE_QUESTS, ENTITY_LOOT, REACH_PIXELS, CUSTOM_ITEMS, VILLAGER_NAMES, VILLAGER_PERSONALITIES, MAX_SPEED
} from '../constants';
import { WorldGenerator } from './WorldGenerator';

export class GameEngine {
  public world: TileType[][];
  public player: Player;
  public entities: Entity[] = [];
  public particles: Particle[] = [];
  public projectiles: Projectile[] = [];
  
  public labLocations: number[] = []; 
  public ruinLocations: number[] = [];
  public factoryLocations: number[] = [];
  public vaultLocation: number | null = null;
  
  public cameraX: number = 0;
  public cameraY: number = 0;
  public inventory: InventoryItem[] = [];
  
  public mouseState = { x: 0, y: 0, leftDown: false, rightDown: false };
  public virtualCursor = { x: 400, y: 300 }; 

  public miningState: MiningState | null = null;

  public time: number = 6000; 
  public rainIntensity: number = 0; 
  public paused: boolean = false;
  
  public currentBiome: BiomeType = BiomeType.OUTSKIRTS;
  public lightningTimer: number = 0;

  public defeatedBosses: string[] = []; // Track defeated bosses
  public skyIslandSpawned: boolean = false;

  private actionCooldown: number = 0; 
  private listeners: GameEventListener[] = [];
  private keys: Set<string> = new Set();
  private canvasWidth: number = 800;
  private canvasHeight: number = 600;

  private animTimer: number = 0;
  private jumpBuffer: number = 0;

  public isGameOver: boolean = false;
  public isGameWon: boolean = false;

  constructor() {
    this.world = WorldGenerator.generate(this); 
    
    let spawnX = 50 * TILE_SIZE;
    let spawnY = 0;
    for (let y=0; y<WORLD_HEIGHT; y++) {
        if (this.world[y][50] !== TileType.AIR && this.world[y][50] !== TileType.TREE_LEAVES && this.world[y][50] !== TileType.TREE_LOG) {
            spawnY = (y - 4) * TILE_SIZE;
            break;
        }
    }

    this.player = {
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      width: 12,
      height: 24, 
      isGrounded: false,
      facingRight: true,
      selectedSlot: 0,
      health: MAX_HEALTH,
      maxHealth: MAX_HEALTH,
      isInventoryOpen: false,
      animationFrame: 0,
      spawned: true,
      damageCooldown: 0, 
      isRolling: false,
      isGroundPounding: false,
      isCrouching: false,
      movementCooldown: 0,
      lastKeyPressTime: {},
      wallSlideDir: 0,
      swingProgress: 0,
      swingType: 'slash',
      equipment: { head: null, body: null, module: null },
      defense: 0,
      creativeMode: false // Default off
    };
    this.initInventory();
    
    this.cameraX = spawnX - 400;
    this.cameraY = spawnY - 300;
  }

  private initInventory() {
      this.inventory = Array(27).fill(null).map((_, i) => {
          if (i === 0) return { id: 'pick1', type: ItemType.TOOL, name: 'Iron Pickaxe', count: 1, icon: '⛏️', description: 'Standard issue.', stats: { damage: 3, range: REACH_PIXELS, miningMultiplier: 2 } };
          if (i === 1) return { id: 'torch1', type: ItemType.BLOCK, tileType: TileType.TORCH, name: 'TORCH', count: 10, icon: '🔥', description: 'Lights up the dark.' };
          return { id: `slot-${i}`, type: ItemType.BLOCK, tileType: TileType.AIR, name: 'Empty', count: 0, icon: '' };
      });
  }

  public fillCreativeInventory() {
      const icons: Record<number, string> = {
           [TileType.DIRT]: '🟫', [TileType.GRASS]: '🌿', [TileType.STONE]: '🪨', [TileType.WOOD]: '🪵',
           [TileType.ORE_IRON]: '🔩', [TileType.ORE_GOLD]: '🟡', [TileType.TORCH]: '🔥',
           [TileType.PLANK]: '🟫', [TileType.WORKBENCH]: '🛠️', [TileType.ANVIL]: '🔨', [TileType.WHEAT]: '🌾',
           [TileType.ANCIENT_BRICK]: '🧱', [TileType.FACTORY_METAL]: '🏭', [TileType.CONCRETE]: '⬜',
           [TileType.LAB_WALL]: '🧪', [TileType.BOOKSHELF]: '📚', [TileType.ALTAR]: '⛩️', [TileType.SERVER_TERMINAL]: '🖥️'
      };

      this.inventory = Array(27).fill(null).map((_, i) => ({ id: `slot-${i}`, type: ItemType.BLOCK, tileType: TileType.AIR, name: 'Empty', count: 0, icon: '' }));
      
      let slot = 0;
      
      // 1. Creative Tools
      this.inventory[slot++] = { 
          id: 'creat-pick', type: ItemType.TOOL, name: 'Admin Pick', count: 1, icon: '⚡', 
          description: 'Breaks reality.', stats: { damage: 1000, range: 1000, miningMultiplier: 100 } 
      };

      // 2. Weapons
      const weapons = ['railgun', 'rocket_launcher', 'laser_rifle', 'shotgun', 'pistol'];
      weapons.forEach(w => {
          if (slot < 27 && CUSTOM_ITEMS[w]) {
              this.inventory[slot++] = { ...CUSTOM_ITEMS[w], id: `creat-${w}`, count: 1 };
          }
      });

      // 3. Blocks
      const blocks = [
          TileType.TORCH, TileType.WOOD, TileType.STONE, TileType.DIRT, TileType.PLANK, 
          TileType.ANCIENT_BRICK, TileType.FACTORY_METAL, TileType.CONCRETE, TileType.LAB_WALL, 
          TileType.BOOKSHELF, TileType.ORE_GOLD, TileType.ORE_IRON, TileType.WHEAT, TileType.ALTAR, TileType.SERVER_TERMINAL
      ];

      blocks.forEach(t => {
          if (slot < 27) {
              this.inventory[slot++] = {
                  id: `creat-${t}`, type: ItemType.BLOCK, tileType: t, name: TileType[t], 
                  count: 999, icon: icons[t] || '🧱'
              };
          }
      });

      this.emit({ type: 'INVENTORY_UPDATE', payload: this.inventory });
  }

  public toggleCreative() {
      this.player.creativeMode = !this.player.creativeMode;
      if (this.player.creativeMode) {
          this.player.health = this.player.maxHealth;
          this.fillCreativeInventory();
          this.emit({ type: 'QUEST_UPDATE', payload: { message: "CREATIVE MODE ENABLED" }});
      } else {
          this.emit({ type: 'QUEST_UPDATE', payload: { message: "SURVIVAL MODE ENABLED" }});
      }
      this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
  }

  public setInventory(newInventory: InventoryItem[]) {
      this.inventory = newInventory;
      this.updateQuestProgress();
      this.emit({ type: 'INVENTORY_UPDATE', payload: this.inventory });
  }

  public equipItem(item: InventoryItem, slot: 'head' | 'body' | 'module') {
      this.player.equipment[slot] = item;
      this.recalcStats();
  }

  public unequipItem(slot: 'head' | 'body' | 'module'): InventoryItem | null {
      const item = this.player.equipment[slot];
      this.player.equipment[slot] = null;
      this.recalcStats();
      return item;
  }

  private recalcStats() {
      let def = 0;
      let spd = 0;
      if (this.player.equipment.head) def += this.player.equipment.head.stats?.defense || 0;
      if (this.player.equipment.body) def += this.player.equipment.body.stats?.defense || 0;
      if (this.player.equipment.module) {
          def += this.player.equipment.module.stats?.defense || 0;
          spd += this.player.equipment.module.stats?.speed || 0;
      }
      this.player.defense = def;
      this.player.speed = spd;
      this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
  }

  public updateEntityChatHistory(id: string, history: { sender: string; text: string }[]) {
      const ent = this.entities.find(e => e.id === id);
      if (ent) {
          ent.chatHistory = history;
          ent.lastInteractionTime = Date.now();
      }
  }

  public subscribe(listener: GameEventListener) {
    this.listeners.push(listener);
    listener({ type: 'PLAYER_UPDATE', payload: this.player });
    listener({ type: 'INVENTORY_UPDATE', payload: this.inventory });
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: GameEvent) {
    this.listeners.forEach(l => l(event));
  }

  public saveGame() {
      if (this.isGameOver || this.isGameWon) return;
      const saveData = {
          player: this.player,
          inventory: this.inventory,
          world: this.world,
          entities: this.entities,
          time: this.time,
          ruinLocations: this.ruinLocations,
          factoryLocations: this.factoryLocations,
          labLocations: this.labLocations,
          vaultLocation: this.vaultLocation,
          defeatedBosses: this.defeatedBosses,
          skyIslandSpawned: this.skyIslandSpawned
      };
      try {
          localStorage.setItem('terraGenesis_save', JSON.stringify(saveData));
          this.emit({ type: 'QUEST_UPDATE', payload: { message: "Game Saved!" }});
      } catch (e) {
          console.error("Save failed", e);
          this.emit({ type: 'QUEST_UPDATE', payload: { message: "Save Failed (Storage Full?)" }});
      }
  }

  public loadGame(): boolean {
      try {
          const json = localStorage.getItem('terraGenesis_save');
          if (!json) return false;
          
          const data = JSON.parse(json);
          this.player = data.player;
          this.player.swingType = 'slash'; // Reset visual
          this.inventory = data.inventory;
          this.world = data.world;
          this.entities = data.entities;
          this.time = data.time;
          this.ruinLocations = data.ruinLocations;
          this.factoryLocations = data.factoryLocations;
          this.labLocations = data.labLocations;
          this.vaultLocation = data.vaultLocation;
          this.defeatedBosses = data.defeatedBosses || [];
          this.skyIslandSpawned = data.skyIslandSpawned || false;

          this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
          this.emit({ type: 'INVENTORY_UPDATE', payload: this.inventory });
          this.emit({ type: 'ENTITY_UPDATE', payload: this.entities });
          this.emit({ type: 'TIME_UPDATE', payload: this.time });
          this.emit({ type: 'QUEST_UPDATE', payload: { message: "Game Loaded!" }});
          
          return true;
      } catch (e) {
          console.error("Load failed", e);
          this.emit({ type: 'QUEST_UPDATE', payload: { message: "Load Failed (Corrupt Save?)" }});
          return false;
      }
  }

  // --- TELEPORTATION FOR CREATIVE MODE ---
  public teleportToStructure(type: EntityType): { success: boolean, message: string } {
      if (!this.player.creativeMode) return { success: false, message: "Creative Mode Required" };

      let targetX = -1;
      let targetY = -1;
      let locationName = "";

      if (type === EntityType.BOSS_GUARDIAN) {
          // Find nearest ruin
          const closest = this.findClosestX(this.ruinLocations);
          if (closest !== -1) {
              targetX = closest;
              locationName = "Ancient Ruins";
              // Scan for Altar or floor
              for(let y=0; y<WORLD_HEIGHT; y++) {
                  if (this.world[y][targetX] === TileType.ALTAR) { targetY = y; break; }
              }
              if (targetY === -1) targetY = 50; // Fallback
          }
      }
      else if (type === EntityType.BOSS_SENTRY) {
          const locs = [...this.factoryLocations, ...this.labLocations];
          const closest = this.findClosestX(locs);
          if (closest !== -1) {
              targetX = closest;
              locationName = "Industrial Facility";
              for(let y=0; y<WORLD_HEIGHT; y++) {
                  if (this.world[y][targetX] === TileType.SERVER_TERMINAL) { targetY = y; break; }
              }
              if (targetY === -1) targetY = 60;
          }
      }
      else if (type === EntityType.BOSS_URSUS) {
          if (!this.skyIslandSpawned) return { success: false, message: "Structure Not Spawned Yet" };
          targetX = 500;
          targetY = 13; // Sky Island Platform is around 15
          locationName = "Sky Fortress";
      }
      else if (type === EntityType.MECHA_REX) {
          targetX = 850; // Middle of Wastes
          locationName = "Garbage Wastes";
          targetY = this.findSurface(targetX);
      }
      else if (type === EntityType.MECHA_BEAR) {
          targetX = 500; // Middle of Industrial
          locationName = "Industrial Complex";
          targetY = this.findSurface(targetX);
      }
      else if (type === EntityType.PTEROSAUR) {
          targetX = Math.floor(this.player.x / TILE_SIZE);
          targetY = 20; // High up
          locationName = "Upper Atmosphere";
      }
      else if (type === EntityType.VOID_STALKER) {
          targetX = Math.floor(this.player.x / TILE_SIZE);
          targetY = this.findSurface(targetX);
          locationName = "Current Location (Night)";
      }
      else {
           return { success: false, message: "No specific structure found." };
      }

      if (targetX !== -1) {
          if (targetY === -1) targetY = this.findSurface(targetX);
          this.player.x = targetX * TILE_SIZE;
          this.player.y = (targetY - 2) * TILE_SIZE;
          this.player.vx = 0;
          this.player.vy = 0;
          this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
          return { success: true, message: `Warped to ${locationName}` };
      }

      return { success: false, message: "Structure not found." };
  }

  private findClosestX(locations: number[]): number {
      if (locations.length === 0) return -1;
      let closest = locations[0];
      let minDist = Math.abs((this.player.x / TILE_SIZE) - closest);
      for(const loc of locations) {
          const dist = Math.abs((this.player.x / TILE_SIZE) - loc);
          if (dist < minDist) {
              minDist = dist;
              closest = loc;
          }
      }
      return closest;
  }

  private findSurface(x: number): number {
      for(let y=0; y<WORLD_HEIGHT; y++) {
          if (this.world[y][x] !== TileType.AIR && this.world[y][x] !== TileType.TREE_LEAVES) return y;
      }
      return 50;
  }

  public acceptQuest(quest: Quest, giverId: string) {
      this.player.activeQuestId = quest.id;
      this.player.questGiverId = giverId;
      this.player.questProgress = 0;

      if (quest.id === 'kill_pterosaur') {
           const side = Math.random() > 0.5 ? 1 : -1;
           const spawnX = this.player.x + (side * 200);
           const spawnY = Math.max(50, this.player.y - 150);
           this.spawnEntity(EntityType.PTEROSAUR, spawnX, spawnY);
           this.emit({ type: 'QUEST_UPDATE', payload: { message: "SCREE! The Sky Demon approaches!" }});
      } 
      else if (quest.id === 'kill_zombies') {
           for(let i=0; i<5; i++) {
               const side = Math.random() > 0.5 ? 1 : -1;
               const spawnX = this.player.x + (side * (100 + Math.random() * 100));
               const spawnY = Math.max(0, this.player.y - 100); 
               this.spawnEntity(EntityType.ZOMBIE, spawnX, spawnY);
           }
           this.emit({ type: 'QUEST_UPDATE', payload: { message: "AMBUSH! The dead rise!" }});
      }

      this.updateQuestProgress();
      this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
  }

  private updateQuestProgress() {
      if (!this.player.activeQuestId) return;
      const quest = SIDE_QUESTS.find(q => q.id === this.player.activeQuestId);
      if (!quest || quest.objective.type !== 'collect') return;

      let count = 0;
      const nameMatch = this.inventory.find(i => i.name === quest.objective.target);
      if (nameMatch) count += nameMatch.count;
      
      const tileMatch = this.inventory.find(i => i.tileType && TileType[i.tileType] === quest.objective.target);
      if (tileMatch && tileMatch !== nameMatch) count += tileMatch.count;

      if (this.player.questProgress !== count) {
          this.player.questProgress = Math.min(count, quest.objective.amount);
          this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
          
          if (this.player.questProgress >= quest.objective.amount) {
               this.emit({ type: 'QUEST_UPDATE', payload: { message: "Objective Met! Return to Villager." }});
          }
      }
  }

  public completeQuest() {
      const quest = SIDE_QUESTS.find(q => q.id === this.player.activeQuestId);
      if (!quest) return;

      if (quest.objective.type === 'collect') {
          let remaining = quest.objective.amount;
          this.inventory.forEach(item => {
              if (remaining > 0 && (item.name === quest.objective.target || (item.tileType && TileType[item.tileType] === quest.objective.target))) {
                  const take = Math.min(remaining, item.count);
                  item.count -= take;
                  remaining -= take;
              }
          });
          this.inventory = this.inventory.map(i => i.count <= 0 && i.type !== ItemType.TOOL ? { ...i, type: ItemType.BLOCK, tileType: TileType.AIR, name: 'Empty', count: 0, icon: '' } : i);
      }

      const emptyIdx = this.inventory.findIndex(i => i.count === 0);
      if (emptyIdx > -1) {
          this.inventory[emptyIdx] = { ...quest.reward, id: Date.now().toString() };
      } else {
          this.emit({ type: 'QUEST_UPDATE', payload: { message: "Inventory Full! Dropped reward." }});
      }

      // If quest giver exists, remove their quest flag so they don't offer it again immediately (or loop)
      if (this.player.questGiverId) {
          const giver = this.entities.find(e => e.id === this.player.questGiverId);
          if (giver) giver.hasQuest = false;
      }

      this.player.activeQuestId = undefined;
      this.player.questProgress = undefined;
      this.player.questGiverId = undefined;

      this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
      this.emit({ type: 'INVENTORY_UPDATE', payload: this.inventory });
      this.emit({ type: 'QUEST_UPDATE', payload: { message: "Quest Completed & Turned In!" }});
  }

  public handleInput(type: 'keydown' | 'keyup', code: string) {
    if (this.isGameOver || this.isGameWon) return;

    if (type === 'keydown') {
        const now = Date.now();
        const lastPress = this.player.lastKeyPressTime[code] || 0;
        const isDoubleTap = (now - lastPress) < 300; 
        this.player.lastKeyPressTime[code] = now;

        this.keys.add(code);
        
        if (this.player.movementCooldown <= 0) {
            if (code === 'ShiftLeft' || code === 'ShiftRight') {
                if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.performRoll(-1);
                if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.performRoll(1);
            }
            if (isDoubleTap) {
                if (code === 'KeyA' || code === 'ArrowLeft') this.performRoll(-1);
                if (code === 'KeyD' || code === 'ArrowRight') this.performRoll(1);
            }
        }

        if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
            this.jumpBuffer = 6; 
        }

        if ((code === 'KeyS' || code === 'ArrowDown') && !this.player.isGrounded && !this.player.isGroundPounding && !this.player.creativeMode) {
            this.player.isGroundPounding = true;
            this.player.vx = 0;
            this.player.vy = 10; 
        }
        
        if (code === 'KeyE') {
            this.player.isInventoryOpen = !this.player.isInventoryOpen;
            this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
        }
        
        if (code.startsWith('Digit')) {
            const slot = parseInt(code.replace('Digit', '')) - 1;
            if (slot >= 0 && slot < 9) {
                this.player.selectedSlot = slot;
                this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
            }
        }
    } else {
        this.keys.delete(code);
    }
  }

  private performRoll(dir: number) {
      if (this.player.movementCooldown > 0) return;
      this.player.isRolling = true;
      this.player.vx = dir * 6; 
      this.player.damageCooldown = 20; 
      this.player.movementCooldown = 60; 
  }

  public handleMouse(x: number, y: number, isRelative: boolean, leftDown: boolean, rightDown: boolean) {
      if (this.isGameOver || this.isGameWon) return;
      if (isRelative) {
          this.virtualCursor.x += x;
          this.virtualCursor.y += y;
      } else {
          this.virtualCursor.x = x;
          this.virtualCursor.y = y;
      }
      
      this.virtualCursor.x = Math.max(0, Math.min(this.canvasWidth, this.virtualCursor.x));
      this.virtualCursor.y = Math.max(0, Math.min(this.canvasHeight, this.virtualCursor.y));

      this.mouseState = { x: this.virtualCursor.x, y: this.virtualCursor.y, leftDown, rightDown };
  }

  public setCanvasSize(w: number, h: number) {
      this.canvasWidth = w;
      this.canvasHeight = h;
      this.virtualCursor.x = Math.min(this.virtualCursor.x, w);
      this.virtualCursor.y = Math.min(this.virtualCursor.y, h);
  }

  public handleVillagerCommand(entityId: string, command: 'FOLLOW' | 'STAY' | 'ATTACK' | 'JOIN_PARTY' | 'NONE') {
      const villager = this.entities.find(e => e.id === entityId);
      if (!villager || villager.damageTaken > 15) return; 

      switch(command) {
          case 'JOIN_PARTY':
              const partyCount = this.entities.filter(e => e.isInParty).length;
              if (partyCount >= 2) {
                   this.emit({ type: 'QUEST_UPDATE', payload: { message: "Party is full! (Max 2 members)" }});
                   villager.emote = '❌';
                   return;
              }
              villager.isInParty = true;
              villager.state = AIState.FOLLOWING;
              villager.emote = '🛡️';
              this.emit({ type: 'QUEST_UPDATE', payload: { message: `${villager.name} joined your party!` }});
              break;
          case 'FOLLOW':
              villager.state = AIState.FOLLOWING;
              villager.targetId = 'player';
              villager.emote = '🫡';
              villager.emoteTimer = 60;
              break;
          case 'STAY':
              villager.state = AIState.IDLE;
              villager.targetId = undefined;
              villager.emote = '🛑';
              villager.emoteTimer = 60;
              if (villager.isInParty) {
                  this.emit({ type: 'QUEST_UPDATE', payload: { message: `${villager.name}: holding position.` }});
              }
              break;
          case 'ATTACK':
              villager.state = AIState.ATTACKING;
              let nearest = null;
              let minDst = 500;
              this.entities.forEach(e => {
                  if (e.type !== EntityType.VILLAGER && !e.isDead && e.type !== EntityType.RABBIT) {
                      const d = Math.sqrt((e.x - villager.x)**2 + (e.y - villager.y)**2);
                      if (d < minDst) { minDst = d; nearest = e; }
                  }
              });
              if (nearest) {
                  villager.targetId = nearest.id;
                  villager.emote = '⚔️';
              } else {
                  villager.emote = '❓';
                  villager.state = AIState.IDLE;
              }
              villager.emoteTimer = 60;
              break;
      }
  }

  public update() {
    if (this.paused || this.isGameOver || this.isGameWon) return;

    this.time = (this.time + 1) % DAY_LENGTH;
    if (this.time % 100 === 0) this.emit({ type: 'TIME_UPDATE', payload: this.time });
    
    this.currentBiome = WorldGenerator.getBiome(Math.floor(this.player.x / TILE_SIZE));

    if (this.time > 15000) {
        this.rainIntensity = Math.min(1, (this.time - 15000) / 8000);
    } else {
        this.rainIntensity = 0;
    }

    if (this.currentBiome === BiomeType.INDUSTRIAL && this.rainIntensity > 0.5) {
        if (Math.random() < 0.005) { 
            this.lightningTimer = 15;
        }
    }
    if (this.lightningTimer > 0) this.lightningTimer--;

    if (this.player.health < this.player.maxHealth && (!this.player.damageCooldown || this.player.damageCooldown <= 0)) {
        if (this.time % 300 === 0) {
            this.player.health = Math.min(this.player.maxHealth, this.player.health + 1);
            this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
        }
    }

    if (this.actionCooldown > 0) this.actionCooldown--;
    if (this.player.damageCooldown && this.player.damageCooldown > 0) this.player.damageCooldown--;
    if (this.player.movementCooldown > 0) this.player.movementCooldown--;
    if (this.player.swingProgress > 0) this.player.swingProgress = Math.max(0, this.player.swingProgress - 0.1);
    if (this.jumpBuffer > 0) this.jumpBuffer--;

    if (this.player.isRolling) {
        if (Math.abs(this.player.vx) < 2 || this.player.damageCooldown === 0) {
            this.player.isRolling = false; 
        }
    }

    if (Math.random() < 0.02) { 
        const activeEntities = this.entities.length;
        if (activeEntities < 25) {
            const isNight = this.time > 14000 && this.time < 22000;
            const rand = Math.random();
            const playerTileX = Math.floor(this.player.x / TILE_SIZE);
            const currentBiome = WorldGenerator.getBiome(playerTileX);

            if (currentBiome === BiomeType.INDUSTRIAL) {
                if (rand < 0.05) this.spawnEntity(EntityType.DRONE);
                else if (rand < 0.10) this.spawnEntity(EntityType.SCRAP_WALKER);
                else if (rand < 0.12) this.spawnEntity(EntityType.MECHA_BEAR);
                else if (rand < 0.4) this.spawnEntity(EntityType.ZOMBIE);
            }
            else if (isNight) {
                if (rand < 0.3) this.spawnEntity(EntityType.ZOMBIE);
                else if (rand < 0.45) this.spawnEntity(EntityType.BAT);
                else if (rand < 0.55) this.spawnEntity(EntityType.WOLF);
                else if (rand < 0.6) this.spawnEntity(EntityType.RAT);
                else if (rand < 0.61) this.spawnEntity(EntityType.VOID_STALKER);
            } else {
                if (rand < 0.1) this.spawnEntity(EntityType.RABBIT);
                else if (rand < 0.2) this.spawnEntity(EntityType.FOX);
                else if (rand < 0.3) this.spawnEntity(EntityType.DEER);
                else if (rand < 0.35) this.spawnEntity(EntityType.BOAR);
                else if (rand < 0.4) this.spawnEntity(EntityType.DUCK);
                else if (rand < 0.45) this.spawnEntity(EntityType.SCRAP_CRAB); 
                else if (rand < 0.47) this.spawnEntity(EntityType.RUSTED_ROVER);
                else if (rand < 0.475) this.spawnEntity(EntityType.MECHA_REX);
            }
        }
    }

    this.updatePhysics();
    this.updateEntities();
    this.updateProjectiles();
    this.updateInteraction();
    this.updateParticles();
    this.updateCamera();
  }

  private updateProjectiles() {
      for(let i=this.projectiles.length-1; i>=0; i--) {
          const p = this.projectiles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life--;

          if (p.targetId && p.type === 'missile') {
              let target: {x:number, y:number} | null = null;
              if (p.targetId === 'player') target = this.player;
              
              if (target) {
                  const dx = target.x - p.x;
                  const dy = target.y - p.y;
                  const angle = Math.atan2(dy, dx);
                  p.vx += Math.cos(angle) * 0.5;
                  p.vy += Math.sin(angle) * 0.5;
                  const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
                  if (speed > 6) { p.vx = (p.vx/speed)*6; p.vy = (p.vy/speed)*6; }
              }
          }
          
          this.particles.push({
              x: p.x, y: p.y, vx: 0, vy: 0, life: 5, 
              color: p.color, size: 2
          });

          let hit = false;
          if (p.isEnemy) {
               if (this.checkRectOverlap(p, this.player)) {
                   this.takeDamage(p.damage);
                   hit = true;
               }
               if (!hit) {
                   for (const ent of this.entities) {
                       if (ent.type === EntityType.VILLAGER && ent.isInParty && !ent.isDead) {
                            if (this.checkRectOverlap(p, ent)) {
                                let dmg = p.damage;
                                if (ent.equipment?.body) dmg = Math.max(1, dmg - (ent.equipment.body.stats?.defense || 0));
                                if (ent.equipment?.head) dmg = Math.max(1, dmg - (ent.equipment.head.stats?.defense || 0));
                                ent.health -= dmg;
                                ent.damageTaken += dmg;
                                ent.emote = '🛡️';
                                hit = true;
                                if (ent.health <= 0) ent.isDead = true;
                                break;
                            }
                       }
                   }
               }
          } else {
              for(const ent of this.entities) {
                  if (!ent.isDead && !ent.isInParty && this.checkRectOverlap(p, ent)) {
                      ent.damageTaken += p.damage;
                      ent.health -= p.damage;
                      ent.emote = '💥';
                      ent.emoteTimer = 10;
                      ent.vx += p.vx * 0.2; 
                      if (ent.health <= 0) {
                          ent.isDead = true;
                          this.handleEntityDeath(ent);
                      }
                      hit = true;
                      break; 
                  }
              }
          }

          if (!hit && this.isSolid(this.getTileAt(p.x, p.y))) {
              hit = true;
          }

          if (hit || p.life <= 0) {
              if (p.type === 'missile') {
                  // Explosion Logic
                  const radius = 3; 
                  const px = Math.floor(p.x / TILE_SIZE);
                  const py = Math.floor(p.y / TILE_SIZE);
                  
                  for(let y = py - radius; y <= py + radius; y++) {
                      for(let x = px - radius; x <= px + radius; x++) {
                          if (x >= 0 && x < WORLD_WIDTH && y >= 0 && y < WORLD_HEIGHT) {
                              const dx = x - px;
                              const dy = y - py;
                              if (dx*dx + dy*dy <= radius*radius) {
                                  const t = this.world[y][x];
                                  if (t !== TileType.BEDROCK && t !== TileType.AIR) {
                                      this.world[y][x] = TileType.AIR;
                                      
                                      // Trigger block break events (e.g. boss spawns) for exploded blocks
                                      this.checkBlockBreakEvents(x, y, t);

                                      if (Math.random() < 0.3) {
                                           this.particles.push({
                                               x: x*TILE_SIZE+8, y: y*TILE_SIZE+8,
                                               vx: (Math.random()-0.5)*4, vy: -Math.random()*4,
                                               life: 10, color: '#555', size: 2
                                           });
                                      }
                                  }
                              }
                          }
                      }
                  }
                  
                  for(let k=0; k<20; k++) {
                       this.particles.push({
                           x: p.x, y: p.y, 
                           vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
                           life: 30, color: p.color, size: 3 + Math.random()*3
                       });
                  }
              } else if (hit) {
                  for(let k=0; k<8; k++) {
                       this.particles.push({
                           x: p.x, y: p.y, 
                           vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
                           life: 20, color: p.color, size: 3
                       });
                  }
              }
              this.projectiles.splice(i, 1);
          }
      }
  }

  private handleEntityDeath(ent: Entity) {
    // Record Boss Deaths
    if (ent.type.startsWith('boss_') || ent.type === EntityType.MECHA_REX || ent.type === EntityType.VOID_STALKER || ent.type === EntityType.MECHA_BEAR || ent.type === EntityType.PTEROSAUR) {
        if (!this.defeatedBosses.includes(ent.type)) {
            this.defeatedBosses.push(ent.type);
            this.emit({ type: 'QUEST_UPDATE', payload: { message: `TARGET NEUTRALIZED: ${ent.type.toUpperCase().replace('_', ' ')}` }});
        }
    }

    if (ent.type === EntityType.BOSS_URSUS) {
         this.addCustomItemToInventory('artifact_teddy_bear', 1);
         this.emit({ type: 'QUEST_UPDATE', payload: { message: "BOSS DEFEATED! You found the artifact!" }});
    }

    // CHECK FOR FINAL UNLOCK (SKY ISLAND)
    if (!this.skyIslandSpawned) {
        const required = [EntityType.BOSS_GUARDIAN, EntityType.BOSS_SENTRY, EntityType.MECHA_REX];
        const allDefeated = required.every(id => this.defeatedBosses.includes(id));
        
        if (allDefeated) {
            this.spawnSkyIsland();
        }
    }

    if (ent.type !== EntityType.VILLAGER) {
        const table = ENTITY_LOOT[ent.type];
        if (table) {
            table.forEach(drop => {
                if (Math.random() < drop.chance) {
                    if (drop.isTile && typeof drop.item === 'number') {
                        this.addToInventory(drop.item);
                    } else if (!drop.isTile && typeof drop.item === 'string') {
                        this.addCustomItemToInventory(drop.item as string);
                    }
                }
            });
        }
    }
    if (this.player.activeQuestId && this.player.questProgress !== undefined) {
        const quest = SIDE_QUESTS.find(q => q.id === this.player.activeQuestId);
        if (quest && quest.objective.type === 'kill' && quest.objective.target === ent.type) {
            if (this.player.questProgress < quest.objective.amount) {
                this.player.questProgress++;
                this.emit({ type: 'PLAYER_UPDATE', payload: this.player }); 
                if (this.player.questProgress >= quest.objective.amount) {
                    this.emit({ type: 'QUEST_UPDATE', payload: { message: "Objective Met! Return to Villager." }});
                }
            }
        }
    }
  }

  private spawnSkyIsland() {
      this.skyIslandSpawned = true;
      const islandX = 500; // Center of world width
      const islandY = 15;  // High up in the sky
      const width = 30;
      
      // Build Platform
      for(let dx = -width/2; dx <= width/2; dx++) {
          const px = islandX + dx;
          // Main platform
          if (px >= 0 && px < WORLD_WIDTH) {
              this.world[islandY][px] = TileType.ANCIENT_BRICK;
              this.world[islandY+1][px] = TileType.ANCIENT_BRICK;
              // Background wall
              for(let dy=1; dy<8; dy++) {
                  this.world[islandY-dy][px] = TileType.LAB_WALL;
              }
          }
      }

      // Add details
      for(let dx = -width/2 + 2; dx <= width/2 - 2; dx+=5) {
          this.world[islandY-1][islandX+dx] = TileType.TORCH;
      }

      // Spawn Final Boss URSUS
      this.spawnEntity(EntityType.BOSS_URSUS, islandX * TILE_SIZE, (islandY-5) * TILE_SIZE);
      
      // Spawn Teddy Bear Tile (Decor)
      this.world[islandY-2][islandX] = TileType.TEDDY_BEAR;

      this.emit({ type: 'QUEST_UPDATE', payload: { message: "WARNING: SKY ISLAND DETECTED! PROJECT URSUS ONLINE." } });
  }

  private updateParticles() {
      const isMorning = this.time < 5000;
      if (this.rainIntensity > 0 && this.player.y < 60 * TILE_SIZE) {
          const count = Math.ceil(this.rainIntensity * 10); 
          if (this.currentBiome === BiomeType.GARBAGE_WASTES) {
              for(let i=0; i<count*2; i++) {
                  const px = this.cameraX + Math.random() * this.canvasWidth;
                  const py = this.cameraY + Math.random() * this.canvasHeight;
                  this.particles.push({x: px, y: py, vx: 15 + Math.random() * 10, vy: 1 + Math.random() * 2, life: 20, color: Math.random() > 0.5 ? '#d2b48c' : '#a1887f', size: Math.random() > 0.8 ? 2 : 1 });
              }
          } else if (this.currentBiome === BiomeType.INDUSTRIAL) {
              for(let i=0; i<count; i++) {
                  const px = this.cameraX + Math.random() * this.canvasWidth;
                  const py = this.cameraY - 10;
                  const isSpark = Math.random() < 0.2;
                  this.particles.push({x: px, y: py, vx: -2 + Math.random() * 1, vy: 15 + Math.random() * 5, life: 20, color: isSpark ? '#00e5ff' : 'rgba(170, 200, 255, 0.6)', size: isSpark ? 2 : 1 });
              }
          } else {
              for(let i=0; i<count; i++) {
                  const px = this.cameraX + Math.random() * this.canvasWidth;
                  const py = this.cameraY - 10;
                  this.particles.push({x: px, y: py, vx: -4 + Math.random() * 2, vy: 10 + Math.random() * 5, life: 30, color: 'rgba(200, 200, 255, 0.3)', size: Math.random() > 0.8 ? 2 : 1 });
              }
          }
      }
      if (isMorning && (this.currentBiome === BiomeType.OUTSKIRTS || this.currentBiome === BiomeType.INDUSTRIAL)) {
          if (Math.random() < 0.3) {
               const px = this.cameraX + Math.random() * this.canvasWidth;
               const py = (this.cameraY + this.canvasHeight) - Math.random() * 50; 
               this.particles.push({x: px, y: py, vx: (Math.random() - 0.5) * 0.5, vy: -0.2, life: 100, color: 'rgba(255, 255, 255, 0.1)', size: 4 + Math.random() * 4 });
          }
      }
      const beaconChance = 0.05;
      const locations = [
          { locs: this.ruinLocations, color: '#b71c1c' }, 
          { locs: this.factoryLocations, color: '#424242' }, 
          { locs: this.labLocations, color: '#00e5ff' },
          { locs: this.vaultLocation ? [this.vaultLocation] : [], color: '#ffd700' }
      ];
      locations.forEach(group => {
          group.locs.forEach(lx => {
              if (Math.abs(lx * TILE_SIZE - this.player.x) < 800) {
                  if (Math.random() < beaconChance) {
                      let sy = 0;
                      for(let y=0; y<WORLD_HEIGHT; y++) {
                          if (this.world[y][lx] !== TileType.AIR) {
                              sy = y * TILE_SIZE;
                              break;
                          }
                      }
                      if (sy > 0) {
                          this.particles.push({x: lx * TILE_SIZE + Math.random() * 16, y: sy - Math.random() * 10, vx: (Math.random()-0.5) * 0.5, vy: -1 - Math.random(), life: 100, color: group.color, size: 2 });
                      }
                  }
              }
          });
      });
      for(let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.x += p.vx; p.y += p.vy; p.life--;
          if (p.life <= 0) this.particles.splice(i, 1);
          if (p.vy > 0 && this.isSolid(this.getTileAt(p.x, p.y))) {
             this.particles.splice(i, 1);
          }
      }
  }

  public spawnEntity(type: EntityType, x?: number, y?: number, job?: VillagerJob, homeX?: number, homeY?: number) {
      if (!x) {
          const spawnTileX = Math.floor(this.player.x / TILE_SIZE) + (Math.random() > 0.5 ? (15 + Math.random()*10) : (-15 - Math.random()*10));
          if (spawnTileX < 2 || spawnTileX >= WORLD_WIDTH - 2) return;
          for(let fy=0; fy<WORLD_HEIGHT; fy++) {
              if (this.world[fy][spawnTileX] !== TileType.AIR && this.world[fy][spawnTileX] !== TileType.TREE_LEAVES) {
                  x = spawnTileX * TILE_SIZE;
                  y = (fy - 2) * TILE_SIZE;
                  break;
              }
          }
      }
      if (typeof x === 'number' && typeof y === 'number') {
          let hp = 30; let w = 16; let h = 24;
          if (type === EntityType.MECHA_REX) { hp = 600; w=48; h=48; }
          else if (type === EntityType.VOID_STALKER) { hp = 400; w=32; h=32; }
          else if (type === EntityType.BOSS_URSUS) { hp = 2000; w=48; h=48; }
          else if (type === EntityType.BOSS_GUARDIAN) { hp = 800; w=32; h=32; }
          else if (type === EntityType.BOSS_SENTRY) { hp = 600; w=32; h=24; }
          else if (type === EntityType.BOAR || type === EntityType.WOLF) { hp = 50; }
          else if (type === EntityType.RABBIT || type === EntityType.RAT) { hp = 10; w=8; h=8; }
          else if (type === EntityType.DUCK || type === EntityType.OWL || type === EntityType.BAT) { hp = 15; w=12; h=12; }
          else if (type === EntityType.PTEROSAUR) { hp = 120; w=32; h=20; }
          else if (type === EntityType.MECHA_BEAR) { hp = 180; w=32; h=24; }
          else if (type === EntityType.SCRAP_WALKER) { hp = 80; w=16; h=24; }
          let name = undefined;
          let personality = undefined;
          if (type === EntityType.VILLAGER) {
              name = VILLAGER_NAMES[Math.floor(Math.random() * VILLAGER_NAMES.length)];
              personality = VILLAGER_PERSONALITIES[Math.floor(Math.random() * VILLAGER_PERSONALITIES.length)];
          }
          this.entities.push({ id: `ent-${Date.now()}-${Math.random()}`, type, x, y, vx: 0, vy: 0, width: w, height: h, health: hp, maxHealth: hp, facingRight: Math.random() > 0.5, animationFrame: 0, isDead: false, hasQuest: type === EntityType.VILLAGER && Math.random() < 0.3, damageTaken: 0, job: job || VillagerJob.UNEMPLOYED, state: VillagerState.IDLE, homeX: homeX || x, homeY: homeY || y, stateTimer: 0, attackPhase: 0, bookTimer: type === EntityType.VILLAGER && job === VillagerJob.LIBRARIAN ? Math.random() * 2000 : undefined, name, personality, isInParty: false, equipment: { head: null, body: null, module: null }, chatHistory: [], lastInteractionTime: 0 });
      }
  }

  private updateEntities() {
      const activeEntities = this.entities.filter(e => !e.isDead);
      const isNight = this.time > 14000 && this.time < 22000;
      const isHeavyRain = this.rainIntensity > 0.4;
      const seekingShelter = isHeavyRain || isNight;
      activeEntities.forEach(ent => {
          if (ent.stateTimer && ent.stateTimer > 0) ent.stateTimer--;
          if (ent.job === VillagerJob.LIBRARIAN) { if (ent.bookTimer === undefined) ent.bookTimer = 0; ent.bookTimer++; if (ent.bookTimer > 3000 && ent.state !== AIState.SEEKING_SHELTER) ent.emote = '📘'; }
          if (ent.type === EntityType.BOSS_GUARDIAN) {
              const distToPlayer = Math.sqrt(Math.pow(this.player.x - ent.x, 2) + Math.pow(this.player.y - ent.y, 2));
              if (ent.state === AIState.IDLE || !ent.state) { if (distToPlayer < 400) ent.state = AIState.CHASING; } 
              else if (ent.state === AIState.CHASING) { ent.vx = (this.player.x - ent.x) > 0 ? 1 : -1; ent.facingRight = ent.vx > 0; if (distToPlayer < 80 && ent.stateTimer <= 0) { ent.state = AIState.BOSS_SMASH; ent.stateTimer = 60; ent.vy = -8; } else if (Math.random() < 0.01 && ent.stateTimer <= 0) { ent.state = AIState.BOSS_LASER; ent.stateTimer = 100; ent.vx = 0; } } 
              else if (ent.state === AIState.BOSS_SMASH) { if (ent.vy > 0 && this.isSolid(this.getTileAt(ent.x, ent.y + ent.height + 2))) { ent.state = AIState.BOSS_RECOVER; ent.stateTimer = 40; this.projectiles.push({ id: 'sw1', x: ent.x, y: ent.y+ent.height-5, vx: 5, vy: 0, width: 10, height: 10, damage: 20, life: 20, type: 'shockwave', color: '#ffeb3b', isEnemy: true }, { id: 'sw2', x: ent.x, y: ent.y+ent.height-5, vx: -5, vy: 0, width: 10, height: 10, damage: 20, life: 20, type: 'shockwave', color: '#ffeb3b', isEnemy: true }); } } 
              else if (ent.state === AIState.BOSS_LASER) { ent.emote = '⚡'; if (ent.stateTimer === 30) { const dx = this.player.x - ent.x; const dy = this.player.y - ent.y; const angle = Math.atan2(dy, dx); this.projectiles.push({ id: 'laser', x: ent.x + ent.width/2, y: ent.y + ent.height/2, vx: Math.cos(angle)*8, vy: Math.sin(angle)*8, width: 8, height: 8, damage: 30, life: 60, type: 'laser', color: '#f44336', isEnemy: true }); } if (ent.stateTimer <= 0) ent.state = AIState.CHASING; } 
              else if (ent.state === AIState.BOSS_RECOVER) { ent.vx = 0; if (ent.stateTimer <= 0) ent.state = AIState.CHASING; }
          }
          else if (ent.type === EntityType.BOSS_SENTRY) {
              const distToPlayer = Math.abs(this.player.x - ent.x); ent.facingRight = this.player.x > ent.x;
              if (ent.state === AIState.IDLE) { if (distToPlayer < 500) ent.state = AIState.BOSS_LASER; }
              else if (ent.state === AIState.BOSS_LASER) { if (ent.stateTimer <= 0) ent.stateTimer = 100; if (ent.stateTimer % 10 === 0) { const angle = Math.atan2(this.player.y - ent.y, this.player.x - ent.x); const spread = (Math.random() - 0.5) * 0.2; this.projectiles.push({ id: 'bullet', x: ent.x + ent.width/2, y: ent.y, vx: Math.cos(angle+spread)*6, vy: Math.sin(angle+spread)*6, width: 4, height: 4, damage: 10, life: 100, type: 'bullet', color: '#ff9800', isEnemy: true }); } if (Math.random() < 0.02) { ent.state = AIState.BOSS_MISSILE; ent.stateTimer = 60; } }
              else if (ent.state === AIState.BOSS_MISSILE) { ent.vx = 0; ent.emote = '🚀'; if (ent.stateTimer === 10) { this.projectiles.push({ id: 'missile', x: ent.x + ent.width/2, y: ent.y - 10, vx: 0, vy: -5, width: 8, height: 8, damage: 40, life: 200, type: 'missile', color: '#d50000', isEnemy: true, targetId: 'player' }); } if (ent.stateTimer <= 0) ent.state = AIState.BOSS_LASER; }
          }
          else if (ent.type === EntityType.BOSS_URSUS) {
              if (ent.state === AIState.IDLE) { if (Math.random() < 0.05) { const rand = Math.random(); if (rand < 0.2) ent.state = AIState.BOSS_SMASH; else if (rand < 0.4) ent.state = AIState.BOSS_MISSILE; else if (rand < 0.6) ent.state = AIState.BOSS_CHARGE; else if (rand < 0.8) ent.state = AIState.BOSS_LASER; else ent.state = AIState.BOSS_SUMMON; ent.stateTimer = 120; } else { const dx = this.player.x - ent.x; if (Math.abs(dx) > 50) ent.vx = dx > 0 ? 1 : -1; } }
              if (ent.state === AIState.BOSS_SMASH) { if (ent.stateTimer === 60) ent.vy = -10; if (ent.vy > 0 && this.isSolid(this.getTileAt(ent.x, ent.y+ent.height+2))) { for(let i=-2; i<=2; i++) { if (i===0) continue; this.projectiles.push({ id: 'quake', x: ent.x, y: ent.y+ent.height, vx: i*4, vy: 0, width: 16, height: 16, damage: 30, life: 30, type: 'shockwave', color: '#5d4037', isEnemy: true }); } ent.state = AIState.IDLE; } }
              else if (ent.state === AIState.BOSS_MISSILE) { if (ent.stateTimer % 20 === 0 && ent.stateTimer > 20) { this.projectiles.push({ id: 'missile', x: ent.x + ent.width/2, y: ent.y, vx: (Math.random()-0.5)*4, vy: -8, width: 8, height: 8, damage: 25, life: 150, type: 'missile', color: '#d50000', isEnemy: true, targetId: 'player' }); } if (ent.stateTimer <= 0) ent.state = AIState.IDLE; }
              else if (ent.state === AIState.BOSS_CHARGE) { if (ent.stateTimer === 100) ent.vx = (this.player.x - ent.x) > 0 ? 8 : -8; if (ent.stateTimer < 100) ent.vx *= 0.98; if (this.checkRectOverlap(ent, this.player)) { this.takeDamage(20); this.player.vx = ent.vx * 2; } if (ent.stateTimer <= 0) ent.state = AIState.IDLE; }
              else if (ent.state === AIState.BOSS_LASER) { ent.vx = 0; if (ent.stateTimer === 60) { for(let a=0; a<5; a++) { const ang = -Math.PI/4 - (a * Math.PI/8); this.projectiles.push({ id: 'laser', x: ent.x + ent.width/2, y: ent.y + 10, vx: Math.cos(ang)*6, vy: Math.sin(ang)*6, width: 6, height: 6, damage: 35, life: 60, type: 'laser', color: '#76ff03', isEnemy: true }); } } if (ent.stateTimer <= 0) ent.state = AIState.IDLE; }
              else if (ent.state === AIState.BOSS_SUMMON) { ent.vx = 0; ent.emote = '🤖'; if (ent.stateTimer === 60) { this.spawnEntity(EntityType.DRONE, ent.x - 30, ent.y - 30); this.spawnEntity(EntityType.DRONE, ent.x + 30, ent.y - 30); } if (ent.stateTimer <= 0) ent.state = AIState.IDLE; }
          }
          else { this.updateStandardAI(ent, activeEntities, seekingShelter, isHeavyRain); }
          if (ent.emoteTimer && ent.emoteTimer > 0) { ent.emoteTimer--; if (ent.emoteTimer <= 0) ent.emote = undefined; }
          const isFlyer = ent.type === EntityType.BAT || ent.type === EntityType.OWL || ent.type === EntityType.DRONE || ent.type === EntityType.PTEROSAUR || ent.type === EntityType.BOSS_SENTRY;
          if (ent.type !== EntityType.BOSS_GUARDIAN && ent.type !== EntityType.BOSS_URSUS && !isFlyer) { ent.vx *= FRICTION; ent.vy += GRAVITY; } else if (isFlyer) { ent.vx *= 0.95; ent.vy *= 0.95; } else { if (ent.state !== AIState.BOSS_SMASH) ent.vy += GRAVITY; ent.vx *= 0.9; }
          this.applyEntityPhysics(ent);
          if (this.time % 10 === 0) ent.animationFrame++;
      });
      this.entities = this.entities.filter(e => !e.isDead);
      this.emit({ type: 'ENTITY_UPDATE', payload: this.entities });
  }

  private updateStandardAI(ent: Entity, activeEntities: Entity[], seekingShelter: boolean, isHeavyRain: boolean) {
      const distToPlayer = Math.abs(this.player.x - ent.x);
      let target: any = null;
      const MOB_JUMP = -4.2; 
      if (ent.type === EntityType.VILLAGER) {
          if (ent.damageTaken > 30) { ent.state = AIState.ATTACKING; ent.isInParty = false; target = this.player; } else if (ent.isInParty) { if (ent.state === AIState.IDLE) { const enemy = activeEntities.find(e => e.type !== EntityType.VILLAGER && !e.isDead && Math.abs(e.x - ent.x) < 200 && e.type !== EntityType.RABBIT); if (enemy) { ent.targetId = enemy.id; ent.state = AIState.ATTACKING; } } else if (ent.state === AIState.FOLLOWING) { target = this.player; if (distToPlayer < 50) target = null; const enemy = activeEntities.find(e => e.type !== EntityType.VILLAGER && !e.isDead && Math.abs(e.x - ent.x) < 300 && e.type !== EntityType.RABBIT); if (enemy) { ent.targetId = enemy.id; ent.state = AIState.ATTACKING; } } else if (ent.state === AIState.ATTACKING) { if (ent.targetId) { target = activeEntities.find(e => e.id === ent.targetId); if (!target || target.isDead) { ent.state = ent.isInParty ? AIState.FOLLOWING : AIState.IDLE; target = this.player; } } else { ent.state = AIState.FOLLOWING; } } } else if (ent.state === AIState.FOLLOWING) { target = this.player; if (distToPlayer < 40) target = null; } else if (ent.homeX && seekingShelter && ent.state !== AIState.ATTACKING) { ent.state = AIState.SEEKING_SHELTER; if (Math.abs(ent.x - ent.homeX) > 16) { ent.vx = (ent.homeX - ent.x) > 0 ? 1 : -1; const wallX = ent.x + (ent.vx > 0 ? ent.width + 5 : -5); const headClear = !this.isSolid(this.getTileAt(ent.x + ent.width/2, ent.y - 16)); if (headClear && this.isSolid(this.getTileAt(wallX, ent.y + ent.height - 2)) && ent.vy === 0) { ent.vy = MOB_JUMP; } return; } } else if (ent.state === AIState.ATTACKING && ent.targetId) { target = this.entities.find(e => e.id === ent.targetId); if (!target) ent.state = AIState.IDLE; }
      }
      const aggressiveMobs = [EntityType.ZOMBIE, EntityType.WOLF, EntityType.PTEROSAUR, EntityType.MECHA_BEAR];
      if (aggressiveMobs.includes(ent.type)) { if (distToPlayer < 400) target = this.player; }
      const passiveMobs = [EntityType.RABBIT, EntityType.FOX, EntityType.DEER, EntityType.BOAR, EntityType.DUCK, EntityType.RAT, EntityType.OWL];
      if (passiveMobs.includes(ent.type)) { if (distToPlayer < 120) { const dx = ent.x - this.player.x; ent.vx = dx > 0 ? 2 : -2; ent.facingRight = ent.vx > 0; ent.state = AIState.FLEEING; const wallX = ent.x + (dx > 0 ? ent.width + 2 : -2); const isBlocked = this.isSolid(this.getTileAt(wallX, ent.y + ent.height - 5)); if (isBlocked && ent.vy === 0) { ent.vy = MOB_JUMP; } return; } }
      if (target) {
           const dx = target.x - ent.x; const dy = target.y - ent.y;
           if (ent.type === EntityType.PTEROSAUR || ent.type === EntityType.DRONE) { const angle = Math.atan2(dy, dx); ent.vx += Math.cos(angle) * 0.2; ent.vy += Math.sin(angle) * 0.2; const speed = Math.sqrt(ent.vx*ent.vx + ent.vy*ent.vy); if (speed > 4) { ent.vx = (ent.vx/speed)*4; ent.vy = (ent.vy/speed)*4; } } 
           else { const speed = ent.type === EntityType.MECHA_BEAR ? 2.5 : (ent.type === EntityType.WOLF ? 1.5 : (ent.type === EntityType.VILLAGER ? 1.5 : (ent.type === EntityType.MECHA_REX ? 1.2 : 0.5))); ent.vx = dx > 0 ? speed : -speed; ent.facingRight = dx > 0; if (Math.abs(dx) > 10 && ent.vy === 0) { const wallX = ent.x + (dx > 0 ? ent.width + 2 : -2); const headClear = !this.isSolid(this.getTileAt(ent.x + ent.width/2, ent.y - 16)); const isBlocked = this.isSolid(this.getTileAt(wallX, ent.y + ent.height - 2)); if (headClear && isBlocked) { ent.vy = MOB_JUMP; } if (ent.isInParty && headClear && target === this.player) { const hittingWall = this.isSolid(this.getTileAt(wallX, ent.y + ent.height/2)); const playerAbove = (target.y < ent.y - 32); if (hittingWall && playerAbove) { ent.vy = MOB_JUMP * 1.2; ent.vx = dx > 0 ? -4 : 4; } } } }
           if (Math.abs(dx) < 30 && Math.abs(dy) < 30) { if (this.time % 30 === 0 && target === this.player && ent.type !== EntityType.VILLAGER) { const dmg = ent.type === EntityType.MECHA_BEAR ? 25 : (ent.type === EntityType.MECHA_REX ? 40 : 5); this.takeDamage(dmg); } else if (ent.type === EntityType.VILLAGER && ent.state === AIState.ATTACKING && target !== this.player) { if (this.time % 30 === 0) { let dmg = 5; if (ent.equipment?.body) { if (ent.equipment.body?.type === ItemType.WEAPON) dmg = ent.equipment.body.stats?.damage || 5; } target.health -= dmg; target.vx = (target.x - ent.x) > 0 ? 5 : -5; target.vy = -3; target.emote = '💥'; if (target.health <= 0) { target.isDead = true; if (ent.isInParty) { this.handleEntityDeath(target); } } } } }
      } else if (Math.random() < 0.02) { ent.vx = (Math.random() - 0.5); if (ent.type === EntityType.PTEROSAUR) ent.vy = (Math.random() - 0.5); }
  }

  private applyEntityPhysics(ent: Entity) {
      const isFlyer = ent.type === EntityType.BAT || ent.type === EntityType.OWL || ent.type === EntityType.DRONE || ent.type === EntityType.PTEROSAUR || ent.type === EntityType.BOSS_SENTRY;
      if (!isFlyer) {
         const nextX = ent.x + ent.vx; let colX = false; const pointsY = [ent.y + 2, ent.y + ent.height/2, ent.y + ent.height - 2];
         if (ent.vx > 0) { const testX = nextX + ent.width; if (pointsY.some(py => this.isSolid(this.getTileAt(testX, py)))) { ent.x = (Math.floor(testX / TILE_SIZE)) * TILE_SIZE - ent.width; ent.vx = 0; colX = true; } } else if (ent.vx < 0) { const testX = nextX; if (pointsY.some(py => this.isSolid(this.getTileAt(testX, py)))) { ent.x = (Math.floor(testX / TILE_SIZE) + 1) * TILE_SIZE; ent.vx = 0; colX = true; } } if (!colX) ent.x = nextX;
         const nextY = ent.y + ent.vy; let colY = false; const pointsX = [ent.x + 2, ent.x + ent.width/2, ent.x + ent.width - 2];
         if (ent.vy > 0) { const testY = nextY + ent.height; if (pointsX.some(px => this.isSolid(this.getTileAt(px, testY)))) { ent.y = (Math.floor(testY / TILE_SIZE)) * TILE_SIZE - ent.height; ent.vy = 0; colY = true; } } else if (ent.vy < 0) { const testY = nextY; if (pointsX.some(px => this.isSolid(this.getTileAt(px, testY)))) { ent.y = (Math.floor(testY / TILE_SIZE) + 1) * TILE_SIZE; ent.vy = 0; colY = true; } } if (!colY) ent.y = nextY;
      } else { 
          // FLYER COLLISION
          const nextX = ent.x + ent.vx;
          let colX = false;
          const pointsY = [ent.y + 4, ent.y + ent.height/2, ent.y + ent.height - 4];
          if (ent.vx > 0) {
              const testX = nextX + ent.width;
              if (pointsY.some(py => this.isSolid(this.getTileAt(testX, py)))) {
                  ent.x = (Math.floor(testX / TILE_SIZE)) * TILE_SIZE - ent.width;
                  ent.vx *= -1; 
                  colX = true;
              }
          } else if (ent.vx < 0) {
              const testX = nextX;
              if (pointsY.some(py => this.isSolid(this.getTileAt(testX, py)))) {
                  ent.x = (Math.floor(testX / TILE_SIZE) + 1) * TILE_SIZE;
                  ent.vx *= -1;
                  colX = true;
              }
          }
          if (!colX) ent.x = nextX;

          const nextY = ent.y + ent.vy;
          let colY = false;
          const pointsX = [ent.x + 4, ent.x + ent.width - 4];
          if (ent.vy > 0) {
              const testY = nextY + ent.height;
              if (pointsX.some(px => this.isSolid(this.getTileAt(px, testY)))) {
                  ent.y = (Math.floor(testY / TILE_SIZE)) * TILE_SIZE - ent.height;
                  ent.vy *= -1;
                  colY = true;
              }
          } else if (ent.vy < 0) {
              const testY = nextY;
              if (pointsX.some(px => this.isSolid(this.getTileAt(px, testY)))) {
                  ent.y = (Math.floor(testY / TILE_SIZE) + 1) * TILE_SIZE;
                  ent.vy *= -1;
                  colY = true;
              }
          }
          if (!colY) ent.y = nextY;

          if (ent.y < 0) { ent.y = 0; ent.vy = Math.abs(ent.vy); } 
          if (ent.y > WORLD_HEIGHT * TILE_SIZE) { ent.y = WORLD_HEIGHT * TILE_SIZE; ent.vy = -Math.abs(ent.vy); } 
      }
  }

  private updatePhysics() {
      if (this.player.creativeMode) {
          this.player.isCrouching = false;
          let currentSpeed = MOVE_SPEED * 1.5;
          
          if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.player.vx -= currentSpeed;
          if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.player.vx += currentSpeed;
          
          if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.player.vy -= currentSpeed;
          if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.player.vy += currentSpeed;

          this.player.vx *= FRICTION;
          this.player.vy *= FRICTION;

          const max = MAX_SPEED * 2;
          if (this.player.vx > max) this.player.vx = max;
          if (this.player.vx < -max) this.player.vx = -max;
          if (this.player.vy > max) this.player.vy = max;
          if (this.player.vy < -max) this.player.vy = -max;

          const nextX = this.player.x + this.player.vx;
          let colX = false;
          if (this.player.vx > 0) {
              const testX = nextX + this.player.width;
              if (this.isSolid(this.getTileAt(testX, this.player.y + this.player.height/2))) {
                  this.player.vx = 0; colX = true;
              }
          } else if (this.player.vx < 0) {
              const testX = nextX;
              if (this.isSolid(this.getTileAt(testX, this.player.y + this.player.height/2))) {
                  this.player.vx = 0; colX = true;
              }
          }
          if (!colX) this.player.x = nextX;

          const nextY = this.player.y + this.player.vy;
          let colY = false;
          if (this.player.vy > 0) {
              const testY = nextY + this.player.height;
              if (this.isSolid(this.getTileAt(this.player.x + this.player.width/2, testY))) {
                  this.player.vy = 0; colY = true;
              }
          } else if (this.player.vy < 0) {
              const testY = nextY;
              if (this.isSolid(this.getTileAt(this.player.x + this.player.width/2, testY))) {
                  this.player.vy = 0; colY = true;
              }
          }
          if (!colY) this.player.y = nextY;

          this.player.isGrounded = false; 
          this.player.facingRight = this.player.vx > 0 ? true : (this.player.vx < 0 ? false : this.player.facingRight);
          this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
          return; 
      }

      this.player.isCrouching = (this.keys.has('KeyS') || this.keys.has('ArrowDown')) && this.player.isGrounded;
      if (!this.player.isRolling && this.player.movementCooldown <= 0) { let currentSpeed = MOVE_SPEED; if (this.player.isCrouching) currentSpeed *= 0.4; if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) { this.player.vx -= currentSpeed; if (this.player.speed) this.player.vx -= this.player.speed * 0.1; } if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) { this.player.vx += currentSpeed; if (this.player.speed) this.player.vx += this.player.speed * 0.1; } const max = MAX_SPEED + (this.player.speed ? this.player.speed * 0.5 : 0); if (this.player.vx > max) this.player.vx = max; if (this.player.vx < -max) this.player.vx = -max; }
      if (!this.player.isRolling) this.player.vx *= FRICTION;
      const centerTile = this.getTileAt(this.player.x + this.player.width/2, this.player.y + this.player.height/2);
      const isOnPole = centerTile === TileType.POLE || centerTile === TileType.HANGING_WIRES;
      if (isOnPole) { this.player.vy = 0; this.player.isGrounded = true; if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) { this.player.vy = -3; } if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) { this.player.vy = 3; } } else { this.player.vy += GRAVITY; }
      if (this.player.vy > TERMINAL_VELOCITY) this.player.vy = TERMINAL_VELOCITY;
      if (this.player.wallSlideDir !== 0 && this.player.vy > 0 && !isOnPole) { this.player.vy *= 0.8; }
      const nextX = this.player.x + this.player.vx; let colX = false; this.player.wallSlideDir = 0; const pointsY = [this.player.y + 4, this.player.y + this.player.height/2, this.player.y + this.player.height - 4];
      if (this.player.vx > 0) { const testX = nextX + this.player.width; if (pointsY.some(py => this.isSolid(this.getTileAt(testX, py)))) { this.player.x = (Math.floor(testX / TILE_SIZE)) * TILE_SIZE - this.player.width; this.player.vx = 0; colX = true; if (!this.player.isGrounded) this.player.wallSlideDir = 1; } } else if (this.player.vx < 0) { const testX = nextX; if (pointsY.some(py => this.isSolid(this.getTileAt(testX, py)))) { this.player.x = (Math.floor(testX / TILE_SIZE) + 1) * TILE_SIZE; this.player.vx = 0; colX = true; if (!this.player.isGrounded) this.player.wallSlideDir = -1; } } if (!colX) this.player.x = nextX;
      const nextY = this.player.y + this.player.vy; let colY = false; const pointsX = [this.player.x + 4, this.player.x + this.player.width - 4]; this.player.isGrounded = isOnPole;
      if (this.player.vy > 0) { const testY = nextY + this.player.height; if (pointsX.some(px => this.isSolid(this.getTileAt(px, testY)))) { const landY = (Math.floor(testY / TILE_SIZE)) * TILE_SIZE - this.player.height; if (this.player.vy > FALL_DAMAGE_THRESHOLD && !this.player.isGroundPounding && !isOnPole) { const dmg = Math.floor((this.player.vy - FALL_DAMAGE_THRESHOLD) * FALL_DAMAGE_MULTIPLIER); if (dmg > 0) this.takeDamage(dmg); } if (this.player.isGroundPounding) { for(let i=0; i<8; i++) { this.particles.push({ x: this.player.x + this.player.width/2, y: landY + this.player.height, vx: (Math.random()-0.5)*10, vy: -Math.random()*5, life: 20, color: '#fff', size: 3 }); } this.entities.forEach(e => { if (!e.isDead && Math.abs(e.x - this.player.x) < 50 && Math.abs(e.y - this.player.y) < 50) { e.health -= 20; e.damageTaken += 20; e.vy = -5; if (e.health <= 0) { e.isDead = true; this.handleEntityDeath(e); } } }); this.player.isGroundPounding = false; } this.player.y = landY; this.player.vy = 0; this.player.isGrounded = true; colY = true; } } else if (this.player.vy < 0) { const testY = nextY; if (pointsX.some(px => this.isSolid(this.getTileAt(px, testY)))) { this.player.y = (Math.floor(testY / TILE_SIZE) + 1) * TILE_SIZE; this.player.vy = 0; colY = true; } } if (!colY) this.player.y = nextY;
      if (this.player.isGrounded && this.jumpBuffer > 0) { this.player.vy = JUMP_FORCE; if (this.player.isCrouching) { this.player.vy = JUMP_FORCE * 1.3; } this.jumpBuffer = 0; }
      if (this.keys.has('Space') && !this.player.isGrounded && this.player.wallSlideDir !== 0) { this.player.vy = JUMP_FORCE * 0.9; this.player.vx = -this.player.wallSlideDir * 5; this.player.wallSlideDir = 0; }
      this.animTimer++; if (this.player.vx !== 0 || !this.player.isGrounded) { if (this.animTimer > 5) { this.player.animationFrame++; this.animTimer = 0; } } else { if (this.animTimer > 20) { this.player.animationFrame++; this.animTimer = 0; } }
      this.player.facingRight = this.player.vx > 0 ? true : (this.player.vx < 0 ? false : this.player.facingRight);
      if (this.player.y > WORLD_HEIGHT * TILE_SIZE + 200) { this.takeDamage(1000); }
      this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
  }

  public checkRectOverlap(r1: {x:number, y:number, width:number, height:number}, r2: {x:number, y:number, width:number, height:number}): boolean {
      return r1.x < r2.x + r2.width &&
             r1.x + r1.width > r2.x &&
             r1.y < r2.y + r2.height &&
             r1.y + r1.height > r2.y;
  }

  public takeDamage(amount: number) {
      if (this.player.creativeMode) return;
      if (this.player.damageCooldown && this.player.damageCooldown > 0) return;
      if (this.player.isRolling) return; 

      let actualDamage = Math.max(1, amount - this.player.defense);
      this.player.health -= actualDamage;
      this.player.damageCooldown = 60; 
      this.emit({ type: 'PLAYER_UPDATE', payload: this.player });

      if (this.player.health <= 0) {
          this.isGameOver = true;
          this.emit({ type: 'GAME_OVER', payload: { reason: "Vital signs critical." } });
      }
  }

  public updateCamera() {
      const targetX = this.player.x - (this.canvasWidth / 2) + (this.player.width / 2);
      const targetY = this.player.y - (this.canvasHeight / 2) + (this.player.height / 2);
      
      this.cameraX += (targetX - this.cameraX) * 0.1;
      this.cameraY += (targetY - this.cameraY) * 0.1;
      
      const maxX = WORLD_WIDTH * TILE_SIZE - this.canvasWidth;
      const maxY = WORLD_HEIGHT * TILE_SIZE - this.canvasHeight;

      this.cameraX = Math.max(0, Math.min(this.cameraX, maxX));
      this.cameraY = Math.max(-200, Math.min(this.cameraY, maxY + 50));
  }

  public addToInventory(tileType: TileType, count: number = 1) {
      const existing = this.inventory.find(i => i.tileType === tileType && i.count < 64);
      if (existing) {
          existing.count += count;
      } else {
          const empty = this.inventory.find(i => i.count === 0);
          if (empty) {
              empty.type = ItemType.BLOCK;
              empty.tileType = tileType;
              empty.name = TileType[tileType];
              empty.count = count;
              const icons: Record<number, string> = {
                   [TileType.DIRT]: '🟫', [TileType.GRASS]: '🌿', [TileType.STONE]: '🪨', [TileType.WOOD]: '🪵',
                   [TileType.ORE_IRON]: '🔩', [TileType.ORE_GOLD]: '🟡', [TileType.TORCH]: '🔥',
                   [TileType.PLANK]: '🟫', [TileType.WORKBENCH]: '🛠️', [TileType.ANVIL]: '🔨', [TileType.WHEAT]: '🌾'
              };
              empty.icon = icons[tileType] || '🧱';
          } else {
              this.emit({ type: 'QUEST_UPDATE', payload: { message: "Inventory Full!" } });
              return;
          }
      }
      this.updateQuestProgress(); 
      this.emit({ type: 'INVENTORY_UPDATE', payload: this.inventory });
  }

  public addCustomItemToInventory(itemId: string, count: number = 1) {
      const def = CUSTOM_ITEMS[itemId];
      if (!def) return; 

      const existing = this.inventory.find(i => i.name === def.name && i.count < 64);
      if (existing) {
          existing.count += count;
      } else {
          const empty = this.inventory.find(i => i.count === 0);
          if (empty) {
              Object.assign(empty, { ...def, id: `loot-${Date.now()}-${Math.random()}`, count });
          } else {
              this.emit({ type: 'QUEST_UPDATE', payload: { message: "Inventory Full!" } });
              return;
          }
      }
      this.updateQuestProgress();
      this.emit({ type: 'INVENTORY_UPDATE', payload: this.inventory });
  }

  public craft(recipe: CraftingRecipe) {
      const valid = recipe.ingredients.every(ing => {
          const item = this.inventory.find(i => i.name === ing.name);
          return item && item.count >= ing.count;
      });

      if (!valid) return;

      if (recipe.requiredTile) {
          const radius = 100;
          let hasStation = false;
          const px = Math.floor(this.player.x / TILE_SIZE);
          const py = Math.floor(this.player.y / TILE_SIZE);
          const r = Math.ceil(radius / TILE_SIZE);
          
          for(let y = py-r; y<=py+r; y++) {
              for(let x = px-r; x<=px+r; x++) {
                  if (this.getTileAt(x*TILE_SIZE, y*TILE_SIZE) === recipe.requiredTile) {
                      hasStation = true;
                      break;
                  }
              }
              if (hasStation) break;
          }
          
          if (!hasStation) {
              this.emit({ type: 'QUEST_UPDATE', payload: { message: `Requires ${TileType[recipe.requiredTile]} nearby.` } });
              return;
          }
      }

      recipe.ingredients.forEach(ing => {
          const item = this.inventory.find(i => i.name === ing.name);
          if (item) {
              item.count -= ing.count;
              if (item.count <= 0) {
                  item.type = ItemType.BLOCK;
                  item.tileType = TileType.AIR;
                  item.name = 'Empty';
                  item.count = 0;
                  item.icon = '';
              }
          }
      });

      const existing = this.inventory.find(i => i.name === recipe.result.name && i.count < 64 && i.type === recipe.result.type);
      if (existing) {
          existing.count += recipe.result.count;
      } else {
          const empty = this.inventory.find(i => i.count === 0);
          if (empty) {
              Object.assign(empty, { ...recipe.result, id: `crafted-${Date.now()}`, count: recipe.result.count });
          } else {
              this.emit({ type: 'QUEST_UPDATE', payload: { message: "Inventory Full! Item lost." } });
          }
      }
      this.updateQuestProgress();
      this.emit({ type: 'INVENTORY_UPDATE', payload: this.inventory });
      this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
  }

  public getTileAt(pixelX: number, pixelY: number): TileType {
      const tx = Math.floor(pixelX / TILE_SIZE);
      const ty = Math.floor(pixelY / TILE_SIZE);
      if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return TileType.AIR;
      return this.world[ty][tx];
  }

  public isSolid(t: TileType): boolean {
      return t !== TileType.AIR && 
             t !== TileType.TORCH && 
             t !== TileType.WHEAT && 
             t !== TileType.DOOR_OPEN && 
             t !== TileType.POLE && 
             t !== TileType.DEAD_BUSH && 
             t !== TileType.HANGING_WIRES &&
             t !== TileType.TREE_LEAVES &&
             t !== TileType.LEAVES &&
             t !== TileType.TREE_LOG &&
             t !== TileType.BOOKSHELF &&
             t !== TileType.LECTERN;
  }

  private checkBlockBreakEvents(tx: number, ty: number, tile: TileType): boolean {
      let bossSpawned = false;

      // BOSS SPAWNING
      if (tile === TileType.ALTAR) {
          this.spawnEntity(EntityType.BOSS_GUARDIAN, (tx-1)*TILE_SIZE, (ty-2)*TILE_SIZE);
          this.emit({ type: 'BOSS_SPAWNED', payload: { name: 'TEMPLE GUARDIAN' } });
          bossSpawned = true;
      } else if (tile === TileType.SERVER_TERMINAL) {
           // Standard security sentry only now. Boss Ursus moved to Sky Island.
           this.spawnEntity(EntityType.BOSS_SENTRY, (tx-1)*TILE_SIZE, (ty-2)*TILE_SIZE);
           this.emit({ type: 'BOSS_SPAWNED', payload: { name: 'SECURITY SYSTEM' } });
           bossSpawned = true;
      }

      if (tile === TileType.OLD_WORLD_DEBRIS || tile === TileType.SERVER_TERMINAL || tile === TileType.TELESCOPE) {
           this.emit({ type: 'LORE_DISCOVERED', payload: { block: TileType[tile], depth: ty, surroundings: 'Ruins' } });
      }
      
      return bossSpawned;
  }

  private updateInteraction() {
      if (this.player.isInventoryOpen) return;

      // virtualCursor is now in logical pixels (set by GameCanvas scaling)
      // So we just add the camera offset to get world coordinates
      const mx = this.virtualCursor.x + this.cameraX;
      const my = this.virtualCursor.y + this.cameraY;
      
      const tx = Math.floor(mx / TILE_SIZE);
      const ty = Math.floor(my / TILE_SIZE);

      const px = this.player.x + this.player.width/2;
      const py = this.player.y + this.player.height/2;
      const dist = Math.sqrt((mx - px)**2 + (my - py)**2);
      
      const item = this.inventory[this.player.selectedSlot];

      if (!this.mouseState.leftDown) {
          this.miningState = null;
      }

      if (this.actionCooldown > 0) return;

      if (this.mouseState.rightDown) {
          const clickedEntity = this.entities.find(e => 
              mx >= e.x && mx <= e.x + e.width &&
              my >= e.y && my <= e.y + e.height &&
              !e.isDead
          );
          
          if (clickedEntity && clickedEntity.type === EntityType.VILLAGER && dist < REACH_PIXELS) {
              // 1. Check Quest Completion
              if (this.player.activeQuestId && this.player.questGiverId === clickedEntity.id) {
                   const quest = SIDE_QUESTS.find(q => q.id === this.player.activeQuestId);
                   if (quest && (this.player.questProgress || 0) >= quest.objective.amount) {
                       this.emit({ type: 'QUEST_COMPLETION', payload: { quest } });
                       this.actionCooldown = 30;
                       return;
                   }
              }

              // 2. Check Quest Offer
              if (clickedEntity.hasQuest && !this.player.activeQuestId) {
                   // Assign a random quest
                   const quest = SIDE_QUESTS[Math.floor(Math.random() * SIDE_QUESTS.length)];
                   this.emit({ type: 'QUEST_OFFER', payload: { quest, giverId: clickedEntity.id } });
                   this.actionCooldown = 30;
                   return;
              }

              this.emit({ type: 'DIALOGUE_OPEN', payload: { entityId: clickedEntity.id } });
              this.actionCooldown = 30;
              return;
          }

          const tile = this.getTileAt(mx, my);
          if (dist < REACH_PIXELS) {
              if (tile === TileType.DOOR_CLOSED) {
                  this.world[ty][tx] = TileType.DOOR_OPEN;
                  this.actionCooldown = 10;
                  return;
              } else if (tile === TileType.DOOR_OPEN) {
                  this.world[ty][tx] = TileType.DOOR_CLOSED;
                  this.actionCooldown = 10;
                  return;
              }
          }

          if (item && item.type === ItemType.BLOCK && item.count > 0 && dist < REACH_PIXELS) {
               const tileAt = this.getTileAt(mx, my);
               if (tileAt === TileType.AIR || tileAt === TileType.WHEAT || tileAt === TileType.DEAD_BUSH || tileAt === TileType.HANGING_WIRES) {
                   const isOccupied = this.entities.some(e => 
                       !e.isDead &&
                       e.x < (tx+1)*TILE_SIZE && e.x + e.width > tx*TILE_SIZE &&
                       e.y < (ty+1)*TILE_SIZE && e.y + e.height > ty*TILE_SIZE
                   );
                   const playerOccupied = 
                       this.player.x < (tx+1)*TILE_SIZE && this.player.x + this.player.width > tx*TILE_SIZE &&
                       this.player.y < (ty+1)*TILE_SIZE && this.player.y + this.player.height > ty*TILE_SIZE;

                   if (!isOccupied && !playerOccupied) {
                       if (item.tileType) {
                           this.world[ty][tx] = item.tileType;
                           item.count--;
                           if (item.count <= 0) {
                               this.inventory[this.player.selectedSlot] = { id: `empty-${Date.now()}`, type: ItemType.BLOCK, tileType: TileType.AIR, name: 'Empty', count: 0, icon: '' };
                           }
                           this.emit({ type: 'INVENTORY_UPDATE', payload: this.inventory });
                           this.actionCooldown = 10;
                       }
                   }
               }
          }
          
          if (item && item.type === ItemType.CONSUMABLE && item.count > 0) {
              if (item.stats?.heal && this.player.health < this.player.maxHealth) {
                  this.player.health = Math.min(this.player.maxHealth, this.player.health + item.stats.heal);
                  item.count--;
                  if (item.count <= 0) {
                      this.inventory[this.player.selectedSlot] = { id: `empty-${Date.now()}`, type: ItemType.BLOCK, tileType: TileType.AIR, name: 'Empty', count: 0, icon: '' };
                  }
                  this.emit({ type: 'INVENTORY_UPDATE', payload: this.inventory });
                  this.emit({ type: 'PLAYER_UPDATE', payload: this.player });
                  this.actionCooldown = 30;
              }
          }
      }

      if (this.mouseState.leftDown) {
          if (item && item.shootProps) {
              const speed = item.stats?.speed || 20;
              const angle = Math.atan2(my - (this.player.y + 12), mx - (this.player.x + 6));
              
              if (item.shootProps.projectileType === 'rail') {
                  this.projectiles.push({
                      id: `rail-${Date.now()}`, x: this.player.x + 6, y: this.player.y + 12,
                      vx: Math.cos(angle) * item.shootProps.speed, vy: Math.sin(angle) * item.shootProps.speed,
                      width: 1000, height: 4, damage: item.stats?.damage || 50, life: 5, type: 'rail',
                      color: item.shootProps.color, isEnemy: false
                  });
              } else {
                  const count = item.shootProps.count || 1;
                  const spread = item.shootProps.spread || 0;
                  for(let i=0; i<count; i++) {
                      const finalAngle = angle + (Math.random() - 0.5) * spread;
                      this.projectiles.push({
                          id: `proj-${Date.now()}-${i}`,
                          x: this.player.x + 6 + Math.cos(finalAngle)*20, 
                          y: this.player.y + 12 + Math.sin(finalAngle)*20,
                          vx: Math.cos(finalAngle) * item.shootProps.speed,
                          vy: Math.sin(finalAngle) * item.shootProps.speed,
                          width: item.shootProps.projectileType === 'missile' ? 6 : 4,
                          height: item.shootProps.projectileType === 'missile' ? 6 : 4,
                          damage: item.stats?.damage || 10,
                          life: 100, type: item.shootProps.projectileType, color: item.shootProps.color,
                          isEnemy: false, targetId: item.shootProps.projectileType === 'missile' ? undefined : undefined
                      });
                  }
              }
              this.actionCooldown = speed;
              return;
          }

          let attacked = false;
          const range = (item?.stats?.range || REACH_PIXELS) + 20;
          if (dist < range) {
              if (this.player.swingProgress <= 0) {
                  this.player.swingProgress = 1.0;
                  this.player.swingType = (Math.random() > 0.5) ? 'slash' : 'overhead';
                  if (item?.name.includes('Spear') || item?.name.includes('Knife')) this.player.swingType = 'stab';
              }
              this.entities.forEach(e => {
                  if (!e.isDead && !e.isInParty) { 
                      // Widen hit box slightly
                      if (mx >= e.x - 20 && mx <= e.x + e.width + 20 && my >= e.y - 20 && my <= e.y + e.height + 20) {
                           let dmg = item?.stats?.damage || 2; 
                           e.health -= dmg; e.damageTaken += dmg;
                           e.vx = (e.x - this.player.x) > 0 ? 5 : -5; e.vy = -3; e.emote = '💥';
                           if (e.health <= 0) { e.isDead = true; this.handleEntityDeath(e); }
                           attacked = true;
                           for(let i=0; i<5; i++) { this.particles.push({ x: e.x + e.width/2, y: e.y + e.height/2, vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5, life: 10, color: '#ff0000', size: 2 }); }
                      }
                  }
              });
              if (attacked) {
                  this.actionCooldown = item?.stats?.speed || 20;
                  return;
              }
          }

          if (dist < REACH_PIXELS) {
              const tile = this.getTileAt(mx, my);
              if (tile !== TileType.AIR && tile !== TileType.BEDROCK) {
                  const hardness = this.player.creativeMode ? 0 : (TILE_HARDNESS[tile] || 20);
                  const power = item?.stats?.miningMultiplier || 1;
                  const damage = 1 * power;

                  if (!this.miningState || this.miningState.x !== tx || this.miningState.y !== ty) {
                      this.miningState = { x: tx, y: ty, progress: 0, maxProgress: hardness || 1, isMining: true };
                  }
                  
                  this.miningState.progress += damage;
                  if (this.player.swingProgress <= 0) { this.player.swingProgress = 1.0; this.player.swingType = 'overhead'; }
                  if (Math.random() > 0.5) { this.particles.push({ x: mx, y: my, vx: (Math.random()-0.5)*4, vy: -Math.random()*4, life: 10, color: '#aaa', size: 2 }); }

                  if (this.miningState.progress >= hardness) {
                      this.world[ty][tx] = TileType.AIR;
                      if (!this.player.creativeMode) {
                          this.addToInventory(tile, 1);
                      }
                      this.miningState = null;

                      const bossSpawned = this.checkBlockBreakEvents(tx, ty, tile);
                      
                      // Rapid break cooldown
                      // If a boss spawned, add a LARGE cooldown to prevent instant one-shot with high dmg weapons like Admin Pick
                      this.actionCooldown = bossSpawned ? 60 : (this.player.creativeMode ? 2 : 5);
                  }
              }
          }
      }
  }
}