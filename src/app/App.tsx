// AI Trip Planner — Production-quality React SPA
// Architecture: view state machine (landing → generating → trip)
// Stack: React 18, motion/react, @hello-pangea/dnd, recharts

import { useState, useReducer, useCallback, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import {
  MapPin, Calendar, DollarSign, Heart, Trash2, Copy, Check,
  ChevronDown, Edit3, X, GripVertical, Sun, Moon,
  Plane, Package, Download, Save, ArrowRight, Sparkles, Clock,
  Lightbulb, Users, Baby, Zap, Diamond, PiggyBank, Globe,
  Coffee, Utensils, Camera, Landmark, ShoppingBag, Music,
  RotateCcw, Cloud, Plus, Star, ArrowLeft, CheckCircle2,
} from "lucide-react";

// ─── utils ────────────────────────────────────────────────────────────────────

const cn = (...cls: (string | false | null | undefined)[]) => cls.filter(Boolean).join(" ");
const uid = () => Math.random().toString(36).slice(2, 9);

// ─── constants ────────────────────────────────────────────────────────────────

const TRAVEL_STYLES = [
  { id: "solo", label: "Solo", Icon: Users },
  { id: "couples", label: "Couples", Icon: Heart },
  { id: "family", label: "Family", Icon: Baby },
  { id: "adventure", label: "Adventure", Icon: Zap },
  { id: "luxury", label: "Luxury", Icon: Diamond },
  { id: "budget", label: "Budget", Icon: PiggyBank },
];

const POPULAR_DESTINATIONS = [
  { name: "Tokyo", country: "Japan", unsplash: "1540959733332-eab4deabeeaf", prompt: "5 days in Tokyo, Japan — temples, ramen, and modern culture" },
  { name: "Paris", country: "France", unsplash: "1502602898657-3e91760cbb34", prompt: "5 days in Paris, France — art, food, and the Seine" },
  { name: "Bali", country: "Indonesia", unsplash: "1537996194471-e657df975ab4", prompt: "7 days in Bali, Indonesia — rice terraces, temples, beach" },
  { name: "New York", country: "USA", unsplash: "1496442226666-8d4d0e62e6e9", prompt: "4 days in New York City — museums, food, and skyline views" },
  { name: "Rome", country: "Italy", unsplash: "1552832230-c0197dd311b5", prompt: "4 days in Rome, Italy — ancient history and Italian cuisine" },
  { name: "Santorini", country: "Greece", unsplash: "1570077188670-e3a8d69ac5ff", prompt: "5 days in Santorini, Greece — sunsets, caldera views, and seafood" },
];

const EXAMPLE_PROMPTS = [
  "5 days in Tokyo exploring temples, food markets, and modern neighborhoods",
  "A romantic week in Paris with the Louvre, Seine walks, and wine bars",
  "10 days backpacking through Bali on a $1,500 budget",
  "Family trip to New York City for 4 days with kids aged 8 and 11",
  "Luxury 7-day Santorini getaway with sunset dinners and yacht day trips",
];

const GENERATING_STEPS = [
  "Understanding your trip...",
  "Finding top attractions...",
  "Planning your itinerary...",
  "Calculating budget breakdown...",
  "Optimizing your route...",
];

const PACKING_ITEMS = [
  { id: "p1", label: "Passport & travel documents" },
  { id: "p2", label: "Travel insurance policy" },
  { id: "p3", label: "Local currency or travel card" },
  { id: "p4", label: "Universal power adapter" },
  { id: "p5", label: "Portable phone charger" },
  { id: "p6", label: "Comfortable walking shoes" },
  { id: "p7", label: "Weather-appropriate clothing" },
  { id: "p8", label: "Sunscreen & toiletries" },
  { id: "p9", label: "First aid essentials" },
  { id: "p10", label: "Reusable water bottle" },
  { id: "p11", label: "Camera or extra phone storage" },
  { id: "p12", label: "Day pack or backpack" },
];

const CAT: Record<string, { bg: string; text: string; dark: string; Icon: typeof Landmark }> = {
  "Cultural":    { bg: "bg-indigo-50",  text: "text-indigo-700",  dark: "dark:bg-indigo-950/40 dark:text-indigo-300",  Icon: Landmark },
  "Food & Drink":{ bg: "bg-amber-50",   text: "text-amber-700",   dark: "dark:bg-amber-950/40 dark:text-amber-300",   Icon: Utensils },
  "Nature":      { bg: "bg-emerald-50", text: "text-emerald-700", dark: "dark:bg-emerald-950/40 dark:text-emerald-300", Icon: Globe },
  "Adventure":   { bg: "bg-red-50",     text: "text-red-700",     dark: "dark:bg-red-950/40 dark:text-red-300",       Icon: Zap },
  "Shopping":    { bg: "bg-violet-50",  text: "text-violet-700",  dark: "dark:bg-violet-950/40 dark:text-violet-300", Icon: ShoppingBag },
  "Nightlife":   { bg: "bg-pink-50",    text: "text-pink-700",    dark: "dark:bg-pink-950/40 dark:text-pink-300",     Icon: Music },
  "Photography": { bg: "bg-sky-50",     text: "text-sky-700",     dark: "dark:bg-sky-950/40 dark:text-sky-300",       Icon: Camera },
  "Relaxation":  { bg: "bg-lime-50",    text: "text-lime-700",    dark: "dark:bg-lime-950/40 dark:text-lime-300",     Icon: Coffee },
};

const CHART_COLORS = ["#BF7F3C","#6B7C8D","#5B7A5E","#8B6BAE","#C05A3A","#7A9A8B"];

// ─── data generators ──────────────────────────────────────────────────────────

function parseDestination(prompt: string) {
  const p = prompt.toLowerCase();
  const known = [
    { keys: ["tokyo","japan"], name: "Tokyo", country: "Japan" },
    { keys: ["paris","france"], name: "Paris", country: "France" },
    { keys: ["bali","indonesia","ubud","seminyak"], name: "Bali", country: "Indonesia" },
    { keys: ["new york","nyc","manhattan"], name: "New York", country: "USA" },
    { keys: ["rome","italy","colosseum"], name: "Rome", country: "Italy" },
    { keys: ["santorini","greece","mykonos"], name: "Santorini", country: "Greece" },
    { keys: ["london","england","uk"], name: "London", country: "UK" },
    { keys: ["barcelona","spain","madrid"], name: "Barcelona", country: "Spain" },
    { keys: ["dubai","uae"], name: "Dubai", country: "UAE" },
    { keys: ["singapore"], name: "Singapore", country: "Singapore" },
    { keys: ["amsterdam","netherlands"], name: "Amsterdam", country: "Netherlands" },
    { keys: ["istanbul","turkey"], name: "Istanbul", country: "Turkey" },
    { keys: ["kyoto","osaka"], name: "Kyoto", country: "Japan" },
  ];
  for (const d of known) {
    if (d.keys.some(k => p.includes(k))) return { name: d.name, country: d.country };
  }
  const m = prompt.match(/\bin\s+([A-Z][a-zA-Z\s]+?)(?:\s*[,—–]|\s*$)/);
  if (m) return { name: m[1].trim(), country: "World" };
  return { name: "Your Destination", country: "World" };
}

function parseDuration(prompt: string): number {
  const m = prompt.match(/(\d+)\s*(day|days|night|nights|week|weeks)/i);
  if (!m) return 5;
  const n = parseInt(m[1]);
  return m[2].toLowerCase().startsWith("week") ? Math.min(n * 7, 10) : Math.max(2, Math.min(n, 10));
}

function budgetForStyle(style: string | null): number {
  const map: Record<string, number> = {
    budget: 1200, solo: 2000, couples: 3500, family: 5500, adventure: 2200, luxury: 8000,
  };
  return style && map[style] ? map[style] : 2400;
}

function makeActivity(overrides: Partial<ReturnType<typeof baseActivity>>) {
  return { ...baseActivity(), ...overrides };
}

function baseActivity() {
  return {
    id: uid(), title: "", description: "", time: "10:00", timeOfDay: "morning",
    duration: "2 hours", estimatedCost: 0, category: "Cultural", location: "",
    insiderTip: "", tags: [] as string[], isFavorite: false, isCompleted: false,
  };
}

const TOKYO_DAYS = () => [
  {
    id: uid(), dayNumber: 1, theme: "Arrival & Shinjuku",
    activities: [
      makeActivity({ title: "Shinjuku Gyoen National Garden", description: "Tokyo's most celebrated garden blends French formal, English landscape, and traditional Japanese styles. Especially magical during cherry blossom season — 1,100 trees in full bloom.", time: "15:00", timeOfDay: "afternoon", duration: "2 hours", estimatedCost: 5, category: "Nature", location: "Shinjuku, Tokyo", insiderTip: "Alcohol is prohibited — it's a rare peaceful respite in the chaos of Shinjuku", tags: ["garden","nature","photography"] }),
      makeActivity({ title: "Omoide Yokocho (Memory Lane)", description: "A narrow 1940s alley packed with tiny yakitori bars and izakayas. Smoke, sizzle, and lantern light create an atmosphere unlike anywhere in the world.", time: "19:00", timeOfDay: "evening", duration: "2 hours", estimatedCost: 28, category: "Food & Drink", location: "Shinjuku Station West Exit", insiderTip: "Most stalls seat only 6–8 — arrive by 6:30pm or wait for a stool at the bar", tags: ["yakitori","izakaya","local","nightlife"] }),
    ],
  },
  {
    id: uid(), dayNumber: 2, theme: "Temples & Tradition",
    activities: [
      makeActivity({ title: "Senso-ji Temple at Dawn", description: "Tokyo's oldest and most beloved Buddhist temple. The Thunder Gate (Kaminarimon), Nakamise shopping street, and main hall are all extraordinary — especially in early morning mist.", time: "07:00", timeOfDay: "morning", duration: "2 hours", estimatedCost: 0, category: "Cultural", location: "Asakusa, Tokyo", insiderTip: "Arrive before 8am. By 10am the crowds make quiet contemplation impossible", tags: ["temple","shrine","photography","cultural"] }),
      makeActivity({ title: "Tsukiji Outer Market Breakfast", description: "The freshest sushi breakfast in the world. Browse stalls of otoro tuna, giant sea scallops, and tamagoyaki alongside Tokyo chefs doing their morning shopping.", time: "09:00", timeOfDay: "morning", duration: "1.5 hours", estimatedCost: 22, category: "Food & Drink", location: "Tsukiji, Tokyo", insiderTip: "Sushi Dai opens at 5am and has a 2-hour queue — worth every minute for the omakase", tags: ["sushi","breakfast","market","seafood"] }),
      makeActivity({ title: "teamLab Planets", description: "An immersive digital art museum where you walk through water and enter boundless worlds. One of the most photographed experiences in Japan — a sensory masterpiece designed by artists and engineers.", time: "14:00", timeOfDay: "afternoon", duration: "2 hours", estimatedCost: 32, category: "Photography", location: "Toyosu, Tokyo", insiderTip: "Book tickets 2–3 weeks in advance online — it sells out almost every weekend", tags: ["art","digital","immersive","must-do"] }),
      makeActivity({ title: "Shibuya Crossing & Dinner", description: "Experience the world's busiest pedestrian crossing at rush hour, then explore the vibrant Shibuya district for dinner at one of its hundreds of brilliant restaurants.", time: "18:00", timeOfDay: "evening", duration: "3 hours", estimatedCost: 38, category: "Food & Drink", location: "Shibuya, Tokyo", insiderTip: "Watch first from the Mag's Park observation deck, then join the crossing — feel it both ways", tags: ["shibuya","crossing","dinner","iconic"] }),
    ],
  },
  {
    id: uid(), dayNumber: 3, theme: "Harajuku & Modern Culture",
    activities: [
      makeActivity({ title: "Meiji Shrine Morning Walk", description: "A tranquil forest shrine dedicated to Emperor Meiji. The forested path — 70,000 donated trees — offers a meditative contrast to the urban city outside its gates.", time: "08:00", timeOfDay: "morning", duration: "1.5 hours", estimatedCost: 0, category: "Cultural", location: "Harajuku, Tokyo", insiderTip: "Witness the early morning ritual cleaning (osoji) by priests — deeply moving and rarely photographed", tags: ["shrine","forest","peaceful","spiritual"] }),
      makeActivity({ title: "Takeshita Street & Harajuku", description: "The epicenter of Tokyo's youth fashion and subculture. Find crepe stands, vintage boutiques, kawaii accessories, and the constantly evolving street style scene.", time: "10:00", timeOfDay: "morning", duration: "2 hours", estimatedCost: 45, category: "Shopping", location: "Harajuku, Tokyo", insiderTip: "The best crepe stands (Maries and Santa Monica) have 30-min queues by noon — go early", tags: ["shopping","fashion","youth","crepes"] }),
      makeActivity({ title: "Ichiran Ramen — Solo Bowl", description: "Experience the famous solo ramen dining concept at Ichiran, where individual bamboo booths let you focus entirely on the bowl. Order via form, receive perfection, exit euphoric.", time: "19:00", timeOfDay: "evening", duration: "1 hour", estimatedCost: 16, category: "Food & Drink", location: "Shibuya or Shinjuku", insiderTip: "Choose 'medium' for noodle firmness and broth richness — the local default for good reason", tags: ["ramen","solo","local","must-do"] }),
    ],
  },
];

const PARIS_DAYS = () => [
  {
    id: uid(), dayNumber: 1, theme: "Left Bank & First Impressions",
    activities: [
      makeActivity({ title: "Café Terrace Ritual", description: "Perform the essential Parisian ritual: sit at a café terrace, order a café crème and a croissant, and watch the city wake up. This is not optional — it is Paris.", time: "09:00", timeOfDay: "morning", duration: "1 hour", estimatedCost: 12, category: "Food & Drink", location: "Saint-Germain-des-Prés", insiderTip: "Café de Flore and Les Deux Magots are famous but pricey. Café de la Mairie nearby is half the price", tags: ["café","breakfast","parisian","ritual"] }),
      makeActivity({ title: "Musée d'Orsay", description: "The world's finest collection of Impressionist art in a stunning Beaux-Arts railway station. Monet, Renoir, Degas, Van Gogh — a whole afternoon in one extraordinary building.", time: "13:00", timeOfDay: "afternoon", duration: "3 hours", estimatedCost: 16, category: "Cultural", location: "7th Arrondissement, Paris", insiderTip: "The 5th-floor Impressionist rooms at 3pm in golden afternoon light are extraordinary. Book online", tags: ["museum","impressionism","art","monet"] }),
      makeActivity({ title: "Seine Stroll & Dinner", description: "Walk the bouquiniste bookstalls along the Seine toward Île de la Cité. Watch the sunset from Pont des Arts, then dine at a proper French bistro in the 5th.", time: "18:30", timeOfDay: "evening", duration: "3 hours", estimatedCost: 58, category: "Food & Drink", location: "Seine Riverbank, Paris", insiderTip: "Le Comptoir du Relais requires booking weeks ahead. Its sister café Le Relais has no queue, same kitchen", tags: ["seine","sunset","dinner","bistro"] }),
    ],
  },
  {
    id: uid(), dayNumber: 2, theme: "Royal Paris & the Louvre",
    activities: [
      makeActivity({ title: "The Louvre — Strategic Visit", description: "The world's largest art museum requires strategy. Focus on the Denon Wing: Venus de Milo, Winged Victory of Samothrace, and the Mona Lisa. Allow 3 hours minimum.", time: "09:00", timeOfDay: "morning", duration: "3 hours", estimatedCost: 22, category: "Cultural", location: "1st Arrondissement, Paris", insiderTip: "Enter via the Richelieu Passage (rue de Rivoli) — 80% of tourists use the pyramid, queues here are short", tags: ["louvre","museum","mona-lisa","art"] }),
      makeActivity({ title: "Tuileries Garden Lunch", description: "Formal garden stretching from the Louvre to Place de la Concorde. Grab a crêpe from a kiosk and sit by the central fountain — the most Parisian lunch possible.", time: "12:30", timeOfDay: "afternoon", duration: "1 hour", estimatedCost: 14, category: "Relaxation", location: "Tuileries, Paris", insiderTip: "The metal chairs around the ponds are moveable — drag one to the water for the perfect Parisian picnic", tags: ["garden","lunch","relaxation","picnic"] }),
      makeActivity({ title: "Eiffel Tower at Dusk", description: "Time your visit for the golden hour before sunset. Stay for the 10pm light show when 20,000 bulbs make it sparkle for 5 minutes every hour on the hour.", time: "17:30", timeOfDay: "evening", duration: "3 hours", estimatedCost: 28, category: "Photography", location: "Champ de Mars, Paris", insiderTip: "The Trocadéro stairs give the best photograph. But Champ de Mars has better picnic vibes", tags: ["eiffel-tower","iconic","sunset","photography"] }),
    ],
  },
  {
    id: uid(), dayNumber: 3, theme: "Montmartre & Village Life",
    activities: [
      makeActivity({ title: "Sacré-Cœur & Montmartre", description: "Climb to the hilltop basilica for panoramic views over Paris, then wander the winding village streets — artist studios, hidden squares, and the city's best pain au chocolat.", time: "10:00", timeOfDay: "morning", duration: "3 hours", estimatedCost: 0, category: "Cultural", location: "Montmartre, 18th Arrondissement", insiderTip: "Take the funicular up, walk down through the vineyard steps — the local route most tourists miss", tags: ["montmartre","sacre-coeur","village","views"] }),
      makeActivity({ title: "Le Marais & Place des Vosges", description: "Explore Paris's most fashionable district: medieval streets, Jewish deli culture, contemporary art galleries, and the stunning 17th-century Place des Vosges square.", time: "14:00", timeOfDay: "afternoon", duration: "3 hours", estimatedCost: 20, category: "Cultural", location: "Le Marais, 4th Arrondissement", insiderTip: "L'As du Fallafel on rue des Rosiers is still the best falafel in Europe. Queue is worth it", tags: ["marais","jewish-quarter","galleries","architecture"] }),
    ],
  },
];

const BALI_DAYS = () => [
  {
    id: uid(), dayNumber: 1, theme: "Ubud — Arts & Rice Terraces",
    activities: [
      makeActivity({ title: "Tegallalang Rice Terraces", description: "The iconic emerald-green stepped rice terraces carved into the Ubud hillside. Walk the trails between the paddies at dawn for ethereal light and cool temperatures.", time: "07:00", timeOfDay: "morning", duration: "2 hours", estimatedCost: 5, category: "Nature", location: "Tegallalang, Ubud", insiderTip: "Arrive before 8am to beat tour groups. The farmer-run viewpoints charge a small donation — pay it", tags: ["rice-terraces","nature","photography","dawn"] }),
      makeActivity({ title: "Sacred Monkey Forest Sanctuary", description: "A lush nature reserve home to 1,000 Balinese long-tailed macaques among ancient Hindu temples. An extraordinary and occasionally chaotic wildlife encounter.", time: "10:00", timeOfDay: "morning", duration: "1.5 hours", estimatedCost: 8, category: "Nature", location: "Ubud, Bali", insiderTip: "Secure all loose items — these monkeys are expert thieves. Glasses, earrings, and phones are targets", tags: ["monkeys","temple","wildlife","nature"] }),
      makeActivity({ title: "Kecak Dance at Uluwatu Temple", description: "Watch the mesmerizing fire-lit Kecak performance at the clifftop Uluwatu Temple at sunset — 70 chanting men, a Ramayana story, and the Indian Ocean behind them.", time: "18:00", timeOfDay: "evening", duration: "2 hours", estimatedCost: 15, category: "Cultural", location: "Uluwatu Temple, Bali", insiderTip: "Arrive 30 minutes early for front-row seats. The sunset backdrop during the performance is stunning", tags: ["kecak","dance","temple","sunset"] }),
    ],
  },
  {
    id: uid(), dayNumber: 2, theme: "Temples & Spiritual Bali",
    activities: [
      makeActivity({ title: "Tanah Lot Sunrise", description: "The most iconic sea temple in Bali, perched on a dramatic rock formation amid crashing waves. Visit at low tide to walk across and explore the temple grounds.", time: "06:00", timeOfDay: "morning", duration: "2 hours", estimatedCost: 4, category: "Cultural", location: "Tabanan, Bali", insiderTip: "The temple is only accessible during low tide. Check the schedule the evening before", tags: ["tanah-lot","temple","sunrise","ocean"] }),
      makeActivity({ title: "Traditional Balinese Cooking Class", description: "Learn to make satay, gado-gado, and black rice pudding in a family compound. Start with a market visit, cook with local ingredients, eat what you make.", time: "09:00", timeOfDay: "morning", duration: "4 hours", estimatedCost: 35, category: "Food & Drink", location: "Ubud, Bali", insiderTip: "Casa Luna and Paon Bali are the most respected. Book 2–3 days ahead in high season", tags: ["cooking","food","market","cultural"] }),
    ],
  },
];

function genericDays(dest: string, n: number) {
  const themes = ["Arrival & First Impressions","Cultural Deep Dive","Local Neighborhoods","Day Trip & Discovery","Farewell & Last Moments"];
  return Array.from({ length: n }, (_, i) => ({
    id: uid(),
    dayNumber: i + 1,
    theme: themes[i] || `Day ${i + 1}`,
    activities: [
      makeActivity({ title: `Explore ${dest}'s Historic Heart`, description: `Wander through the historic quarter of ${dest}, discovering hidden alleyways, century-old architecture, and the rhythm of daily local life. The best way to understand any city is to walk it without a plan.`, time: "10:00", timeOfDay: "morning", duration: "2–3 hours", estimatedCost: 0, category: "Cultural", location: `Old Town, ${dest}`, insiderTip: "Ask your hotel which neighborhood they'd take their own family to — never the tourist circuit", tags: ["walking","cultural","architecture","discovery"] }),
      makeActivity({ title: "Local Food Market", description: `Dive into ${dest}'s food market culture — stalls of fresh produce, artisan goods, and street food prepared by vendors who've been at it for decades. More insight per dollar than any restaurant.`, time: "12:00", timeOfDay: "afternoon", duration: "1.5 hours", estimatedCost: 18, category: "Food & Drink", location: `Central Market, ${dest}`, insiderTip: "Markets are quietest on weekday mornings — more vibrant on weekends but correspondingly crowded", tags: ["food","market","local","street-food"] }),
      makeActivity({ title: "Museum or Gallery Visit", description: `Spend an afternoon in ${dest}'s finest museum or contemporary gallery. Even non-museum-goers often find local historical collections surprisingly revelatory about why this place feels the way it does.`, time: "15:00", timeOfDay: "afternoon", duration: "2 hours", estimatedCost: 15, category: "Cultural", location: `${dest} City Center`, insiderTip: "Many city museums have free admission on the first Sunday of each month — plan around it", tags: ["museum","art","history","culture"] }),
    ],
  }));
}

function generateTripData(prompt: string, style: string | null) {
  const { name, country } = parseDestination(prompt);
  const duration = parseDuration(prompt);
  const total = budgetForStyle(style);

  const p = prompt.toLowerCase();
  let rawDays =
    (p.includes("tokyo") || (p.includes("japan") && !p.includes("kyoto"))) ? TOKYO_DAYS() :
    p.includes("paris") || p.includes("france") ? PARIS_DAYS() :
    p.includes("bali") || p.includes("indonesia") ? BALI_DAYS() :
    genericDays(name, 5);

  const days = rawDays.slice(0, Math.max(2, Math.min(duration, rawDays.length)));

  const spent = days.flatMap(d => d.activities).reduce((sum, a) => sum + a.estimatedCost, 0);

  return {
    id: uid(),
    destination: name,
    country,
    duration,
    travelStyle: style || "Cultural",
    budget: { total, currency: "USD", spent },
    weather: name === "Tokyo" ? "Spring (Mar–May): 15–22°C, cherry blossoms in bloom" :
             name === "Paris" ? "Spring (Apr–Jun): 16–22°C, mild and ideal for walking" :
             name === "Bali" ? "Dry season (May–Sep): 26–32°C, low humidity" :
             "Check local forecast before departure",
    bestTimeToVisit: name === "Tokyo" ? "March–May for sakura, Oct–Nov for autumn foliage" :
                     name === "Paris" ? "April–June — before summer crowds" :
                     "Spring and autumn typically offer the best conditions",
    packingTips: name === "Tokyo" ? ["IC Suica card for all transit","Cash for shrines and small shops","Portable WiFi or eSIM","Comfortable shoes — 15,000 steps/day is normal"] :
                 name === "Paris" ? ["Navigo weekly pass for unlimited metro","Euros in small denominations","Layers for changeable weather","Comfortable shoes — you'll walk 10+ miles daily"] :
                 ["Travel insurance — essential","Local currency in small notes","Universal power adapter","Lightweight layers"],
    days,
    createdAt: new Date().toISOString(),
  };
}

// ─── state management ─────────────────────────────────────────────────────────

type Activity = ReturnType<typeof baseActivity>;
type Day = { id: string; dayNumber: number; theme: string; activities: Activity[] };
type Trip = ReturnType<typeof generateTripData>;

type State = {
  view: "landing" | "generating" | "trip";
  prompt: string;
  travelStyle: string | null;
  trip: Trip | null;
  generatingStep: number;
  darkMode: boolean;
  packingChecked: Record<string, boolean>;
  deletedActivity: { dayId: string; activity: Activity; index: number } | null;
  toast: { message: string; action?: () => void } | null;
  expandedDays: Record<string, boolean>;
};

const init: State = {
  view: "landing", prompt: "", travelStyle: null, trip: null,
  generatingStep: 0, darkMode: false, packingChecked: {},
  deletedActivity: null, toast: null, expandedDays: {},
};

type Action =
  | { type: "SET_PROMPT"; payload: string }
  | { type: "SET_STYLE"; payload: string }
  | { type: "START_GENERATING" }
  | { type: "SET_STEP"; payload: number }
  | { type: "FINISH_GENERATING"; payload: Trip }
  | { type: "TOGGLE_DARK" }
  | { type: "GO_HOME" }
  | { type: "UPDATE_ACTIVITY"; payload: { dayId: string; id: string; patch: Partial<Activity> } }
  | { type: "DELETE_ACTIVITY"; payload: { dayId: string; id: string } }
  | { type: "RESTORE_ACTIVITY" }
  | { type: "DUPLICATE_ACTIVITY"; payload: { dayId: string; id: string } }
  | { type: "REORDER"; payload: { dayId: string; from: number; to: number } }
  | { type: "TOGGLE_PACKING"; payload: string }
  | { type: "TOGGLE_DAY"; payload: string }
  | { type: "TOAST"; payload: { message: string; action?: () => void } | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_PROMPT":    return { ...state, prompt: action.payload };
    case "SET_STYLE":     return { ...state, travelStyle: state.travelStyle === action.payload ? null : action.payload };
    case "START_GENERATING": return { ...state, view: "generating", generatingStep: 0 };
    case "SET_STEP":      return { ...state, generatingStep: action.payload };
    case "FINISH_GENERATING": {
      const expanded: Record<string, boolean> = {};
      action.payload.days.forEach(d => { expanded[d.id] = true; });
      return { ...state, view: "trip", trip: action.payload, expandedDays: expanded };
    }
    case "TOGGLE_DARK":   return { ...state, darkMode: !state.darkMode };
    case "GO_HOME":       return { ...state, view: "landing", trip: null, deletedActivity: null };
    case "UPDATE_ACTIVITY": {
      const { dayId, id, patch } = action.payload;
      return {
        ...state,
        trip: { ...state.trip!, days: state.trip!.days.map(d =>
          d.id !== dayId ? d : { ...d, activities: d.activities.map(a => a.id === id ? { ...a, ...patch } : a) }
        )},
      };
    }
    case "DELETE_ACTIVITY": {
      const { dayId, id } = action.payload;
      const day = state.trip!.days.find(d => d.id === dayId)!;
      const index = day.activities.findIndex(a => a.id === id);
      const activity = day.activities[index];
      return {
        ...state,
        deletedActivity: { dayId, activity, index },
        trip: { ...state.trip!, days: state.trip!.days.map(d =>
          d.id !== dayId ? d : { ...d, activities: d.activities.filter(a => a.id !== id) }
        )},
      };
    }
    case "RESTORE_ACTIVITY": {
      if (!state.deletedActivity) return state;
      const { dayId, activity, index } = state.deletedActivity;
      return {
        ...state, deletedActivity: null,
        trip: { ...state.trip!, days: state.trip!.days.map(d => {
          if (d.id !== dayId) return d;
          const acts = [...d.activities];
          acts.splice(index, 0, activity);
          return { ...d, activities: acts };
        })},
      };
    }
    case "DUPLICATE_ACTIVITY": {
      const { dayId, id } = action.payload;
      return {
        ...state,
        trip: { ...state.trip!, days: state.trip!.days.map(d => {
          if (d.id !== dayId) return d;
          const idx = d.activities.findIndex(a => a.id === id);
          const orig = d.activities[idx];
          const copy = { ...orig, id: uid(), title: `${orig.title} (copy)` };
          const acts = [...d.activities];
          acts.splice(idx + 1, 0, copy);
          return { ...d, activities: acts };
        })},
      };
    }
    case "REORDER": {
      const { dayId, from, to } = action.payload;
      return {
        ...state,
        trip: { ...state.trip!, days: state.trip!.days.map(d => {
          if (d.id !== dayId) return d;
          const acts = [...d.activities];
          const [removed] = acts.splice(from, 1);
          acts.splice(to, 0, removed);
          return { ...d, activities: acts };
        })},
      };
    }
    case "TOGGLE_PACKING":
      return { ...state, packingChecked: { ...state.packingChecked, [action.payload]: !state.packingChecked[action.payload] } };
    case "TOGGLE_DAY":
      return { ...state, expandedDays: { ...state.expandedDays, [action.payload]: !state.expandedDays[action.payload] } };
    case "TOAST":
      return { ...state, toast: action.payload };
    default:
      return state;
  }
}

// ─── small components ─────────────────────────────────────────────────────────

const CategoryBadge = ({ category }: { category: string }) => {
  const cfg = CAT[category] || CAT["Cultural"];
  const { Icon } = cfg;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium", cfg.bg, cfg.text, cfg.dark)}>
      <Icon size={10} />
      {category}
    </span>
  );
};

const TimeOfDayIcon = ({ timeOfDay }: { timeOfDay: string }) => {
  if (timeOfDay === "morning")   return <Coffee size={12} className="text-amber-500" />;
  if (timeOfDay === "afternoon") return <Sun size={12} className="text-orange-400" />;
  if (timeOfDay === "evening")   return <Star size={12} className="text-violet-400" />;
  return <Star size={12} className="text-indigo-400" />;
};

// ─── landing page ─────────────────────────────────────────────────────────────

function LandingPage({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    if (!state.prompt.trim()) return;
    dispatch({ type: "START_GENERATING" });
  }, [state.prompt, dispatch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
  }, [submit]);

  return (
    <motion.div
      key="landing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-background"
    >
      {/* nav */}
      <nav className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center">
            <Plane size={14} className="text-white rotate-45" />
          </div>
          <span style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-lg font-semibold tracking-tight text-foreground">
            Wayfarer
          </span>
        </div>
        <button
          onClick={() => dispatch({ type: "TOGGLE_DARK" })}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          aria-label="Toggle dark mode"
        >
          {state.darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </nav>

      {/* hero */}
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground mb-8 font-medium">
            <Sparkles size={11} className="text-accent" />
            AI-powered trip planning
          </div>
          <h1
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
            className="text-5xl md:text-6xl font-semibold leading-[1.1] tracking-tight text-foreground mb-5"
          >
            Plan your perfect trip.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Describe your dream journey in plain language. Get a rich, editable itinerary in seconds — not a chatbot response.
          </p>
        </motion.div>

        {/* prompt box */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-10 bg-card border border-border rounded-2xl shadow-sm overflow-hidden"
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-accent mt-0.5 shrink-0" />
              <textarea
                ref={textareaRef}
                value={state.prompt}
                onChange={e => dispatch({ type: "SET_PROMPT", payload: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="Describe your trip… e.g. '5 days in Tokyo focusing on food, temples, and hidden neighborhoods'"
                rows={3}
                className="flex-1 resize-none bg-transparent text-foreground placeholder:text-muted-foreground text-base leading-relaxed outline-none"
              />
            </div>
          </div>

          {/* travel style chips */}
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {TRAVEL_STYLES.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => dispatch({ type: "SET_STYLE", payload: id })}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  state.travelStyle === id
                    ? "bg-accent text-white border-accent"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                )}
              >
                <Icon size={11} />
                {label}
              </button>
            ))}
          </div>

          {/* submit bar */}
          <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-secondary/50">
            <span className="text-xs text-muted-foreground">⌘ + Enter to plan</span>
            <button
              onClick={submit}
              disabled={!state.prompt.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Plan my trip
              <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>

        {/* example prompts */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6"
        >
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Try an example</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {EXAMPLE_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => dispatch({ type: "SET_PROMPT", payload: p })}
                className="text-xs text-muted-foreground border border-border rounded-full px-3 py-1.5 hover:text-foreground hover:border-foreground/30 transition-all truncate max-w-xs"
              >
                {p.length > 60 ? p.slice(0, 60) + "…" : p}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* popular destinations */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm font-medium text-foreground">Popular destinations</p>
            <Globe size={14} className="text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {POPULAR_DESTINATIONS.map((dest, i) => (
              <motion.button
                key={dest.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.55 + i * 0.07 }}
                onClick={() => dispatch({ type: "SET_PROMPT", payload: dest.prompt })}
                className="group relative overflow-hidden rounded-xl aspect-[4/3] bg-muted hover:shadow-md transition-all duration-300"
              >
                <img
                  src={`https://images.unsplash.com/photo-${dest.unsplash}?w=600&h=450&fit=crop&auto=format`}
                  alt={`${dest.name}, ${dest.country}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 p-3 text-left">
                  <p className="text-white font-medium text-sm leading-tight">{dest.name}</p>
                  <p className="text-white/70 text-xs">{dest.country}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── generating screen ────────────────────────────────────────────────────────

function GeneratingScreen({ state }: { state: State }) {
  const dest = parseDestination(state.prompt);
  const progress = Math.round(((state.generatingStep + 1) / GENERATING_STEPS.length) * 100);

  return (
    <motion.div
      key="generating"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-background flex items-center justify-center px-6"
    >
      <div className="max-w-sm w-full text-center">
        {/* animated plane */}
        <motion.div
          className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-8"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Plane size={28} className="text-accent rotate-45" />
        </motion.div>

        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Planning your trip to</p>
        <h2
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          className="text-3xl font-semibold text-foreground mb-1"
        >
          {dest.name}
        </h2>
        <p className="text-muted-foreground text-sm mb-10">{dest.country}</p>

        {/* steps */}
        <div className="space-y-3 mb-8 text-left">
          {GENERATING_STEPS.map((step, i) => {
            const done = i < state.generatingStep;
            const active = i === state.generatingStep;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.15 }}
                className="flex items-center gap-3"
              >
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                  done ? "bg-accent" : active ? "border-2 border-accent" : "border-2 border-border"
                )}>
                  {done && <Check size={10} className="text-white" strokeWidth={3} />}
                  {active && (
                    <motion.div
                      className="w-2 h-2 bg-accent rounded-full"
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </div>
                <span className={cn(
                  "text-sm transition-all duration-300",
                  done ? "text-muted-foreground line-through" : active ? "text-foreground font-medium" : "text-muted-foreground/50"
                )}>
                  {step}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* progress bar */}
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <motion.div
            className="h-full bg-accent rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{progress}% complete</p>
      </div>
    </motion.div>
  );
}

// ─── activity card ─────────────────────────────────────────────────────────────

const ActivityCard = memo(function ActivityCard({
  activity, dayId, index, dispatch,
}: {
  activity: Activity; dayId: string; index: number; dispatch: React.Dispatch<Action>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(activity);

  const update = (patch: Partial<Activity>) =>
    dispatch({ type: "UPDATE_ACTIVITY", payload: { dayId, id: activity.id, patch } });

  const saveEdit = () => {
    update(draft);
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(activity);
    setEditing(false);
  };

  return (
    <Draggable draggableId={activity.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "group bg-card border border-border rounded-xl overflow-hidden transition-shadow duration-200",
            snapshot.isDragging ? "shadow-xl ring-1 ring-accent/30 opacity-95" : "hover:shadow-sm",
            activity.isCompleted ? "opacity-60" : ""
          )}
        >
          {/* main row */}
          <div className="flex items-start gap-0">
            {/* drag handle */}
            <div
              {...provided.dragHandleProps}
              className="px-2 py-4 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-colors shrink-0"
            >
              <GripVertical size={14} />
            </div>

            {/* content */}
            <div className="flex-1 py-3 pr-3 min-w-0">
              {editing ? (
                /* edit mode */
                <div className="space-y-2">
                  <input
                    autoFocus
                    value={draft.title}
                    onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                    className="w-full text-sm font-medium bg-input-background rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent border border-border"
                  />
                  <div className="flex gap-2">
                    <input
                      value={draft.time}
                      onChange={e => setDraft(d => ({ ...d, time: e.target.value }))}
                      placeholder="Time"
                      className="w-24 text-xs bg-input-background rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent border border-border"
                    />
                    <input
                      value={draft.duration}
                      onChange={e => setDraft(d => ({ ...d, duration: e.target.value }))}
                      placeholder="Duration"
                      className="w-28 text-xs bg-input-background rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent border border-border"
                    />
                    <div className="relative flex items-center">
                      <span className="absolute left-2 text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={draft.estimatedCost}
                        onChange={e => setDraft(d => ({ ...d, estimatedCost: parseFloat(e.target.value) || 0 }))}
                        className="w-20 pl-5 text-xs bg-input-background rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent border border-border"
                      />
                    </div>
                  </div>
                  <textarea
                    value={draft.description}
                    onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                    rows={2}
                    className="w-full text-xs bg-input-background rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent border border-border resize-none"
                    placeholder="Description"
                  />
                  <input
                    value={draft.insiderTip}
                    onChange={e => setDraft(d => ({ ...d, insiderTip: e.target.value }))}
                    className="w-full text-xs bg-input-background rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent border border-border"
                    placeholder="Insider tip"
                  />
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1 bg-accent text-white text-xs rounded-md font-medium hover:bg-accent/90 transition-colors">
                      <Check size={11} /> Save
                    </button>
                    <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1 bg-muted text-muted-foreground text-xs rounded-md font-medium hover:bg-muted/80 transition-colors">
                      <X size={11} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* view mode */
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <TimeOfDayIcon timeOfDay={activity.timeOfDay} />
                        <span className="text-xs text-muted-foreground font-mono">{activity.time}</span>
                        <CategoryBadge category={activity.category} />
                      </div>
                      <p className={cn(
                        "text-sm font-medium text-foreground leading-snug",
                        activity.isCompleted && "line-through text-muted-foreground"
                      )}>
                        {activity.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock size={10} /> {activity.duration}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign size={10} />
                          {activity.estimatedCost === 0 ? "Free" : `$${activity.estimatedCost}`}
                        </span>
                      </div>
                    </div>

                    {/* actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => update({ isFavorite: !activity.isFavorite })}
                        className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", activity.isFavorite ? "text-rose-500" : "text-muted-foreground/40 hover:text-rose-400 opacity-0 group-hover:opacity-100")}
                        aria-label="Favorite"
                      >
                        <Heart size={13} fill={activity.isFavorite ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => update({ isCompleted: !activity.isCompleted })}
                        className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", activity.isCompleted ? "text-emerald-500" : "text-muted-foreground/40 hover:text-emerald-400 opacity-0 group-hover:opacity-100")}
                        aria-label="Mark complete"
                      >
                        <CheckCircle2 size={13} />
                      </button>
                      <button
                        onClick={() => setEditing(true)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                        aria-label="Edit"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => dispatch({ type: "DUPLICATE_ACTIVITY", payload: { dayId, id: activity.id } })}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                        aria-label="Duplicate"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => dispatch({ type: "DELETE_ACTIVITY", payload: { dayId, id: activity.id } })}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                        aria-label="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                      <button
                        onClick={() => setExpanded(e => !e)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                        aria-label={expanded ? "Collapse" : "Expand"}
                      >
                        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronDown size={14} />
                        </motion.div>
                      </button>
                    </div>
                  </div>

                  {/* expanded details */}
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 space-y-3 border-t border-border mt-3">
                          <p className="text-xs text-muted-foreground leading-relaxed">{activity.description}</p>
                          {activity.location && (
                            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <MapPin size={12} className="mt-0.5 shrink-0 text-accent" />
                              {activity.location}
                            </div>
                          )}
                          {activity.insiderTip && (
                            <div className="flex items-start gap-1.5 text-xs bg-accent/8 rounded-lg p-2.5 border border-accent/15">
                              <Lightbulb size={12} className="mt-0.5 shrink-0 text-accent" />
                              <span className="text-foreground/80">{activity.insiderTip}</span>
                            </div>
                          )}
                          {activity.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {activity.tags.map(tag => (
                                <span key={tag} className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
});

// ─── day accordion ────────────────────────────────────────────────────────────

function DayAccordion({ day, expanded, dispatch }: {
  day: Day; expanded: boolean; dispatch: React.Dispatch<Action>;
}) {
  const totalCost = day.activities.reduce((s, a) => s + a.estimatedCost, 0);
  const completed = day.activities.filter(a => a.isCompleted).length;

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card">
      {/* header */}
      <button
        onClick={() => dispatch({ type: "TOGGLE_DAY", payload: day.id })}
        className="w-full flex items-center justify-between px-4 py-4 hover:bg-secondary/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-accent">{day.dayNumber}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{day.theme}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {day.activities.length} activities · ${totalCost}
              {completed > 0 && ` · ${completed} done`}
            </p>
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-muted-foreground" />
        </motion.div>
      </button>

      {/* activities */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <Droppable droppableId={day.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "p-3 space-y-2 border-t border-border transition-colors duration-200",
                    snapshot.isDraggingOver ? "bg-accent/5" : ""
                  )}
                >
                  {day.activities.map((activity, index) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      dayId={day.id}
                      index={index}
                      dispatch={dispatch}
                    />
                  ))}
                  {provided.placeholder}
                  {day.activities.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No activities — drag one here or add a new one
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── budget panel ─────────────────────────────────────────────────────────────

function BudgetPanel({ trip }: { trip: Trip }) {
  const allActivities = trip.days.flatMap(d => d.activities);
  const spent = allActivities.reduce((s, a) => s + a.estimatedCost, 0);
  const pct = Math.min(100, Math.round((spent / trip.budget.total) * 100));

  const byCategory = Object.entries(
    allActivities.reduce((acc: Record<string, number>, a) => {
      acc[a.category] = (acc[a.category] || 0) + a.estimatedCost;
      return acc;
    }, {})
  )
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name: name.split(" ")[0], value, color: CHART_COLORS[i % CHART_COLORS.length] }));

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <DollarSign size={14} className="text-accent" /> Budget
        </h3>
        <span className="text-xs text-muted-foreground">{trip.budget.currency}</span>
      </div>

      {/* progress */}
      <div>
        <div className="flex justify-between text-xs mb-2">
          <span className="text-foreground font-medium">${spent.toLocaleString()} spent</span>
          <span className="text-muted-foreground">${trip.budget.total.toLocaleString()} budget</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full", pct > 90 ? "bg-destructive" : "bg-accent")}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{pct}% of budget used · ${(trip.budget.total - spent).toLocaleString()} remaining</p>
      </div>

      {/* chart */}
      {byCategory.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-3 font-medium">By category</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={byCategory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                formatter={(value: number) => [`$${value}`, "Estimated"]}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {byCategory.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* per day */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
        <span>Avg per day</span>
        <span className="font-medium text-foreground">
          ${Math.round(spent / trip.duration)}/day
        </span>
      </div>
    </div>
  );
}

// ─── packing checklist ─────────────────────────────────────────────────────────

function PackingChecklist({ checked, dispatch }: {
  checked: Record<string, boolean>; dispatch: React.Dispatch<Action>;
}) {
  const done = PACKING_ITEMS.filter(i => checked[i.id]).length;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Package size={14} className="text-accent" /> Packing List
        </h3>
        <span className="text-xs text-muted-foreground">{done}/{PACKING_ITEMS.length}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1 mb-4 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${(done / PACKING_ITEMS.length) * 100}%` }}
        />
      </div>
      <div className="space-y-1.5">
        {PACKING_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => dispatch({ type: "TOGGLE_PACKING", payload: item.id })}
            className="w-full flex items-center gap-2.5 py-1.5 text-left group"
          >
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
              checked[item.id] ? "bg-accent border-accent" : "border-border group-hover:border-foreground/40"
            )}>
              {checked[item.id] && <Check size={10} className="text-white" strokeWidth={3} />}
            </div>
            <span className={cn(
              "text-xs transition-colors",
              checked[item.id] ? "line-through text-muted-foreground" : "text-foreground"
            )}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── trip header ───────────────────────────────────────────────────────────────

function TripHeader({ trip, darkMode, onSave, dispatch }: {
  trip: Trip; darkMode: boolean; onSave: () => void; dispatch: React.Dispatch<Action>;
}) {
  return (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        {/* left */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => dispatch({ type: "GO_HOME" })}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0"
            aria-label="Back to home"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-lg font-semibold text-foreground truncate">
                {trip.destination}
              </h1>
              <span className="text-xs text-muted-foreground hidden sm:block">{trip.country}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Calendar size={10} /> {trip.duration} days</span>
              <span className="flex items-center gap-1"><DollarSign size={10} /> ${trip.budget.total.toLocaleString()}</span>
              <span className="capitalize">{trip.travelStyle}</span>
            </div>
          </div>
        </div>

        {/* right */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onSave}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 rounded-lg transition-all"
          >
            <Save size={13} /> Save
          </button>
          <button
            onClick={() => dispatch({ type: "TOAST", payload: { message: "PDF export — coming soon!" } })}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 rounded-lg transition-all"
          >
            <Download size={13} /> Export
          </button>
          <button
            onClick={() => dispatch({ type: "TOGGLE_DARK" })}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── trip page ─────────────────────────────────────────────────────────────────

function TripPage({ state, dispatch }: { state: State; dispatch: React.Dispatch<Action> }) {
  const { trip } = state;
  if (!trip) return null;

  const onDragEnd = useCallback((result: any) => {
    if (!result.destination) return;
    if (result.source.droppableId !== result.destination.droppableId) return;
    dispatch({
      type: "REORDER",
      payload: {
        dayId: result.source.droppableId,
        from: result.source.index,
        to: result.destination.index,
      },
    });
  }, [dispatch]);

  const handleSave = useCallback(() => {
    try {
      localStorage.setItem("wayfarer_trip", JSON.stringify(trip));
      dispatch({ type: "TOAST", payload: { message: "Trip saved to your browser." } });
    } catch {
      dispatch({ type: "TOAST", payload: { message: "Could not save — storage unavailable." } });
    }
  }, [trip, dispatch]);

  return (
    <motion.div
      key="trip"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-background"
    >
      <TripHeader trip={trip} darkMode={state.darkMode} onSave={handleSave} dispatch={dispatch} />

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {/* weather notice */}
        {trip.weather && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-border rounded-xl text-xs text-muted-foreground mb-6"
          >
            <Cloud size={13} className="text-accent shrink-0" />
            <span><strong className="text-foreground">Weather:</strong> {trip.weather}</span>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* left — itinerary */}
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-foreground">Itinerary</h2>
                <span className="text-xs text-muted-foreground">{trip.days.length} days</span>
              </div>
              {trip.days.map(day => (
                <motion.div
                  key={day.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: day.dayNumber * 0.08 }}
                >
                  <DayAccordion
                    day={day}
                    expanded={!!state.expandedDays[day.id]}
                    dispatch={dispatch}
                  />
                </motion.div>
              ))}
            </div>
          </DragDropContext>

          {/* right — sidebar */}
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <BudgetPanel trip={trip} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <PackingChecklist checked={state.packingChecked} dispatch={dispatch} />
            </motion.div>

            {/* packing tips */}
            {trip.packingTips.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-card border border-border rounded-2xl p-5"
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                  <Lightbulb size={14} className="text-accent" /> Travel Tips
                </h3>
                <ul className="space-y-2">
                  {trip.packingTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="text-accent mt-0.5 shrink-0">·</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── toast ─────────────────────────────────────────────────────────────────────

const Toast = memo(function Toast({
  toast, dispatch,
}: { toast: State["toast"]; dispatch: React.Dispatch<Action> }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dispatch({ type: "TOAST", payload: null }), 5000);
    return () => clearTimeout(t);
  }, [toast, dispatch]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-foreground text-background rounded-xl shadow-xl text-sm max-w-sm"
        >
          <span className="flex-1">{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => { toast.action!(); dispatch({ type: "TOAST", payload: null }); }}
              className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
            >
              Undo
            </button>
          )}
          <button onClick={() => dispatch({ type: "TOAST", payload: null })} className="shrink-0 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ─── app ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(reducer, init);

  // generating sequence
  useEffect(() => {
    if (state.view !== "generating") return;
    const timers = GENERATING_STEPS.map((_, i) =>
      setTimeout(() => dispatch({ type: "SET_STEP", payload: i + 1 }), (i + 1) * 850)
    );
    const done = setTimeout(() => {
      const trip = generateTripData(state.prompt, state.travelStyle);
      dispatch({ type: "FINISH_GENERATING", payload: trip });
    }, GENERATING_STEPS.length * 850 + 600);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, [state.view]);

  // show undo toast on delete
  useEffect(() => {
    if (!state.deletedActivity) return;
    dispatch({
      type: "TOAST",
      payload: {
        message: `"${state.deletedActivity.activity.title}" deleted`,
        action: () => dispatch({ type: "RESTORE_ACTIVITY" }),
      },
    });
  }, [state.deletedActivity]);

  return (
    <div className={state.darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <AnimatePresence mode="wait">
          {state.view === "landing" && <LandingPage key="landing" state={state} dispatch={dispatch} />}
          {state.view === "generating" && <GeneratingScreen key="generating" state={state} />}
          {state.view === "trip" && <TripPage key="trip" state={state} dispatch={dispatch} />}
        </AnimatePresence>
        <Toast toast={state.toast} dispatch={dispatch} />
      </div>
    </div>
  );
}
