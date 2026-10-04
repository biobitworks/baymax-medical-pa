CREATE SEQUENCE IF NOT EXISTS baymax_care_workspace_revision_seq;
ALTER TABLE baymax_care_workspaces ALTER COLUMN revision TYPE bigint;
SELECT setval('baymax_care_workspace_revision_seq', GREATEST(
  (SELECT last_value FROM baymax_care_workspace_revision_seq),
  (SELECT COALESCE(MAX(revision), 0) FROM baymax_care_workspaces)
), true);
ALTER TABLE baymax_care_workspaces ALTER COLUMN revision SET DEFAULT nextval('baymax_care_workspace_revision_seq');
