




import React, { useRef, useEffect, useState, useMemo } from 'react';
import { GameEngine } from '../classes/GameEngine';
import { TileType, EntityType, VillagerJob, AIState, ItemType, BiomeType } from '../types';
import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT, RENDER_SCALE, BIOME_CONFIG, REACH_PIXELS } from '../constants';
import { createTileTexture, createPlayerSprite, createEntitySprite, createPartSprite, createToolSprite } from '../utils/procedural';

interface GameCanvasProps {
  engine: GameEngine;
  isUIOpen: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ engine, isUIOpen }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });
  const [time, setTime] = useState(0);

  const lightCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  const textures = useMemo(() => {
      const cache: Record<number, HTMLCanvasElement> = {};
      Object.values(TileType).forEach(val => {
          if (typeof val === 'number') cache[val] = createTileTexture(val);
      });
      return cache;
  }, []);

  useEffect(() => {
      const unsub = engine.subscribe((e) => {
          if (e.type === 'TIME_UPDATE') setTime(e.payload);
      });
      return unsub;
  }, [engine]);

  useEffect(() => {
    const handleResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setDimensions({ w, h });
        engine.setCanvasSize(w / RENDER_SCALE, h / RENDER_SCALE);
        lightCanvasRef.current.width = w;
        lightCanvasRef.current.height = h;
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [engine]);

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (isUIOpen) {
          if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
          }
      }

      const handleClick = () => {
          if (!isUIOpen) {
              canvas.requestPointerLock();
          }
      };

      const handleMouseMove = (e: MouseEvent) => {
          if (isUIOpen) return;
          const isLocked = document.pointerLockElement === canvas;
          if (isLocked) {
               // Relative movement needs to be scaled to logical pixels to match cursor speed expectation
               engine.handleMouse(e.movementX / RENDER_SCALE, e.movementY / RENDER_SCALE, true, (e.buttons&1)===1, (e.buttons&2)===2);
          } else {
               // Absolute position must be converted to logical pixels
               engine.handleMouse(e.clientX / RENDER_SCALE, e.clientY / RENDER_SCALE, false, (e.buttons&1)===1, (e.buttons&2)===2);
          }
      };

      const handleMouseDown = (e: MouseEvent) => {
          if (isUIOpen) return;
          const isLocked = document.pointerLockElement === canvas;
          if (!isLocked && !isUIOpen) canvas.requestPointerLock();
          engine.mouseState.leftDown = (e.buttons & 1) === 1;
          engine.mouseState.rightDown = (e.buttons & 2) === 2;
      };

      const handleMouseUp = (e: MouseEvent) => {
          if (isUIOpen) {
              engine.mouseState.leftDown = false;
              engine.mouseState.rightDown = false;
              return;
          }
          engine.mouseState.leftDown = (e.buttons & 1) === 1;
          engine.mouseState.rightDown = (e.buttons & 2) === 2;
      };

      canvas.addEventListener('click', handleClick);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
          canvas.removeEventListener('click', handleClick);
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mousedown', handleMouseDown);
          document.removeEventListener('mouseup', handleMouseUp);
      };
  }, [engine, isUIOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const lightCtx = lightCanvasRef.current.getContext('2d');
    let animationId: number;

    const render = () => {
      ctx.imageSmoothingEnabled = false;
      if (lightCtx) lightCtx.imageSmoothingEnabled = false;

      engine.update();
      
      const { width, height } = canvas;
      
      // Dynamic Background based on Weather/Biome
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      if (engine.rainIntensity > 0) {
          if (engine.currentBiome === BiomeType.GARBAGE_WASTES) {
              grad.addColorStop(0, '#3e2723'); // Dark Brown Sky
              grad.addColorStop(1, '#5d4037'); 
          } else if (engine.currentBiome === BiomeType.INDUSTRIAL) {
              grad.addColorStop(0, '#0d47a1'); // Dark Electric Blue
              grad.addColorStop(1, '#1a237e');
          } else {
              grad.addColorStop(0, '#050505'); 
              grad.addColorStop(1, '#1a1a1d'); 
          }
      } else {
          grad.addColorStop(0, '#050505'); 
          grad.addColorStop(1, '#1a1a1d'); 
      }
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Mountains BG
      ctx.fillStyle = 'rgba(20, 20, 25, 0.5)';
      ctx.fillRect(0, height/2 + Math.sin(engine.time/1000)*20, width, height/2);

      ctx.save();
      ctx.scale(RENDER_SCALE, RENDER_SCALE); 
      
      const camX = Math.floor(engine.cameraX);
      const camY = Math.floor(engine.cameraY);
      
      ctx.translate(-camX, -camY);

      const logicalW = width / RENDER_SCALE;
      const logicalH = height / RENDER_SCALE;
      const startCol = Math.floor(camX / TILE_SIZE);
      const endCol = startCol + (logicalW / TILE_SIZE) + 2;
      const startRow = Math.floor(camY / TILE_SIZE);
      const endRow = startRow + (logicalH / TILE_SIZE) + 2;

      const visibleTorches: {x: number, y: number}[] = [];
      const foregroundTiles: {x: number, y: number, t: TileType}[] = [];

      for (let y = startRow; y <= endRow; y++) {
        for (let x = startCol; x <= endCol; x++) {
          if (y >= 0 && y < WORLD_HEIGHT) { 
             if (x >= 0 && x < WORLD_WIDTH) {
                 const tile = engine.world[y][x];
                 if (tile !== TileType.AIR) {
                     if (tile === TileType.DEAD_BUSH || tile === TileType.HANGING_WIRES) {
                         foregroundTiles.push({x, y, t: tile});
                         continue;
                     }
                     const tex = textures[tile];
                     if (tex) ctx.drawImage(tex, x * TILE_SIZE, y * TILE_SIZE);
                     if (tile === TileType.TORCH || tile === TileType.ALTAR || tile === TileType.SERVER_TERMINAL) {
                         visibleTorches.push({x: x * TILE_SIZE + 8, y: y * TILE_SIZE + 8});
                     }
                 }
             }
          }
        }
      }

      if (engine.miningState && engine.miningState.isMining) {
          const { x, y, progress, maxProgress } = engine.miningState;
          const ratio = progress / maxProgress;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          const shrink = Math.floor(8 * ratio); 
          ctx.fillRect(x * TILE_SIZE + shrink, y * TILE_SIZE + shrink, TILE_SIZE - (shrink * 2), TILE_SIZE - (shrink * 2));
      }

      // Entities
      engine.entities.forEach(ent => {
          const entSprite = createEntitySprite(ent.type, ent.animationFrame, ent.facingRight, ent.job);
          ctx.drawImage(entSprite, Math.floor(ent.x), Math.floor(ent.y));
          
          // Draw Equipped Item for Villagers
          if (ent.equipment && ent.equipment.body && ent.equipment.body.count > 0) {
              const toolSprite = createToolSprite(ent.equipment.body);
              const handX = ent.x + (ent.facingRight ? ent.width * 0.7 : ent.width * 0.3);
              const handY = ent.y + ent.height * 0.6;
              
              ctx.save();
              ctx.translate(handX, handY);
              if (!ent.facingRight) ctx.scale(-1, 1);
              
              // Simple swing if attacking
              if (ent.state === AIState.ATTACKING) {
                   const swing = Math.sin(engine.time * 0.5) * 0.5;
                   ctx.rotate(swing);
              }

              ctx.drawImage(toolSprite, -10, -10, 20, 20);
              ctx.restore();
          }

          // BOSS Telegraphs
          if (ent.state === AIState.BOSS_LASER) {
              const chargeRatio = ent.stateTimer ? Math.min(1, ent.stateTimer/100) : 0;
              ctx.fillStyle = `rgba(255, 0, 0, ${1-chargeRatio})`;
              ctx.beginPath();
              ctx.arc(ent.x + ent.width/2, ent.y + ent.height/2, 5 + (1-chargeRatio)*10, 0, Math.PI*2);
              ctx.fill();
          }

          if (ent.hasQuest) {
              const bounce = Math.abs(Math.sin(engine.time / 20)) * 4;
              ctx.font = 'bold 16px monospace';
              ctx.fillStyle = '#ffd600';
              ctx.strokeStyle = 'black';
              ctx.lineWidth = 2;
              const tx = ent.x + ent.width / 2 - 4;
              const ty = ent.y - 12 - bounce;
              ctx.strokeText('!', tx, ty);
              ctx.fillText('!', tx, ty);
          }

          if (ent.isInParty) {
              const bounce = Math.abs(Math.sin(engine.time / 20)) * 2;
              ctx.font = '12px monospace';
              ctx.fillStyle = '#00e676';
              const tx = ent.x + ent.width/2 - 4;
              const ty = ent.y - 4 - bounce;
              ctx.fillText('🛡️', tx, ty);
          }

          if (ent.emote) {
              const bounce = Math.sin(time / 5) * 2;
              ctx.font = '10px monospace';
              ctx.fillStyle = '#ffffff';
              ctx.fillText(ent.emote, ent.x + ent.width/2 - 4, ent.y - 8 + bounce);
          }
      });

      // Projectiles
      engine.projectiles.forEach(p => {
          ctx.fillStyle = p.color;
          if (p.type === 'laser' || p.type === 'rail') {
               const angle = Math.atan2(p.vy, p.vx);
               ctx.save();
               ctx.translate(p.x, p.y);
               ctx.rotate(angle);
               ctx.fillRect(0, -p.height/2, Math.max(p.width, 16), p.height); // Stretch laser
               ctx.restore();
          } else if (p.type === 'missile') {
               ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
          } else if (p.type === 'shockwave') {
               ctx.beginPath(); ctx.arc(p.x, p.y, p.width, 0, Math.PI*2); ctx.stroke();
          } else {
               ctx.fillRect(p.x, p.y, p.width, p.height);
          }
      });

      // Player
      const { player } = engine;
      const pSprite = createPlayerSprite(player);
      const drawX = Math.floor(player.x + (player.width/2) - (pSprite.width/2));
      const drawY = Math.floor(player.y + player.height - pSprite.height);

      if (player.damageCooldown && player.damageCooldown > 0 && Math.floor(player.damageCooldown / 4) % 2 === 0) {
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = 'rgba(255,0,0,0.5)';
      } else {
          ctx.drawImage(pSprite, drawX, drawY); 
      }
      
      // Wall Slide Dust
      if (player.wallSlideDir !== 0 && !player.isGrounded && Math.random() < 0.3) {
           const dustX = player.wallSlideDir > 0 ? player.x + player.width : player.x;
           const dustY = player.y + Math.random() * player.height;
           engine.particles.push({
               x: dustX, y: dustY,
               vx: player.wallSlideDir > 0 ? -1 : 1, vy: -1,
               life: 15, size: 2, color: 'rgba(200,200,200,0.5)'
           });
      }

      const selectedItem = engine.inventory[player.selectedSlot];
      if (selectedItem && selectedItem.count > 0 && !player.isRolling) {
          const toolSprite = createToolSprite(selectedItem);
          const handX = drawX + (player.facingRight ? 28 : 20); 
          const handY = drawY + 18;
          ctx.save();
          ctx.translate(handX, handY);
          
          if (selectedItem.shootProps) {
               // GUN ROTATION (Point to cursor)
               // Corrected coordinate mapping: virtualCursor is already logical
               const mx = engine.virtualCursor.x + engine.cameraX;
               const my = engine.virtualCursor.y + engine.cameraY;
               let angle = Math.atan2(my - handY, mx - handX);
               
               if (!player.facingRight) {
                   ctx.scale(-1, 1);
                   angle = Math.atan2(my - handY, -(mx - handX)); 
               }
               ctx.rotate(angle);
          } else {
               // MELEE/TOOL ANIMATION with Varieties
               if (!player.facingRight) ctx.scale(-1, 1);
               
               let baseRot = 0;
               let swingRot = 0;
               let transX = 0;
               let transY = 0;

               if (player.swingProgress > 0) {
                   // 0 is start, 1 is end. swingProgress counts down from 1 to 0.
                   // So t goes 0 -> 1
                   const t = 1 - player.swingProgress;
                   
                   if (player.swingType === 'stab') {
                       // STAB: Move forward and back
                       const stabDist = Math.sin(t * Math.PI) * 15;
                       transX = stabDist;
                       swingRot = 0.2; // Slight tilt
                   } else if (player.swingType === 'overhead') {
                       // OVERHEAD: Big arc from back to front
                       // Start angle: -135 deg (-2.3 rad)
                       // End angle: 45 deg (0.78 rad)
                       const startAngle = -2.3;
                       const endAngle = 0.8;
                       swingRot = startAngle + (t * (endAngle - startAngle));
                       // Add some translation to follow arc
                       transY = -Math.sin(t * Math.PI) * 5;
                   } else {
                       // NORMAL SLASH (Default)
                       // Start: -45 deg, End: 90 deg
                       swingRot = (t * 2.5) - 0.5;
                   }
               } else {
                   // IDLE SWAY
                   swingRot = Math.sin(engine.time * 0.1) * 0.1;
               }

               ctx.translate(transX, transY);
               ctx.rotate(baseRot + swingRot);
          }
          
          ctx.drawImage(toolSprite, -10, -10, 20, 20);
          ctx.restore();
      }

      foregroundTiles.forEach(item => {
           const tex = textures[item.t];
           if (tex) ctx.drawImage(tex, item.x * TILE_SIZE, item.y * TILE_SIZE);
      });

      engine.particles.forEach(p => {
          ctx.fillStyle = p.color;
          if (p.vy > 5) {
               ctx.globalAlpha = 0.6;
               ctx.fillRect(p.x, p.y, 1, p.vy * 1.5);
               ctx.globalAlpha = 1;
          } else {
              ctx.fillRect(p.x, p.y, p.size, p.size);
          }
      });

      // Cursor Rendering - Corrected mapping
      const mx = engine.virtualCursor.x + engine.cameraX;
      const my = engine.virtualCursor.y + engine.cameraY;
      
      ctx.strokeStyle = isUIOpen ? 'rgba(255,255,255,0.3)' : '#ffffff';
      ctx.lineWidth = 1.5;
      const cs = 3; 
      ctx.beginPath();
      ctx.moveTo(mx - cs, my - cs); ctx.lineTo(mx + cs, my - cs); ctx.lineTo(mx + cs, my + cs); ctx.lineTo(mx - cs, my + cs); ctx.lineTo(mx - cs, my - cs);
      ctx.stroke();

      ctx.restore();

      // --- OVERLAYS (SCREEN SPACE) ---
      
      // 1. LIGHTNING FLASH
      if (engine.lightningTimer > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${engine.lightningTimer / 10})`;
          ctx.fillRect(0, 0, width, height);
      }

      // 2. WEATHER OVERLAYS
      if (engine.rainIntensity > 0 && engine.player.y < 60 * TILE_SIZE) {
          if (engine.currentBiome === BiomeType.GARBAGE_WASTES) {
              // SANDSTORM OVERLAY
              ctx.fillStyle = `rgba(194, 178, 128, ${0.1 + engine.rainIntensity * 0.2})`;
              ctx.fillRect(0, 0, width, height);
          }
      }

      // 3. MORNING FOG (Outskirts / Industrial)
      if (engine.time < 5000 && (engine.currentBiome === BiomeType.OUTSKIRTS || engine.currentBiome === BiomeType.INDUSTRIAL)) {
          const fogGrad = ctx.createLinearGradient(0, height/2, 0, height);
          fogGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          fogGrad.addColorStop(1, 'rgba(200, 220, 255, 0.3)');
          ctx.fillStyle = fogGrad;
          ctx.fillRect(0, 0, width, height);
      }

      if (lightCtx) {
          lightCtx.clearRect(0, 0, width, height);
          const vignette = lightCtx.createRadialGradient(width/2, height/2, height/3, width/2, height/2, height);
          vignette.addColorStop(0, 'rgba(0,0,0,0.1)');
          vignette.addColorStop(1, 'rgba(0,0,0,0.8)');
          lightCtx.fillStyle = vignette;
          lightCtx.fillRect(0, 0, width, height);

          lightCtx.fillStyle = `rgba(0,0,0,0.1)`;
          for(let i=0; i<width; i+=4) {
              if (Math.random() > 0.5) lightCtx.fillRect(i, 0, 2, height);
          }

          lightCtx.save();
          lightCtx.scale(RENDER_SCALE, RENDER_SCALE);
          lightCtx.translate(-camX, -camY);
          lightCtx.globalCompositeOperation = 'destination-out';
          
          const pCX = player.x + player.width/2;
          const pCY = player.y + player.height/2;
          const pGrad = lightCtx.createRadialGradient(pCX, pCY, 10, pCX, pCY, 120);
          pGrad.addColorStop(0, 'rgba(0,0,0,1)'); 
          pGrad.addColorStop(1, 'rgba(0,0,0,0)'); 
          lightCtx.fillStyle = pGrad;
          lightCtx.beginPath(); lightCtx.arc(pCX, pCY, 120, 0, Math.PI*2); lightCtx.fill();

          visibleTorches.forEach(torch => {
              const tGrad = lightCtx.createRadialGradient(torch.x, torch.y, 4, torch.x, torch.y, 80);
              tGrad.addColorStop(0, 'rgba(0,0,0,0.8)');
              tGrad.addColorStop(1, 'rgba(0,0,0,0)');
              lightCtx.fillStyle = tGrad;
              lightCtx.beginPath(); lightCtx.arc(torch.x, torch.y, 80, 0, Math.PI*2); lightCtx.fill();
          });
          
          // Projectile Glow
          engine.projectiles.forEach(p => {
              const tGrad = lightCtx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 30);
              tGrad.addColorStop(0, 'rgba(0,0,0,1)');
              tGrad.addColorStop(1, 'rgba(0,0,0,0)');
              lightCtx.fillStyle = tGrad;
              lightCtx.beginPath(); lightCtx.arc(p.x, p.y, 30, 0, Math.PI*2); lightCtx.fill();
          });

          lightCtx.restore();

          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0); 
          ctx.drawImage(lightCanvasRef.current, 0, 0);
          ctx.restore();
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [engine, textures, isUIOpen]);

  return (
    <canvas
        ref={canvasRef}
        width={dimensions.w}
        height={dimensions.h}
        onContextMenu={e => e.preventDefault()}
        className="block"
        style={{ imageRendering: 'pixelated', cursor: isUIOpen ? 'default' : 'none' }} 
    />
  );
};