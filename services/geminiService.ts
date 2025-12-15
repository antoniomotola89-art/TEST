import { GoogleGenAI, Type } from "@google/genai";

let provider: 'gemini' | 'groq' = 'gemini'; // Default to Gemini
let apiKey: string = '';

export interface VillagerContext {
    isRaining: boolean;
    reputation: 'friendly' | 'neutral' | 'hostile';
    timeOfDay: 'day' | 'night';
    villagerName?: string;
    villagerJob?: string;
    villagerPersonality?: string;
}

export interface ChatResponse {
    text: string;
    action: 'FOLLOW' | 'STAY' | 'ATTACK' | 'JOIN_PARTY' | 'NONE';
}

// Helper to strip markdown code blocks if present
const cleanJson = (text: string) => {
    let clean = text.trim();
    if (clean.startsWith('```json')) clean = clean.replace('```json', '');
    if (clean.startsWith('```')) clean = clean.replace('```', '');
    if (clean.endsWith('```')) clean = clean.slice(0, -3);
    return clean.trim();
};

export const configureAI = (newProvider: 'gemini' | 'groq', newKey?: string) => {
    // Reset key if switching providers with a new key provided, or keep existing logic
    if (newKey && newKey.trim() !== '') {
        apiKey = newKey;
        // Auto-detect Groq key format
        if (apiKey.startsWith('gsk_')) {
            provider = 'groq';
            console.log("Auto-detected Groq Key. Switching provider to Groq.");
        } else {
            provider = newProvider;
        }
    } else {
        provider = newProvider;
        // Fallback to env var if available and no key provided, BUT only for Gemini
        // We assume process.env.API_KEY is a Gemini key based on instructions.
        if (!apiKey && process.env.API_KEY && provider === 'gemini') {
            apiKey = process.env.API_KEY;
        }
    }
    console.log(`AI Configured: ${provider}`);
};

const callGroq = async (messages: { role: string, content: string }[], maxTokens: number, jsonMode: boolean = false) => {
    if (!apiKey || !apiKey.startsWith('gsk_')) {
        console.warn("Groq API Key is missing or invalid (must start with 'gsk_').");
        return null;
    }
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messages,
                model: 'llama-3.3-70b-versatile', // Smartest model for roleplay
                max_tokens: maxTokens,
                temperature: 0.7,
                response_format: jsonMode ? { type: "json_object" } : undefined
            })
        });
        
        if (!response.ok) {
             const err = await response.text();
             console.error("Groq API Error Details:", err);
             return null;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (error) {
        console.error("Groq API Request Failed:", error);
        return null;
    }
};

export const generateLore = async (
  blockType: string,
  depth: number,
  surroundings: string
): Promise<string> => {
  const systemPrompt = `
    You are an analysis module on a Robot from the future.
    You have just scanned an object in a post-apocalyptic world.
    Task:
    - If it is "Old World Debris", identify it as a specific mundane 21st-century item (e.g., a crushed smartphone, a license plate, a plastic toy, a vending machine part), but describe it as an ancient artifact.
    - If it is a "Server Terminal", mention "Project Ursus" (The Bear) or the collapse.
    
    Output: A single, atmospheric log entry. Max 20 words.
  `;
  
  const userPrompt = `
    Object: ${blockType}
    Location Depth: ${depth}
    Surroundings: ${surroundings}
  `;

  try {
    if (provider === 'groq') {
        const res = await callGroq([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], 60);
        return res || "Unidentified object.";
    }

    // Default: Gemini
    const keyToUse = apiKey || process.env.API_KEY;
    if (!keyToUse) return "Analysis offline (No Key).";

    const ai = new GoogleGenAI({ apiKey: keyToUse });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt + "\n" + userPrompt,
      config: {
        maxOutputTokens: 60,
        temperature: 0.8,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return response.text || "Unidentified object.";
  } catch (error) {
    console.error("AI API Error:", error);
    return "Data corrupted.";
  }
};

export const chatWithVillager = async (
    history: { sender: string; text: string }[],
    inventory: string[],
    context?: VillagerContext
): Promise<ChatResponse> => {
    // IMPORTANT: Rename 'You' to 'Player' in the history so the AI doesn't think IT is 'You'.
    const conversation = history.map(h => `${h.sender === 'You' ? 'Player (Robot)' : h.sender}: ${h.text}`).join('\n');
    
    let envDesc = "Normal day.";
    if (context) {
        if (context.isRaining) envDesc = "It is raining heavily.";
        else envDesc = "The weather is clear/dry.";
        
        if (context.timeOfDay === 'night') envDesc += " It is dark night.";
        else envDesc += " It is daytime.";
    }

    let attitudeDesc = "You are wary but neutral.";
    if (context?.reputation === 'hostile') attitudeDesc = "You HATE the player. They attacked you.";
    else if (context?.reputation === 'friendly') attitudeDesc = "You trust the player. You are willing to help them.";

    const name = context?.villagerName || "Villager";
    const personality = context?.villagerPersonality || "Stoic";
    const job = context?.villagerJob || "Wanderer";

    const systemPrompt = `
        You are ${name}, a ${job} in a post-apocalyptic primitive world.
        Your personality is: ${personality}.
        
        The user you are talking to is "Player" (a strange metal golem).
        DO NOT confuse yourself with the player. You are ${name}.
        
        CURRENT CONTEXT:
        Environment: ${envDesc}
        Your Attitude: ${attitudeDesc}
        
        INSTRUCTIONS:
        1. Reply to the last message based on your personality.
        2. Pay attention to the 'CURRENT CONTEXT'. If the user says something that conflicts with the current environment (e.g. they say "nice sun" but it is raining), CORRECT THEM naturally.
        3. If the weather has changed since the start of the conversation, mention it (e.g., "Ah, the rain has started.").
        4. If the user asks for a poem/story, you can write one (keep it under 40 words).
        5. COMMANDS:
           - If user says "Join me", "Recruit", "Help me fight": 
             -> If Attitude is Friendly: Respond YES and use action "JOIN_PARTY".
             -> If Attitude is Neutral/Hostile: Refuse. Action "NONE".
           - If user says "Stay here", "Wait", "We are here", "Stop following":
             -> Action "STAY".
           - If user says "Follow": Action "FOLLOW".
           - If user says "Attack": Action "ATTACK".
        
        OUTPUT FORMAT: JSON Object
        {
          "text": "Your spoken response here.",
          "action": "FOLLOW" | "STAY" | "ATTACK" | "JOIN_PARTY" | "NONE"
        }
    `;
    
    const userPrompt = `History:\n${conversation}`;

    try {
        let jsonStr = "";
        
        if (provider === 'groq') {
            const res = await callGroq([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ], 150, true); // JSON Mode
            jsonStr = res || "{}";
        } else {
             // Ensure we have a key for Gemini
            const keyToUse = apiKey || process.env.API_KEY;
            if (!keyToUse) return { text: "...", action: 'NONE' };

            const ai = new GoogleGenAI({ apiKey: keyToUse });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: systemPrompt + "\n" + userPrompt,
                config: {
                    maxOutputTokens: 150, 
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingBudget: 0 },
                }
            });
            jsonStr = response.text || "{}";
        }
        
        const parsed = JSON.parse(cleanJson(jsonStr));
        return {
            text: parsed.text || "...",
            action: parsed.action || "NONE"
        };
    } catch (error) {
        console.error("Chat Error", error);
        return { text: "...", action: 'NONE' };
    }
};

export const generateBook = async (): Promise<{title: string, content: string}> => {
    const topics = [
        "The day the metal birds fell from the sky.",
        "The Machine God Ursus.",
        "How to grow wheat in ash.",
        "The legend of the first rain.",
        "The grey rot that eats the stone.",
        "A poem about the silence of the night."
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    const systemPrompt = `
        You are a Historian/Librarian in a post-apocalyptic primitive world.
        Write a very short book content (max 80 words) about: "${topic}".
        Style: Mythological, mysterious, slightly fearful of technology.
        Return JSON format: { "title": "string", "content": "string" }
        DO NOT include markdown code blocks. Just raw JSON.
    `;

    try {
        let jsonStr = "";
        
        if (provider === 'groq') {
            jsonStr = await callGroq([{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Write the book.' }], 300, true) || "{}";
        } else {
            const keyToUse = apiKey || process.env.API_KEY;
            if (!keyToUse) return { title: "Empty Book", content: "The pages are blank." };
            const ai = new GoogleGenAI({ apiKey: keyToUse });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: systemPrompt + "\nWrite the book.",
                config: {
                    maxOutputTokens: 300,
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingBudget: 0 },
                },
            });
            jsonStr = response.text || "{}";
        }
        
        const parsed = JSON.parse(cleanJson(jsonStr));
        return { 
            title: parsed.title || "Ancient Script", 
            content: parsed.content || "The ink is smeared." 
        };
    } catch (e) {
        console.error("Book Gen Error", e);
        return { title: "Tattered Tome", content: "The pages are too damaged to read." };
    }
}