"use client";

import React, { useState, useEffect } from 'react';
import { Search, BookHeart, Library, Loader2, Plus, Trash2, DollarSign, Heart, X, Sparkles } from 'lucide-react';

// --- Firebase Initialization ---
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';

// Safely retrieve Next.js environment variables.
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
const pokemonEnvKey = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_POKEMON_API_KEY : '';

const firebaseConfig = isSandbox ? JSON.parse(__firebase_config) : firebaseEnv;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

const appId = (typeof __app_id !== 'undefined' ? __app_id : undefined) || 'pokemon-binder-app';

// --- API Configurations ---
const POKEMON_API_KEY = pokemonEnvKey;
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

// Helper for strict timeouts to prevent "endless spinning"
const fetchWithTimeout = async (url, options = {}, timeout = 4000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
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

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  const logout = () => signOut(auth);

  useEffect(() => {
    const initSandboxAuth = async () => {
      if (!isSandbox) return; 
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

  useEffect(() => {
    if (!user) {
      setBinderCards([]);
      setWishlistCards([]);
      return;
    }

    const binderRef = collection(db, 'artifacts', appId, 'users', user.uid, 'binder');
    const unsubscribeBinder = onSnapshot(query(binderRef), (snapshot) => {
      setBinderCards(snapshot.docs.map(doc => doc.data()));
    }, (err) => console.error("Binder fetch error:", err));

    const wishlistRef = collection(db, 'artifacts', appId, 'users', user.uid, 'wishlist');
    const unsubscribeWishlist = onSnapshot(query(wishlistRef), (snapshot) => {
      setWishlistCards(snapshot.docs.map(doc => doc.data()));
    }, (err) => console.error("Wishlist fetch error:", err));

    return () => {
      unsubscribeBinder();
      unsubscribeWishlist();
    };
  }, [user]);

  // Robust Search Logic with Multi-Tier Resilience and Timeouts
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError('');

    const cleanQuery = searchQuery.trim().replace(/[^a-zA-Z0-9 -]/g, '');
    let queryParts = [];
    if (cleanQuery) queryParts.push(`name:"${cleanQuery}"`);
    if (selectedType) queryParts.push(`types:"${selectedType}"`);
    
    const qParam = queryParts.join(' ');
    const targetUrl = `https://api.pokemontcg.io/v2/cards?pageSize=24${qParam ? `&q=${encodeURIComponent(qParam)}` : ''}`;
    
    let resultData = null;

    // Level 1: Direct Fetch
    try {
      const res = await fetchWithTimeout(targetUrl, {}, 3000);
      if (res.ok) resultData = await res.json();
    } catch (e) { console.warn("Direct fetch failed."); }

    // Level 2: JSON Wrapper Proxy (AllOrigins) - Most reliable for CORS
    if (!resultData) {
      try {
        const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, {}, 4000);
        if (res.ok) {
          const wrapper = await res.json();
          resultData = JSON.parse(wrapper.contents);
        }
      } catch (e) { console.warn("Primary proxy failed."); }
    }

    // Level 3: Corsproxy.io
    if (!resultData) {
      try {
        const res = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`, {}, 4000);
        if (res.ok) resultData = await res.json();
      } catch (e) { console.warn("Secondary proxy failed."); }
    }

    if (resultData && resultData.data) {
      setCards(resultData.data);
      if (resultData.data.length === 0) setError("No cards found for that search.");
      setIsLoading(false);
    } else {
      // Level 4: Mock Fallback
      console.error("All live sources failed. Using mock data.");
      let filteredMocks = MOCK_CARDS;
      if (searchQuery) filteredMocks = filteredMocks.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
      if (selectedType) filteredMocks = filteredMocks.filter(c => c.types.includes(selectedType));
      
      setCards(filteredMocks);
      setError("Live API unreachable. Showing sample collection for now!");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSearchQuery('');
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addToBinder = async (card) => {
    if (!user) { alert("Please sign in to save cards!"); return; }
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'binder', card.id), card);
    } catch (err) { console.error("Save error:", err); }
  };

  const removeFromBinder = async (cardId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'binder', cardId));
    } catch (err) { console.error("Delete error:", err); }
  };

  const toggleWishlist = async (card) => {
    if (!user) { alert("Please sign in to use wishlist!"); return; }
    const isWished = wishlistCards.some(c => c.id === card.id);
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'wishlist', card.id);
    try {
      if (isWished) await deleteDoc(ref);
      else await setDoc(ref, card);
    } catch (err) { console.error("Wishlist error:", err); }
  };

  const getCardPrice = (card) => {
    if (!card.tcgplayer?.prices) return "N/A";
    const prices = card.tcgplayer.prices;
    const priceKey = Object.keys(prices)[0]; 
    return priceKey && prices[priceKey].market ? `$${prices[priceKey].market.toFixed(2)}` : "N/A";
  };

  const calculateTotalValue = (cardsArray) => {
    const total = cardsArray.reduce((acc, card) => {
      if (!card.tcgplayer?.prices) return acc;
      const prices = card.tcgplayer.prices;
      const priceKey = Object.keys(prices)[0]; 
      return acc + (prices[priceKey].market || 0);
    }, 0);
    return total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const askGeminiAboutCard = async (card) => {
    if (!GEMINI_API_KEY) { setCardLore("Gemini API not configured."); return; }
    setIsLoreLoading(true);
    setCardLore('');
    try {
      const prompt = `Tell me a fun fact and a brief TCG competitive strategy for: ${card.name} (Set: ${card.set?.name || 'Unknown'}). Keep it engaging and under 3 short sentences. No markdown.`;
      const data = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: "You are a Pokemon TCG expert." }] }
        })
      }).then(r => r.json());
      setCardLore(data?.candidates?.[0]?.content?.parts?.[0]?.text || "Pokédex error!");
    } catch (error) { setCardLore("Professor Oak is busy right now."); }
    finally { setIsLoreLoading(false); }
  };

  const analyzeMyBinder = async () => {
    if (!GEMINI_API_KEY || binderCards.length === 0) return;
    setIsAnalysisLoading(true);
    setBinderAnalysis('');
    try {
      const names = binderCards.map(c => c.name).join(', ');
      const prompt = `I have these cards: ${names}. Suggest a fun themed deck strategy in 3 bullet points. No markdown.`;
      const data = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: "You are a deck builder." }] }
        })
      }).then(r => r.json());
      setBinderAnalysis(data?.candidates?.[0]?.content?.parts?.[0]?.text || "Analysis failed.");
    } catch (error) { setBinderAnalysis("Professor Oak is offline."); }
    finally { setIsAnalysisLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <nav className="bg-blue-600 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BookHeart className="h-8 w-8 text-yellow-300" />
            <span className="text-xl font-bold hidden sm:block">PokéBinder</span>
          </div>
          <div className="flex items-center space-x-2 overflow-x-auto">
            <button onClick={() => setView('search')} className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'search' ? 'bg-blue-800' : 'hover:bg-blue-700'}`}>Search</button>
            <button onClick={() => setView('binder')} className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'binder' ? 'bg-blue-800' : 'hover:bg-blue-700'}`}>Binder ({binderCards.length})</button>
            <button onClick={() => setView('wishlist')} className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'wishlist' ? 'bg-blue-800' : 'hover:bg-blue-700'}`}>Wishlist ({wishlistCards.length})</button>
            {user ? (
              <button onClick={logout} className="px-4 py-2 bg-slate-800 rounded-md text-sm ml-2">Sign Out</button>
            ) : (
              <button onClick={loginWithGoogle} className="px-4 py-2 bg-white text-blue-600 rounded-md text-sm font-bold ml-2">Sign In</button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!user && <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4">Please Sign In to save cards!</div>}

        {view === 'search' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Pokémon Name</label>
                  <input type="text" placeholder="Charizard..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="w-full md:w-64">
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none bg-white">
                    <option value="">All Types</option>
                    {POKEMON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="submit" disabled={isLoading} className="w-full md:w-auto px-8 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold rounded-lg disabled:opacity-50">
                    {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Search"}
                  </button>
                </div>
              </form>
            </div>
            {error && <div className="p-4 bg-orange-50 text-orange-700 rounded-lg text-center border border-orange-200">{error}</div>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {cards.map(card => <CardDisplay key={card.id} card={card} inBinder={binderCards.some(c => c.id === card.id)} inWishlist={wishlistCards.some(c => c.id === card.id)} onAdd={() => addToBinder(card)} onRemove={() => removeFromBinder(card.id)} onToggleWishlist={() => toggleWishlist(card)} onClick={() => setSelectedCard(card)} price={getCardPrice(card)} />)}
            </div>
          </div>
        )}

        {view === 'binder' && (
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b pb-4">
              <h2 className="text-2xl font-bold">My Binder</h2>
              <div className="text-right">
                <span className="text-sm text-slate-500 block">Total Value</span>
                <span className="text-xl font-bold text-emerald-600">${calculateTotalValue(binderCards)}</span>
              </div>
            </div>
            {binderCards.length > 0 && (
              <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-indigo-900 flex items-center"><Sparkles className="h-5 w-5 mr-2" /> Deck Builder AI</h3>
                  <button onClick={analyzeMyBinder} disabled={isAnalysisLoading} className="px-4 py-1 bg-indigo-600 text-white text-xs rounded-lg">{isAnalysisLoading ? "Analyzing..." : "Analyze Collection"}</button>
                </div>
                {binderAnalysis && <div className="text-sm text-indigo-800 bg-white p-4 rounded-lg shadow-inner">{binderAnalysis.split('\n').map((l,i) => <p key={i}>{l}</p>)}</div>}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {binderCards.map(card => <CardDisplay key={card.id} card={card} inBinder={true} inWishlist={wishlistCards.some(c => c.id === card.id)} onRemove={() => removeFromBinder(card.id)} onToggleWishlist={() => toggleWishlist(card)} onClick={() => setSelectedCard(card)} price={getCardPrice(card)} />)}
            </div>
          </div>
        )}

        {view === 'wishlist' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold border-b pb-4">My Wishlist</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {wishlistCards.map(card => <CardDisplay key={card.id} card={card} inBinder={binderCards.some(c => c.id === card.id)} inWishlist={true} onAdd={() => addToBinder(card)} onRemove={() => removeFromBinder(card.id)} onToggleWishlist={() => toggleWishlist(card)} onClick={() => setSelectedCard(card)} price={getCardPrice(card)} />)}
            </div>
          </div>
        )}
      </main>

      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={() => setSelectedCard(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold">{selectedCard.name}</h3>
              <button onClick={() => setSelectedCard(null)} className="p-1 hover:bg-slate-200 rounded-full"><X /></button>
            </div>
            <div className="p-6 flex flex-col items-center max-h-[80vh] overflow-y-auto">
              <img src={selectedCard.images?.large || selectedCard.images?.small} alt={selectedCard.name} className="w-64 h-auto shadow-xl rounded-lg mb-6" />
              <div className="w-full bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-indigo-900 uppercase">AI Insights</span>
                  <button onClick={() => askGeminiAboutCard(selectedCard)} disabled={isLoreLoading} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-full">{isLoreLoading ? "Thinking..." : "✨ Ask Gemini"}</button>
                </div>
                {cardLore ? <p className="text-sm text-indigo-800">{cardLore}</p> : <p className="text-xs text-indigo-300 italic">Click to generate lore and strategy.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardDisplay({ card, inBinder, inWishlist, onAdd, onRemove, onToggleWishlist, onClick, price }) {
  return (
    <div className="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all group cursor-pointer" onClick={onClick}>
      <div className="relative pt-[140%] bg-slate-50">
        <img src={card.images?.small} alt={card.name} className="absolute inset-0 w-full h-full object-contain p-2" loading="lazy" />
        <button onClick={(e) => { e.stopPropagation(); onToggleWishlist(); }} className="absolute top-2 right-2 p-1.5 bg-black/20 hover:bg-black/40 rounded-full transition-colors">
          <Heart className={`h-4 w-4 ${inWishlist ? 'fill-pink-500 text-pink-500' : 'text-white'}`} />
        </button>
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {inBinder ? (
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-full flex items-center"><Trash2 className="h-3 w-3 mr-1" /> Remove</button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-full flex items-center"><Plus className="h-3 w-3 mr-1" /> Add</button>
          )}
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-bold text-xs truncate">{card.name}</h3>
        <p className="text-[10px] text-slate-400 truncate">{card.set?.name}</p>
        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <span className="text-xs font-bold text-emerald-600">{price}</span>
          {inBinder && <div className="h-2 w-2 bg-blue-500 rounded-full" />}
        </div>
      </div>
    </div>
  );
}