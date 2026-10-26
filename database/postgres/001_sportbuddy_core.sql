-- SportBuddy78 Russian Data Platform
-- Migration-ready PostgreSQL schema. NOT connected to production yet.
-- Current Firebase UID values are intentionally preserved as users.id so all
-- existing references can migrate without rewriting account relationships.

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id varchar(128) PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status varchar(32) NOT NULL DEFAULT 'active',
  email_normalized varchar(320),
  display_name varchar(180),
  birth_date date,
  gender varchar(32),
  avatar_url text,
  bio text,
  district_id varchar(120),
  location_name varchar(220),
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_verified boolean NOT NULL DEFAULT false,
  subscription_plan varchar(40) NOT NULL DEFAULT 'free',
  premium_until timestamptz,
  raw_profile jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_uq
  ON users(email_normalized) WHERE email_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_identities (
  id bigserial PRIMARY KEY,
  user_id varchar(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider varchar(32) NOT NULL,
  provider_user_id varchar(320) NOT NULL,
  email_normalized varchar(320),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS user_identities_user_idx ON user_identities(user_id);

CREATE TABLE IF NOT EXISTS public_dissemination_consents (
  user_id varchar(128) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT false,
  version varchar(80) NOT NULL,
  groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  granted_at timestamptz,
  revoked_at timestamptz,
  purpose text,
  recipients text,
  conditions text,
  prohibitions text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id bigserial PRIMARY KEY,
  user_id varchar(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(80) NOT NULL,
  version varchar(80) NOT NULL,
  accepted_at timestamptz NOT NULL,
  source varchar(80),
  auth_provider varchar(40),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(user_id,kind,version)
);

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY,
  owner_user_id varchar(128) REFERENCES users(id) ON DELETE SET NULL,
  provider varchar(32) NOT NULL,
  provider_key text,
  public_url text NOT NULL,
  media_type varchar(32) NOT NULL,
  mime_type varchar(120),
  bytes bigint,
  width integer,
  height integer,
  duration_seconds numeric(12,3),
  sha256 varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  migrated_from_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS media_assets_owner_idx ON media_assets(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_provider_key_uq
  ON media_assets(provider,provider_key) WHERE provider_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS friendships (
  user_id varchar(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_user_id varchar(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,friend_user_id),
  CHECK(user_id<>friend_user_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id uuid PRIMARY KEY,
  from_user_id varchar(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id varchar(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(32) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS friend_requests_to_status_idx ON friend_requests(to_user_id,status);

CREATE TABLE IF NOT EXISTS trainings (
  id varchar(180) PRIMARY KEY,
  owner_user_id varchar(128) REFERENCES users(id) ON DELETE SET NULL,
  organizer_type varchar(32) NOT NULL DEFAULT 'user',
  title varchar(220) NOT NULL,
  sport varchar(120),
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  venue_id varchar(180),
  latitude numeric(9,6),
  longitude numeric(9,6),
  gender_filter varchar(32),
  status varchar(32) NOT NULL DEFAULT 'active',
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trainings_starts_idx ON trainings(starts_at);
CREATE INDEX IF NOT EXISTS trainings_owner_idx ON trainings(owner_user_id);

CREATE TABLE IF NOT EXISTS training_members (
  training_id varchar(180) NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  user_id varchar(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(32) NOT NULL DEFAULT 'participant',
  status varchar(32) NOT NULL DEFAULT 'joined',
  joined_at timestamptz NOT NULL DEFAULT now(),
  checked_in_at timestamptz,
  PRIMARY KEY(training_id,user_id)
);

CREATE TABLE IF NOT EXISTS feed_posts (
  id varchar(180) PRIMARY KEY,
  author_user_id varchar(128) REFERENCES users(id) ON DELETE SET NULL,
  sport_tag varchar(120),
  content text,
  media_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  legacy_media_url text,
  media_type varchar(32),
  status varchar(32) NOT NULL DEFAULT 'active',
  publication_consent_version varchar(80),
  publication_consent_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS feed_posts_created_idx ON feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS feed_posts_author_idx ON feed_posts(author_user_id);

CREATE TABLE IF NOT EXISTS feed_comments (
  id varchar(180) PRIMARY KEY,
  post_id varchar(180) NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  author_user_id varchar(128) REFERENCES users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status varchar(32) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS chats (
  id varchar(180) PRIMARY KEY,
  kind varchar(32) NOT NULL DEFAULT 'direct',
  training_id varchar(180) REFERENCES trainings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id varchar(180) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id varchar(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY(chat_id,user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id varchar(180) PRIMARY KEY,
  chat_id varchar(180) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_user_id varchar(128) REFERENCES users(id) ON DELETE SET NULL,
  content text,
  media_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL,
  deleted_at timestamptz,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS chat_messages_chat_created_idx ON chat_messages(chat_id,created_at);

CREATE TABLE IF NOT EXISTS business_legal_profiles (
  user_id varchar(128) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  entity_type varchar(40) NOT NULL,
  legal_name varchar(220) NOT NULL,
  inn varchar(12) NOT NULL,
  ogrn varchar(15),
  address text,
  email varchar(320) NOT NULL,
  phone varchar(80),
  representative varchar(180),
  basis varchar(180),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_contracts (
  id varchar(180) PRIMARY KEY,
  contract_number varchar(120) NOT NULL UNIQUE,
  contract_version varchar(120) NOT NULL,
  owner_user_id varchar(128) REFERENCES users(id) ON DELETE SET NULL,
  subject_type varchar(40),
  subject_id varchar(180),
  subject_label varchar(220),
  product varchar(80) NOT NULL,
  amount_rub numeric(14,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'RUB',
  payment_id varchar(180),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL,
  service_start timestamptz,
  service_until timestamptz,
  contract_snapshot jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_ledger (
  id varchar(220) PRIMARY KEY,
  event_type varchar(80) NOT NULL,
  owner_user_id varchar(128) REFERENCES users(id) ON DELETE SET NULL,
  subject_type varchar(40),
  subject_id varchar(180),
  amount_rub numeric(14,2),
  currency char(3) DEFAULT 'RUB',
  payment_id varchar(180),
  contract_id varchar(180) REFERENCES business_contracts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS privacy_requests (
  id uuid PRIMARY KEY,
  owner_user_id varchar(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(80) NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'received',
  details text,
  contact_email varchar(320),
  response_note text,
  reviewed_by varchar(320),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS privacy_requests_status_idx ON privacy_requests(status,created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit (
  id uuid PRIMARY KEY,
  admin_email varchar(320),
  action varchar(160) NOT NULL,
  entity_type varchar(120),
  entity_id varchar(220),
  request_id varchar(220),
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Migration bookkeeping makes every import repeatable and inspectable.
CREATE TABLE IF NOT EXISTS migration_records (
  source varchar(80) NOT NULL,
  collection_name varchar(120) NOT NULL,
  source_id varchar(220) NOT NULL,
  target_table varchar(120) NOT NULL,
  target_id varchar(220) NOT NULL,
  source_updated_at timestamptz,
  source_hash varchar(64),
  migrated_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  status varchar(32) NOT NULL DEFAULT 'migrated',
  error_text text,
  PRIMARY KEY(source,collection_name,source_id)
);

COMMIT;
