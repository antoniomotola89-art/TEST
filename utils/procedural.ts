

import { TileType, EntityType, VillagerJob, Player, InventoryItem } from '../types';
import { TILE_SIZE } from '../constants';

// --- Noise (Kept for WorldGen) ---
export class Noise {
  private p: number[] = [];

  constructor(seed = Math.random()) {
    this.p = new Array(512);
    const permutation = new Array(256).fill(0).map((_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor((seed * (i + 1) * 1000) % (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    for (let i = 0; i < 512; i++) {
      this.p[i] = permutation[i % 256];
    }
  }
  fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t: number, a: number, b: number) { return a + t * (b - a); }
  grad(hash: number, x: number) {
    const h = hash & 15;
    const grad = 1 + (h & 7); 
    return (h & 8 ? -grad : grad) * x; 
  }
  perlin1(x: number) {
    const X = Math.floor(x) & 255;
    x -= Math.floor(x);
    return this.lerp(this.fade(x), this.grad(this.p[X], x), this.grad(this.p[X + 1], x - 1));
  }
  octave(x: number, octaves: number, persistence: number) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0; 
    for(let i=0;i<octaves;i++) {
        total += this.perlin1(x * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
    }
    return total / maxValue;
  }
}

// --- Pixel Art Sprite Generator ---

const createCanvas = (w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
};

// Colors (Updated for Rain World Gloom)
const C = {
    DIRT_BASE: '#2d2420',
    DIRT_DETAIL: '#1a1614',
    GRASS_TOP: '#5d4037', // Dead Brown
    GRASS_LIGHT: '#795548', // Lighter Dead Brown
    STONE_BASE: '#262626', 
    STONE_DARK: '#121212',
    STONE_LIGHT: '#3d3d3d',
    WOOD_BASE: '#3e2723',
    LEAVES_BASE: '#1b2e1b',
    LEAVES_LIGHT: '#2d442d',
};

// Helper for noisy textures
const addNoise = (ctx: CanvasRenderingContext2D, width: number, height: number, density: number, opacity: number) => {
    ctx.fillStyle = `rgba(0,0,0,${opacity})`;
    for(let i=0; i<width*height*density; i++) {
        const x = Math.floor(Math.random()*width);
        const y = Math.floor(Math.random()*height);
        ctx.fillRect(x,y,1,1);
    }
    ctx.fillStyle = `rgba(255,255,255,${opacity/2})`;
     for(let i=0; i<width*height*density; i++) {
        const x = Math.floor(Math.random()*width);
        const y = Math.floor(Math.random()*height);
        ctx.fillRect(x,y,1,1);
    }
};

export const createTileTexture = (type: TileType): HTMLCanvasElement => {
    const canvas = createCanvas(16, 16);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    switch (type) {
        case TileType.GRASS:
            ctx.fillStyle = C.DIRT_BASE; ctx.fillRect(0,4,16,12); 
            addNoise(ctx, 16, 16, 0.4, 0.2);
            ctx.fillStyle = C.GRASS_TOP; 
            for(let x=0; x<16; x++) {
                const height = Math.random() > 0.5 ? 4 : 3;
                ctx.fillRect(x, 0, 1, height);
                if (Math.random() > 0.7) ctx.fillRect(x, 4, 1, Math.random()*3);
            }
            ctx.fillStyle = C.GRASS_LIGHT; 
            for(let i=0; i<10; i++) ctx.fillRect(Math.random()*16, Math.random()*4, 1, 1);
            break;

        case TileType.DIRT:
            ctx.fillStyle = C.DIRT_BASE; ctx.fillRect(0,0,16,16);
            addNoise(ctx, 16, 16, 0.5, 0.2);
            ctx.fillStyle = C.DIRT_DETAIL; 
            ctx.beginPath(); ctx.arc(4, 4, 2, 0, Math.PI*2); ctx.fill();
            ctx.arc(12, 10, 3, 0, Math.PI*2); ctx.fill();
            break;

        case TileType.STONE:
            ctx.fillStyle = C.STONE_BASE; ctx.fillRect(0,0,16,16);
            addNoise(ctx, 16, 16, 0.4, 0.1);
            ctx.strokeStyle = C.STONE_DARK;
            ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(8, 8); ctx.lineTo(6, 12); ctx.stroke();
            break;

        case TileType.WOOD:
            ctx.fillStyle = C.WOOD_BASE; ctx.fillRect(0,0,16,16);
            ctx.fillStyle = '#2d1e1a'; 
            for(let x=2; x<16; x+=4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x-1, 5, x+1, 10, x, 16); ctx.stroke(); }
            addNoise(ctx, 16, 16, 0.2, 0.2);
            break;
        
        case TileType.TREE_LOG:
            ctx.fillStyle = '#1d1512'; ctx.fillRect(0,0,16,16);
            ctx.fillStyle = '#0f0b09'; 
            for(let i=0; i<6; i++) { ctx.fillRect(Math.random()*14, Math.random()*14, 2, 4); }
            addNoise(ctx, 16, 16, 0.4, 0.3);
            break;
            
        case TileType.PLANK:
            ctx.fillStyle = '#4e342e'; ctx.fillRect(0,0,16,16);
            ctx.fillStyle = '#3e2723';
            ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 5, 16, 1); ctx.fillRect(0, 10, 16, 1); 
            ctx.fillStyle = '#111';
            ctx.fillRect(1, 2, 1, 1); ctx.fillRect(14, 2, 1, 1);
            ctx.fillRect(1, 7, 1, 1); ctx.fillRect(14, 7, 1, 1);
            break;
            
        case TileType.WORKBENCH:
            ctx.fillStyle = '#3e2723'; ctx.fillRect(0,0,16,16); 
            ctx.fillStyle = '#8d6e63'; ctx.fillRect(0,0,16,6);
            ctx.fillStyle = '#ccc'; ctx.fillRect(2, 8, 2, 6);
            ctx.fillStyle = '#555'; ctx.fillRect(1, 8, 4, 2);
            addNoise(ctx, 16, 16, 0.2, 0.2);
            break;

        case TileType.LEAVES:
        case TileType.TREE_LEAVES:
            ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0,0,16,16);
            ctx.fillStyle = '#2d2d2d'; 
            for(let i=0; i<30; i++) ctx.fillRect(Math.random()*15, Math.random()*15, 2, 2);
            break;

        case TileType.ANCIENT_BRICK:
            ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0,0,16,16);
            ctx.fillStyle = '#000'; 
            ctx.fillRect(0, 7, 16, 1); ctx.fillRect(7, 0, 1, 7); ctx.fillRect(12, 8, 1, 8);
            addNoise(ctx, 16, 16, 0.5, 0.3);
            break;

        case TileType.ALTAR:
             ctx.fillStyle = '#3e0404'; ctx.fillRect(0,0,16,16);
             addNoise(ctx, 16, 16, 0.5, 0.3);
             ctx.fillStyle = '#f44336'; 
             ctx.beginPath(); ctx.arc(8,8, 4, 0, Math.PI*2); ctx.fill();
             break;
             
        case TileType.LAB_WALL:
             ctx.fillStyle = '#37474f'; ctx.fillRect(0,0,16,16);
             ctx.fillStyle = '#263238'; ctx.fillRect(1,1,14,14);
             ctx.fillStyle = '#00bcd4'; ctx.fillRect(4, 4, 8, 1); ctx.fillRect(4, 10, 8, 1);
             addNoise(ctx, 16, 16, 0.3, 0.2);
             break;

        case TileType.FACTORY_METAL:
             ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0,0,16,16);
             ctx.fillStyle = '#212121'; 
             ctx.fillRect(1,1,2,2); ctx.fillRect(13,1,2,2);
             ctx.fillRect(1,13,2,2); ctx.fillRect(13,13,2,2);
             ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(16,16); ctx.stroke();
             break;

        case TileType.SERVER_TERMINAL:
             ctx.fillStyle = '#002f2f'; ctx.fillRect(0,0,16,16);
             ctx.fillStyle = '#004d40'; ctx.fillRect(2,2,12,8); 
             ctx.fillStyle = Math.random()>0.5 ? '#00e676' : '#004d40'; ctx.fillRect(10,4,2,2);
             addNoise(ctx, 12, 8, 0.7, 0.3);
             break;

        case TileType.ORE_GOLD:
            ctx.fillStyle = C.STONE_BASE; ctx.fillRect(0,0,16,16);
            addNoise(ctx, 16, 16, 0.5, 0.2);
            ctx.fillStyle = '#ffab00'; 
            ctx.fillRect(4,4,2,2); ctx.fillRect(8,10,3,3); ctx.fillRect(12,2,2,2);
            break;

        case TileType.ORE_IRON:
            ctx.fillStyle = C.STONE_BASE; ctx.fillRect(0,0,16,16);
            addNoise(ctx, 16, 16, 0.5, 0.2);
            ctx.fillStyle = '#a1887f'; 
            ctx.fillRect(5,5,2,2); ctx.fillRect(10,8,3,3);
            break;

        case TileType.TORCH:
             ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0,0,16,16);
             ctx.fillStyle = '#3e2723'; ctx.fillRect(6, 8, 4, 8); 
             ctx.fillStyle = '#ff6f00'; ctx.beginPath(); ctx.arc(8, 6, 4, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(8, 6, 2, 0, Math.PI*2); ctx.fill();
             break;

        case TileType.DOOR_CLOSED:
            ctx.fillStyle = '#3e2723'; ctx.fillRect(0,0,16,16);
            ctx.fillStyle = '#2d1e1a'; ctx.fillRect(2,2,12,12); 
            ctx.fillStyle = '#ffd700'; ctx.fillRect(10, 8, 2, 2);
            addNoise(ctx, 16, 16, 0.2, 0.2);
            break;

        case TileType.DOOR_OPEN:
            ctx.fillStyle = '#2d1e1a'; ctx.fillRect(0,0,4,16); 
            break;
            
        case TileType.OLD_WORLD_DEBRIS:
            ctx.fillStyle = '#424242'; ctx.fillRect(0,0,16,16);
            addNoise(ctx, 16, 16, 0.6, 0.4);
            ctx.fillStyle = '#bf360c'; ctx.fillRect(4,2,2,8); 
            ctx.fillStyle = '#0277bd'; ctx.fillRect(8,10,4,4); 
            break;

        case TileType.WHEAT:
             ctx.fillStyle = C.DIRT_BASE; ctx.fillRect(0,0,16,16); 
             ctx.fillStyle = '#827717'; 
             ctx.fillRect(4,6,2,10); ctx.fillRect(10,4,2,12); 
             ctx.fillStyle = '#c0ca33'; ctx.fillRect(3,2,4,4); ctx.fillRect(9,0,4,4); 
             break;

        case TileType.ANVIL:
             ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0,0,16,16);
             ctx.fillStyle = '#212121'; 
             ctx.beginPath();
             ctx.moveTo(2, 16); ctx.lineTo(14, 16); ctx.lineTo(12, 12); ctx.lineTo(4, 12); ctx.fill();
             ctx.fillRect(6, 8, 4, 4);
             ctx.fillRect(2, 4, 12, 4);
             break;
             
        case TileType.CONCRETE:
             ctx.fillStyle = '#616161'; ctx.fillRect(0,0,16,16);
             addNoise(ctx, 16, 16, 0.3, 0.1);
             break;
        
        case TileType.POLE:
            ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0,0,16,16);
            ctx.fillStyle = '#212121'; ctx.fillRect(6, 0, 4, 16);
            ctx.fillStyle = '#616161'; ctx.fillRect(7, 0, 1, 16);
            break;
        
        case TileType.DEAD_BUSH:
            ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0,0,16,16);
            ctx.fillStyle = '#3e2723'; 
            ctx.beginPath();
            ctx.moveTo(8, 16); ctx.lineTo(8, 10); 
            ctx.lineTo(4, 6); ctx.moveTo(8, 10); ctx.lineTo(12, 6);
            ctx.moveTo(8, 12); ctx.lineTo(2, 10);
            ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 1; ctx.stroke();
            break;
            
        case TileType.HANGING_WIRES:
             ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0,0,16,16);
             ctx.fillStyle = '#111';
             ctx.fillRect(7, 0, 2, 8); 
             if(Math.random() > 0.9) {
                 ctx.fillStyle = '#00bcd4'; ctx.fillRect(6, 8, 4, 4);
             }
             break;
        
        case TileType.BOOKSHELF:
             ctx.fillStyle = '#3e2723'; ctx.fillRect(0,0,16,16);
             ctx.fillStyle = '#2d1e1a'; ctx.fillRect(0, 5, 16, 1); ctx.fillRect(0, 11, 16, 1);
             for(let i=1; i<15; i+=3) {
                 ctx.fillStyle = `hsl(${Math.random()*360}, 40%, 40%)`;
                 ctx.fillRect(i, 6, 2, 5);
                 ctx.fillStyle = `hsl(${Math.random()*360}, 40%, 40%)`;
                 ctx.fillRect(i, 0, 2, 5);
             }
             break;
             
        case TileType.LECTERN:
             ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0,0,16,16);
             ctx.fillStyle = '#3e2723'; ctx.fillRect(6, 6, 4, 10); 
             ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.moveTo(4, 6); ctx.lineTo(12, 6); ctx.lineTo(14, 2); ctx.lineTo(2, 2); ctx.fill(); 
             ctx.fillStyle = '#fff'; ctx.fillRect(4, 3, 8, 2); 
             break;

        // ICONS
        case 100 as any: // Iron Sword Hack for Icons
             ctx.translate(8,8); ctx.rotate(Math.PI/4); ctx.translate(-8,-8);
             ctx.fillStyle = '#757575'; ctx.fillRect(6,2,4,10);
             ctx.fillStyle = '#3e2723'; ctx.fillRect(7,12,2,4); 
             ctx.fillStyle = '#5d4037'; ctx.fillRect(5,12,6,2); 
             break;

        default:
            ctx.fillStyle = '#b71c1c'; ctx.fillRect(0,0,16,16);
    }
    return canvas;
};

// --- HELD ITEM SPRITE GENERATOR ---
export const createToolSprite = (item: InventoryItem): HTMLCanvasElement => {
    // 32x32 canvas for better details
    const canvas = createCanvas(32, 32);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    if (item.name.includes('Pickaxe')) {
        ctx.translate(16, 16); ctx.rotate(-Math.PI / 4); ctx.translate(-16, -16);
        ctx.fillStyle = '#5d4037'; ctx.fillRect(14, 12, 4, 12); // Handle
        ctx.fillStyle = '#9e9e9e'; 
        // Head
        ctx.beginPath(); 
        ctx.moveTo(8, 10); ctx.quadraticCurveTo(16, 6, 24, 10); 
        ctx.lineTo(22, 14); ctx.quadraticCurveTo(16, 10, 10, 14); 
        ctx.fill();
    } 
    else if (item.name.includes('Sword') && !item.name.includes('Energy')) {
        // Rotated 45 deg to point up-right
        ctx.translate(16, 16); ctx.rotate(-Math.PI / 4); ctx.translate(-16, -16);
        
        // Hilt
        ctx.fillStyle = '#3e2723'; ctx.fillRect(14, 24, 4, 6);
        // Guard
        ctx.fillStyle = '#5d4037'; ctx.fillRect(10, 22, 12, 2);
        // Blade (Metallic Gradient)
        const grad = ctx.createLinearGradient(12, 22, 20, 2);
        grad.addColorStop(0, '#90a4ae');
        grad.addColorStop(0.5, '#cfd8dc');
        grad.addColorStop(1, '#eceff1');
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.moveTo(12, 22);
        ctx.lineTo(20, 22);
        ctx.lineTo(18, 4); // Tip side
        ctx.lineTo(16, 1); // Point
        ctx.lineTo(14, 4); // Tip side
        ctx.closePath();
        ctx.fill();
        
        // Shine line
        ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(16, 20); ctx.lineTo(16, 4); ctx.stroke();
    }
    else if (item.name.includes('Pistol')) {
         ctx.fillStyle = '#5d4037'; ctx.fillRect(8, 16, 6, 6); // Handle
         ctx.fillStyle = '#757575'; ctx.fillRect(8, 10, 14, 6); // Barrel
         ctx.fillStyle = '#000'; ctx.fillRect(20, 11, 2, 2);
    }
    else if (item.name.includes('Shotgun') || item.name.includes('Boomstick')) {
         ctx.fillStyle = '#3e2723'; ctx.fillRect(4, 14, 8, 4); // Stock
         ctx.fillStyle = '#424242'; ctx.fillRect(12, 12, 16, 4); // Barrel
         ctx.fillStyle = '#111'; ctx.fillRect(26, 12, 2, 4);
    }
    else if (item.name.includes('Rifle') || item.name.includes('Railgun')) {
         ctx.fillStyle = '#0288d1'; ctx.fillRect(4, 14, 8, 4);
         ctx.fillStyle = '#b3e5fc'; ctx.fillRect(12, 14, 18, 3);
         if (item.name.includes('Railgun')) {
             ctx.fillStyle = '#76ff03'; ctx.fillRect(14, 13, 14, 1); // Glow
         }
    }
    else if (item.name.includes('Rocket')) {
         ctx.fillStyle = '#37474f'; ctx.fillRect(6, 10, 20, 8); // Tube
         ctx.fillStyle = '#263238'; ctx.fillRect(10, 18, 6, 4); // Handle
         ctx.fillStyle = '#d84315'; ctx.fillRect(6, 10, 2, 8); // Back
    }
    else if (item.tileType) {
        const tex = createTileTexture(item.tileType);
        ctx.drawImage(tex, 8, 8, 16, 16); 
    }
    else if (item.type === 'book') {
        ctx.fillStyle = '#5d4037'; ctx.fillRect(8, 6, 16, 20);
        ctx.fillStyle = '#fff'; ctx.fillRect(10, 8, 12, 16);
        ctx.fillStyle = '#000'; ctx.fillRect(12, 10, 8, 1); ctx.fillRect(12, 14, 8, 1);
    }
    else {
        // Fallback
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(8, 8, 16, 16);
    }
    return canvas;
};

// ... (Rest of sprites: createPlayerSprite, createEntitySprite kept the same) ...
export const createPlayerSprite = (player: Player): HTMLCanvasElement => {
    const width = 48;
    const height = 32;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const { animationFrame, facingRight, isRolling, isCrouching, vx, swingProgress, wallSlideDir, isGrounded } = player;
    
    // Shifted CY down to fix floating (Feet will land at Y=32 approx)
    const cx = 24; 
    const cy = 27; 
    
    const isWallSliding = wallSlideDir !== 0 && !isGrounded;

    // If rolling, just a ball
    if (isRolling) {
        ctx.translate(cx, cy - 6);
        const rotation = (animationFrame % 8) * (Math.PI / 4) * (vx > 0 ? 1 : -1);
        ctx.rotate(rotation);
        ctx.translate(-cx, -(cy - 6));
        
        ctx.fillStyle = '#212121'; // Black body
        ctx.beginPath(); ctx.arc(cx, cy - 6, 6, 0, Math.PI * 2); ctx.fill(); 
        ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx-6, cy-6); ctx.lineTo(cx+6, cy-6); ctx.stroke();
        return canvas;
    }

    if (!facingRight) {
        ctx.translate(width, 0); 
        ctx.scale(-1, 1);
    }

    // Animation Cycles
    const speed = Math.abs(vx);
    const time = animationFrame * 0.2; // Slowed down base time
    const runCycle = Math.sin(time * 2.5); // Run speed
    const isMoving = speed > 0.1;
    
    // Idle Animation (Breathing/Bobbing)
    const idleBreath = Math.sin(time * 0.5) * 1; 
    const bob = isMoving ? Math.abs(Math.sin(time * 5)) * 1.5 : (idleBreath * 0.5); 

    // Crouch offset
    const crouchOffset = isCrouching ? 5 : 0;

    // Attack Rotation handled in GameCanvas for held item, but arm follows here
    let armRot = 0;
    if (swingProgress > 0) {
        armRot = -(swingProgress * Math.PI) + (Math.PI/4); 
    } else {
        armRot = isMoving ? Math.sin(time * 2.5) * 0.8 : Math.sin(time * 0.5) * 0.1; // Idle arm swing
    }
    
    if (isWallSliding) {
        armRot = -2.0; // Arm Up against wall
    }

    // --- 1. ANIMATED CAPE (Fluid Physics Simulation Look) ---
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    // Anchor point lowers with crouch/bob
    const anchorY = cy - 12 - bob + crouchOffset;
    ctx.moveTo(cx - 3, anchorY); 
    
    // Drag increases with speed, but also hangs when idle
    // If wall sliding, drag is UP
    const capeDrag = isWallSliding ? 0 : Math.min(speed * 8, 12);
    const capeLift = isWallSliding ? -10 : 0;
    const capeIdleSway = isMoving ? 0 : Math.sin(time * 0.3) * 2;
    
    const capeWave1 = Math.sin(time * (isMoving ? 2.5 : 0.5)) * 2;
    
    // Control points for bezier cape
    const cp1x = (cx - 6) - capeDrag * 0.5 + capeIdleSway;
    const cp1y = anchorY + 6 + capeWave1 + capeLift;
    
    const endX = (cx - 3) - 6 - capeDrag + (capeIdleSway * 1.5);
    const endY = anchorY + 12 + capeWave1 + capeLift; // Cape length

    ctx.bezierCurveTo(cp1x, cp1y, endX, endY - 4, endX, endY);
    ctx.lineTo(endX + 4, endY + 2); 
    ctx.bezierCurveTo(cp1x + 4, cp1y + 2, cx, anchorY + 6, cx + 3, anchorY);
    ctx.fill();

    // --- 2. BACK LIMBS (Left Arm/Leg) ---
    ctx.fillStyle = '#111'; 
    
    // Back Arm
    let backArmAngle = isMoving ? -runCycle : (isCrouching ? 0.5 : 0.1);
    if (isWallSliding) backArmAngle = 0.5; // Balance

    ctx.save();
    ctx.translate(cx - 3, cy - 11 - bob + crouchOffset);
    ctx.rotate(backArmAngle);
    ctx.fillRect(-1, 0, 2, 6);
    ctx.fillStyle = '#fff'; ctx.fillRect(-1, 4, 2, 2); // Hand
    ctx.restore();

    // Back Leg
    let backLegAngle = isMoving ? runCycle : (isCrouching ? 0.8 : 0);
    if (isWallSliding) backLegAngle = 0.4; // Braced against wall

    ctx.fillStyle = '#111';
    ctx.save();
    ctx.translate(cx - 2, cy - 5 - bob + crouchOffset);
    
    if (isCrouching) {
        // Splayed leg for crouching
        ctx.rotate(-0.5); 
        ctx.fillRect(-1, 0, 3, 4); // Thigh
        ctx.translate(0, 4);
        ctx.rotate(1.2); // Knee bend
        ctx.fillRect(-1, 0, 2, 4); // Shin
        ctx.fillStyle = '#fff'; ctx.fillRect(-1, 3, 2, 2); // Foot
    } else {
        ctx.rotate(backLegAngle * 0.8);
        ctx.fillRect(-1, 0, 3, 5); // Thigh
        ctx.translate(0, 5);
        const backKnee = backLegAngle > 0 ? backLegAngle * 0.5 : 0;
        ctx.rotate(backKnee);
        ctx.fillRect(-1, 0, 2, 5); // Shin
        ctx.fillStyle = '#fff'; ctx.fillRect(-1, 3, 2, 2); // Foot
    }
    ctx.restore();

    // --- 3. BODY & HEAD ---
    // Torso
    ctx.fillStyle = '#111111';
    ctx.fillRect(cx - 4, cy - 12 - bob + crouchOffset, 8, 9);
    
    // Chest Emblem
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath();
    const chestY = cy - 8 - bob + crouchOffset;
    ctx.moveTo(cx - 2, chestY - 2); ctx.lineTo(cx + 2, chestY + 2);
    ctx.moveTo(cx - 2, chestY + 2); ctx.lineTo(cx + 2, chestY - 2);
    ctx.stroke();

    // Head (Independent slightly lagged bob + look around)
    const headBob = bob * 0.8; 
    let lookX = isMoving ? 0 : Math.sin(time * 0.2) * 1; // Slight head turn when idle
    if (isWallSliding) lookX = 2; // Look slightly towards wall if facing away? Or forward?

    ctx.fillStyle = '#00e5ff'; 
    ctx.beginPath();
    ctx.arc(cx + lookX, cy - 13 - headBob + crouchOffset, 5, Math.PI, 0); 
    ctx.lineTo(cx + 5 + lookX, cy - 13 - headBob + crouchOffset);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(cx + 2 + lookX, cy - 16 - headBob + crouchOffset, 2, 2);

    // --- 4. FRONT LIMBS (Right Arm/Leg) ---
    // Front Leg
    let frontLegAngle = isMoving ? -runCycle : (isCrouching ? -0.8 : 0);
    if (isWallSliding) frontLegAngle = -0.3; // Other leg also braced but slightly offset

    ctx.fillStyle = '#111';
    ctx.save();
    ctx.translate(cx + 2, cy - 5 - bob + crouchOffset);
    
    if (isCrouching) {
        ctx.rotate(0.5);
        ctx.fillRect(-1, 0, 3, 4);
        ctx.translate(0, 4);
        ctx.rotate(-1.2);
        ctx.fillRect(-1, 0, 2, 4);
        ctx.fillStyle = '#fff'; ctx.fillRect(-1, 3, 2, 2);
    } else {
        ctx.rotate(frontLegAngle * 0.8);
        ctx.fillRect(-1, 0, 3, 5);
        ctx.translate(0, 5);
        const frontKnee = frontLegAngle > 0 ? frontLegAngle * 0.5 : 0;
        ctx.rotate(frontKnee);
        ctx.fillRect(-1, 0, 2, 5);
        ctx.fillStyle = '#fff'; ctx.fillRect(-1, 3, 2, 2);
    }
    ctx.restore();

    // Front Arm (Attack Arm)
    ctx.fillStyle = '#111';
    ctx.save();
    ctx.translate(cx + 3, cy - 11 - bob + crouchOffset);
    ctx.rotate(armRot);
    ctx.fillRect(-1, 0, 3, 6); // Arm
    ctx.fillStyle = '#fff'; ctx.fillRect(-1, 4, 3, 2); // Hand
    ctx.restore();

    return canvas;
}

export const createPartSprite = (partName: string): HTMLCanvasElement => {
    const canvas = createCanvas(32, 32);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.fillStyle = '#546e7a'; ctx.fillRect(10, 10, 12, 12);
    return canvas;
};

export const createEntitySprite = (type: EntityType, frame: number, facingRight: boolean, job?: VillagerJob): HTMLCanvasElement => {
    const isBoss = type === EntityType.BOSS_GUARDIAN || type === EntityType.BOSS_SENTRY || type === EntityType.BOSS_URSUS || type === EntityType.MECHA_REX || type === EntityType.VOID_STALKER;
    const isBig = type === EntityType.PTEROSAUR || type === EntityType.MECHA_BEAR || type === EntityType.WOLF || type === EntityType.DEER || type === EntityType.BOAR || type === EntityType.SCRAP_WALKER;
    const isSmall = type === EntityType.RABBIT || type === EntityType.RAT || type === EntityType.BAT || type === EntityType.DUCK || type === EntityType.OWL;
    
    let w = 16, h = 24;
    if (type === EntityType.MECHA_REX) { w=48; h=48; }
    else if (isBoss) { w=32; h=32; }
    else if (isSmall) { w=16; h=16; } // Small canvas for small animals
    else if (isBig) { w=40; h=32; } // Wider canvas for big quadrupeds
    
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    if (!facingRight) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
    }
    
    const t = frame * 0.2;
    const walk = Math.sin(t) * 2; 
    const run = Math.sin(t * 2) * 3;
    const breathe = Math.sin(t * 0.5);

    // --- DEER (Gracile, Antlers) ---
    if (type === EntityType.DEER) {
        ctx.fillStyle = '#8d6e63'; 
        ctx.beginPath(); ctx.ellipse(20, 18, 10, 6, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(26, 16); ctx.quadraticCurveTo(28, 12, 32, 10); ctx.lineTo(34, 14); ctx.quadraticCurveTo(30, 16, 28, 20); ctx.fill();
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(14 + run, 20, 2, 12); ctx.fillRect(24 - run, 20, 2, 12);
        ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(32, 10); ctx.lineTo(32, 4); ctx.lineTo(30, 2); ctx.moveTo(32, 6); ctx.lineTo(35, 3); ctx.stroke();
    }
    // --- WOLF (Shaggy, Pointy) ---
    else if (type === EntityType.WOLF) {
        ctx.fillStyle = '#616161'; 
        ctx.beginPath(); ctx.ellipse(20, 20, 9, 5, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(30, 16, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(32, 16, 4, 3);
        ctx.beginPath(); ctx.moveTo(28, 12); ctx.lineTo(26, 8); ctx.lineTo(30, 12); ctx.fill();
        ctx.fillStyle = '#424242';
        ctx.fillRect(14 + run, 22, 3, 10); ctx.fillRect(24 - run, 22, 3, 10);
        ctx.beginPath(); ctx.moveTo(11, 18); ctx.quadraticCurveTo(5, 20 + walk, 8, 26); ctx.lineTo(12, 22); ctx.fill();
        ctx.fillStyle = '#d50000'; ctx.fillRect(31, 15, 1, 1);
    }
    // --- FOX (Orange, sleek) ---
    else if (type === EntityType.FOX) {
        ctx.fillStyle = '#e65100'; 
        ctx.beginPath(); ctx.ellipse(20, 20, 8, 4, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(14 + run, 22, 2, 8); ctx.fillRect(24 - run, 22, 2, 8);
        ctx.fillStyle = '#e65100'; 
        ctx.beginPath(); ctx.moveTo(26, 18); ctx.lineTo(32, 20); ctx.lineTo(26, 22); ctx.fill();
        ctx.beginPath(); ctx.moveTo(26, 18); ctx.lineTo(28, 14); ctx.lineTo(29, 18); ctx.fill();
        ctx.fillStyle = '#e65100';
        ctx.beginPath(); ctx.ellipse(10, 20 + walk, 6, 2, Math.PI/4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6, 17+walk, 2, 0, Math.PI*2); ctx.fill();
    }
    // --- BOAR (Bulky, Tusks) ---
    else if (type === EntityType.BOAR) {
        ctx.fillStyle = '#3e2723'; 
        ctx.beginPath(); ctx.arc(20, 18, 9, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(26, 16, 6, 6);
        ctx.fillRect(16 + walk, 24, 3, 6); ctx.fillRect(22 - walk, 24, 3, 6);
        ctx.fillStyle = '#fff'; 
        ctx.beginPath(); ctx.moveTo(30, 20); ctx.quadraticCurveTo(34, 18, 32, 16); ctx.fill();
    }
    // --- DUCK (Mallard) ---
    else if (type === EntityType.DUCK) {
        ctx.fillStyle = '#795548'; 
        ctx.beginPath(); ctx.ellipse(8, 10, 5, 3, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2e7d32'; 
        ctx.beginPath(); ctx.arc(12, 6, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffb300'; ctx.fillRect(14, 6, 3, 1);
        ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.ellipse(8, 10 + breathe, 3, 2, 0.2, 0, Math.PI*2); ctx.fill();
    }
    // --- OWL (Perched usually) ---
    else if (type === EntityType.OWL) {
        ctx.fillStyle = '#5d4037'; 
        ctx.beginPath(); ctx.ellipse(8, 8, 4, 6, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(5, 2, 6, 4);
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(6, 3, 1, 1); ctx.fillRect(9, 3, 1, 1);
        ctx.fillStyle = '#3e2723'; ctx.fillRect(4, 6, 2, 6); ctx.fillRect(10, 6, 2, 6);
    }
    // --- RAT (Small, pink tail) ---
    else if (type === EntityType.RAT) {
        ctx.fillStyle = '#757575'; 
        ctx.beginPath(); ctx.ellipse(8, 10, 4, 2, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#f48fb1'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(4, 10); ctx.quadraticCurveTo(0, 12, 2, 14); ctx.stroke();
        ctx.fillStyle = '#757575'; ctx.beginPath(); ctx.moveTo(10, 9); ctx.lineTo(14, 11); ctx.lineTo(10, 12); ctx.fill();
    }
    // --- BAT (Flying wings) ---
    else if (type === EntityType.BAT) {
        ctx.fillStyle = '#212121'; 
        ctx.beginPath(); ctx.arc(8, 8 + breathe*2, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#424242';
        const flap = Math.sin(frame * 0.5) * 4;
        ctx.beginPath(); ctx.moveTo(8, 8+breathe*2); ctx.lineTo(2, 4+flap); ctx.lineTo(4, 10+flap); ctx.fill();
        ctx.beginPath(); ctx.moveTo(8, 8+breathe*2); ctx.lineTo(14, 4+flap); ctx.lineTo(12, 10+flap); ctx.fill();
    }
    // --- RABBIT ---
    else if (type === EntityType.RABBIT) {
        ctx.fillStyle = '#e0e0e0'; 
        ctx.beginPath(); ctx.arc(8, 10, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(6, 2, 1, 5); ctx.fillRect(8, 2, 1, 5);
        ctx.fillStyle = '#f5f5f5'; ctx.fillRect(6 + walk, 13, 2, 1); ctx.fillRect(9 - walk, 13, 2, 1);
    }
    
    // --- ROBOTS ---
    else if (type === EntityType.DRONE) {
         ctx.fillStyle = '#37474f'; 
         ctx.beginPath(); ctx.arc(8, 8 + breathe*2, 5, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = '#f44336'; ctx.fillRect(6, 6 + breathe*2, 4, 2);
         ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1;
         ctx.beginPath(); ctx.moveTo(2, 4+breathe*2); ctx.lineTo(14, 4+breathe*2); ctx.stroke();
    }
    else if (type === EntityType.SCRAP_WALKER) {
         ctx.fillStyle = '#5d4037'; 
         ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 2;
         ctx.beginPath(); ctx.moveTo(8, 10); ctx.lineTo(4, 18+walk); ctx.stroke();
         ctx.beginPath(); ctx.moveTo(8, 10); ctx.lineTo(12, 18-walk); ctx.stroke();
         ctx.fillStyle = '#795548'; ctx.fillRect(4, 4 + breathe, 8, 8);
         ctx.fillStyle = '#ff6f00'; ctx.fillRect(6, 6 + breathe, 2, 2); 
    }
    
    // --- BOSSES ---
    else if (type === EntityType.BOSS_GUARDIAN) {
        ctx.fillStyle = '#3e2723'; 
        ctx.fillRect(8, 8 + breathe, 16, 14);
        ctx.fillStyle = '#5d4037'; ctx.fillRect(10, 0 + breathe, 12, 8);
        ctx.fillStyle = '#00e676'; 
        ctx.fillRect(14, 4 + breathe, 4, 2); 
        ctx.fillRect(12, 12 + breathe, 8, 6); 
        ctx.fillStyle = '#4e342e'; 
        const armSwing = Math.sin(t)*4;
        ctx.fillRect(2, 8 + armSwing, 6, 16); ctx.fillRect(24, 8 - armSwing, 6, 16);
    }
    else if (type === EntityType.BOSS_SENTRY) {
        ctx.fillStyle = '#263238'; 
        ctx.beginPath(); ctx.moveTo(8, 24); ctx.lineTo(24, 24); ctx.lineTo(16, 10); ctx.fill();
        ctx.fillStyle = '#37474f'; 
        ctx.fillRect(8, 4, 16, 10);
        ctx.fillStyle = '#000'; ctx.fillRect(24, 6, 8, 4);
        ctx.fillStyle = '#f44336'; ctx.beginPath(); ctx.arc(16, 9, 3, 0, Math.PI*2); ctx.fill();
    }
    else if (type === EntityType.BOSS_URSUS) {
        ctx.fillStyle = '#212121'; 
        ctx.fillRect(10, 16, 28, 16);
        ctx.fillStyle = '#d84315'; ctx.beginPath(); ctx.arc(24, 16, 14, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#424242'; ctx.fillRect(34, 14 + breathe, 12, 10);
        ctx.fillStyle = '#ff1744'; ctx.fillRect(40, 16 + breathe, 4, 2);
        ctx.fillStyle = '#111'; 
        ctx.fillRect(12 + walk, 28, 6, 14); ctx.fillRect(30 - walk, 28, 6, 14);
    }
    else if (type === EntityType.PTEROSAUR) {
        ctx.fillStyle = '#607d8b'; 
        ctx.beginPath(); ctx.ellipse(20, 16, 8, 4, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#90a4ae'; 
        const flap = Math.sin(frame*0.5) * 8;
        ctx.beginPath(); ctx.moveTo(20, 16); ctx.lineTo(4, 8+flap); ctx.lineTo(12, 20+flap); ctx.fill();
        ctx.beginPath(); ctx.moveTo(20, 16); ctx.lineTo(36, 8+flap); ctx.lineTo(28, 20+flap); ctx.fill();
        ctx.fillStyle = '#607d8b'; ctx.beginPath(); ctx.moveTo(26, 14); ctx.lineTo(38, 12); ctx.lineTo(28, 18); ctx.fill();
        ctx.fillStyle = '#ffeb3b'; ctx.fillRect(30, 14, 2, 1); 
    }
    else if (type === EntityType.MECHA_BEAR) {
        ctx.fillStyle = '#546e7a'; 
        ctx.fillRect(10, 14, 20, 10);
        ctx.fillStyle = '#37474f'; ctx.fillRect(28, 12, 8, 8); 
        ctx.fillStyle = '#00bcd4'; ctx.fillRect(32, 14, 2, 2); 
        ctx.fillRect(12 + walk, 24, 4, 6); ctx.fillRect(24 - walk, 24, 4, 6);
    }
    else if (type === EntityType.MECHA_REX) {
        ctx.fillStyle = '#1b5e20'; 
        ctx.save();
        ctx.translate(16, 24);
        ctx.rotate(-0.2);
        ctx.fillRect(0, -10, 24, 14);
        ctx.restore();
        ctx.fillStyle = '#2e7d32'; ctx.fillRect(30, 6 + breathe, 14, 10);
        ctx.fillStyle = '#1b5e20'; ctx.fillRect(32, 14 + breathe, 10, 4);
        ctx.fillStyle = '#ffca28'; ctx.fillRect(38, 8 + breathe, 3, 3);
        ctx.fillStyle = '#1b5e20'; ctx.fillRect(20 + walk, 24, 8, 16); ctx.fillRect(10 - walk, 24, 8, 16);
    }
    else if (type === EntityType.VOID_STALKER) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; 
        ctx.beginPath(); ctx.arc(16, 16, 12 + breathe*2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#6200ea'; 
        ctx.beginPath(); ctx.arc(12, 14, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(20, 14, 2, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        for(let i=0; i<4; i++) {
            ctx.beginPath(); 
            ctx.moveTo(16, 20); 
            ctx.quadraticCurveTo(16 + (i-2)*10, 30 + walk, 16 + (i-2)*8, 40);
            ctx.stroke();
        }
    }

    // --- GENERIC VILLAGER ---
    else if (type === EntityType.VILLAGER) {
        ctx.fillStyle = job === VillagerJob.FARMER ? '#558b2f' : (job === VillagerJob.BLACKSMITH ? '#4e342e' : (job === VillagerJob.LIBRARIAN ? '#5e35b1' : '#6d4c41'));
        ctx.fillRect(4, 8, 8, 16);
        ctx.fillStyle = '#ffccbc'; ctx.fillRect(4, 2 + breathe, 8, 6);
        ctx.fillStyle = '#000'; ctx.fillRect(6, 4 + breathe, 1, 1); ctx.fillRect(9, 4 + breathe, 1, 1);
        if (job === VillagerJob.FARMER) {
             ctx.fillStyle = '#fdd835'; ctx.fillRect(2, 0 + breathe, 12, 2);
        }
    }
    // --- ZOMBIE ---
    else if (type === EntityType.ZOMBIE) {
        ctx.fillStyle = '#2e7d32'; 
        ctx.fillRect(4, 8, 8, 16);
        ctx.fillStyle = '#1b5e20'; ctx.fillRect(4, 2 + breathe, 8, 6); 
        ctx.fillStyle = '#d50000'; ctx.fillRect(5, 4 + breathe, 2, 2); 
        ctx.fillRect(10, 10 + breathe, 6, 2);
    }

    return canvas;
};