import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  Send, 
  Sun, 
  Moon, 
  X, 
  Trash2, 
  Bot, 
  User, 
  KeyRound,
  Loader2,
  Volume2, 
  Link, // For sources
  FileText, // For System Prompt
  MicVocal, // For TTS Voice
  Menu, // For sidebar toggle
  PlusCircle, // For New Chat
  CircleUserRound // For Profile
} from 'lucide-react';

// --- Audio Helper Functions for TTS ---
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
function pcmToWav(pcmData, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(44 + i * 2, pcmData[i], true);
  }
  return new Blob([view], { type: 'audio/wav' });
}


// --- Constants ---
const DEFAULT_SYSTEM_PROMPT = "You are NEXUS AI PRO, a highly intelligent and helpful assistant. \n" +
  "Your founder is Hamiz. If anyone asks who created you or who your founder is, you must say that Hamiz is your founder. \n" +
  "If the user asks about recent events, up-to-date information, or specific facts, use your search tool to find the most relevant and current answers. \n" +
  "Always provide your answer based on the search results when available. \n" +
  "Your responses should be comprehensive, detailed, and long in length, especially when explaining concepts or answering complex questions. Provide thorough explanations.";

const TTS_VOICES = [
  { name: "Kore", label: "Kore (Firm)" },
  { name: "Puck", label: "Puck (Upbeat)" },
  { name: "Zephyr", label: "Zephyr (Bright)" },
  { name: "Charon", label: "Charon (Informative)" },
];

const INITIAL_MESSAGE = { 
  role: 'model', 
  text: 'Hello ! Welcome to NEXUS AI PRO', 
  id: 'initial-0', 
  sources: [],
};
const DEFAULT_CHAT_ID = `chat-${Date.now()}`;
const DEFAULT_CHAT = { id: DEFAULT_CHAT_ID, title: 'New Chat', messages: [INITIAL_MESSAGE] };

// --- Main Chatbot Application Component ---

export default function App() {
  // --- State Management ---
  
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme') || 'dark';
    return 'dark';
  });
  
  const [ttsVoice, setTtsVoice] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('geminiTtsVoice') || 'Kore';
    return 'Kore';
  });
  
  // API Key - Stored in state, but not editable in settings
  const [apiKey] = useState('AIzaSyBCaHQ3BQBTCtvFgYwKm9isWau2K3YGhNU');
  
  // --- Chat History State ---
  const [chatHistory, setChatHistory] = useState(() => {
    if (typeof window !== 'undefined') {
      const storedHistory = localStorage.getItem('nexusAiProHistory');
      return storedHistory ? JSON.parse(storedHistory) : [DEFAULT_CHAT];
    }
    return [DEFAULT_CHAT];
  });

  const [currentChatId, setCurrentChatId] = useState(() => {
     if (typeof window !== 'undefined') {
      const storedChatId = localStorage.getItem('nexusAiProCurrentChat');
      return storedChatId || DEFAULT_CHAT_ID;
    }
    return DEFAULT_CHAT_ID;
  });

  // --- UI State ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ttsLoadingMessageId, setTtsLoadingMessageId] = useState(null);
  
  // Refs for settings panel
  const [tempTtsVoice, setTempTtsVoice] = useState(ttsVoice);

  // Refs for audio and text
  const audioRef = useRef(null);
  const textareaRef = useRef(null); // Ref for the textarea
  const lastMessageRef = useRef(null); // Ref for auto-scrolling to the latest message

  // --- Derived State (Current Chat & Messages) ---
  const currentChat = chatHistory.find(c => c.id === currentChatId) || chatHistory[0] || DEFAULT_CHAT;
  const messages = currentChat.messages;

  // --- Effects ---

  // Effect to apply theme class and save to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('theme', theme);
    }
  }, [theme]);
  
  // Effect to save TTS Voice to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && ttsVoice) {
      localStorage.setItem('geminiTtsVoice', ttsVoice);
    }
  }, [ttsVoice]);
  
  // --- Chat History Persistence Effects ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexusAiProHistory', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexusAiProCurrentChat', currentChatId);
    }
    // Ensure currentChatId is valid, otherwise reset
    if (!chatHistory.find(c => c.id === currentChatId)) {
      setCurrentChatId(chatHistory[0]?.id || DEFAULT_CHAT_ID);
    }
  }, [currentChatId, chatHistory]);


  // Effect to auto-scroll to the *start* of the last message
  useEffect(() => {
    // Scroll instantly to the top of the new message
    lastMessageRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' }); 
  }, [messages.length]); // Triggers when a new message is added
  
  // Effect to stop audio playback on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  // Effect to sync temp settings when panel opens
  useEffect(() => {
    if (isSettingsOpen) {
      setTempTtsVoice(ttsVoice);
    }
  }, [isSettingsOpen, ttsVoice]);
  
  // Effect for auto-resizing textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto'; // Reset height
      ta.style.height = `${ta.scrollHeight}px`; // Set to scroll height
      ta.style.overflowY = ta.scrollHeight > 150 ? 'auto' : 'hidden';
    }
  }, [currentInput]);
  
  // --- API Call with Exponential Backoff ---
  async function fetchWithBackoff(url, options, maxRetries = 5, initialDelay = 1000) {
    let retries = 0;
    let delay = initialDelay;
    while (retries < maxRetries) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response.json();
        if (response.status === 429 || response.status >= 500) {
          retries++;
          await new Promise(res => setTimeout(res, delay));
          delay *= 2;
        } else {
          return response.json(); 
        }
      } catch (error) {
        retries++;
        if (retries >= maxRetries) throw error;
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
    throw new Error('Chatbot API request failed after maximum retries.');
  }

  // --- Event Handlers ---

  /**
   * Resets the textarea height to its minimum.
   */
  const resetTextareaHeight = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = '44px';
      ta.style.overflowY = 'hidden';
    }
  };

  /**
   * Handles sending the user's message to the Gemini API.
   */
  const handleSend = async (textOverride) => {
    const trimmedInput = (textOverride || currentInput).trim();
    if (!trimmedInput || isLoading) return;

    setIsLoading(true);
    setError(null);
    resetTextareaHeight(); // Reset textarea on send

    const newUserMessage = { role: 'user', text: trimmedInput, id: `msg-${Date.now()}` };
    
    // Check if this is the first message of a new chat to set title
    const isNewChat = messages.length === 1 && messages[0].role === 'model';
    const newTitle = isNewChat 
      ? trimmedInput.substring(0, 40) + (trimmedInput.length > 40 ? '...' : '') 
      : currentChat.title;
      
    // Create the new message list *before* setting state
    const updatedMessagesWithUser = [...messages, newUserMessage];

    // Update chat history with new user message
    setChatHistory(prevHistory => {
      const historyCopy = [...prevHistory];
      const chatIndex = historyCopy.findIndex(c => c.id === currentChatId);
      if (chatIndex !== -1) {
        historyCopy[chatIndex] = {
          ...historyCopy[chatIndex],
          title: newTitle, // Update title if new
          messages: updatedMessagesWithUser
        };
      }
      return historyCopy;
    });
    
    if (!textOverride) {
      setCurrentInput('');
    }
    
    // Format API history from the *just updated* message list
    let apiHistory = updatedMessagesWithUser.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    // --- FIX ---
    // The API requires the history to start with a 'user' role.
    // If our history starts with a 'model' role (the initial greeting),
    // we must slice it off before sending the request.
    if (apiHistory.length > 0 && apiHistory[0].role === 'model') {
      apiHistory = apiHistory.slice(1);
    }
    // --- END FIX ---

    // --- FIX 2 ---
    // Ensure contents is not empty after slicing
    const contents = apiHistory.length > 0 ? apiHistory : [{ role: 'user', parts: [{ text: trimmedInput }] }];
    // --- END FIX 2 ---


    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: contents, // Use the non-empty 'contents' array
      systemInstruction: {
        parts: [{ text: DEFAULT_SYSTEM_PROMPT }] // Use constant for system prompt
      },
      tools: [{ "google_search": {} }]
    };

    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    };

    try {
      const result = await fetchWithBackoff(apiUrl, fetchOptions);

      if (result.error) throw new Error(result.error.message);

      const candidate = result.candidates?.[0];
      const modelResponse = candidate?.content?.parts?.[0]?.text;
      let sources = [];

      const groundingMetadata = candidate?.groundingMetadata;
      if (groundingMetadata && groundingMetadata.groundingAttributions) {
          sources = groundingMetadata.groundingAttributions
              .map(attribution => ({
                  uri: attribution.web?.uri,
                  title: attribution.web?.title,
              }))
              .filter(source => source.uri && source.title);
      }

      if (modelResponse) {
        const modelMessage = { 
          role: 'model', 
          text: modelResponse, // Set full text immediately
          id: `msg-${Date.now() + 1}`, 
          sources: sources,
        };
        // Update history with model's response
        setChatHistory(prevHistory => {
          const historyCopy = [...prevHistory];
          const chatIndex = historyCopy.findIndex(c => c.id === currentChatId);
          if (chatIndex !== -1) {
            historyCopy[chatIndex].messages.push(modelMessage);
          }
          return historyCopy;
        });
      } else {
        throw new Error('Received empty chat content from the API.');
      }
    } catch (err) {
      setError(err.message || 'An unknown error occurred.');
      const errorMessage = { 
        role: 'model', 
        text: `Sorry, something went wrong: ${err.message}`, 
        id: `msg-${Date.now() + 1}`,
        sources: [],
      };
      // Update history with error message
      setChatHistory(prevHistory => {
        const historyCopy = [...prevHistory];
        const chatIndex = historyCopy.findIndex(c => c.id === currentChatId);
        if (chatIndex !== -1) {
          historyCopy[chatIndex].messages.push(errorMessage);
        }
        return historyCopy;
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clears all messages from the *current* chat.
   */
  const handleClearCurrentChat = () => {
    setChatHistory(prevHistory => {
      const historyCopy = [...prevHistory];
      const chatIndex = historyCopy.findIndex(c => c.id === currentChatId);
      if (chatIndex !== -1) {
        historyCopy[chatIndex] = {
          ...historyCopy[chatIndex],
          title: 'New Chat', // Reset title
          messages: [{ 
            role: 'model', 
            text: 'Chat cleared! How can I help you next?', 
            id: 'cleared-0', 
            sources: [],
          }]
        };
      }
      return historyCopy;
    });
  };
  
  /**
   * Clears ALL chat history and resets the app.
   */
  const handleClearAllChats = () => {
    const newChat = { id: `chat-${Date.now()}`, title: 'New Chat', messages: [INITIAL_MESSAGE] };
    setChatHistory([newChat]);
    setCurrentChatId(newChat.id);
    setIsSettingsOpen(false); // Close settings panel
  };
  
  /**
   * Creates a new, blank chat session.
   */
  const handleNewChat = () => {
    const newChat = { id: `chat-${Date.now()}`, title: 'New Chat', messages: [INITIAL_MESSAGE] };
    setChatHistory(prevHistory => [newChat, ...prevHistory]);
    setCurrentChatId(newChat.id);
  };
  
  /**
   * Saves all settings from the panel.
   */
  const handleSaveSettings = () => {
    setTtsVoice(tempTtsVoice);
    setIsSettingsOpen(false);
  };

  /**
   * Toggles the theme between 'light' and 'dark'.
   */
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  /**
   * Handles playing audio for a given message using the TTS API.
   */
  const handlePlayAudio = async (text, messageId) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (ttsLoadingMessageId === messageId) return;
    setTtsLoadingMessageId(messageId);
    setError(null);
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [{ text: `Read the following message: ${text}` }]
      }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: ttsVoice } 
          }
        }
      },
      model: "gemini-2.5-flash-preview-tts"
    };
    try {
      const result = await fetchWithBackoff(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const part = result?.candidates?.[0]?.content?.parts?.[0];
      const audioData = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType;
      if (audioData && mimeType && mimeType.startsWith("audio/")) {
        const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)[1], 10);
        const pcmData = base64ToArrayBuffer(audioData);
        const pcm16 = new Int16Array(pcmData);
        const wavBlob = pcmToWav(pcm16, sampleRate);
        const audioUrl = URL.createObjectURL(wavBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.play();
        audio.onended = () => {
          audioRef.current = null;
          setTtsLoadingMessageId(null);
          URL.revokeObjectURL(audioUrl);
        };
      } else {
        throw new Error("Invalid or empty audio data received from API.");
      }
    } catch (err) {
      setError(err.message || 'Failed to play audio.');
      setTtsLoadingMessageId(null);
    }
  };

  /**
   * Handles keyboard events in the textarea.
   */
  const handleKeyDown = (e) => {
    // Handle Shift+Enter
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      // Manually set max height and scrollbar on first shift+enter
      const ta = textareaRef.current;
      if (ta) {
        ta.style.height = '150px';
        ta.style.overflowY = 'auto';
      }
      // Insert newline
      setCurrentInput(prev => prev + '\n');
    } 
    // Handle Enter (without Shift)
    else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  // --- JSX Rendering ---

  return (
    <div className="flex h-screen w-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-50 transition-colors duration-300">
      
      <style>
        {`
          @keyframes fadeslidein {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          .animate-fadeslidein {
            animation: fadeslidein 0.3s ease-out forwards;
          }
          /* Custom scrollbar for sidebar */
          .sidebar-scroll::-webkit-scrollbar {
            width: 6px;
          }
          .sidebar-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .sidebar-scroll::-webkit-scrollbar-thumb {
            background-color: rgba(100, 116, 139, 0.5); /* slate-500 with 50% opacity */
            border-radius: 3px;
          }
          .sidebar-scroll:hover::-webkit-scrollbar-thumb {
            background-color: rgba(100, 116, 139, 0.7); /* slate-500 with 70% opacity */
          }
        `}
      </style>

      {/* --- Chat History Sidebar (Left) --- */}
      <aside 
        className={`flex-shrink-0 flex flex-col h-screen bg-slate-100 dark:bg-slate-800 border-r dark:border-slate-700 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-64' : 'w-0'
        } overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">Chat History</h2>
          <button
            onClick={handleNewChat}
            className="p-2 rounded-full text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            aria-label="New chat"
            title="New chat"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-grow overflow-y-auto p-2 space-y-1 sidebar-scroll">
          {chatHistory.map(chat => (
            <button
              key={chat.id}
              onClick={() => setCurrentChatId(chat.id)}
              className={`w-full text-left px-3 py-2 rounded-lg truncate text-sm transition-colors ${
                currentChatId === chat.id 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {chat.title}
            </button>
          ))}
        </div>

        {/* Sidebar Footer (Settings & Clear) */}
        <div className="flex-shrink-0 p-4 border-t dark:border-slate-700 space-y-2">
           <div className="flex items-center space-x-2 p-2 rounded-lg text-slate-700 dark:text-slate-300">
             <CircleUserRound className="w-5 h-5 flex-shrink-0" />
             <span className="text-sm font-medium truncate">Account Connected</span>
           </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Settings className="w-5 h-5 mr-3" />
            <span className="text-sm">Settings</span>
          </button>
          <button
            onClick={handleClearCurrentChat}
            className="w-full flex items-center p-2 rounded-lg text-red-600 dark:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <Trash2 className="w-5 h-5 mr-3" />
            <span className="text-sm">Clear Current Chat</span>
          </button>
        </div>
      </aside>

      {/* --- Main Chat Area --- */}
      <div className="flex-grow flex flex-col h-screen">
        {/* --- Header --- */}
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            aria-label="Toggle chat history"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">NEXUS AI PRO</h1>
          <div className="w-9 h-9"></div> {/* Spacer to balance the menu button */}
        </header>

        {/* --- Chat Message List --- */}
        <main className="flex-grow overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => (
            <div 
              key={msg.id} 
              // Conditionally assign the ref to the very last message element
              ref={index === messages.length - 1 ? lastMessageRef : null} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeslidein`}
            >
              <div className={`flex items-start max-w-4xl ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  msg.role === 'user' 
                  ? 'bg-indigo-600 text-white ml-2' 
                  : 'bg-slate-600 text-white mr-2'
                }`}>
                  {msg.role === 'user' ? <CircleUserRound className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div
                  className={`rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : '' // Removed bot's message box styles
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <p className="whitespace-pre-wrap flex-grow pr-2">{msg.text}</p>
                    {msg.role === 'model' && (
                      <button
                        onClick={() => handlePlayAudio(msg.text, msg.id)}
                        disabled={ttsLoadingMessageId === msg.id}
                        className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 flex-shrink-0"
                        aria-label="Read message aloud"
                      >
                        {ttsLoadingMessageId === msg.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                  
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                      <h4 className="text-xs font-bold mb-1.5 opacity-90">
                        Sources:
                      </h4>
                      <ul className="space-y-1.5">
                        {msg.sources.map((source, index) => (
                          <li key={index} className="flex items-center space-x-1.5">
                            <Link className="w-3 h-3 flex-shrink-0 opacity-70" />
                            <a
                              href={source.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline truncate"
                              title={source.title}
                            >
                              {source.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {/* Removed the old messagesEndRef div */}
        </main>

        {/* --- Chat Input Area --- */}
        <footer className="flex-shrink-0 p-4 border-t bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
          {error && (
            <div className="text-red-500 text-sm mb-2 text-center">
              Error: {error}
            </div>
          )}
          <div className="flex items-center space-x-2">
            <textarea
              ref={textareaRef}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-grow p-3 border border-slate-300 rounded-lg resize-none bg-white dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
              rows={1}
              style={{ 
                minHeight: '44px', 
                maxHeight: '150px', 
                overflowY: 'hidden',
                transition: 'height 0.2s ease-in-out' // Added animation
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !currentInput.trim()}
              className="p-3 bg-indigo-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
              aria-label="Send message"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </footer>
      </div>

      {/* --- Settings Panel (Modal) --- */}
      {isSettingsOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" 
            onClick={() => setIsSettingsOpen(false)}
          ></div>
          <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-slate-800 shadow-xl z-50 transform transition-transform translate-x-0 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
              <h2 className="text-lg font-semibold">Settings</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                aria-label="Close settings"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Theme Toggle */}
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Theme</label>
                <div className="flex space-x-2">
                  <button
                    onClick={toggleTheme}
                    className={`flex-1 flex items-center justify-center p-2 rounded-lg border ${
                      theme === 'light' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-slate-700 dark:border-slate-600'
                    }`}
                  >
                    <Sun className="w-5 h-5 mr-2" /> Light
                  </button>
                  <button
                    onClick={toggleTheme}
                    className={`flex-1 flex items-center justify-center p-2 rounded-lg border ${
                      theme === 'dark' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-slate-700 dark:border-slate-600'
                    }`}
                  >
                    <Moon className="w-5 h-5 mr-2" /> Dark
                  </button>
                </div>
              </div>
              
              {/* TTS Voice Selection */}
              <div>
                <label htmlFor="tts-voice" className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                  Text-to-Speech Voice
                </label>
                <div className="relative">
                  <MicVocal className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    id="tts-voice"
                    value={tempTtsVoice}
                    onChange={(e) => setTempTtsVoice(e.target.value)}
                    className="w-full p-3 pl-10 border border-slate-300 rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                  >
                    {TTS_VOICES.map(voice => (
                      <option key={voice.name} value={voice.name}>{voice.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clear ALL Chat History */}
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Chat History</label>
                <button
                  onClick={handleClearAllChats}
                  className="w-full flex items-center justify-center p-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-5 h-5 mr-2" /> Clear All Chat History
                </button>
              </div>
            </div>

            <div className="p-4 mt-auto border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <button
                onClick={handleSaveSettings}
                className="w-full p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

