import React from 'react';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    Eraser,
    Italic,
    List,
    ListOrdered,
    Redo2,
    Strikethrough,
    Underline,
    Undo2,
} from 'lucide-react';
import {
    QUESTION_HIGHLIGHT_PALETTE,
    QUESTION_TEXT_COLOR_PALETTE,
} from '../../../../../shared/question-rich-text.contract';

interface RichQuestionToolbarProps {
    editor: Editor;
}

interface ToolButtonProps {
    label: string;
    pressed?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}

const ToolButton: React.FC<ToolButtonProps> = ({
    label,
    pressed,
    disabled = false,
    onClick,
    children,
}) => (
    <button
        type="button"
        aria-label={label}
        {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        className={`grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40 ${
            pressed
                ? 'border-sky-300 bg-sky-50 text-sky-700'
                : 'border-transparent hover:border-slate-200 hover:bg-white hover:text-slate-900'
        }`}
    >
        {children}
    </button>
);

const Divider = () => <span aria-hidden="true" className="mx-0.5 h-6 w-px shrink-0 bg-slate-200" />;

const RichQuestionToolbar: React.FC<RichQuestionToolbarProps> = ({ editor }) => {
    const state = useEditorState({
        editor,
        selector: ({ editor: current }) => ({
            bold: current.isActive('bold'),
            italic: current.isActive('italic'),
            underline: current.isActive('underline'),
            strike: current.isActive('strike'),
            alignLeft: current.isActive({ textAlign: 'left' }),
            alignCenter: current.isActive({ textAlign: 'center' }),
            alignRight: current.isActive({ textAlign: 'right' }),
            bulletList: current.isActive('bulletList'),
            orderedList: current.isActive('orderedList'),
            color: String(current.getAttributes('textStyle').color ?? ''),
            highlight: String(current.getAttributes('highlight').color ?? ''),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
        }),
    });

    const clearFormatting = () => {
        editor.chain().focus().unsetAllMarks().clearNodes().setTextAlign('left').run();
    };

    return (
        <div
            role="toolbar"
            aria-label="Định dạng câu hỏi"
            className="flex max-w-full items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 py-2"
        >
            <ToolButton
                label="Hoàn tác"
                disabled={!state.canUndo}
                onClick={() => editor.chain().focus().undo().run()}
            >
                <Undo2 className="h-4 w-4" />
            </ToolButton>
            <ToolButton
                label="Làm lại"
                disabled={!state.canRedo}
                onClick={() => editor.chain().focus().redo().run()}
            >
                <Redo2 className="h-4 w-4" />
            </ToolButton>

            <Divider />

            <ToolButton label="In đậm" pressed={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
                <Bold className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="In nghiêng" pressed={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
                <Italic className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Gạch chân" pressed={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                <Underline className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Gạch ngang" pressed={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
                <Strikethrough className="h-4 w-4" />
            </ToolButton>

            <Divider />

            <div className="flex shrink-0 items-center gap-1" aria-label="Màu chữ">
                {QUESTION_TEXT_COLOR_PALETTE.map((color) => (
                    <button
                        key={color}
                        type="button"
                        aria-label={`Màu chữ ${color}`}
                        aria-pressed={state.color === color}
                        title={`Màu chữ ${color}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => editor.chain().focus().setColor(color).run()}
                        className={`h-7 w-7 rounded-full border-2 p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                            state.color === color ? 'border-sky-500' : 'border-white hover:border-slate-300'
                        }`}
                    >
                        <span className="block h-full w-full rounded-full" style={{ backgroundColor: color }} />
                    </button>
                ))}
            </div>

            <div className="flex shrink-0 items-center gap-1" aria-label="Tô nền">
                {QUESTION_HIGHLIGHT_PALETTE.map((color) => (
                    <button
                        key={color}
                        type="button"
                        aria-label={`Tô nền ${color}`}
                        aria-pressed={state.highlight === color}
                        title={`Tô nền ${color}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => editor.chain().focus().setHighlight({ color }).run()}
                        className={`h-7 w-7 rounded-md border-2 p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                            state.highlight === color ? 'border-sky-500' : 'border-white hover:border-slate-300'
                        }`}
                    >
                        <span className="block h-full w-full rounded-sm" style={{ backgroundColor: color }} />
                    </button>
                ))}
            </div>

            <Divider />

            <ToolButton label="Căn trái" pressed={state.alignLeft} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
                <AlignLeft className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Căn giữa" pressed={state.alignCenter} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
                <AlignCenter className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Căn phải" pressed={state.alignRight} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
                <AlignRight className="h-4 w-4" />
            </ToolButton>

            <Divider />

            <ToolButton
                label="Danh sách dấu đầu dòng"
                pressed={state.bulletList}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
                <List className="h-4 w-4" />
            </ToolButton>
            <ToolButton
                label="Danh sách đánh số"
                pressed={state.orderedList}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
                <ListOrdered className="h-4 w-4" />
            </ToolButton>

            <Divider />

            <ToolButton label="Xóa định dạng" onClick={clearFormatting}>
                <Eraser className="h-4 w-4" />
            </ToolButton>
        </div>
    );
};

export default React.memo(RichQuestionToolbar);
