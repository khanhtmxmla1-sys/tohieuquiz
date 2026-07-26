import React from 'react';
import { Button, Modal } from '../../common';
import { QuestionType } from '../../../types';
import { QUESTION_TYPE_OPTIONS } from './questionTypes';

interface AddQuestionModalProps {
    isOpen: boolean;
    questionType: QuestionType;
    onQuestionTypeChange: (type: QuestionType) => void;
    onClose: () => void;
    onConfirm: () => void;
}

const AddQuestionModal: React.FC<AddQuestionModalProps> = ({
    isOpen,
    questionType,
    onQuestionTypeChange,
    onClose,
    onConfirm,
}) => isOpen ? (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm câu hỏi mới" size="md">
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn loại câu hỏi</label>
                <select
                    value={questionType}
                    onChange={(event) => onQuestionTypeChange(event.target.value as QuestionType)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    {QUESTION_TYPE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
            </div>
            <div className="flex gap-2 justify-end pt-4">
                <Button variant="secondary" onClick={onClose}>Hủy</Button>
                <Button variant="primary" onClick={onConfirm}>Tiếp tục</Button>
            </div>
        </div>
    </Modal>
) : null;

export default AddQuestionModal;
