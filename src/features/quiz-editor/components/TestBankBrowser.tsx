import React, { useMemo, useState } from 'react';
import { Library, Search, Trash2 } from 'lucide-react';
import MathSpan from '../../../components/common/MathSpan';
import { QuestionType, type Question } from '../../../types';
import type { TestBankItem } from '../../../services/testBankService';

export interface TestBankFilters {
    query: string;
    type: QuestionType | 'all';
    difficulty: 'all' | '1' | '2' | '3';
    subject: string | 'all';
}

const getQuestionText = (question: Question): string => {
    const loose = question as Question & { mainQuestion?: string };
    return loose.mainQuestion || ('question' in loose ? String(loose.question || '') : '') || '[Chưa có nội dung]';
};

const normalizeSearchText = (item: TestBankItem): string => {
    const questionTags = item.question_data.tags;
    return [
        getQuestionText(item.question_data),
        item.question_data.type,
        (item.question_data as Question & { subject?: string }).subject,
        item.question_data.explanation,
        Array.isArray(questionTags) ? questionTags.join(' ') : questionTags,
        (item.tags ?? []).join(' '),
    ].filter(Boolean).join(' ').toLocaleLowerCase('vi');
};

export const filterTestBankItems = (items: TestBankItem[], filters: TestBankFilters): TestBankItem[] => {
    const query = filters.query.trim().toLocaleLowerCase('vi');
    return items.filter((item) => {
        const question = item.question_data as Question & { subject?: string };
        if (filters.type !== 'all' && question.type !== filters.type) return false;
        if (filters.difficulty !== 'all' && String(question.difficulty || '') !== filters.difficulty) return false;
        if (filters.subject !== 'all' && String(question.subject || '') !== filters.subject) return false;
        return !query || normalizeSearchText(item).includes(query);
    });
};

let fallbackCloneId = 0;
const createCloneId = (): string => {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return `question-bank-${uuid}`;
    fallbackCloneId += 1;
    return `question-bank-${Date.now()}-${fallbackCloneId}`;
};

export const cloneQuestionFromBank = (question: Question): Question => {
    const clone = typeof globalThis.structuredClone === 'function'
        ? globalThis.structuredClone(question)
        : JSON.parse(JSON.stringify(question)) as Question;
    return { ...clone, id: createCloneId() } as Question;
};

interface TestBankBrowserProps {
    items: TestBankItem[];
    loading?: boolean;
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    onDelete?: (item: TestBankItem) => void;
}

const TestBankBrowser: React.FC<TestBankBrowserProps> = ({ items, loading = false, selectedIds, onToggle, onDelete }) => {
    const [filters, setFilters] = useState<TestBankFilters>({ query: '', type: 'all', difficulty: 'all', subject: 'all' });
    const filteredItems = useMemo(() => filterTestBankItems(items, filters), [filters, items]);
    const types = useMemo(() => Array.from(new Set(items.map((item) => item.question_data.type))), [items]);
    const subjects = useMemo(() => Array.from(new Set(items
        .map((item) => String((item.question_data as Question & { subject?: string }).subject || ''))
        .filter(Boolean))), [items]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
                <label className="relative sm:col-span-2 xl:col-span-1">
                    <span className="sr-only">Tìm trong kho câu hỏi</span>
                    <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input aria-label="Tìm trong kho câu hỏi" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Tìm nội dung, tag, lời giải…" className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-500" />
                </label>
                <select aria-label="Lọc theo loại" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value as TestBankFilters['type'] }))} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    <option value="all">Tất cả dạng</option>
                    {types.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <select aria-label="Lọc theo độ khó" value={filters.difficulty} onChange={(event) => setFilters((current) => ({ ...current, difficulty: event.target.value as TestBankFilters['difficulty'] }))} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    <option value="all">Mọi độ khó</option><option value="1">Dễ</option><option value="2">Trung bình</option><option value="3">Khó</option>
                </select>
                <select aria-label="Lọc theo môn" value={filters.subject} onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    <option value="all">Tất cả môn</option>
                    {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                </select>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-4">
                {loading ? <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-500">Đang tải kho câu hỏi…</div> : filteredItems.length === 0 ? (
                    <div className="flex min-h-48 flex-col items-center justify-center text-center text-slate-500"><Library className="mb-3 h-10 w-10 text-slate-300" /><p className="font-medium">Không có câu hỏi phù hợp.</p></div>
                ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                        {filteredItems.map((item) => {
                            const question = item.question_data as Question & { subject?: string };
                            const text = getQuestionText(question);
                            const selected = selectedIds.has(item.id);
                            return (
                                <article key={item.id} className={`rounded-xl border bg-white p-4 transition ${selected ? 'border-sky-500 ring-2 ring-sky-100' : 'border-slate-200 hover:border-sky-300'}`}>
                                    <div className="flex items-start gap-3">
                                        <input type="checkbox" aria-label={text} checked={selected} onChange={() => onToggle(item.id)} className="mt-1 h-5 w-5 rounded border-slate-300 accent-sky-600" />
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700">{question.type}</span>{question.difficulty && <span>Mức {question.difficulty}</span>}{question.subject && <span>{question.subject}</span>}{question.points !== undefined && <span>{question.points} điểm</span>}</div>
                                            <MathSpan content={text} as="p" className="line-clamp-3 text-sm font-medium text-slate-800" />
                                            {(item.tags ?? []).length > 0 && <p className="mt-2 line-clamp-1 text-xs text-slate-500">{item.tags.join(' · ')}</p>}
                                        </div>
                                        {onDelete && <button type="button" aria-label={`Xóa khỏi kho: ${text}`} onClick={() => onDelete(item)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TestBankBrowser;
