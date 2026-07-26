/**
 * OrderingEditor.tsx
 * Editor for ORDERING question type.
 */
import React from 'react';
import type { OrderingEditorDraft } from '../../../types/quiz-editor.types';
import { FieldRow, TextInput } from './shared';

interface OrderingEditorProps {
    draft: OrderingEditorDraft;
    onChange: (next: OrderingEditorDraft) => void;
}

const OrderingEditor: React.FC<OrderingEditorProps> = ({ draft, onChange }) => (
    <FieldRow
        label="Các câu/mục (sửa nội dung và thứ tự đúng)"
        hint="Nhập số thứ tự đúng (1, 2, 3...) vào ô bên trái mỗi câu"
    >
        <div className="space-y-2">
            {draft.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                    <input
                        type="number"
                        min={1}
                        max={draft.items.length}
                        value={draft.correctOrder.indexOf(i) + 1}
                        onChange={(e) => {
                            const newPos = parseInt(e.target.value, 10) - 1;
                            const newOrder = [...draft.correctOrder];
                            const oldPos = newOrder.indexOf(i);
                            if (
                                oldPos !== -1 &&
                                newPos >= 0 &&
                                newPos < draft.items.length
                            ) {
                                const itemAtNewPos = newOrder[newPos];
                                newOrder[newPos] = i;
                                newOrder[oldPos] = itemAtNewPos;
                                onChange({ ...draft, correctOrder: newOrder });
                            }
                        }}
                        className="w-12 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500"
                        title="Thứ tự đúng"
                    />
                    <TextInput
                        value={item}
                        onChange={(e) => {
                            const next = [...draft.items];
                            next[i] = e.target.value;
                            onChange({ ...draft, items: next });
                        }}
                    />
                </div>
            ))}
        </div>
    </FieldRow>
);

export default OrderingEditor;
