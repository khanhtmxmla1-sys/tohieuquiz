/**
 * Gamification Types
 *
 * Types for the Pet System, Shop, and Rewards.
 */

// --- Pet ---

export interface PetData {
    petId: string;         // e.g., "cat_01", "dog_01", "rabbit_01"
    petName: string;       // Custom name given by student
    level: number;
    exp: number;
    expToNext: number;     // EXP needed for next level
    mood: PetMood;
    items: string[];       // Owned item IDs
    lastActive: string;    // ISO timestamp
    imageUrl?: string;     // URL for 3D sprite (if available)
}

export type PetMood = 'happy' | 'neutral' | 'sad' | 'excited';

// --- Shop ---

export interface ShopItem {
    itemId: string;        // e.g., "hat_01", "glass_01"
    name: string;          // Display name in Vietnamese
    price: number;         // Cost in coins
    type: ItemSlot;        // Where it goes on the pet
    category: string;      // Sub-category for filtering
    assetUrl: string;      // Image URL (empty = use emoji/CSS)
}

export type ItemSlot = 'HEAD' | 'FACE' | 'BODY';

// --- Game State Update ---

export interface GameStateUpdate {
    addExp: number;
    addCoins: number;
}

export interface GameStateResult {
    newLevel: number;
    newExp: number;
    newExpToNext: number;
    newCoins: number;
    leveledUp: boolean;
    mood: PetMood;
}

export interface ResultRewardClaimResult extends GameStateResult {
    awardedExp: number;
    awardedCoins: number;
    alreadyClaimed: boolean;
}

// --- Purchase ---

export interface PurchaseResult {
    newCoins: number;
    items: string[];
    purchasedItem: {
        itemId: string;
        name: string;
        price: number;
    };
}

// --- Leaderboard ---

export interface LeaderboardEntry {
    username: string;
    fullName: string;
    petId: string;
    petName: string;
    level: number;
    exp: number;
    avatar: string;
}

export interface TopGoldStudent {
    username: string;
    fullName: string;
    avatar: string;
    coins: number;
}

// --- Pet Selection (for registration / onboarding) ---

export interface PetOption {
    id: string;
    name: string;
    emoji: string;
    imageUrl?: string;
}

export const PET_OPTIONS: PetOption[] = [
    { id: 'cat_01', name: 'Mèo', emoji: '🐱', imageUrl: '/assets/images/pets/cat_01_3d.png' },
    { id: 'dog_01', name: 'Chó', emoji: '🐶' },
    { id: 'rabbit_01', name: 'Thỏ', emoji: '🐰' },
];
