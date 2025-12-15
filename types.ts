

export enum TileType {
  AIR = 0,
  DIRT = 1,
  GRASS = 2,
  STONE = 3,
  WOOD = 4,
  LEAVES = 5,
  BEDROCK = 6,
  ANCIENT_BRICK = 7,
  ORE_IRON = 8,
  ORE_GOLD = 9,
  TORCH = 10,
  ALTAR = 11,
  PLANK = 12,
  WORKBENCH = 13,
  DOOR_CLOSED = 14,
  DOOR_OPEN = 15,
  SERVER_TERMINAL = 16,
  LAB_WALL = 17,
  OLD_WORLD_DEBRIS = 18,
  FACTORY_METAL = 19,
  WHEAT = 20,
  ANVIL = 21,
  TREE_LOG = 22,
  TREE_LEAVES = 23,
  CONCRETE = 24,
  TELESCOPE = 25,
  TEDDY_BEAR = 26, // The Goal
  POLE = 27, // Climbing pole (industrial)
  DEAD_BUSH = 28, // Outskirts Foreground
  HANGING_WIRES = 29, // Industrial Foreground
  BOOKSHELF = 30,
  LECTERN = 31,
}

export enum BiomeType {
    OUTSKIRTS = 'outskirts',
    INDUSTRIAL = 'industrial',
    GARBAGE_WASTES = 'garbage_wastes'
}

export enum ItemType {
  TOOL = 'tool',
  BLOCK = 'block',
  MATERIAL = 'material',
  WEAPON = 'weapon',
  QUEST_ITEM = 'quest_item',
  ARMOR = 'armor',
  MODULE = 'module',
  BOOK = 'book',
  CONSUMABLE = 'consumable'
}

export interface InventoryItem {
  id: string;
  type: ItemType;
  tileType?: TileType; 
  name: string;
  description?: string;
  count: number;
  icon: string; // Emoji or code for sprite renderer
  stats?: { 
      damage?: number; 
      speed?: number; 
      range?: number; 
      cooldown?: number;
      miningMultiplier?: number; 
      defense?: number; // For Armor
      heal?: number; // For Consumables
  };
  shootProps?: {
      projectileType: 'bullet' | 'laser' | 'missile' | 'rail';
      speed: number;
      color: string;
      count?: number; // Shotgun pellet count
      spread?: number;
      explode?: boolean;
  };
  armorType?: 'head' | 'body' | 'module';
  text?: string; // CONTENT FOR BOOKS
  author?: string; // Name of the villager who wrote the book
}

export interface Equipment {
    head: InventoryItem | null;
    body: InventoryItem | null;
    module: InventoryItem | null;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  isGrounded: boolean;
  facingRight: boolean;
  selectedSlot: number;
  health: number;
  maxHealth: number;
  isInventoryOpen: boolean;
  animationFrame: number;
  spawned?: boolean;
  activeQuestId?: string;
  questGiverId?: string; // ID of the entity that gave the quest
  questProgress?: number;
  damageCooldown?: number;
  // Movement States
  isRolling: boolean;
  isGroundPounding: boolean;
  isCrouching: boolean;
  movementCooldown: number; 
  lastKeyPressTime: Record<string, number>;
  wallSlideDir: number; 
  swingProgress: number;
  swingType: 'slash' | 'stab' | 'overhead'; 
  equipment: Equipment;
  defense: number;
  speed?: number;
  creativeMode: boolean; // NEW: Creative Mode Flag
}

export enum EntityType {
  ZOMBIE = 'zombie',
  BOSS_GUARDIAN = 'boss_guardian',
  BOSS_SENTRY = 'boss_sentry',
  BOSS_URSUS = 'boss_ursus', // FINAL BOSS
  VILLAGER = 'villager',
  DRONE = 'drone',
  SCRAP_WALKER = 'scrap_walker',
  RABBIT = 'rabbit',
  FOX = 'fox',
  RUSTED_ROVER = 'rusted_rover',
  DEER = 'deer',
  BOAR = 'boar',
  DUCK = 'duck',
  OWL = 'owl',
  RAT = 'rat',
  BAT = 'bat',
  WOLF = 'wolf',
  SCRAP_CRAB = 'scrap_crab',
  MECHA_REX = 'mecha_rex',
  VOID_STALKER = 'void_stalker',
  PTEROSAUR = 'pterosaur',
  MECHA_BEAR = 'mecha_bear',
}

export enum VillagerJob {
    UNEMPLOYED = 'unemployed',
    FARMER = 'farmer',
    BLACKSMITH = 'blacksmith',
    LIBRARIAN = 'librarian',
}

export enum VillagerState {
    IDLE = 'idle',
    WORKING = 'working',
    WANDERING = 'wandering',
}

export enum AIState {
    IDLE = 'idle',
    CHASING = 'chasing',
    FLEEING = 'fleeing',
    ATTACKING = 'attacking',
    PATROL = 'patrol',
    SEEKING_SHELTER = 'seeking_shelter',
    FOLLOWING = 'following',
    // BOSS STATES
    BOSS_CHARGE = 'boss_charge',
    BOSS_SMASH = 'boss_smash',
    BOSS_LASER = 'boss_laser',
    BOSS_MISSILE = 'boss_missile',
    BOSS_SUMMON = 'boss_summon',
    BOSS_RECOVER = 'boss_recover'
}

export interface Entity {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  facingRight: boolean;
  animationFrame: number;
  isDead: boolean;
  hasQuest?: boolean;
  damageTaken: number; 
  job?: VillagerJob;
  name?: string; // Villager Name
  personality?: string; // Villager Personality
  state?: VillagerState | AIState;
  stateTimer?: number; // For timing boss attacks
  attackPhase?: number; // For multi-phase bosses
  workTargetX?: number;
  targetId?: string; 
  emote?: string; 
  emoteTimer?: number;
  homeX?: number;
  homeY?: number;
  bookTimer?: number; // For librarians
  
  // PARTY SYSTEM
  isInParty?: boolean;
  equipment?: Equipment; // Villagers can now hold items

  // MEMORY
  chatHistory?: { sender: string; text: string }[];
  lastInteractionTime?: number; // For chat reset
}

export interface Projectile {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    damage: number;
    life: number;
    type: 'bullet' | 'laser' | 'missile' | 'shockwave' | 'rail';
    color: string;
    isEnemy: boolean;
    targetId?: string; // For homing
}

export interface MiningState {
    x: number; 
    y: number; 
    progress: number;
    maxProgress: number;
    isMining: boolean;
}

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
}

export interface LootEntry {
    item: TileType | string;
    count: number;
    chance: number;
    isTile: boolean;
}

export interface Quest {
    id: string;
    title: string;
    description: string;
    objective: { type: 'kill' | 'collect', target: string, amount: number };
    reward: Omit<InventoryItem, 'id'>;
}

export type GameEvent = 
  | { type: 'LORE_DISCOVERED'; payload: { block: string; depth: number; surroundings: string } }
  | { type: 'PLAYER_UPDATE'; payload: Player }
  | { type: 'INVENTORY_UPDATE'; payload: InventoryItem[] }
  | { type: 'BOSS_SPAWNED'; payload: { name: string } }
  | { type: 'ENTITY_UPDATE'; payload: Entity[] }
  | { type: 'TIME_UPDATE'; payload: number }
  | { type: 'DIALOGUE_OPEN'; payload: { entityId: string } }
  | { type: 'QUEST_OFFER'; payload: { quest: Quest, giverId: string } }
  | { type: 'QUEST_COMPLETION'; payload: { quest: Quest } }
  | { type: 'QUEST_UPDATE'; payload: { message: string } }
  | { type: 'GAME_OVER'; payload: { reason: string } }
  | { type: 'GAME_WON'; payload: { message: string } };

export type GameEventListener = (event: GameEvent) => void;

export interface CraftingRecipe {
    id: string;
    result: { type: ItemType, tileType?: TileType, name: string, count: number, icon: string, description: string, stats?: any, shootProps?: any };
    ingredients: { name: string, count: number }[];
    requiredTile?: TileType; 
}