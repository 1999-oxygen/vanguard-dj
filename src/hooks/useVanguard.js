import { useState, useCallback } from 'react';

/**
 * useVanguard Hook
 * Centralizes AI Logic, Terminal Management, and State
 */
export const useVanguard = (initialFiles) => {
  const [isLive, setIsLive] = useState(false);
  const [bpm, setBpm] = useState(124.0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([
    { id: 1, text: "Vanguard Kernel v3.0.1 initialized...", type: "system" }
  ]);
  const [aiRecommendation, setAiRecommendation] = useState(null);

  const addLog = useCallback((text, type = "system") => {
    setTerminalLogs(prev => [...prev.slice(-15), { 
      id: Date.now(), 
      text: `[${new Date().toLocaleTimeString()}] ${text}`, 
      type 
    }]);
  }, []);

  const askGemini = async (prompt) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    const systemPrompt = "You are the Vanguard V3 AI Production Assistant. Respond in short, technical DJ jargon.";
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      addLog("Critical: AI Connection Timeout", "error");
      return "Fallback: Check API key and network.";
    }
  };

  const runAnalysis = async (currentTrack, library) => {
    setIsAnalyzing(true);
    addLog(`Analyzing relationship: ${currentTrack.name} vs Library`, "ai");
    
    const prompt = `Suggest the next track from: ${JSON.stringify(library.map(t => ({name: t.name, bpm: t.bpm, key: t.key})))}. Current track is ${currentTrack.name} (${currentTrack.bpm}BPM, ${currentTrack.key}). Give DJ workflow advice.`;
    const result = await askGemini(prompt);
    
    if (result) {
      setAiRecommendation(result);
      addLog("Intelligence received: Harmonic pathway identified.", "ai");
    }
    setIsAnalyzing(false);
  };

  return {
    isLive, setIsLive,
    bpm, setBpm,
    isAnalyzing,
    terminalLogs, addLog,
    aiRecommendation,
    runAnalysis
  };
};

