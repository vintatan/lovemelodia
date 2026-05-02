-- OTP store for WhatsApp login — shared across all Cloud Run instances
-- Replaces in-memory Map that breaks with multiple instances

CREATE TABLE IF NOT EXISTS otp_store (
  phone      TEXT PRIMARY KEY,
  otp        TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Auto-clean expired OTPs so the table stays tiny
CREATE OR REPLACE FUNCTION delete_expired_otps() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM otp_store WHERE expires_at < NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_expired_otps ON otp_store;
CREATE TRIGGER trg_delete_expired_otps
  AFTER INSERT ON otp_store
  EXECUTE FUNCTION delete_expired_otps();
