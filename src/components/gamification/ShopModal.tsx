import React, { useState, useMemo } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useGamificationStore } from '../../stores/useGamificationStore';
import { useClassroomStore } from '../../stores/useClassroomStore';
import { ShopItem } from '../../types/gamification.types';

interface ShopModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 'Food' | 'Clothing' | 'Toys';

// Helper image mapping for fluent emojis based on item type/ID
const getItemImage = (item: ShopItem) => {
    // Map existing IDs or types to some 3D Fluent Emojis
    const mapping: Record<string, string> = {
        'hat_01': 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Top%20hat/3D/top_hat_3d.png',
        'glass_01': 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Sunglasses/3D/sunglasses_3d.png',
        'crown_01': 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Crown/3D/crown_3d.png',
        'tie_01': 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Necktie/3D/necktie_3d.png',
        // Fallbacks based on typical types
        'BONE': 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Bone/3D/bone_3d.png',
        'FOOD': 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Meat%20on%20bone/3D/meat_on_bone_3d.png',
        'CLOTHING': 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/T-shirt/3D/t-shirt_3d.png',
        'TOY': 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Yoyo/3D/yoyo_3d.png',
    };

    if (mapping[item.itemId]) return mapping[item.itemId];

    // Guess based on type or name
    if (item.type === 'HEAD') return 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Billed%20cap/3D/billed_cap_3d.png';
    if (item.type === 'FACE') return mapping['glass_01'];
    if (item.type === 'BODY') return mapping['CLOTHING'];

    return 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Wrapped%20gift/3D/wrapped_gift_3d.png'; // Default
};

// Map items to categories for the tabs
const categorizeItem = (item: ShopItem): TabType => {
    if (item.name.toLowerCase().includes('đồ ăn') || item.category === 'FOOD' || item.itemId.includes('food')) return 'Food';
    if (item.name.toLowerCase().includes('đồ chơi') || item.category === 'TOY' || item.itemId.includes('toy')) return 'Toys';
    // Default everything else to clothing/accessories
    return 'Clothing';
};

const ShopModal: React.FC<ShopModalProps> = ({ isOpen, onClose }) => {
    const { shopItems, coins, pet, buyItem, isLoading, error, clearError } = useGamificationStore();
    const { studentSession } = useClassroomStore();
    const [activeTab, setActiveTab] = useState<TabType>('Clothing');
    const [purchasedItemId, setPurchasedItemId] = useState<string | null>(null);

    // Filter items based on active tab
    const filteredItems = useMemo(() => {
        return shopItems.filter(item => categorizeItem(item) === activeTab);
    }, [shopItems, activeTab]);

    if (!isOpen) return null;

    const ownedItems = pet?.items || [];
    const username = studentSession?.username || '';

    const handleBuy = async (item: ShopItem) => {
        if (coins < item.price || ownedItems.includes(item.itemId)) return;
        clearError();

        const success = await buyItem(username, item.itemId);
        if (success) {
            setPurchasedItemId(item.itemId);
            setTimeout(() => {
                setPurchasedItemId(null);
            }, 2000);
        }
    };

    // Color backgrounds for item cards
    const cardBgs = ['bg-orange-50', 'bg-yellow-50', 'bg-red-50', 'bg-purple-50', 'bg-indigo-50', 'bg-sky-50'];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div
                className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Section */}
                <div className="flex items-center justify-between p-6 pb-2">
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Pet Store</h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 mb-6">
                    <div className="flex bg-slate-100 p-1.5 rounded-full w-full max-w-md mx-auto sm:mx-0">
                        {(['Food', 'Clothing', 'Toys'] as TabType[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-2.5 px-4 rounded-full text-sm font-bold transition-all ${activeTab === tab
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mx-6 mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-sm flex items-center justify-center">
                        {error}
                    </div>
                )}

                {/* Store Grid Content */}
                <div className="flex-1 overflow-y-auto px-6 pb-8 custom-scrollbar">
                    {filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <div className="w-24 h-24 mb-4 opacity-50 grayscale">
                                <img src="https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Shopping%20bags/3D/shopping_bags_3d.png" alt="Empty Shop" className="w-full h-full object-contain" />
                            </div>
                            <p className="text-lg font-bold">Chưa có vật phẩm trong mục này.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredItems.map((item, index) => {
                                const owned = ownedItems.includes(item.itemId);
                                const canAfford = coins >= item.price;
                                const justPurchased = purchasedItemId === item.itemId;
                                const bgIdx = index % cardBgs.length;

                                return (
                                    <div
                                        key={item.itemId}
                                        className={`bg-white rounded-[24px] border border-slate-100 p-4 pb-5 flex flex-col items-center shadow-[0_8px_24px_-12px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.15)] transition-all ${justPurchased ? 'scale-105 ring-4 ring-emerald-400' : ''}`}
                                    >
                                        {/* Image Display Area */}
                                        <div className={`w-full aspect-square rounded-[20px] ${cardBgs[bgIdx]} flex items-center justify-center p-6 mb-4 relative`}>
                                            <img
                                                src={getItemImage(item)}
                                                alt={item.name}
                                                className="w-full h-full object-contain drop-shadow-xl hover:scale-110 transition-transform duration-300"
                                            />
                                            {owned && (
                                                <div className="absolute top-3 right-3 bg-emerald-500 text-white p-1 rounded-full shadow-lg">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Item Details */}
                                        <div className="text-center w-full mb-4">
                                            <h3 className="font-extrabold text-lg text-slate-800 leading-tight mb-1 truncate px-2">{item.name}</h3>
                                            <div className="flex justify-center items-center gap-1.5">
                                                <span className="material-symbols-outlined text-amber-500 text-sm font-variation-settings-'FILL'-1">database</span>
                                                <span className="font-black text-amber-500 text-sm">{item.price} Vàng</span>
                                            </div>
                                        </div>

                                        {/* Buy Button */}
                                        <button
                                            onClick={() => handleBuy(item)}
                                            disabled={owned || !canAfford || isLoading}
                                            className={`w-full py-3.5 rounded-full font-black text-sm tracking-wide transition-all ${owned
                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                    : canAfford
                                                        ? 'bg-[#ee9d2b] text-white hover:bg-orange-500 active:scale-95 shadow-[0_4px_0_0_#c57f1e] active:shadow-[0_0_0_0_#c57f1e] active:translate-y-1'
                                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border-2 border-slate-200'
                                                }`}
                                        >
                                            {isLoading && purchasedItemId === item.itemId ? (
                                                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                            ) : owned ? (
                                                'ĐÃ SỞ HỮU'
                                            ) : (
                                                'MUA NGAY'
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
};

export default ShopModal;
