import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GameCanvas } from './components/GameCanvas';
import { GameEngine } from './classes/GameEngine';
import { generateLore, chatWithVillager, configureAI, VillagerContext } from './services/geminiService';
import { GameEvent, InventoryItem, Player, ItemType, TileType, CraftingRecipe, Quest, EntityType, Entity } from './types';
import { RECIPES, VILLAGER_GREETINGS, SIDE_QUESTS } from './constants';

const GameSession = ({ onQuit, loadSave, creativeMode }: { onQuit: () => void, loadSave: boolean, creativeMode: boolean }) => {
  const engine = useMemo(() => {
      const e = new GameEngine();
      if (creativeMode && !loadSave) {
          e.player.creativeMode = true;
          e.player.health = e.player.maxHealth;
          e.fillCreativeInventory();
      }
      return e;
  }, []);
  
  const [player, setPlayer] = useState<Player>(engine.player);
  const [inventory, setInventory] = useState<InventoryItem[]>(engine.inventory);
  const [lore, setLore] = useState<{ text: string; show: boolean }>({ text: '', show: false });
  
  const [cursorItem, setCursorItem] = useState<InventoryItem | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [questOffer, setQuestOffer] = useState<{ quest: Quest, giverId: string } | null>(null);
  const [questCompletion, setQuestCompletion] = useState<{ quest: Quest } | null>(null);
  const [activeQuest, setActiveQuest] = useState<{title: string, progress: string} | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  
  const [readingBook, setReadingBook] = useState<{ title: string, content: string, author?: string } | null>(null);
  const [activeBoss, setActiveBoss] = useState<Entity | null>(null);
  
  const [isPaused, setIsPaused] = useState(false);
  const [showKeybinds, setShowKeybinds] = useState(false);
  const [showBossList, setShowBossList] = useState(false); // New Boss List State

  // GAME STATES
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);

  const [dialogue, setDialogue] = useState<{ 
      show: boolean; 
      speaker: string; 
      entityId: string;
      messages: { sender: string; text: string }[];
      loading: boolean;
      context: VillagerContext; 
  }>({ show: false, speaker: '', entityId: '', messages: [], loading: false, context: { isRaining: false, reputation: 'neutral', timeOfDay: 'day' } });
  
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hoverItem, setHoverItem] = useState<InventoryItem | null>(null);

  const isUIOpen = player.isInventoryOpen || dialogue.show || !!questOffer || lore.show || !!questCompletion || !!readingBook || isPaused || gameOver || gameWon || showBossList;
  
  useEffect(() => {
      // LOAD GAME IF REQUESTED
      if (loadSave) {
          if (engine.loadGame()) {
               setPlayer({...engine.player});
               setInventory([...engine.inventory]);
          }
      }
  }, []);

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (isUIOpen) {
              setMousePos({ x: e.clientX, y: e.clientY });
          }
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isUIOpen]);

  // Boss Polling
  useEffect(() => {
      const interval = setInterval(() => {
          if (engine.paused) return;
          // Find ALL relevant active bosses
          const bosses = engine.entities.filter(e => 
              (e.type === EntityType.BOSS_GUARDIAN || 
               e.type === EntityType.BOSS_SENTRY || 
               e.type === EntityType.BOSS_URSUS || 
               e.type === EntityType.MECHA_REX || 
               e.type === EntityType.VOID_STALKER || 
               e.type === EntityType.MECHA_BEAR) && !e.isDead
          );
          
          if (bosses.length > 0) {
              // Find closest boss
              let closestBoss = bosses[0];
              let minDst = Infinity;
              
              bosses.forEach(b => {
                  const dst = Math.abs(b.x - engine.player.x);
                  if (dst < minDst) {
                      minDst = dst;
                      closestBoss = b;
                  }
              });

              // Hide boss bar if closest boss is too far away (e.g., ran away)
              if (minDst > 1000) {
                  setActiveBoss(null);
                  return;
              }

              setActiveBoss(prev => {
                  if (!prev || prev.id !== closestBoss.id || prev.health !== closestBoss.health) {
                      return { ...closestBoss }; // Copy to force update
                  }
                  return prev;
              });
          } else {
              setActiveBoss(null);
          }
      }, 200); // Check every 200ms
      return () => clearInterval(interval);
  }, [engine]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Toggle Boss List
        if (e.code === 'Tab') {
            e.preventDefault(); // Prevent focus switch
            if (!gameOver && !gameWon && !isPaused) {
                setShowBossList(prev => !prev);
            }
            return;
        }

        // Pause Toggle
        if (e.code === 'Escape') {
            if (gameOver || gameWon) return; // Cannot unpause death

            if (showBossList) {
                setShowBossList(false);
                return;
            }
            if (dialogue.show) {
                setDialogue(prev => ({ ...prev, show: false }));
                return;
            }
            if (player.isInventoryOpen) {
                engine.handleInput('keydown', 'KeyE'); // Close inventory
                return;
            }
            if (readingBook) {
                setReadingBook(null);
                return;
            }
            if (questOffer) {
                setQuestOffer(null);
                return;
            }
            if (questCompletion) {
                setQuestCompletion(null);
                return;
            }
            if (lore.show) {
                setLore({ ...lore, show: false });
                return;
            }

            // Toggle Pause
            const nextPaused = !isPaused;
            setIsPaused(nextPaused);
            engine.paused = nextPaused;
            setShowKeybinds(false); // Reset submenus
            return;
        }

        if (dialogue.show || isPaused || gameOver || gameWon || showBossList) return;
        engine.handleInput('keydown', e.code);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (dialogue.show || isPaused || gameOver || gameWon || showBossList) return;
        engine.handleInput('keyup', e.code);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const unsubscribe = engine.subscribe(async (event: GameEvent) => {
      if (event.type === 'PLAYER_UPDATE') setPlayer({ ...event.payload });
      if (event.type === 'INVENTORY_UPDATE') setInventory([...event.payload]);
      if (event.type === 'LORE_DISCOVERED') {
        setLore({ text: 'Deciphering...', show: true });
        const story = await generateLore(event.payload.block, event.payload.depth, event.payload.surroundings);
        setLore({ text: story, show: true });
      }
      if (event.type === 'QUEST_OFFER') {
          setQuestOffer(event.payload);
      }
      if (event.type === 'QUEST_COMPLETION') {
          setQuestCompletion({ quest: event.payload.quest });
      }
      if (event.type === 'QUEST_UPDATE') {
          setNotification(event.payload.message);
          setTimeout(() => setNotification(null), 4000);
      }
      if (event.type === 'GAME_OVER') {
          setGameOver(true);
      }
      if (event.type === 'GAME_WON') {
          setGameWon(true);
      }
      if (event.type === 'DIALOGUE_OPEN') {
          if (dialogue.show) return; 

          const targetEntity = engine.entities.find(e => e.id === event.payload.entityId);
          const isNight = engine.time > 14000 && engine.time < 22000;
          const isRaining = engine.rainIntensity > 0.2;
          
          let reputation: 'friendly' | 'neutral' | 'hostile' = 'neutral';
          if (targetEntity) {
              if (targetEntity.damageTaken > 15) reputation = 'hostile';
              else if (targetEntity.damageTaken > 0) reputation = 'neutral';
              else if (targetEntity.isInParty) reputation = 'friendly';
              else reputation = 'friendly';
          }

          let pool = VILLAGER_GREETINGS.DAY;
          
          if (targetEntity?.job === 'librarian') {
             pool = VILLAGER_GREETINGS.LIBRARIAN;
          } else {
            if (reputation === 'hostile') {
                pool = VILLAGER_GREETINGS.HURT;
                if (Math.random() < 0.5) pool = VILLAGER_GREETINGS.ANGRY;
            } else if (targetEntity?.state === 'seeking_shelter' || isRaining) {
                pool = VILLAGER_GREETINGS.SHELTER;
            } else if (isRaining) {
                pool = VILLAGER_GREETINGS.RAIN;
            } else if (isNight) {
                pool = VILLAGER_GREETINGS.NIGHT;
            } else if (Math.random() < 0.2) {
                pool = VILLAGER_GREETINGS.QUEST;
            }
          }

          let greeting = pool[Math.floor(Math.random() * pool.length)];
          let messages = targetEntity?.chatHistory || [];

          // 30 Second Rule: If last interaction was > 30s ago, add new greeting. 
          // Otherwise, resume old chat.
          const now = Date.now();
          const lastInteraction = targetEntity?.lastInteractionTime || 0;
          
          if (messages.length === 0 || (now - lastInteraction > 30000)) {
               messages = [...messages, { sender: targetEntity?.name || 'Villager', text: greeting }];
               // Save this new greeting immediately so it persists if you close/reopen
               engine.updateEntityChatHistory(targetEntity?.id || '', messages);
          }

          setDialogue({ 
              show: true, 
              speaker: targetEntity?.name || 'Villager',
              entityId: targetEntity?.id || '',
              messages: messages,
              loading: false,
              context: { 
                  isRaining, 
                  timeOfDay: isNight ? 'night' : 'day', 
                  reputation,
                  villagerName: targetEntity?.name,
                  villagerPersonality: targetEntity?.personality,
                  villagerJob: targetEntity?.job
              }
          });
          
          setTimeout(() => inputRef.current?.focus(), 100);
      }
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      unsubscribe();
    };
  }, [engine, dialogue.show, isPaused, readingBook, questOffer, questCompletion, lore.show, player.isInventoryOpen, gameOver, gameWon, showBossList]);

  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogue.messages]);

  useEffect(() => {
      if (player.activeQuestId && player.questProgress !== undefined) {
          const questDef = SIDE_QUESTS.find(q => q.id === player.activeQuestId);
          if (questDef) {
              setActiveQuest({
                  title: questDef.title,
                  progress: `${player.questProgress} / ${questDef.objective.amount}`
              });
          }
      } else {
          setActiveQuest(null);
      }
  }, [player.activeQuestId, player.questProgress]);

  useEffect(() => {
      if (!player.isInventoryOpen && cursorItem) {
          const emptyIdx = inventory.findIndex(i => i.count === 0);
          if (emptyIdx !== -1) {
              const newInv = [...inventory];
              newInv[emptyIdx] = cursorItem;
              engine.setInventory(newInv);
          }
          setCursorItem(null);
      }
  }, [player.isInventoryOpen]);

  const handleCraft = (recipe: CraftingRecipe) => {
      engine.craft(recipe);
  };

  const handleSlotClick = (index: number, e: React.MouseEvent) => {
      const clickedItem = inventory[index];
      const newInv = [...inventory];
      
      // Right click to read book
      if (e.button === 2) {
          if (clickedItem.type === ItemType.BOOK && clickedItem.text) {
              setReadingBook({ title: clickedItem.name, content: clickedItem.text, author: clickedItem.author });
          }
          return;
      }

      if (!cursorItem) {
          if (clickedItem.count > 0) {
              setCursorItem(clickedItem);
              newInv[index] = { id: `empty-${Date.now()}`, type: ItemType.BLOCK, tileType: TileType.AIR, name: 'Empty', count: 0, icon: '' };
              engine.setInventory(newInv);
          }
      } else {
          if (clickedItem.count === 0) {
              newInv[index] = cursorItem;
              setCursorItem(null);
              engine.setInventory(newInv);
          } else {
              const temp = newInv[index];
              newInv[index] = cursorItem;
              setCursorItem(temp);
              engine.setInventory(newInv);
          }
      }
  };

  const handleEquipClick = (slot: 'head' | 'body' | 'module') => {
      if (cursorItem) {
          if (cursorItem.armorType === slot) {
              // Swap or Equip
              const oldItem = engine.unequipItem(slot);
              engine.equipItem(cursorItem, slot);
              setCursorItem(oldItem);
          }
      } else {
          // Unequip
          const item = engine.unequipItem(slot);
          if (item) setCursorItem(item);
      }
  }

  const handleAcceptQuest = () => {
      if (!questOffer) return;
      engine.acceptQuest(questOffer.quest, questOffer.giverId);
      setQuestOffer(null);
      setNotification(`Accepted Quest: ${questOffer.quest.title}`);
      setTimeout(() => setNotification(null), 3000);
  };

  const handleCompleteQuest = () => {
      if (!questCompletion) return;
      engine.completeQuest();
      setQuestCompletion(null);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputText.trim() || dialogue.loading) return;
      
      // Update Context in real-time (e.g., if rain started while chat was open)
      const isNight = engine.time > 14000 && engine.time < 22000;
      const isRaining = engine.rainIntensity > 0.2;
      const currentContext = { ...dialogue.context, isRaining, timeOfDay: isNight ? 'night' : 'day' } as VillagerContext;

      const newMsg = { sender: 'You', text: inputText };
      const updatedHistory = [...dialogue.messages, newMsg];
      
      setDialogue(prev => ({ ...prev, messages: updatedHistory, loading: true, context: currentContext }));
      setInputText('');
      const invNames = inventory.filter(i => i.count > 0).map(i => i.name);
      
      const response = await chatWithVillager(updatedHistory, invNames, currentContext);
      
      const finalHistory = [...updatedHistory, { sender: dialogue.speaker, text: response.text }];

      setDialogue(prev => ({ 
          ...prev, 
          messages: finalHistory, 
          loading: false 
      }));

      // SAVE HISTORY TO ENTITY
      engine.updateEntityChatHistory(dialogue.entityId, finalHistory);

      // HANDLE COMMANDS
      if (response.action && response.action !== 'NONE') {
          engine.handleVillagerCommand(dialogue.entityId, response.action);
          if (response.action === 'FOLLOW' || response.action === 'ATTACK') {
              setNotification(`${dialogue.speaker}: ${response.action}!`);
              setTimeout(() => setNotification(null), 3000);
          }
      }
  };

  const getRecipeStatus = (recipe: CraftingRecipe) => {
      const hasIngredients = recipe.ingredients.every(ing => {
          const item = inventory.find(i => i.name === ing.name);
          return item && item.count >= ing.count;
      });
      return { hasIngredients };
  };

  // Helper to find name from ID
  const getEntityName = (id?: string) => {
      if (!id) return "Unknown";
      const ent = engine.entities.find(e => e.id === id);
      return ent?.name || "Villager";
  };

  const BOSS_INFO = [
      { id: EntityType.BOSS_GUARDIAN, name: "Temple Guardian", location: "Ancient Ruins (Altars)", desc: "Protects the old gods.", isRequired: true },
      { id: EntityType.BOSS_SENTRY, name: "Security Sentry", location: "Industrial Factories", desc: "Automated defense system.", isRequired: true },
      { id: EntityType.MECHA_REX, name: "Mecha Rex", location: "Garbage Wastes", desc: "Apex predator of scrap.", isRequired: true },
      { id: EntityType.PTEROSAUR, name: "Sky Demon", location: "The Skies", desc: "Flying terror.", isRequired: false },
      { id: EntityType.MECHA_BEAR, name: "Mecha Bear", location: "Industrial Complex", desc: "Armored beast.", isRequired: false },
      { id: EntityType.VOID_STALKER, name: "Void Stalker", location: "Night Time", desc: "Hunts in the dark.", isRequired: false },
      { id: EntityType.BOSS_URSUS, name: "PROJECT URSUS", location: "The Deep Vault", desc: "PRIMARY TARGET. HOLDER OF ARTIFACT.", isFinal: true, isRequired: false },
  ];

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-vt323 text-white" onContextMenu={(e) => e.preventDefault()}>
      <GameCanvas engine={engine} isUIOpen={isUIOpen} />

      <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
        <div className="flex justify-between w-full pointer-events-auto items-start">
            <div className="flex gap-4">
                <div className="bg-slate-900/80 p-2 rounded border-2 border-slate-600 flex flex-col w-48 shadow-lg">
                    <div className="flex justify-between text-sm text-slate-300">
                        <span>HP</span>
                        <span>{Math.ceil(player.health)}/{player.maxHealth}</span>
                    </div>
                    <div className="h-4 bg-slate-800 rounded mt-1 overflow-hidden">
                        <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${(player.health/player.maxHealth)*100}%` }} />
                    </div>
                    <div className="flex justify-between text-sm text-slate-300 mt-1">
                        <span>DEF</span>
                        <span className="text-blue-400 font-bold">{player.defense}</span>
                    </div>
                </div>
                <div className="text-yellow-400 drop-shadow-md pt-2 text-sm flex flex-col gap-1">
                    <span>[E] Inventory | [TAB] Targets | [ESC] Pause</span>
                    {player.creativeMode && <span className="text-purple-400 animate-pulse">[CREATIVE MODE]</span>}
                </div>
            </div>

            {/* BOSS HEALTH BAR */}
            {activeBoss && !activeBoss.isDead && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[600px] pointer-events-none z-40 animate-in fade-in zoom-in duration-500">
                    <div className="flex justify-between text-red-500 font-bold text-2xl mb-1 shadow-black drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-widest">
                        <span className="uppercase">{activeBoss.name || activeBoss.type.replace('boss_', '').replace('_', ' ')}</span>
                        <span>{Math.ceil(activeBoss.health)}</span>
                    </div>
                    <div className="h-6 bg-slate-900 border-2 border-red-900 rounded overflow-hidden relative shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                         <div 
                             className="h-full bg-gradient-to-r from-red-800 via-red-600 to-red-500 transition-all duration-300" 
                             style={{ width: `${Math.max(0, (activeBoss.health / activeBoss.maxHealth) * 100)}%` }}
                         ></div>
                         {/* Shine effect */}
                         <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10"></div>
                         <div className="absolute bottom-0 left-0 w-full h-1/2 bg-black/10"></div>
                    </div>
                </div>
            )}

            {activeQuest && (
                <div className="bg-slate-900/90 border-2 border-yellow-600 p-3 rounded w-64 shadow-lg">
                    <h3 className="text-yellow-500 font-bold border-b border-slate-700 mb-1">QUEST</h3>
                    <div className="text-white text-lg">{activeQuest.title}</div>
                    <div className="text-right text-slate-400 text-sm mt-1">{activeQuest.progress}</div>
                    <div className="text-right text-xs text-yellow-600 mt-1">Given by: {getEntityName(player.questGiverId)}</div>
                </div>
            )}
        </div>

        {notification && (
            <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-yellow-600/90 text-white px-6 py-2 rounded-full border-2 border-yellow-400 shadow-xl animate-bounce z-50 text-center">
                {notification}
            </div>
        )}

        {/* BOSS LIST OVERLAY */}
        {showBossList && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto">
                <div className="bg-slate-900 border-4 border-red-900 w-[700px] max-h-[80vh] overflow-hidden flex flex-col rounded-lg shadow-[0_0_50px_rgba(153,27,27,0.3)]">
                    <div className="bg-red-950/50 p-4 border-b border-red-900 flex justify-between items-center">
                        <h2 className="text-3xl text-red-500 font-bold tracking-[0.2em]">MISSION TARGETS</h2>
                        <span className="text-red-400/50 font-mono text-sm">DB_VER_2.1</span>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1">
                        {player.creativeMode && (
                            <div className="bg-blue-900/30 text-blue-200 p-3 mb-4 rounded border border-blue-500 text-center text-sm font-bold animate-pulse">
                                CREATIVE MODE: CLICK A TARGET TO TELEPORT TO ITS STRUCTURE
                            </div>
                        )}
                        <div className="grid gap-4">
                            {BOSS_INFO.map(boss => {
                                const isDefeated = engine.defeatedBosses.includes(boss.id);
                                return (
                                    <div 
                                        key={boss.id} 
                                        onClick={() => {
                                            if (player.creativeMode) {
                                                const result = engine.teleportToStructure(boss.id);
                                                setNotification(result.message);
                                                setTimeout(() => setNotification(null), 3000);
                                                if (result.success) setShowBossList(false);
                                            }
                                        }}
                                        className={`p-4 border-2 rounded flex justify-between items-center transition-all ${isDefeated ? 'bg-green-900/20 border-green-800' : (boss.isRequired ? 'bg-yellow-900/20 border-yellow-500' : 'bg-slate-800/50 border-slate-700')} ${player.creativeMode ? 'cursor-pointer hover:scale-[1.01] hover:shadow-lg active:scale-95 hover:bg-white/5' : ''}`}
                                        title={player.creativeMode ? "Click to Teleport" : ""}
                                    >
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className={`text-xl font-bold ${isDefeated ? 'text-green-500 line-through' : (boss.isFinal ? 'text-red-500 animate-pulse' : (boss.isRequired ? 'text-yellow-400' : 'text-slate-200'))}`}>
                                                    {boss.name}
                                                </h3>
                                                {boss.isFinal && <span className="text-xs bg-red-900/50 text-red-200 px-2 py-0.5 rounded border border-red-700">PRIMARY OBJECTIVE</span>}
                                                {boss.isRequired && !boss.isFinal && <span className="text-xs bg-yellow-900/50 text-yellow-200 px-2 py-0.5 rounded border border-yellow-600">KEY TARGET</span>}
                                            </div>
                                            <div className="text-sm text-slate-400 mt-1 italic">{boss.desc}</div>
                                            <div className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Location: {boss.location}</div>
                                        </div>
                                        <div className="text-right">
                                            {isDefeated ? (
                                                <span className="text-green-500 font-bold text-lg border border-green-500 px-3 py-1 rounded bg-green-900/30">ELIMINATED</span>
                                            ) : (
                                                <span className={`${boss.isRequired ? 'text-yellow-500 border-yellow-500 bg-yellow-900/30' : 'text-red-500 border-red-500 bg-red-900/30'} font-bold text-lg border px-3 py-1 rounded animate-pulse`}>ACTIVE</span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <div className="bg-slate-950 p-3 text-center text-slate-500 text-sm border-t border-slate-800">
                        Press [TAB] to Close Database
                    </div>
                </div>
            </div>
        )}

        {/* GAME OVER SCREEN */}
        {gameOver && (
            <div className="absolute inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center pointer-events-auto">
                 <h1 className="text-8xl text-red-600 font-bold tracking-widest mb-4 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]">SYSTEM FAILURE</h1>
                 <p className="text-2xl text-slate-400 mb-8">Your core has been shattered.</p>
                 <button onClick={onQuit} className="bg-red-800 hover:bg-red-700 text-white px-8 py-3 rounded text-2xl font-bold border-2 border-red-500 transition-all hover:scale-105 shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                     REBOOT SYSTEM
                 </button>
            </div>
        )}

        {/* VICTORY SCREEN */}
        {gameWon && (
            <div className="absolute inset-0 z-[100] bg-cyan-950/90 flex flex-col items-center justify-center pointer-events-auto">
                 <div className="text-9xl mb-4 animate-bounce">🧸</div>
                 <h1 className="text-6xl text-yellow-400 font-bold tracking-widest mb-2 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]">ARTIFACT RECOVERED</h1>
                 <p className="text-xl text-cyan-200 mb-8 max-w-lg text-center leading-relaxed">
                     You have found the Teddy Bear, the last remnant of a forgotten age of innocence. 
                     The mission is complete. The echoes of the deep have been silenced.
                 </p>
                 <div className="flex gap-4">
                     <button onClick={onQuit} className="bg-cyan-700 hover:bg-cyan-600 text-white px-8 py-3 rounded text-xl font-bold border-2 border-cyan-400 transition-all hover:scale-105">
                         RETURN TO MENU
                     </button>
                 </div>
            </div>
        )}

        {/* PAUSE MENU */}
        {isPaused && !gameOver && !gameWon && !showBossList && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-50 bg-black/80 backdrop-blur-sm">
                 <div className="bg-slate-900 border-4 border-cyan-600 p-8 rounded-lg w-[400px] shadow-2xl flex flex-col items-center gap-6">
                     <h2 className="text-4xl text-cyan-400 font-bold tracking-widest border-b-2 border-slate-700 pb-4 w-full text-center">GAME PAUSED</h2>
                     
                     {!showKeybinds ? (
                         <div className="flex flex-col gap-4 w-full">
                             <button onClick={() => { setIsPaused(false); engine.paused = false; }} className="bg-cyan-800 hover:bg-cyan-700 text-white py-3 rounded font-bold text-xl border border-cyan-600 transition-all">RESUME</button>
                             <button onClick={() => engine.saveGame()} className="bg-green-800 hover:bg-green-700 text-white py-3 rounded font-bold text-xl border border-green-600 transition-all">SAVE GAME</button>
                             <button onClick={() => setShowKeybinds(true)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white py-3 rounded font-bold text-xl border border-slate-600 transition-all">KEY BINDS</button>
                             <button onClick={onQuit} className="bg-red-900/80 hover:bg-red-800 text-red-200 py-3 rounded font-bold text-xl border border-red-700 transition-all">QUIT TO MENU</button>
                         </div>
                     ) : (
                         <div className="w-full">
                             <h3 className="text-yellow-500 text-2xl font-bold mb-4 text-center">CONTROLS</h3>
                             <div className="grid grid-cols-2 gap-4 text-lg mb-6">
                                 <div className="text-slate-400 text-right">W / Space</div><div className="text-white">Jump</div>
                                 <div className="text-slate-400 text-right">A / D</div><div className="text-white">Move Left / Right</div>
                                 <div className="text-slate-400 text-right">S</div><div className="text-white">Crouch / Ground Pound</div>
                                 <div className="text-slate-400 text-right">Shift</div><div className="text-white">Dodge Roll</div>
                                 <div className="text-slate-400 text-right">L-Click</div><div className="text-white">Attack / Mine</div>
                                 <div className="text-slate-400 text-right">R-Click</div><div className="text-white">Interact / Place</div>
                                 <div className="text-slate-400 text-right">E</div><div className="text-white">Inventory</div>
                                 <div className="text-slate-400 text-right">TAB</div><div className="text-white">Targets</div>
                                 <div className="text-slate-400 text-right">ESC</div><div className="text-white">Pause / Back</div>
                             </div>
                             <button onClick={() => setShowKeybinds(false)} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded font-bold border border-slate-500">BACK</button>
                         </div>
                     )}
                 </div>
             </div>
        )}

        {questCompletion && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-50 bg-black/60 backdrop-blur-sm">
                <div className="bg-slate-800 border-4 border-green-500 p-6 rounded-lg w-[400px] shadow-2xl text-center">
                    <h2 className="text-green-400 text-2xl font-bold mb-2">! QUEST COMPLETE !</h2>
                    <h3 className="text-white text-xl mb-4">{questCompletion.quest.title}</h3>
                    <div className="text-sm text-slate-400 mb-2">From: {getEntityName(player.questGiverId)}</div>
                    <p className="text-slate-300 mb-6 italic">"Excellent work. Here is your reward."</p>
                    
                    {questCompletion.quest.objective.type === 'collect' && (
                        <div className="text-yellow-200 mb-4 text-sm bg-yellow-900/30 p-2 rounded border border-yellow-700">
                            (Will remove {questCompletion.quest.objective.amount}x {questCompletion.quest.objective.target} from inventory)
                        </div>
                    )}

                    <div className="bg-slate-900 p-3 rounded mb-6 text-sm">
                        <div className="text-slate-400 mb-1">REWARD:</div>
                        <div className="text-green-400 font-bold flex items-center justify-center gap-2">
                            <span>{questCompletion.quest.reward.icon}</span>
                            <span>{questCompletion.quest.reward.count}x {questCompletion.quest.reward.name}</span>
                        </div>
                    </div>
                    <div className="flex gap-4 justify-center">
                        <button onClick={() => setQuestCompletion(null)} className="bg-red-900/80 hover:bg-red-800 text-white px-4 py-2 rounded border border-red-600">LATER</button>
                        <button onClick={handleCompleteQuest} className="bg-green-700 hover:bg-green-600 text-white px-6 py-2 rounded font-bold border-2 border-green-500 shadow-lg shadow-green-900/50">
                            {questCompletion.quest.objective.type === 'collect' ? 'GIVE ITEMS & COMPLETE' : 'COMPLETE'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {questOffer && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-50 bg-black/60 backdrop-blur-sm">
                <div className="bg-slate-800 border-4 border-yellow-500 p-6 rounded-lg w-[400px] shadow-2xl text-center">
                    <h2 className="text-yellow-400 text-2xl font-bold mb-2">! QUEST AVAILABLE !</h2>
                    <h3 className="text-white text-xl mb-2">{questOffer.quest.title}</h3>
                    <div className="text-sm text-slate-400 mb-4">From: {getEntityName(questOffer.giverId)}</div>
                    <p className="text-slate-300 mb-6 italic">"{questOffer.quest.description}"</p>
                    <div className="bg-slate-900 p-3 rounded mb-6 text-sm">
                        <div className="text-slate-400 mb-1">REWARD:</div>
                        <div className="text-green-400 font-bold flex items-center justify-center gap-2">
                            <span>{questOffer.quest.reward.icon}</span>
                            <span>{questOffer.quest.reward.count}x {questOffer.quest.reward.name}</span>
                        </div>
                    </div>
                    <div className="flex gap-4 justify-center">
                        <button onClick={() => setQuestOffer(null)} className="bg-red-900/80 hover:bg-red-800 text-white px-4 py-2 rounded border border-red-600">DECLINE</button>
                        <button onClick={handleAcceptQuest} className="bg-green-700 hover:bg-green-600 text-white px-6 py-2 rounded font-bold border-2 border-green-500 shadow-lg shadow-green-900/50">ACCEPT</button>
                    </div>
                </div>
            </div>
        )}

        {readingBook && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-50 bg-black/80 backdrop-blur-md">
                <div className="bg-[#3e2723] border-4 border-[#5d4037] p-8 rounded-lg w-[500px] h-[600px] shadow-2xl flex flex-col relative">
                     <div className="absolute top-2 right-2 text-white/50 cursor-pointer text-xl hover:text-white" onClick={() => setReadingBook(null)}>✕</div>
                     <h2 className="text-[#ffecb3] text-3xl font-serif text-center mb-6 border-b border-[#5d4037] pb-4">{readingBook.title}</h2>
                     <div className="flex-1 overflow-y-auto text-[#fff9c4] text-xl font-serif leading-loose p-4 bg-[#2d1e1a] rounded shadow-inner whitespace-pre-wrap">
                         {readingBook.content}
                     </div>
                     <div className="text-center text-[#8d6e63] mt-4 text-sm font-sans">
                         Written by {readingBook.author || 'The Librarian'}
                     </div>
                </div>
            </div>
        )}

        {player.isInventoryOpen && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center pointer-events-auto backdrop-blur-sm z-40">
                <div className="bg-slate-800 border-4 border-slate-600 p-6 rounded-lg w-[800px] flex gap-6 h-[500px]">
                    
                    <div className="flex-1 flex flex-col gap-4">
                        <h2 className="text-xl text-slate-300">Backpack</h2>
                        <div className="grid grid-cols-9 gap-1">
                            {inventory.map((item, i) => (
                                <div 
                                    key={i}
                                    onMouseEnter={() => setHoverItem(item)}
                                    onMouseLeave={() => setHoverItem(null)}
                                    onMouseDown={(e) => handleSlotClick(i, e)}
                                    className={`w-12 h-12 border bg-slate-900 flex items-center justify-center relative cursor-pointer hover:border-yellow-400 ${i < 9 ? 'bg-slate-800 border-slate-500' : 'border-slate-600'}`}
                                >
                                    {item.count > 0 && <span className="text-2xl">{item.icon || (item.tileType && TileType[item.tileType]?.substring(0,2))}</span>}
                                    {item.count > 1 && <span className="absolute bottom-0 right-1 text-xs">{item.count}</span>}
                                    {i < 9 && <span className="absolute top-0 left-1 text-[10px] text-slate-500 font-mono">{i+1}</span>}
                                </div>
                            ))}
                        </div>
                        
                        {/* Equipment Section */}
                        <div className="mt-auto border-t border-slate-600 pt-4">
                            <h3 className="text-slate-400 mb-2">Equipment</h3>
                            <div className="flex gap-4">
                                {['head', 'body', 'module'].map((slot) => {
                                    const eqItem = player.equipment[slot as keyof typeof player.equipment];
                                    return (
                                        <div 
                                            key={slot}
                                            onClick={() => handleEquipClick(slot as any)}
                                            onMouseEnter={() => eqItem && setHoverItem(eqItem)}
                                            onMouseLeave={() => setHoverItem(null)}
                                            className="w-16 h-16 border-2 border-slate-500 bg-slate-900 rounded flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 relative"
                                        >
                                            <span className="text-xs text-slate-500 uppercase absolute top-1">{slot}</span>
                                            {eqItem ? <span className="text-3xl">{eqItem.icon}</span> : <span className="text-slate-700 text-2xl">+</span>}
                                        </div>
                                    )
                                })}
                                <div className="ml-auto text-sm text-slate-400 flex flex-col justify-center">
                                    <div>Defense: <span className="text-blue-400 text-xl">{player.defense}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-80 border-l border-slate-600 pl-6 flex flex-col">
                         <h2 className="text-xl mb-4 text-slate-300 flex items-center gap-2"><span>📖</span> Crafting Book</h2>
                         <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2">
                             {RECIPES.map((r) => {
                                 const status = getRecipeStatus(r);
                                 return (
                                 <div key={r.id} className={`p-2 rounded text-sm border flex flex-col gap-2 transition-all ${status.hasIngredients ? 'bg-slate-700 border-slate-500 hover:bg-slate-600' : 'bg-slate-900/50 border-slate-800 opacity-70'}`}>
                                     <div className="flex justify-between items-center">
                                         <div className="flex items-center gap-2 font-bold"><span>{r.result.icon}</span><span>{r.result.name}</span></div>
                                         <button onClick={() => handleCraft(r)} disabled={!status.hasIngredients} className={`px-3 py-1 rounded text-xs ${status.hasIngredients ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 cursor-not-allowed'}`}>CRAFT</button>
                                     </div>
                                     <div className="text-xs text-slate-400">
                                         Requires:
                                         <div className="flex flex-wrap gap-1 mt-1">
                                             {r.ingredients.map((ing, i) => {
                                                 const myCount = inventory.find(inv => inv.name === ing.name)?.count || 0;
                                                 const hasEnough = myCount >= ing.count;
                                                 return (<span key={i} className={hasEnough ? 'text-green-400' : 'text-red-400'}>{ing.count}x {ing.name} ({myCount})</span>)
                                             })}
                                         </div>
                                         {r.requiredTile && (<div className="mt-1 text-amber-500 flex items-center gap-1">⚠️ Station: {TileType[r.requiredTile]}</div>)}
                                     </div>
                                 </div>
                             )})}
                         </div>
                    </div>
                </div>
            </div>
        )}

        {cursorItem && (
            <div className="fixed pointer-events-none z-50 flex items-center justify-center w-12 h-12" style={{ left: mousePos.x - 24, top: mousePos.y - 24, textShadow: '0 0 10px black' }}>
                <span className="text-4xl filter drop-shadow-lg">{cursorItem.icon}</span>
                <span className="absolute bottom-0 right-0 text-white font-bold bg-black/50 px-1 rounded text-xs">{cursorItem.count}</span>
            </div>
        )}

        {lore.show && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-50">
                <div className="bg-purple-900/90 border-4 border-amber-500 p-8 rounded-lg max-w-lg text-center shadow-[0_0_50px_rgba(168,85,247,0.5)]">
                    <h2 className="text-amber-300 text-2xl mb-4 font-serif">ANCIENT KNOWLEDGE</h2>
                    <p className="text-white text-lg font-mono leading-relaxed">{lore.text}</p>
                    <button onClick={() => setLore({...lore, show: false})} className="mt-6 bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded font-bold">CLOSE</button>
                </div>
            </div>
        )}

        {dialogue.show && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-50 bg-black/50 backdrop-blur-sm">
                <div className="bg-slate-900 border-4 border-cyan-500 p-6 rounded-lg w-[600px] h-[500px] flex flex-col shadow-2xl">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                         <div className="flex items-center gap-2">
                             <span className="text-2xl">🤖</span>
                             <div className="flex flex-col">
                                 <h2 className="text-cyan-300 text-xl font-bold">{dialogue.speaker}</h2>
                                 {dialogue.context.villagerPersonality && <span className="text-xs text-slate-400 italic">{dialogue.context.villagerPersonality}</span>}
                             </div>
                         </div>
                         <button onClick={() => setDialogue({...dialogue, show: false})} className="text-slate-400 hover:text-white px-2">✕</button>
                    </div>
                    <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 scrollbar-thin scrollbar-thumb-cyan-700">
                        {dialogue.messages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col ${msg.sender === 'You' ? 'items-end' : 'items-start'}`}>
                                <span className="text-xs text-slate-500 mb-1 capitalize">{msg.sender}</span>
                                <div className={`px-4 py-2 rounded-lg max-w-[85%] text-lg leading-snug ${msg.sender === 'You' ? 'bg-cyan-900/40 text-cyan-100 border border-cyan-800 rounded-tr-none' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'}`}>{msg.text}</div>
                            </div>
                        ))}
                        {dialogue.loading && (<div className="flex items-start"><span className="text-xs text-slate-500 mb-1">{dialogue.speaker}</span><div className="bg-slate-800 px-4 py-2 rounded-lg rounded-tl-none text-slate-500 italic animate-pulse">processing input...</div></div>)}
                        <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t border-slate-700">
                        <input ref={inputRef} type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} disabled={dialogue.loading} autoFocus className="flex-1 bg-black/50 border border-slate-600 rounded px-4 py-2 text-white focus:border-cyan-500 outline-none transition-colors" placeholder="Type your message..." />
                        <button type="submit" disabled={!inputText.trim() || dialogue.loading} className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-2 rounded font-bold transition-colors">SEND</button>
                    </form>
                </div>
            </div>
        )}

        <div className="flex justify-center pointer-events-auto items-end pb-2 relative">
            {hoverItem && hoverItem.count > 0 && !cursorItem && (
                <div className="absolute bottom-20 bg-slate-900 border border-yellow-500 p-2 rounded text-sm z-50 min-w-[150px]">
                    <div className="font-bold text-yellow-400">{hoverItem.name}</div>
                    <div className="text-slate-400 italic">{hoverItem.description || "No description."}</div>
                    {hoverItem.text && (
                        <div className="text-cyan-400 text-xs mt-1">[Right-Click to Read]</div>
                    )}
                    {hoverItem.author && (
                        <div className="text-slate-500 text-xs mt-1">Author: {hoverItem.author}</div>
                    )}
                    {hoverItem.stats && (
                        <div className="text-xs mt-1 space-y-0.5">
                            {hoverItem.stats.damage && <div className="text-red-400">DMG: {hoverItem.stats.damage}</div>}
                            {hoverItem.stats.defense && <div className="text-blue-400">DEF: {hoverItem.stats.defense}</div>}
                        </div>
                    )}
                </div>
            )}

            <div className="flex gap-1 bg-slate-900/90 p-1 rounded border-2 border-slate-600 shadow-xl">
                {inventory.slice(0, 9).map((item, index) => (
                    <div 
                        key={item.id}
                        onMouseEnter={() => setHoverItem(item)}
                        onMouseLeave={() => setHoverItem(null)}
                        onMouseDown={(e) => {
                             if (player.isInventoryOpen) { handleSlotClick(index, e); } 
                             else if (e.button === 0) { engine.player.selectedSlot = index; engine.handleInput('keydown', `Digit${index+1}`); }
                             else if (e.button === 2 && item.type === ItemType.BOOK && item.text) { setReadingBook({ title: item.name, content: item.text, author: item.author }); }
                        }}
                        className={`w-12 h-12 flex items-center justify-center border-2 cursor-pointer relative transition-all ${player.selectedSlot === index ? 'border-yellow-400 bg-slate-700 -translate-y-1' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}`}
                    >
                        <span className="text-2xl drop-shadow-md">{item.count > 0 ? item.icon : ''}</span>
                        <span className="absolute top-0 left-1 text-[10px] text-slate-500 font-mono">{index + 1}</span>
                        {item.count > 1 && (<span className="absolute bottom-0 right-1 text-xs text-white font-bold">{item.count}</span>)}
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

const MainMenu = ({ onStart }: { onStart: (provider: 'gemini' | 'groq', key: string, loadSave: boolean, creative: boolean) => void }) => {
    const [provider, setProvider] = useState<'gemini' | 'groq'>('gemini');
    const [apiKey, setApiKey] = useState('');
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialTab, setTutorialTab] = useState<'controls' | 'basics' | 'goal'>('controls');
    const [hasSave, setHasSave] = useState(false);

    useEffect(() => {
        const save = localStorage.getItem('terraGenesis_save');
        setHasSave(!!save);
    }, []);

    return (
        <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center font-vt323 text-white relative overflow-hidden selection:bg-cyan-900 p-8">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black opacity-90"></div>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%2322d3ee' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='1'/%3E%3Ccircle cx='13' cy='13' r='1'/%3E%3C/g%3E%3C/svg%3E")` }}></div>
            
            <div className="z-10 text-center space-y-6 flex flex-col items-center h-full justify-center w-full max-w-4xl overflow-y-auto">
                <div className="space-y-2 animate-[bounce_3s_infinite] shrink-0">
                    <h1 className="text-6xl md:text-8xl text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)] tracking-widest font-bold">TERRAGENESIS</h1>
                    <div className="h-1 w-full bg-cyan-900/50 rounded-full"></div>
                    <h2 className="text-2xl md:text-4xl text-yellow-600 tracking-[0.8em] font-bold uppercase drop-shadow-md">Echoes of the Deep</h2>
                </div>
                
                <div className="bg-slate-900/80 border border-slate-700 p-6 rounded-lg w-full max-w-[400px] flex flex-col gap-4 text-left shadow-xl backdrop-blur-md shrink-0">
                    <h3 className="text-cyan-400 text-xl border-b border-slate-700 pb-2 mb-2">AI CONFIGURATION</h3>
                    <div>
                        <label className="block text-slate-400 text-sm mb-1">AI Provider</label>
                        <select value={provider} onChange={(e) => setProvider(e.target.value as any)} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white outline-none focus:border-cyan-500">
                            <option value="gemini">Google Gemini</option>
                            <option value="groq">Groq Cloud (Llama 3)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-slate-400 text-sm mb-1">API Key {provider === 'gemini' && '(Optional if set in Env)'}</label>
                        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider === 'gemini' ? "Using process.env.API_KEY" : "sk-..."} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white outline-none focus:border-cyan-500 placeholder-slate-600" />
                    </div>
                </div>

                <div className="pt-2 flex flex-col gap-3 w-full items-center shrink-0">
                     {hasSave && (
                        <button onClick={() => onStart(provider, apiKey, true, false)} className="w-full max-w-[350px] group relative px-8 py-3 bg-green-900/80 border-4 border-green-600 hover:bg-green-950 hover:border-green-400 transition-all duration-300 active:scale-95 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                            <div className="absolute inset-0 border border-green-400/30 opacity-0 group-hover:opacity-100 animate-pulse transition-opacity"></div>
                            <span className="text-2xl text-green-500 group-hover:text-green-200 font-bold tracking-widest">CONTINUE</span>
                        </button>
                     )}
                     
                     <div className="w-full max-w-[350px] bg-slate-900/50 p-4 rounded-lg border-2 border-slate-700 flex flex-col gap-2">
                         <h3 className="text-slate-400 text-sm font-bold tracking-widest uppercase mb-1">NEW MISSION</h3>
                         <div className="flex gap-2">
                             <button onClick={() => onStart(provider, apiKey, false, false)} className="flex-1 py-3 bg-cyan-900/50 hover:bg-cyan-800 border-2 border-cyan-600 hover:border-cyan-400 transition-all text-cyan-300 font-bold tracking-widest">
                                 SURVIVAL
                             </button>
                             <button onClick={() => onStart(provider, apiKey, false, true)} className="flex-1 py-3 bg-fuchsia-900/50 hover:bg-fuchsia-800 border-2 border-fuchsia-600 hover:border-fuchsia-400 transition-all text-fuchsia-300 font-bold tracking-widest">
                                 CREATIVE
                             </button>
                         </div>
                     </div>
                    
                    <button onClick={() => setShowTutorial(true)} className="text-slate-400 hover:text-white underline decoration-slate-600 underline-offset-4 tracking-widest uppercase py-2">ACCESS TUTORIAL DATABASE</button>
                </div>
                <div className="text-slate-600 text-sm font-mono tracking-wide mt-auto">SYSTEM_VERSION: v1.0.8 // PROTOCOL: SURVIVAL // STATUS: ONLINE</div>
            </div>

            {showTutorial && (
                <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md p-4">
                     <div className="bg-slate-900 border-2 border-slate-600 w-full max-w-[700px] h-full max-h-[500px] shadow-2xl relative flex flex-col">
                         <div className="flex border-b border-slate-700">
                             <button onClick={() => setTutorialTab('controls')} className={`flex-1 py-3 font-bold tracking-widest ${tutorialTab === 'controls' ? 'bg-cyan-900/30 text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-500 hover:text-white'}`}>CONTROLS</button>
                             <button onClick={() => setTutorialTab('basics')} className={`flex-1 py-3 font-bold tracking-widest ${tutorialTab === 'basics' ? 'bg-cyan-900/30 text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-500 hover:text-white'}`}>SURVIVAL</button>
                             <button onClick={() => setTutorialTab('goal')} className={`flex-1 py-3 font-bold tracking-widest ${tutorialTab === 'goal' ? 'bg-cyan-900/30 text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-500 hover:text-white'}`}>OBJECTIVES</button>
                         </div>
                         
                         <button onClick={() => setShowTutorial(false)} className="absolute top-3 right-4 text-slate-400 hover:text-white text-xl font-bold">✕</button>

                         <div className="p-8 overflow-y-auto flex-1 text-lg">
                             {tutorialTab === 'controls' && (
                                 <div className="grid grid-cols-2 gap-8">
                                     <div>
                                         <h4 className="text-yellow-500 mb-4 font-bold border-b border-slate-700 pb-1">MOVEMENT</h4>
                                         <ul className="space-y-3 text-slate-300">
                                             <li className="flex justify-between"><span className="text-white font-bold">W / SPACE</span> <span>Jump / Wall Jump</span></li>
                                             <li className="flex justify-between"><span className="text-white font-bold">A / D</span> <span>Move Left / Right</span></li>
                                             <li className="flex justify-between"><span className="text-white font-bold">S</span> <span>Crouch / Ground Pound</span></li>
                                             <li className="flex justify-between"><span className="text-white font-bold">SHIFT</span> <span>Dodge Roll</span></li>
                                         </ul>
                                     </div>
                                     <div>
                                         <h4 className="text-yellow-500 mb-4 font-bold border-b border-slate-700 pb-1">INTERACTION</h4>
                                         <ul className="space-y-3 text-slate-300">
                                             <li className="flex justify-between"><span className="text-white font-bold">L-CLICK</span> <span>Mine / Attack / Shoot</span></li>
                                             <li className="flex justify-between"><span className="text-white font-bold">R-CLICK</span> <span>Interact / Place / Read</span></li>
                                             <li className="flex justify-between"><span className="text-white font-bold">E</span> <span>Open Inventory</span></li>
                                             <li className="flex justify-between"><span className="text-white font-bold">TAB</span> <span>View Targets</span></li>
                                             <li className="flex justify-between"><span className="text-white font-bold">1 - 9</span> <span>Select Hotbar Slot</span></li>
                                         </ul>
                                     </div>
                                 </div>
                             )}

                             {tutorialTab === 'basics' && (
                                 <div className="space-y-6">
                                     <div>
                                         <h4 className="text-green-400 font-bold mb-2">Resource Gathering</h4>
                                         <p className="text-slate-300 leading-relaxed">
                                             Use your <span className="text-white">Pickaxe</span> to mine blocks. Some blocks like Stone and Metal take longer to break. 
                                             Collect <span className="text-yellow-500">Ores</span> and <span className="text-yellow-500">Old World Debris</span> to craft better gear.
                                         </p>
                                     </div>
                                     <div>
                                         <h4 className="text-blue-400 font-bold mb-2">Crafting & Gear</h4>
                                         <p className="text-slate-300 leading-relaxed">
                                             Press <span className="text-white font-bold">[E]</span> to open your inventory. The crafting menu is on the right. 
                                             You can craft basic items anywhere, but advanced gear requires a <span className="text-white">Workbench</span> or <span className="text-white">Anvil</span>.
                                             Drag armor into your equipment slots to increase Defense.
                                         </p>
                                     </div>
                                 </div>
                             )}

                             {tutorialTab === 'goal' && (
                                 <div className="space-y-6">
                                     <div>
                                         <h4 className="text-purple-400 font-bold mb-2">The Biomes</h4>
                                         <p className="text-slate-300 leading-relaxed">
                                             You start in the <span className="text-green-600">Outskirts</span>. To the east lies the <span className="text-slate-500">Industrial Complex</span>, filled with dangerous machines. Beyond that are the <span className="text-red-900">Garbage Wastes</span>.
                                         </p>
                                     </div>
                                     <div>
                                         <h4 className="text-red-500 font-bold mb-2">Bosses & The Deep</h4>
                                         <p className="text-slate-300 leading-relaxed">
                                             Strange structures are scattered across the world. Breaking <span className="text-red-400">Altars</span> or <span className="text-cyan-400">Terminals</span> will awaken powerful Bosses. 
                                             Defeat them to claim their cores and craft legendary weapons. Your ultimate goal is to find the <span className="text-yellow-400">Hidden Artifact</span> in the vault.
                                         </p>
                                         <p className="text-yellow-400 font-bold mt-2 border-l-4 border-yellow-600 pl-3">
                                             PRIMARY OBJECTIVE: Locate the Vault in the wastes, defeat the Guardian Ursus, and retrieve the Teddy Bear.
                                         </p>
                                     </div>
                                 </div>
                             )}
                         </div>
                         
                         <div className="p-4 border-t border-slate-700 text-center text-slate-500 text-sm">
                             PRO TIP: Interact with Villagers to receive quests and rewards. Librarians write books.
                         </div>
                     </div>
                </div>
            )}
        </div>
    )
}

const App = () => {
    const [gameState, setGameState] = useState<'MENU' | 'PLAYING'>('MENU');
    const [loadSave, setLoadSave] = useState(false);
    const [creativeMode, setCreativeMode] = useState(false);

    const handleStart = (provider: 'gemini' | 'groq', key: string, shouldLoad: boolean, creative: boolean) => {
        configureAI(provider, key);
        setLoadSave(shouldLoad);
        setCreativeMode(creative);
        setGameState('PLAYING');
    };
    const handleQuit = () => {
        setGameState('MENU');
    };
    if (gameState === 'MENU') return <MainMenu onStart={handleStart} />;
    return <GameSession onQuit={handleQuit} loadSave={loadSave} creativeMode={creativeMode} />;
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);