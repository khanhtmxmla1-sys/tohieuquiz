DROP INDEX IF EXISTS idx_webauthn_challenges_retention;
DROP INDEX IF EXISTS idx_webauthn_challenges_owner_expiry;
DROP TABLE IF EXISTS webauthn_challenges;
DROP INDEX IF EXISTS idx_webauthn_credentials_active;
DROP INDEX IF EXISTS idx_webauthn_credentials_user_created;
DROP TABLE IF EXISTS webauthn_credentials;
