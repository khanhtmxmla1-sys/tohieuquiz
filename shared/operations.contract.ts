export type OperationsComponentStatus = 'healthy' | 'degraded' | 'unavailable' | 'unknown';

export type OperationsComponentId =
  | 'api'
  | 'd1'
  | 'migrations'
  | 'queue'
  | 'dlq'
  | 'r2'
  | 'ai'
  | 'certificates'
  | 'backup'
  | 'feature_flags';

export interface OperationsMetric {
  key: string;
  value: number | string | boolean | null;
}

export interface OperationsComponent {
  id: OperationsComponentId;
  label: string;
  status: OperationsComponentStatus;
  checkedAt: string;
  latencyMs: number;
  summary: string;
  code?: string;
  metrics: OperationsMetric[];
}

export interface OperationsSnapshot {
  overallStatus: OperationsComponentStatus;
  checkedAt: string;
  requestId: string;
  release: string;
  components: OperationsComponent[];
}

export interface OperationsSnapshotResponse {
  status: 'success';
  data: OperationsSnapshot;
}
