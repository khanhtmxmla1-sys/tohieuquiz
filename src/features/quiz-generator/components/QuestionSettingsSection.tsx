import React from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import QuestionBlueprintSection from './QuestionBlueprintSection';
import { QuestionTypeSelector, DifficultyLevelSelector } from '../../../components/teacher/QuizCreator';
import type { DifficultyLevels } from '../domain/quizCreation.types';
import type { QuizBlueprint, QuizBlueprintV3 } from '../domain/quizBlueprint';

interface QuestionSettingsSectionProps {
    selectedTypes: Record<string, boolean>;
    setSelectedTypes: (value: Record<string, boolean>) => void;
    difficultyLevels: DifficultyLevels;
    setDifficultyLevels: (value: DifficultyLevels) => void;
    questionBlueprint: QuizBlueprint;
    questionBlueprintV3?: QuizBlueprintV3 | null;
    setQuestionBlueprint: (value: QuizBlueprint) => void;
    showBlueprint?: boolean;
    isOpenTypes: boolean;
    isOpenDifficulty: boolean;
    onToggle: (id: string) => void;
}

const QuestionSettingsSection: React.FC<QuestionSettingsSectionProps> = ({
    selectedTypes,
    setSelectedTypes,
    difficultyLevels,
    setDifficultyLevels,
    questionBlueprint,
    questionBlueprintV3,
    setQuestionBlueprint,
    showBlueprint = true,
    isOpenTypes,
    isOpenDifficulty,
    onToggle,
}) => {
    const questionCount = difficultyLevels.level1 + difficultyLevels.level2 + difficultyLevels.level3;
    const selectedTypesCount = Object.values(selectedTypes).filter(Boolean).length;

    return (
        <>
            <CollapsibleSection
                id="questionTypes"
                icon={<BookOpen className="h-4 w-4" />}
                title={showBlueprint ? 'Dạng câu hỏi & ma trận' : 'Dạng câu hỏi'}
                badge={`${selectedTypesCount} dạng · ${questionCount} câu`}
                isOpen={isOpenTypes}
                onToggle={onToggle}
            >
                <div className="space-y-4">
                    <QuestionTypeSelector
                        selectedTypes={selectedTypes}
                        onChange={setSelectedTypes}
                    />
                    {showBlueprint && (
                        <QuestionBlueprintSection
                            blueprint={questionBlueprint}
                            blueprintV3={questionBlueprintV3}
                            onChange={setQuestionBlueprint}
                        />
                    )}
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="difficulty"
                icon={<Sparkles className="h-4 w-4" />}
                title="Độ khó & Số lượng"
                badge={`${questionCount} câu`}
                isOpen={isOpenDifficulty}
                onToggle={onToggle}
            >
                <DifficultyLevelSelector
                    levels={difficultyLevels}
                    onChange={setDifficultyLevels}
                />
            </CollapsibleSection>
        </>
    );
};

export default QuestionSettingsSection;
