import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import {
  studentCompetitionService,
  type StudentCompetitionSummary,
} from '../../studentCompetitionService';

interface LegacyCompetitionRedirectProps {
  fallback: React.ReactNode;
}

const LegacyCompetitionRedirect: React.FC<LegacyCompetitionRedirectProps> = ({ fallback }) => {
  const [campaigns, setCampaigns] = useState<StudentCompetitionSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void studentCompetitionService.list()
      .then(items => {
        if (active) setCampaigns(items.filter(campaign => campaign.status === 'ACTIVE'));
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadFailed) {
    return <p role="alert">Không thể tải danh sách cuộc thi. Vui lòng thử lại sau.</p>;
  }
  if (campaigns === null) {
    return <p role="status">Đang tải danh sách cuộc thi…</p>;
  }
  if (campaigns.length === 0) {
    return <p>Hiện chưa có cuộc thi đang hoạt động.</p>;
  }
  if (campaigns.some(campaign => !campaign.slug)) {
    return <>{fallback}</>;
  }
  if (campaigns.length === 1) {
    return <Navigate to={`/thi/${encodeURIComponent(campaigns[0].slug!)}`} replace />;
  }

  return (
    <main>
      <h1>Chọn cuộc thi</h1>
      <ul>
        {campaigns.map(campaign => (
          <li key={campaign.id}>
            <Link to={`/thi/${encodeURIComponent(campaign.slug!)}`}>{campaign.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
};

export default LegacyCompetitionRedirect;
