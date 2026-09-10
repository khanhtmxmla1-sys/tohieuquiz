CREATE TABLE IF NOT EXISTS competition_school_exam_admissions (
  campaign_id TEXT NOT NULL,
  eligibility_snapshot_version INTEGER NOT NULL CHECK (eligibility_snapshot_version > 0),
  student_id TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, eligibility_snapshot_version, student_id),
  FOREIGN KEY (campaign_id, eligibility_snapshot_version, student_id)
    REFERENCES competition_eligibility(campaign_id, eligibility_snapshot_version, student_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_competition_school_exam_admissions_snapshot
  ON competition_school_exam_admissions(campaign_id, eligibility_snapshot_version, approved_at, student_id);
