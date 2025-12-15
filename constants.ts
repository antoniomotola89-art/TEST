

import { TileType, CraftingRecipe, ItemType, EntityType, BiomeType, LootEntry } from './types';

// Visual & Scale
export const TILE_SIZE = 16; 
export const RENDER_SCALE = 2; 
export const CHUNK_WIDTH = 16; 
export const WORLD_WIDTH = 1000; 
export const WORLD_HEIGHT = 150; 

// Physics
export const GRAVITY = 0.25;
export const TERMINAL_VELOCITY = 8;
export const JUMP_FORCE = -4.5; 
export const MOVE_SPEED = 0.5;
export const MAX_SPEED = 2.5;
export const FRICTION = 0.82;

// Interaction - REACH EVERYWHERE
export const REACH_BLOCKS = 50; 
export const REACH_PIXELS = REACH_BLOCKS * TILE_SIZE;

// Survival Constants
export const MAX_HEALTH = 100;
export const FALL_DAMAGE_THRESHOLD = 8; 
export const FALL_DAMAGE_MULTIPLIER = 5;
export const DAY_LENGTH = 24000; 

// Mining Hardness
export const TILE_HARDNESS: Record<TileType, number> = {
  [TileType.AIR]: 0,
  [TileType.DIRT]: 30, 
  [TileType.GRASS]: 30,
  [TileType.STONE]: 90, 
  [TileType.WOOD]: 60, 
  [TileType.LEAVES]: 10,
  [TileType.BEDROCK]: Infinity,
  [TileType.ANCIENT_BRICK]: 120, 
  [TileType.ORE_IRON]: 100,
  [TileType.ORE_GOLD]: 100,
  [TileType.TORCH]: 1,
  [TileType.ALTAR]: 150, 
  [TileType.PLANK]: 45,
  [TileType.WORKBENCH]: 60,
  [TileType.DOOR_CLOSED]: 60,
  [TileType.DOOR_OPEN]: 60,
  [TileType.SERVER_TERMINAL]: 150, 
  [TileType.LAB_WALL]: 150,
  [TileType.OLD_WORLD_DEBRIS]: 80,
  [TileType.FACTORY_METAL]: 180, 
  [TileType.WHEAT]: 10,
  [TileType.ANVIL]: 150,
  [TileType.TREE_LOG]: 50,
  [TileType.TREE_LEAVES]: 10,
  [TileType.CONCRETE]: 150,
  [TileType.TELESCOPE]: 100,
  [TileType.TEDDY_BEAR]: 200,
  [TileType.POLE]: 40,
  [TileType.DEAD_BUSH]: 1,
  [TileType.HANGING_WIRES]: 1,
  [TileType.BOOKSHELF]: 45,
  [TileType.LECTERN]: 45,
};

// Colors
export const TILE_COLORS: Record<TileType, string> = {
  [TileType.AIR]: 'transparent',
  [TileType.DIRT]: '#3e3e3e',
  [TileType.GRASS]: '#4e3629',
  [TileType.STONE]: '#262626',
  [TileType.WOOD]: '#3e2723',
  [TileType.LEAVES]: '#2d2d2d',
  [TileType.BEDROCK]: '#000000',
  [TileType.ANCIENT_BRICK]: '#1a1a1a',
  [TileType.ORE_IRON]: '#4e342e',
  [TileType.ORE_GOLD]: '#bf360c',
  [TileType.TORCH]: '#e65100',
  [TileType.ALTAR]: '#3e0404',
  [TileType.PLANK]: '#3e2723',
  [TileType.WORKBENCH]: '#3e2723',
  [TileType.DOOR_CLOSED]: '#3e2723',
  [TileType.DOOR_OPEN]: '#28221f',
  [TileType.SERVER_TERMINAL]: '#002f2f',
  [TileType.LAB_WALL]: '#37474f',
  [TileType.OLD_WORLD_DEBRIS]: '#212121',
  [TileType.FACTORY_METAL]: '#0d0d0d',
  [TileType.WHEAT]: '#554f2a',
  [TileType.ANVIL]: '#000000',
  [TileType.TREE_LOG]: '#1d1512',
  [TileType.TREE_LEAVES]: '#1a1a1a',
  [TileType.CONCRETE]: '#424242',
  [TileType.TELESCOPE]: '#bf360c',
  [TileType.TEDDY_BEAR]: '#3e2723',
  [TileType.POLE]: '#424242',
  [TileType.DEAD_BUSH]: '#3e2723',
  [TileType.HANGING_WIRES]: '#000000',
  [TileType.BOOKSHELF]: '#3e2723',
  [TileType.LECTERN]: '#3e2723',
};

export const INVENTORY_SIZE = 27; 
export const HOTBAR_SIZE = 9;

export const BIOME_CONFIG = {
  surfaceLevel: 50,
  caveFrequency: 0.05,
  oreFrequency: 0.03,
};

export const BIOME_RANGES = {
    [BiomeType.OUTSKIRTS]: { start: 0, end: 350 },
    [BiomeType.INDUSTRIAL]: { start: 350, end: 700 },
    [BiomeType.GARBAGE_WASTES]: { start: 700, end: 1000 }
};

// --- LOOT TABLES ---
export const ENTITY_LOOT: Record<string, LootEntry[]> = {
    [EntityType.ZOMBIE]: [
        { item: TileType.OLD_WORLD_DEBRIS, count: 1, chance: 0.4, isTile: true },
        { item: TileType.ORE_IRON, count: 1, chance: 0.1, isTile: true },
        { item: 'bandage', count: 1, chance: 0.2, isTile: false }
    ],
    [EntityType.DRONE]: [
        { item: TileType.FACTORY_METAL, count: 1, chance: 0.5, isTile: true },
        { item: 'microchip', count: 1, chance: 0.3, isTile: false }
    ],
    [EntityType.BOSS_GUARDIAN]: [
        { item: 'guardian_core', count: 1, chance: 1.0, isTile: false },
        { item: 'titanium_chest', count: 1, chance: 1.0, isTile: false },
        { item: TileType.ORE_GOLD, count: 10, chance: 1.0, isTile: true },
        { item: 'medkit', count: 2, chance: 1.0, isTile: false }
    ],
    [EntityType.BOSS_SENTRY]: [
        { item: 'gun_barrel', count: 1, chance: 1.0, isTile: false },
        { item: 'targeting_module', count: 1, chance: 1.0, isTile: false }
    ],
    [EntityType.BOSS_URSUS]: [
        { item: 'ursus_claw', count: 1, chance: 1.0, isTile: false },
        { item: 'ursus_hide', count: 1, chance: 1.0, isTile: false },
        { item: 'omega_core', count: 1, chance: 1.0, isTile: false }
    ],
    [EntityType.PTEROSAUR]: [
        { item: 'sky_wing', count: 1, chance: 1.0, isTile: false }
    ],
    [EntityType.MECHA_BEAR]: [
        { item: 'bear_plating', count: 1, chance: 1.0, isTile: false }
    ],
    [EntityType.MECHA_REX]: [{ item: TileType.FACTORY_METAL, count: 10, chance: 1, isTile: true }],
    [EntityType.VOID_STALKER]: [{ item: 'lens', count: 1, chance: 0.5, isTile: false }],
    [EntityType.DEER]: [{ item: TileType.WOOD, count: 1, chance: 0.3, isTile: true }],
    [EntityType.BOAR]: [{ item: TileType.OLD_WORLD_DEBRIS, count: 1, chance: 0.3, isTile: true }],
    [EntityType.RABBIT]: [{ item: 'bandage', count: 1, chance: 0.1, isTile: false }],
};

// --- CUSTOM ITEMS ---
// Map internal string IDs to Item Definitions
export const CUSTOM_ITEMS: Record<string, any> = {
    'microchip': { type: ItemType.MATERIAL, name: 'Microchip', icon: '💾', description: 'Used for crafting high-tech gear.' },
    'lens': { type: ItemType.MATERIAL, name: 'Focus Lens', icon: '🔍', description: 'Reflects pure energy.' },
    'gun_barrel': { type: ItemType.MATERIAL, name: 'Gun Barrel', icon: '📏', description: 'Precision machined steel.' },
    'guardian_core': { type: ItemType.MODULE, name: 'Guardian Core', icon: '🧿', description: 'Module: +5 Defense. The heart of a machine.', stats: { defense: 5 }, armorType: 'module' },
    'titanium_chest': { type: ItemType.ARMOR, name: 'Titanium Plate', icon: '🦺', description: 'Body: +10 Defense. Lightweight and strong.', stats: { defense: 10 }, armorType: 'body' },
    'targeting_module': { type: ItemType.MODULE, name: 'Targeting Chip', icon: '🎯', description: 'Module: +2 Defense. Improves focus.', stats: { defense: 2 }, armorType: 'module' },
    'ursus_claw': { type: ItemType.WEAPON, name: 'Ursus Claw', icon: '🥊', description: 'Devastating melee power.', stats: { damage: 40, speed: 20 } },
    'ursus_hide': { type: ItemType.ARMOR, name: 'Ursus Armor', icon: '🐻', description: 'Body: +20 Defense. Nearly indestructible.', stats: { defense: 20 }, armorType: 'body' },
    'omega_core': { type: ItemType.MODULE, name: 'Omega Core', icon: '⚛️', description: 'Module: +10 Defense. Unlimited power.', stats: { defense: 10 }, armorType: 'module' },
    'sky_wing': { type: ItemType.ARMOR, name: 'Aero Helm', icon: '🪖', description: 'Head: +5 Defense.', stats: { defense: 5 }, armorType: 'head' },
    'bear_plating': { type: ItemType.ARMOR, name: 'Heavy Plating', icon: '🛡️', description: 'Body: +8 Defense.', stats: { defense: 8 }, armorType: 'body' },
    
    // ARTIFACT
    'artifact_teddy_bear': {
        type: ItemType.QUEST_ITEM, name: 'Lost Teddy Bear', icon: '🧸', description: 'A relic of pure innocence. The goal of your journey.',
    },

    // GUNS
    'pistol': { 
        type: ItemType.WEAPON, name: 'Scrap Pistol', icon: '🔫', description: 'Reliable. 20 DMG.', 
        stats: { damage: 20, speed: 20, range: 400 },
        shootProps: { projectileType: 'bullet', speed: 8, color: '#ffcc00' }
    },
    'shotgun': { 
        type: ItemType.WEAPON, name: 'Boomstick', icon: '💥', description: 'Close range devastation.', 
        stats: { damage: 15, speed: 60, range: 200 },
        shootProps: { projectileType: 'bullet', speed: 7, color: '#ff5722', count: 5, spread: 0.3 }
    },
    'laser_rifle': { 
        type: ItemType.WEAPON, name: 'Photon Rifle', icon: '🔦', description: 'Rapid energy fire.', 
        stats: { damage: 12, speed: 10, range: 600 },
        shootProps: { projectileType: 'laser', speed: 12, color: '#00e5ff' }
    },
    'rocket_launcher': { 
        type: ItemType.WEAPON, name: 'The Equalizer', icon: '🚀', description: 'Explosive ordinances.', 
        stats: { damage: 100, speed: 90, range: 600 },
        shootProps: { projectileType: 'missile', speed: 4, color: '#d50000', explode: true }
    },
    'railgun': { 
        type: ItemType.WEAPON, name: 'Railgun Prototype', icon: '⚡', description: 'Hyper-velocity slug.', 
        stats: { damage: 200, speed: 120, range: 800 },
        shootProps: { projectileType: 'rail', speed: 25, color: '#76ff03' }
    },

    // HEALING
    'bandage': {
        type: ItemType.CONSUMABLE, name: 'Bandage', icon: '🩹', description: 'Heals 25 HP.', stats: { heal: 25 }
    },
    'medkit': {
        type: ItemType.CONSUMABLE, name: 'Medkit', icon: '💊', description: 'Heals 60 HP.', stats: { heal: 60 }
    }
};

export const RECIPES: CraftingRecipe[] = [
    {
        id: 'planks',
        result: { type: ItemType.BLOCK, tileType: TileType.PLANK, name: 'PLANK', count: 4, icon: '🟫', description: 'Rough hewn timber.' },
        ingredients: [{ name: 'WOOD', count: 1 }]
    },
    {
        id: 'torch',
        result: { type: ItemType.BLOCK, tileType: TileType.TORCH, name: 'TORCH', count: 4, icon: '🔥', description: 'Keeps the shadows at bay.' },
        ingredients: [{ name: 'WOOD', count: 1 }] 
    },
    {
        id: 'workbench',
        result: { type: ItemType.BLOCK, tileType: TileType.WORKBENCH, name: 'WORKBENCH', count: 1, icon: '🛠️', description: 'For complex creation.' },
        ingredients: [{ name: 'PLANK', count: 4 }]
    },
    {
        id: 'door',
        result: { type: ItemType.BLOCK, tileType: TileType.DOOR_CLOSED, name: 'DOOR_CLOSED', count: 1, icon: '🚪', description: 'Barricade yourself.' },
        ingredients: [{ name: 'PLANK', count: 6 }]
    },
    {
        id: 'iron_pick',
        result: { type: ItemType.TOOL, name: 'Iron Pickaxe', count: 1, icon: '⛏️', description: 'Breaks hard stone.', stats: { damage: 5, range: REACH_PIXELS, miningMultiplier: 5 } },
        ingredients: [{ name: 'PLANK', count: 2 }, { name: 'ORE_IRON', count: 3 }],
        requiredTile: TileType.WORKBENCH
    },
    {
        id: 'iron_sword',
        result: { type: ItemType.WEAPON, name: 'Iron Sword', count: 1, icon: '⚔️', description: 'Sharp and deadly.', stats: { damage: 15, speed: 10, range: REACH_PIXELS + 20, miningMultiplier: 1 } },
        ingredients: [{ name: 'PLANK', count: 1 }, { name: 'ORE_IRON', count: 2 }],
        requiredTile: TileType.WORKBENCH
    },
    {
        id: 'pole',
        result: { type: ItemType.BLOCK, tileType: TileType.POLE, name: 'POLE', count: 6, icon: '丨', description: 'Old pipes for climbing.' },
        ingredients: [{ name: 'ORE_IRON', count: 2 }],
        requiredTile: TileType.WORKBENCH
    },
    {
        id: 'bandage',
        result: { ...CUSTOM_ITEMS['bandage'], count: 1 },
        ingredients: [{ name: 'WHEAT', count: 3 }]
    },
    {
        id: 'medkit',
        result: { ...CUSTOM_ITEMS['medkit'], count: 1 },
        ingredients: [{ name: 'Bandage', count: 2 }, { name: 'ORE_IRON', count: 1 }]
    },
    // --- GUN RECIPES (EXPENSIVE) ---
    {
        id: 'pistol',
        result: { ...CUSTOM_ITEMS['pistol'], count: 1 },
        ingredients: [{ name: 'ORE_IRON', count: 5 }, { name: 'ORE_GOLD', count: 2 }, { name: 'PLANK', count: 2 }],
        requiredTile: TileType.ANVIL
    },
    {
        id: 'shotgun',
        result: { ...CUSTOM_ITEMS['shotgun'], count: 1 },
        ingredients: [{ name: 'FACTORY_METAL', count: 4 }, { name: 'WOOD', count: 4 }, { name: 'ORE_IRON', count: 6 }],
        requiredTile: TileType.ANVIL
    },
    {
        id: 'laser_rifle',
        result: { ...CUSTOM_ITEMS['laser_rifle'], count: 1 },
        ingredients: [{ name: 'FACTORY_METAL', count: 10 }, { name: 'Microchip', count: 2 }, { name: 'Focus Lens', count: 1 }],
        requiredTile: TileType.SERVER_TERMINAL
    },
    {
        id: 'rocket_launcher',
        result: { ...CUSTOM_ITEMS['rocket_launcher'], count: 1 },
        ingredients: [{ name: 'Gun Barrel', count: 1 }, { name: 'FACTORY_METAL', count: 20 }, { name: 'Microchip', count: 1 }],
        requiredTile: TileType.SERVER_TERMINAL
    },
    {
        id: 'railgun',
        result: { ...CUSTOM_ITEMS['railgun'], count: 1 },
        ingredients: [{ name: 'Guardian Core', count: 1 }, { name: 'FACTORY_METAL', count: 30 }, { name: 'ORE_GOLD', count: 20 }],
        requiredTile: TileType.SERVER_TERMINAL
    }
];

export const VILLAGER_NAMES = [
    "Eldrin", "Thorne", "Mara", "Silas", "Kael", "Lyra", "Grom", "Bryn", "Vesper", "Orion", "Fae", "Dorn", "Oric"
];

export const VILLAGER_PERSONALITIES = [
    "Stoic and brief",
    "Cheerful and optimistic",
    "Paranoid and fearful",
    "Poetic and mysterious",
    "Aggressive and rude",
    "Curious and scientific",
    "Religious and zealous"
];

export const VILLAGER_GREETINGS = {
    DAY: [
        "The crops barely grow in this grey soil.",
        "Have you seen the metal beasts?",
        "Winter is always coming.",
        "We survive, that is all.",
        "The Gods left us long ago."
    ],
    NIGHT: [
        "They scream in the dark.",
        "Bar the doors.",
        "The rain burns my skin.",
        "Hush, the walkers are near.",
        "No light, they will see us."
    ],
    RAIN: [
        "The heavens weep oil and ash.",
        "This rain... it chills the bones.",
        "Seek shelter, traveler. The storm is heavy.",
        "The crops will drown if this keeps up.",
        "Water falls, but nothing grows."
    ],
    HURT: [
        "Stay back! I've had enough!",
        "Why do you strike me?",
        "You are no better than the machines.",
        "Get away from me!",
        "I'll defend myself if I must!"
    ],
    ANGRY: [
        "Die, traitor!",
        "You will pay for that!",
        "Get out of our village!",
        "I will not tolerate this!",
    ],
    QUEST: [
        "We need wood for the fires.",
        "The dead won't stay buried.",
        "A demon flies in the west."
    ],
    SHELTER: [
        "It's safe inside. Or safer, at least.",
        "I hate the storms.",
        "The roof leaks, but it holds.",
        "Don't let the cold in.",
        "We wait until it passes."
    ],
    LIBRARIAN: [
        "I record what remains.",
        "History is all we have left.",
        "Paper is more valuable than gold.",
        "I am writing a new chronicle.",
        "Do not touch the books with dirty hands."
    ]
};

export const SIDE_QUESTS = [
    {
        id: 'collect_wood',
        title: 'Winter Fuel',
        description: 'The cold is coming. We need timber for the fires.',
        objective: { type: 'collect' as const, target: 'WOOD', amount: 10 },
        reward: { type: ItemType.BLOCK, tileType: TileType.TORCH, name: 'TORCH', count: 10, icon: '🔥', description: 'Fire' }
    },
    {
        id: 'kill_zombies',
        title: 'The Rotted Ones',
        description: 'The dead walk again. Put them to rest.',
        objective: { type: 'kill' as const, target: 'zombie', amount: 5 },
        reward: { type: ItemType.BLOCK, tileType: TileType.ORE_GOLD, name: 'ORE_GOLD', count: 3, icon: '🟡', description: 'Shiny Stone' }
    },
    {
        id: 'kill_pterosaur',
        title: 'Sky Demon',
        description: 'A metal dragon plagues the skies. Slay it.',
        objective: { type: 'kill' as const, target: 'pterosaur', amount: 1 },
        reward: { type: ItemType.WEAPON, name: 'Iron Sword', count: 1, icon: '⚔️', description: 'A hero\'s blade', stats: { damage: 20 } }
    },
    {
        id: 'collect_iron',
        title: 'Iron for Steel',
        description: 'We need the hard earth to forge weapons.',
        objective: { type: 'collect' as const, target: 'ORE_IRON', amount: 5 },
        reward: { type: ItemType.BLOCK, tileType: TileType.ANCIENT_BRICK, name: 'ANCIENT_BRICK', count: 10, icon: '🧱', description: 'Castle Stone' }
    }
];