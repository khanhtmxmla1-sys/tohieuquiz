import { useEffect, useState } from 'react';
import type { PublicCompetitionSummaryDto } from '../../../../../shared/competition-portal.contract';
import { publicCompetitionPortalService } from './publicCompetitionPortalService';
import CompetitionIndexView from './CompetitionIndexView';

const CompetitionIndexPage = () => {
  const [items, setItems] = useState<PublicCompetitionSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    void publicCompetitionPortalService.listCompetitions()
      .then((competitions) => {
        if (!active) return;
        setItems(competitions);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <CompetitionIndexView
      items={items}
      loading={loading}
      failed={failed}
      onRetry={() => setReloadKey((value) => value + 1)}
    />
  );
};

export default CompetitionIndexPage;
