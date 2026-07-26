import { Card } from '../../common';

export const ResultsEmptyState = () => (
  <Card>
    <div className="text-center py-12">
      <div className="text-6xl mb-4">📊</div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">Chưa có kết quả</h3>
      <p className="text-gray-500">
        Chưa có học sinh nào làm bài hoặc không tìm thấy kết quả phù hợp với bộ lọc.
      </p>
    </div>
  </Card>
);
