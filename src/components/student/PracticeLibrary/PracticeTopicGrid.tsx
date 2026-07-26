import type { PracticeTopicSummary } from '../../HomePage/student-dashboard/dashboard.types';
import { normalizePracticeTopic } from '../../../features/student-dashboard/model';
import { PracticeSearchEmptyState } from './PracticeLibraryStates';
import TopicCard from './TopicCard';

interface PracticeTopicGridProps {
  topics: PracticeTopicSummary[];
  searchQuery: string;
  startingTopic: string | null;
  onStartTopic: (topic: string) => void;
}

export const PracticeTopicGrid = ({
  topics,
  searchQuery,
  startingTopic,
  onStartTopic,
}: PracticeTopicGridProps) => {
  const trimmedQuery = searchQuery.trim();
  const normalizedQuery = trimmedQuery ? normalizePracticeTopic(trimmedQuery) : '';
  const filteredTopics = normalizedQuery
    ? topics.filter(topic => normalizePracticeTopic(topic.name).includes(normalizedQuery))
    : topics;

  if (filteredTopics.length === 0) {
    return <PracticeSearchEmptyState query={trimmedQuery} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filteredTopics.map(topic => (
        <TopicCard
          key={topic.name}
          topic={topic.name}
          count={topic.count}
          isStarting={startingTopic === topic.name}
          onClick={onStartTopic}
        />
      ))}
    </div>
  );
};
