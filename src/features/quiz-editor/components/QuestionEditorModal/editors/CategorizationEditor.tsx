/**
 * CategorizationEditor.tsx
 * Editor for CATEGORIZATION question type.
 */
import React from 'react';
import type { CategorizationEditorDraft } from '../../../types/quiz-editor.types';
import { FieldRow, RemoveBtn, AddRowBtn, TextInput } from './shared';

interface CategorizationEditorProps {
    draft: CategorizationEditorDraft;
    onChange: (next: CategorizationEditorDraft) => void;
}

const CategorizationEditor: React.FC<CategorizationEditorProps> = ({ draft, onChange }) => (
    <div className="space-y-4">
        {/* Categories */}
        <FieldRow label="Các nhóm (categories)">
            <div className="space-y-2">
                {draft.categories.map((cat, i) => (
                    <div key={cat.id} className="flex items-center gap-2">
                        <TextInput
                            value={cat.name}
                            onChange={(e) => {
                                const next = [...draft.categories];
                                next[i] = { ...next[i], name: e.target.value };
                                onChange({ ...draft, categories: next });
                            }}
                            placeholder={`Nhóm ${i + 1}`}
                        />
                        {draft.categories.length > 2 && (
                            <RemoveBtn
                                onClick={() => {
                                    const removedId = cat.id;
                                    onChange({
                                        ...draft,
                                        categories: draft.categories.filter((_, idx) => idx !== i),
                                        // Remove items belonging to this category
                                        items: draft.items.filter(
                                            (item) => item.categoryId !== removedId,
                                        ),
                                    });
                                }}
                            />
                        )}
                    </div>
                ))}
                <AddRowBtn
                    onClick={() =>
                        onChange({
                            ...draft,
                            categories: [
                                ...draft.categories,
                                { id: String(Date.now()), name: '' },
                            ],
                        })
                    }
                    label="Thêm nhóm"
                />
            </div>
        </FieldRow>

        {/* Items */}
        <FieldRow label="Các mục cần phân loại">
            <div className="space-y-2">
                {draft.items.map((item, i) => (
                    <div key={item.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                        <TextInput
                            value={item.content}
                            onChange={(e) => {
                                const next = [...draft.items];
                                next[i] = { ...next[i], content: e.target.value };
                                onChange({ ...draft, items: next });
                            }}
                            placeholder="Nội dung mục"
                        />
                        <select
                            value={item.categoryId}
                            onChange={(e) => {
                                const next = [...draft.items];
                                next[i] = { ...next[i], categoryId: e.target.value };
                                onChange({ ...draft, items: next });
                            }}
                            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[140px]"
                        >
                            <option value="">-- Chọn nhóm --</option>
                            {draft.categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name || `Nhóm ${draft.categories.indexOf(cat) + 1}`}
                                </option>
                            ))}
                        </select>
                        <RemoveBtn
                            onClick={() =>
                                onChange({
                                    ...draft,
                                    items: draft.items.filter((_, idx) => idx !== i),
                                })
                            }
                        />
                    </div>
                ))}
                <AddRowBtn
                    onClick={() =>
                        onChange({
                            ...draft,
                            items: [
                                ...draft.items,
                                {
                                    id: String(Date.now()),
                                    content: '',
                                    categoryId: draft.categories[0]?.id ?? '',
                                },
                            ],
                        })
                    }
                    label="Thêm mục"
                />
            </div>
        </FieldRow>
    </div>
);

export default CategorizationEditor;
