import React, { useState } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    useDraggable,
    useDroppable,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { RefreshCcw, GripVertical } from 'lucide-react';
import { MathSpan } from '../common';
import NewlineMathText from '../common/NewlineMathText';

// Color palette for categories
const CATEGORY_COLORS = [
    { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-700', hover: 'hover:bg-blue-200', dragBg: 'bg-blue-200' },
    { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-700', hover: 'hover:bg-green-200', dragBg: 'bg-green-200' },
    { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-700', hover: 'hover:bg-purple-200', dragBg: 'bg-purple-200' },
    { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700', hover: 'hover:bg-orange-200', dragBg: 'bg-orange-200' },
    { bg: 'bg-pink-100', border: 'border-pink-400', text: 'text-pink-700', hover: 'hover:bg-pink-200', dragBg: 'bg-pink-200' },
];

interface CategoryItem {
    id: string;
    content: string;
}

interface Category {
    id: string;
    name: string;
}

interface Props {
    categories: Category[];
    items: CategoryItem[];
    instruction?: string;
    currentAnswers: Record<string, string>;
    onAnswerChange: (answers: Record<string, string>) => void;
}

// Draggable item chip
function DraggableItem({ item, isSelected, onClick, color }: {
    item: CategoryItem;
    isSelected: boolean;
    onClick: () => void;
    color?: typeof CATEGORY_COLORS[0];
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: item.id,
    });

    const style: React.CSSProperties = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
    };

    const baseClass = color
        ? `px-3 py-1.5 rounded-lg text-xs font-medium ${color.bg} ${color.text} ${color.border} border transition-all`
        : `px-4 py-2 rounded-lg font-medium text-sm shadow-sm transition-all transform`;

    const stateClass = color
        ? 'hover:opacity-80 cursor-grab active:cursor-grabbing'
        : isSelected
            ? 'bg-indigo-500 text-white ring-2 ring-indigo-300 ring-offset-2 scale-105'
            : 'bg-white border border-gray-200 text-blue-900 hover:border-indigo-300 hover:bg-indigo-50 cursor-grab active:cursor-grabbing';

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={(e) => {
                // Only trigger click if not dragging
                if (!isDragging) {
                    e.stopPropagation();
                    onClick();
                }
            }}
            className={`${baseClass} ${stateClass} select-none`}
        >
            <span className="inline-flex items-center gap-1">
                <GripVertical className="w-3 h-3 opacity-40 flex-shrink-0" />
                <MathSpan content={item.content} />
                {color && <span className="ml-1 opacity-60">×</span>}
            </span>
        </button>
    );
}

// Droppable category zone
function DroppableCategory({ category, children, isHighlighted, isOver, color }: {
    category: Category;
    children: React.ReactNode;
    isHighlighted: boolean;
    isOver: boolean;
    color: typeof CATEGORY_COLORS[0];
}) {
    const { setNodeRef } = useDroppable({
        id: `category-${category.id}`,
    });

    return (
        <div
            ref={setNodeRef}
            className={`p-4 rounded-xl border-2 min-h-[120px] transition-all duration-200 ${isOver
                ? `${color.border} ${color.dragBg} scale-[1.02] shadow-lg ring-2 ring-offset-1 ring-indigo-300`
                : isHighlighted
                    ? `${color.border} ${color.bg} cursor-pointer ring-2 ring-offset-1 ring-indigo-300`
                    : `border-gray-200 bg-white`
                }`}
        >
            <NewlineMathText
                content={category.name}
                as="p"
                className={`font-bold text-sm mb-3 ${color.text} quiz-text-preserve-block`}
            />
            <div className="flex flex-wrap gap-2 min-h-[40px]">
                {children}
            </div>
        </div>
    );
}

// Droppable "unplaced" zone (to remove items from categories)
function DroppableUnplaced({ children, isOver }: {
    children: React.ReactNode;
    isOver: boolean;
}) {
    const { setNodeRef } = useDroppable({
        id: 'unplaced-zone',
    });

    return (
        <div
            ref={setNodeRef}
            className={`bg-gray-50 p-4 rounded-xl border-2 border-dashed transition-all duration-200 ${isOver
                ? 'border-indigo-400 bg-indigo-50 shadow-inner'
                : 'border-gray-300'
                }`}
        >
            {children}
        </div>
    );
}

// Main component
const DraggableCategorization: React.FC<Props> = ({
    categories,
    items,
    instruction,
    currentAnswers,
    onAnswerChange,
}) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [overDroppableId, setOverDroppableId] = useState<string | null>(null);

    // Sensors: pointer for mouse, touch for mobile
    const pointerSensor = useSensor(PointerSensor, {
        activationConstraint: { distance: 8 }, // 8px movement before drag activates
    });
    const touchSensor = useSensor(TouchSensor, {
        activationConstraint: { delay: 200, tolerance: 5 }, // Hold 200ms then drag
    });
    const sensors = useSensors(pointerSensor, touchSensor);

    // Derived state
    const unplacedItems = items.filter((item) => !currentAnswers[item.id]);
    const getItemsInCategory = (catId: string) =>
        items.filter((item) => currentAnswers[item.id] === catId);
    const getCategoryColor = (idx: number) => CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
    const activeItem = items.find((item) => item.id === activeId);

    // Tap-to-select handler (fallback for mobile)
    const handleItemClick = (itemId: string) => {
        if (currentAnswers[itemId]) {
            // Item already placed → remove from category
            const newAnswers = { ...currentAnswers };
            delete newAnswers[itemId];
            onAnswerChange(newAnswers);
        } else if (selectedItem === itemId) {
            // Deselect
            setSelectedItem(null);
        } else {
            // Select item
            setSelectedItem(itemId);
        }
    };

    const handleCategoryClick = (catId: string) => {
        if (selectedItem && !currentAnswers[selectedItem]) {
            // Place selected item into category
            const newAnswers = { ...currentAnswers, [selectedItem]: catId };
            onAnswerChange(newAnswers);
            setSelectedItem(null);
        }
    };

    // Drag handlers
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        setSelectedItem(null); // Clear tap selection when dragging
    };

    const handleDragOver = (event: any) => {
        setOverDroppableId(event.over?.id as string || null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setOverDroppableId(null);

        if (!over) return;

        const itemId = active.id as string;
        const droppableId = over.id as string;

        if (droppableId === 'unplaced-zone') {
            // Remove item from category
            const newAnswers = { ...currentAnswers };
            delete newAnswers[itemId];
            onAnswerChange(newAnswers);
        } else if (droppableId.startsWith('category-')) {
            // Place item into category
            const catId = droppableId.replace('category-', '');
            const newAnswers = { ...currentAnswers, [itemId]: catId };
            onAnswerChange(newAnswers);
        }
    };

    const handleDragCancel = () => {
        setActiveId(null);
        setOverDroppableId(null);
    };

    const placedCount = Object.keys(currentAnswers).filter(k => k !== '_selected').length;

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <div className="space-y-4">
                {/* Instruction */}
                {instruction && (
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <p className="text-sm text-amber-800">
                            📝 <em><NewlineMathText content={instruction} as="span" className="quiz-text-preserve-inline" /></em>
                        </p>
                    </div>
                )}

                {/* Unplaced items zone */}
                <DroppableUnplaced isOver={overDroppableId === 'unplaced-zone' && !!activeId}>
                    <p className="text-xs font-bold text-gray-600 mb-3 uppercase tracking-wide">
                        Các mục cần phân loại (Kéo thả hoặc chạm để chọn):
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {unplacedItems.length === 0 ? (
                            <p className="text-gray-400 text-sm italic">Đã phân loại hết!</p>
                        ) : (
                            unplacedItems.map((item) => (
                                <DraggableItem
                                    key={item.id}
                                    item={item}
                                    isSelected={selectedItem === item.id}
                                    onClick={() => handleItemClick(item.id)}
                                />
                            ))
                        )}
                    </div>
                    {selectedItem && !currentAnswers[selectedItem] && (
                        <p className="text-xs text-indigo-600 mt-3 font-medium">
                            👆 Đã chọn! Giờ hãy chạm vào nhóm bên dưới để xếp vào, hoặc kéo thả trực tiếp.
                        </p>
                    )}
                </DroppableUnplaced>

                {/* Category zones */}
                {categories.length === 0 ? (
                    <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm text-center font-medium border border-red-200">
                        ⚠️ Câu hỏi này bị lỗi (chưa thiết lập nhóm phân loại). Vui lòng báo lỗi cho giáo viên.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categories.map((cat, catIdx) => {
                            const color = getCategoryColor(catIdx);
                            const itemsInCat = getItemsInCategory(cat.id);
                            const isHighlighted = !!selectedItem && !currentAnswers[selectedItem];
                            const isOver = overDroppableId === `category-${cat.id}` && !!activeId;

                            return (
                                <div key={cat.id} onClick={() => handleCategoryClick(cat.id)}>
                                    <DroppableCategory
                                        category={cat}
                                        isHighlighted={isHighlighted}
                                        isOver={isOver}
                                        color={color}
                                    >
                                        {itemsInCat.length === 0 ? (
                                            <p className="text-gray-300 text-xs italic">
                                                {isHighlighted || isOver ? '📥 Thả vào đây...' : 'Chưa có mục nào'}
                                            </p>
                                        ) : (
                                            itemsInCat.map((item) => (
                                                <DraggableItem
                                                    key={item.id}
                                                    item={item}
                                                    isSelected={false}
                                                    onClick={() => handleItemClick(item.id)}
                                                    color={color}
                                                />
                                            ))
                                        )}
                                    </DroppableCategory>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Status and Reset */}
                <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        Đã phân loại: {placedCount}/{items.length}
                    </p>
                    <button
                        onClick={() => {
                            onAnswerChange({});
                            setSelectedItem(null);
                        }}
                        className="text-xs text-red-500 hover:underline flex items-center"
                    >
                        <RefreshCcw className="w-3 h-3 mr-1" /> Làm lại câu này
                    </button>
                </div>
            </div>

            {/* Drag overlay - floating item that follows cursor */}
            <DragOverlay>
                {activeItem ? (
                    <div className="px-4 py-2 rounded-lg font-medium text-sm shadow-xl bg-indigo-500 text-white ring-2 ring-indigo-300 ring-offset-2 scale-110 pointer-events-none">
                        <MathSpan content={activeItem.content} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default DraggableCategorization;
