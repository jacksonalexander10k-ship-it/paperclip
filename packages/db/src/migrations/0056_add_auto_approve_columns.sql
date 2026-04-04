ALTER TABLE approvals ADD COLUMN IF NOT EXISTS auto_approved boolean DEFAULT false;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS auto_approve_reason text;