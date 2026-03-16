"use client";

import React, { useState, useEffect } from 'react';
import { Search, BookHeart, Library, Loader2, Plus, Trash2, DollarSign, Heart, X, Sparkles } from 'lucide-react';

// --- Firebase Initialization ---
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';

// Safely retrieve Next.js environment variables at build-time.
// Using "typeof process" prevents ReferenceErrors in the Canvas preview sandbox.
const isSandbox = typeof __firebase_config !== 'undefined';

const firebaseEnv = {
  apiKey: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_API_KEY : '',
  authDomain: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN : '',
  projectId: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID : '',
  storageBucket: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET : '',
  messagingSenderId: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID : '',
  appId: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_APP_ID : ''
};
const geminiEnvKey = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEMINI_API_KEY : '';

// Support both the Canvas sandbox preview and the Vercel live app
const firebaseConfig = isSandbox ? JSON.parse(__firebase_config) : firebaseEnv;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

const sandboxAppId = typeof __app_id !== 'undefined' ? __app_id : undefined;
const appId = sandboxAppId || 'pokemon-binder-app';

// --- API Configurations ---
const GEMINI_API_KEY = isSandbox ? "" : geminiEnvKey;
const GEMINI_URL = isSandbox 
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`
  : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const POKEMON_TYPES = ['Colorless', 'Darkness', 'Dragon', 'Fairy', 'Fighting', 'Fire', 'Grass', 'Lightning', 'Metal', 'Psychic', 'Water'];

// --- Fallback Data ---
const MOCK_CARDS = [
  { id: 'base1-58', name: 'Pikachu', set: { name: 'Base Set' }, images: { small: 'https://images.pokemontcg.io/base1/58.png', large: 'https://images.pokemontcg.io/base1/58_hires.png' }, tcgplayer: { prices: { normal: { market: 5.99 } } }, types: ['Lightning'] },
  { id: 'base1-4', name: 'Charizard', set: { name: 'Base Set' }, images: { small: 'https://images.pokemontcg.io/base1/4.png', large: 'https://images.pokemontcg.io/base1/4_hires.png' }, tcgplayer: { prices: { holofoil: { market: 350.00 } } }, types: ['Fire'] },
  { id: 'base1-2', name: 'Blastoise', set: { name: 'Base Set' }, images: { small: 'https://images.pokemontcg.io/base1/2.png', large: 'https://images.pokemontcg.io/base1/2_hires.png' }, tcgplayer: { prices: { holofoil: { market: 120.00 } } }, types: ['Water'] },
  { id: 'base1-15', name: 'Venusaur', set: { name: 'Base Set' }, images: { small: 'https://images.pokemontcg.io/base1/15.png', large: 'https://images.pokemontcg.io/base1/15_hires.png' }, tcgplayer: { prices: { holofoil: { market: 90.00 } } }, types: ['Grass'] },
  { id: 'base1-10', name: 'Mewtwo', set: { name: 'Base Set' }, images: { small: 'https://images.pokemontcg.io/base1/10.png', large: 'https://images.pokemontcg.io/base1/10_hires.png' }, tcgplayer: { prices: { holofoil: { market: 45.00 } } }, types: ['Psychic'] },
  { id: 'neo1-9', name: 'Lugia', set: { name: 'Neo Genesis' }, images: { small: 'https://images.pokemontcg.io/neo1/9.png', large: 'https://images.pokemontcg.io/neo1/9_hires.png' }, tcgplayer: { prices: { holofoil: { market: 200.00 } } }, types: ['Colorless'] },
  { id: 'swsh4-138', name: 'Rayquaza', set: { name: 'Vivid Voltage' }, images: { small: 'https://images.pokemontcg.io/swsh4/138.png', large: 'https://images.pokemontcg.io/swsh4/138_hires.png' }, tcgplayer: { prices: { normal: { market: 8.50 } } }, types: ['Colorless'] },
  { id: 'swsh1-141', name: 'Snorlax', set: { name: 'Sword & Shield' }, images: { small: 'https://images.pokemontcg.io/swsh1/141.png', large: 'https://images.pokemontcg.io/swsh1/141_hires.png' }, tcgplayer: { prices: { normal: { market: 12.00 } } }, types: ['Colorless'] },
];

// Helper to fetch with exponential backoff for Gemini
const fetchWithRetry = async (url, options, retries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('search'); 
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [binderCards, setBinderCards] = useState([]);
  const [wishlistCards, setWishlistCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);

  const [isLoreLoading, setIsLoreLoading] = useState(false);
  const [cardLore, setCardLore] = useState('');
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [binderAnalysis, setBinderAnalysis] = useState('');

  // 1. Initialize Authentication
  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  const logout = () => signOut(auth);

  useEffect(() => {
    // Hidden auto-login exclusively for the Canvas Sandbox preview window to prevent errors.
    const initSandboxAuth = async () => {
      if (!isSandbox) return; // Completely skips this step on your live Vercel site
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.warn("Sandbox Auth skipped:", err);
      }
    };
    initSandboxAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Binder Data from Cloud Database
  useEffect(() => {
    if (!user) {
      setBinderCards([]);
      setWishlistCards([]);
      return;
    }

    const binderRef = collection(db, 'artifacts', appId, 'users', user.uid, 'binder');
    const qBinder = query(binderRef);
    
    const unsubscribeBinder = onSnapshot(qBinder, (snapshot) => {
      const savedCards = snapshot.docs.map(doc => doc.data());
      setBinderCards(savedCards);
    }, (err) => {
      console.error("Error fetching binder:", err);
    });

    const wishlistRef = collection(db, 'artifacts', appId, 'users', user.uid, 'wishlist');
    const qWishlist = query(wishlistRef);

    const unsubscribeWishlist = onSnapshot(qWishlist, (snapshot) => {
      const savedWishlist = snapshot.docs.map(doc => doc.data());
      setWishlistCards(savedWishlist);
    }, (err) => {
      console.error("Error fetching wishlist:", err);
    });

    return () => {
      unsubscribeBinder();
      unsubscribeWishlist();
    };
  }, [user]);

  // 3. Search Pokemon API
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let queryParts = [];
      const cleanQuery = searchQuery.trim().replace(/[^a-zA-Z0-9 -]/g, '');
      if (cleanQuery) {
        queryParts.push(`name:"${cleanQuery}"`);
      }
      if (selectedType) {
        queryParts.push(`types:"${selectedType}"`);
      }
      
      const qParam = queryParts.join(' ');
      const targetUrl = `https://api.pokemontcg.io/v2/cards?pageSize=24${qParam ? `&q=${encodeURIComponent(qParam)}` : ''}`;
      
      // CORS FIX: Simple fetch with no headers
      const response = await fetch(targetUrl);
      
      if (!response.ok) {
        throw new Error(`API returned status: ${response.status}`);
      }
      
      const data = await response.json();
      setCards(data.data || []);
      
      if (data.data && data.data.length === 0) {
        setError("No cards found. Try a different search.");
      }
    } catch (err) {
      console.warn("Live API fetch failed. Using local sample data for testing.", err);
      
      let filteredMocks = MOCK_CARDS;
      if (searchQuery) {
        filteredMocks = filteredMocks.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      if (selectedType) {
        filteredMocks = filteredMocks.filter(c => c.types.includes(selectedType));
      }
      
      setCards(filteredMocks);
      
      if (filteredMocks.length === 0) {
        setError("Live connection failed, and no sample cards matched your search criteria.");
      } else {
        setError("Live API connection failed. Showing sample data for testing!");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSearchQuery('');
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. Binder Actions
  const addToBinder = async (card) => {
    if (!user) {
        alert("Please sign in to add cards to your binder!");
        return;
    }
    try {
      const cardRef = doc(db, 'artifacts', appId, 'users', user.uid, 'binder', card.id);
      await setDoc(cardRef, card);
    } catch (err) {
      console.error("Error saving card:", err);
    }
  };

  const removeFromBinder = async (cardId) => {
    if (!user) return;
    try {
      const cardRef = doc(db, 'artifacts', appId, 'users', user.uid, 'binder', cardId);
      await deleteDoc(cardRef);
    } catch (err) {
      console.error("Error removing card:", err);
    }
  };

  const isInBinder = (cardId) => {
    return binderCards.some(c => c.id === cardId);
  };

  const isInWishlist = (cardId) => {
    return wishlistCards.some(c => c.id === cardId);
  };

  const toggleWishlist = async (card) => {
    if (!user) {
        alert("Please sign in to use your wishlist!");
        return;
    }
    const isWished = isInWishlist(card.id);
    const cardRef = doc(db, 'artifacts', appId, 'users', user.uid, 'wishlist', card.id);
    
    try {
      if (isWished) {
        await deleteDoc(cardRef);
      } else {
        await setDoc(cardRef, card);
      }
    } catch (err) {
      console.error("Error toggling wishlist:", err);
    }
  };

  const getCardPrice = (card) => {
    if (!card.tcgplayer || !card.tcgplayer.prices) return "N/A";
    const prices = card.tcgplayer.prices;
    const priceKey = Object.keys(prices)[0]; 
    if (priceKey && prices[priceKey].market) {
      return `$${prices[priceKey].market.toFixed(2)}`;
    }
    return "N/A";
  };

  const calculateTotalValue = (cardsArray) => {
    const total = cardsArray.reduce((acc, card) => {
      if (!card.tcgplayer || !card.tcgplayer.prices) return acc;
      const prices = card.tcgplayer.prices;
      const priceKey = Object.keys(prices)[0]; 
      if (priceKey && prices[priceKey].market) {
        return acc + prices[priceKey].market;
      }
      return acc;
    }, 0);
    return total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 5. Gemini AI Features
  const askGeminiAboutCard = async (card) => {
    if (!GEMINI_API_KEY) {
      setCardLore("Error: Gemini API key is not configured.");
      return;
    }
    setIsLoreLoading(true);
    setCardLore('');
    try {
      const prompt = `Tell me a fun fact and a brief TCG competitive strategy for the Pokemon card: ${card.name} (Set: ${card.set?.name || 'Unknown'}, Type: ${card.types?.join(', ') || 'Unknown'}). Keep it engaging, fun, and under 3 short sentences. Avoid markdown formatting like asterisks.`;
      
      const data = await fetchWithRetry(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: "You are a friendly and helpful Pokemon TCG expert." }] }
        })
      });
      
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      setCardLore(text || "Hmm, my Pokédex seems to be malfunctioning. Try again later!");
    } catch (error) {
      console.error("Gemini Error:", error);
      setCardLore("Sorry, I couldn't reach Professor Oak right now to analyze this card.");
    } finally {
      setIsLoreLoading(false);
    }
  };

  const analyzeMyBinder = async () => {
    if (!GEMINI_API_KEY) {
      setBinderAnalysis("Error: Gemini API key is not configured.");
      return;
    }
    if (binderCards.length === 0) return;
    setIsAnalysisLoading(true);
    setBinderAnalysis('');
    try {
      const cardNames = binderCards.map(c => `${c.name} (${c.types?.join(', ') || 'Unknown'})`).join(', ');
      const prompt = `I have the following Pokemon cards in my binder: ${cardNames}. 
      Suggest a fun, themed TCG deck strategy or collection goal based on the specific cards and types I have. 
      Format your response with 3 short bullet points. Do not use asterisks or markdown.`;
      
      const data = await fetchWithRetry(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: "You are an enthusiastic Pokemon deck builder." }] }
        })
      });
      
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      setBinderAnalysis(text || "Could not generate an analysis for your collection.");
    } catch (error) {
      console.error("Gemini Error:", error);
      setBinderAnalysis("Sorry, I couldn't analyze your binder right now. Please try again.");
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  const formatAIResponse = (text) => {
    return text.split('\n').map((line, i) => (
      <span key={i} className="block mb-1">{line}</span>
    ));
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      
      {/* Navigation Bar */}
      <nav className="bg-blue-600 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <BookHeart className="h-8 w-8 text-yellow-300" />
              <span className="text-xl font-bold tracking-wider hidden sm:block">PokéBinder</span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto">
              <button 
                onClick={() => setView('search')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${view === 'search' ? 'bg-blue-800 text-white' : 'text-blue-100 hover:bg-blue-700'}`}
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
              <button 
                onClick={() => setView('binder')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${view === 'binder' ? 'bg-blue-800 text-white' : 'text-blue-100 hover:bg-blue-700'}`}
              >
                <Library className="h-4 w-4 mr-2" />
                Binder ({binderCards.length})
              </button>
              <button 
                onClick={() => setView('wishlist')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${view === 'wishlist' ? 'bg-blue-800 text-white' : 'text-blue-100 hover:bg-blue-700'}`}
              >
                <Heart className="h-4 w-4 mr-2" />
                Wishlist ({wishlistCards.length})
              </button>
              
              {/* Google Auth Buttons */}
              {user ? (
                <button 
                  onClick={logout}
                  className="flex items-center px-4 py-2 ml-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Sign Out
                </button>
              ) : (
                <button 
                  onClick={loginWithGoogle}
                  className="flex items-center px-4 py-2 ml-2 bg-white hover:bg-slate-100 text-blue-600 rounded-md text-sm font-bold transition-colors shadow-sm whitespace-nowrap"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Warning if not logged in */}
        {!user && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 flex items-center shadow-sm">
                <span className="font-medium">Welcome!</span>&nbsp;Please Sign In to save cards to your personal Binder and Wishlist.
            </div>
        )}

        {view === 'search' && (
          <div className="space-y-6">
            {/* Search Controls */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label htmlFor="search" className="block text-sm font-medium text-slate-700 mb-1">Pokémon Name</label>
                  <input
                    type="text"
                    id="search"
                    placeholder="e.g. Charizard, Mewtwo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="w-full md:w-64">
                  <label htmlFor="type" className="block text-sm font-medium text-slate-700 mb-1">Filter by Type</label>
                  <select
                    id="type"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                  >
                    <option value="">All Types</option>
                    {POKEMON_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full md:w-auto px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center disabled:opacity-70"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Search Cards"}
                  </button>
                </div>
              </form>
            </div>

            {/* Results Grid */}
            {error && <div className="p-4 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-center font-medium shadow-sm">{error}</div>}
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {cards.map(card => (
                <CardDisplay 
                  key={card.id} 
                  card={card} 
                  inBinder={isInBinder(card.id)}
                  inWishlist={isInWishlist(card.id)}
                  onAdd={() => addToBinder(card)}
                  onRemove={() => removeFromBinder(card.id)}
                  onToggleWishlist={() => toggleWishlist(card)}
                  onClick={() => { setSelectedCard(card); setCardLore(''); }}
                  price={getCardPrice(card)}
                />
              ))}
            </div>
            
            {!isLoading && cards.length === 0 && !error && (
              <div className="text-center text-slate-500 py-12">
                Enter a search term or select a type to find cards!
              </div>
            )}
          </div>
        )}

        {view === 'binder' && (
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">My Virtual Binder</h2>
                <p className="text-slate-500 text-sm mt-1">Cards you've collected and saved.</p>
              </div>
              <div className="flex gap-6 text-right items-end">
                <div>
                  <span className="text-sm text-slate-500 block">Total Cards</span>
                  <span className="text-xl font-bold text-blue-600">{binderCards.length}</span>
                </div>
                <div>
                  <span className="text-sm text-slate-500 block">Total Value</span>
                  <span className="text-xl font-bold text-emerald-600">${calculateTotalValue(binderCards)}</span>
                </div>
              </div>
            </div>

            {/* AI Collection Analyzer */}
            {binderCards.length > 0 && (
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-indigo-900 flex items-center">
                    <Sparkles className="h-5 w-5 mr-2 text-indigo-600" /> Collection Strategy AI
                  </h3>
                  <button
                    onClick={analyzeMyBinder}
                    disabled={isAnalysisLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center disabled:opacity-70"
                  >
                    {isAnalysisLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "✨ Analyze Collection"}
                  </button>
                </div>
                {binderAnalysis && (
                  <div className="mt-4 p-4 bg-white rounded-lg text-indigo-800 text-sm leading-relaxed border border-indigo-100 shadow-inner">
                    {formatAIResponse(binderAnalysis)}
                  </div>
                )}
              </div>
            )}

            {binderCards.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-slate-200">
                <Library className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">Your binder is empty!</h3>
                <p className="text-slate-500 mb-6">Go to the search tab to find and add your favorite Pokémon cards.</p>
                <button 
                  onClick={() => setView('search')}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Start Searching
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {binderCards.map(card => (
                  <CardDisplay 
                    key={card.id} 
                    card={card} 
                    inBinder={true}
                    inWishlist={isInWishlist(card.id)}
                    onAdd={() => addToBinder(card)}
                    onRemove={() => removeFromBinder(card.id)}
                    onToggleWishlist={() => toggleWishlist(card)}
                    onClick={() => { setSelectedCard(card); setCardLore(''); }}
                    price={getCardPrice(card)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'wishlist' && (
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">My Wishlist</h2>
                <p className="text-slate-500 text-sm mt-1">Cards you are hoping to collect.</p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <span className="text-sm text-slate-500 block">Total Cards</span>
                  <span className="text-xl font-bold text-pink-600">{wishlistCards.length}</span>
                </div>
                <div>
                  <span className="text-sm text-slate-500 block">Total Cost</span>
                  <span className="text-xl font-bold text-emerald-600">${calculateTotalValue(wishlistCards)}</span>
                </div>
              </div>
            </div>

            {wishlistCards.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-slate-200">
                <Heart className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">Your wishlist is empty!</h3>
                <p className="text-slate-500 mb-6">Found a card you want? Click the heart icon to add it here.</p>
                <button 
                  onClick={() => setView('search')}
                  className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-lg transition-colors"
                >
                  Start Searching
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {wishlistCards.map(card => (
                  <CardDisplay 
                    key={card.id} 
                    card={card} 
                    inBinder={isInBinder(card.id)}
                    inWishlist={true}
                    onAdd={() => addToBinder(card)}
                    onRemove={() => removeFromBinder(card.id)}
                    onToggleWishlist={() => toggleWishlist(card)}
                    onClick={() => { setSelectedCard(card); setCardLore(''); }}
                    price={getCardPrice(card)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Card Details Modal with Gemini Integration */}
      {selectedCard && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
          onClick={() => { setSelectedCard(null); setCardLore(''); }}
        >
          <div 
            className="relative max-w-lg w-full flex flex-col items-center bg-white rounded-2xl overflow-hidden shadow-2xl" 
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="w-full bg-slate-100 flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800 text-lg">{selectedCard.name}</h3>
              <button
                onClick={() => { setSelectedCard(null); setCardLore(''); }}
                className="p-1 text-slate-400 hover:text-slate-700 transition-colors rounded-full hover:bg-slate-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 w-full flex flex-col items-center max-h-[80vh] overflow-y-auto">
              <img
                src={selectedCard.images?.large || selectedCard.images?.small}
                alt={selectedCard.name}
                className="w-3/4 h-auto rounded-xl shadow-lg mb-6"
              />
              
              {/* Gemini AI Feature Box */}
              <div className="w-full bg-indigo-50 rounded-xl p-5 border border-indigo-100">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-semibold text-indigo-900 flex items-center text-sm uppercase tracking-wider">
                    <Sparkles className="h-4 w-4 mr-2 text-indigo-500" /> AI Insights
                  </h4>
                  <button
                    onClick={() => askGeminiAboutCard(selectedCard)}
                    disabled={isLoreLoading}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-full transition-colors flex items-center disabled:opacity-70"
                  >
                    {isLoreLoading ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : "✨ Ask Gemini"}
                  </button>
                </div>
                
                {cardLore ? (
                  <p className="text-sm text-indigo-800 leading-relaxed border-t border-indigo-200 pt-3 mt-1">
                    {cardLore}
                  </p>
                ) : (
                  <p className="text-sm text-indigo-400 italic">
                    Click the button to generate competitive strategy and lore for this card.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Sub-component for rendering individual cards
function CardDisplay({ card, inBinder, inWishlist, onAdd, onRemove, onToggleWishlist, onClick, price }) {
  return (
    <div 
      className="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group cursor-pointer"
      onClick={onClick}
    >
      <div className="relative pt-[140%] w-full bg-slate-100">
        <img 
          src={card.images?.small || ''} 
          alt={card.name} 
          className="absolute inset-0 w-full h-full object-contain p-2"
          loading="lazy"
        />

        {/* Wishlist Toggle Button (Top Right) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist();
          }}
          className="absolute top-2 right-2 p-1.5 bg-black/30 hover:bg-black/60 rounded-full z-10 transition-colors"
          title={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={`h-4 w-4 transition-colors ${inWishlist ? 'fill-pink-500 text-pink-500' : 'text-white'}`} />
        </button>

        {/* Overlay actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
          {inBinder ? (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all"
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Remove
            </button>
          ) : (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add
            </button>
          )}
        </div>
      </div>
      
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-sm text-slate-800 truncate" title={card.name}>
            {card.name}
          </h3>
          <p className="text-xs text-slate-500 truncate" title={card.set?.name || 'Unknown Set'}>
            {card.set?.name || 'Unknown Set'}
          </p>
        </div>
        
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
          <div className="flex items-center text-emerald-600 font-semibold text-sm">
            <DollarSign className="h-3 w-3" />
            <span>{price.replace('$', '')}</span>
          </div>
          
          {/* Small visual indicator if it's in the binder */}
          {inBinder && (
            <div className="h-2 w-2 rounded-full bg-blue-500" title="In your binder"></div>
          )}
          {/* Visual indicator for wishlist if not already visible via the button above */}
          {!inBinder && inWishlist && (
            <div className="h-2 w-2 rounded-full bg-pink-500" title="On your wishlist"></div>
          )}
        </div>
      </div>
    </div>
  );
}