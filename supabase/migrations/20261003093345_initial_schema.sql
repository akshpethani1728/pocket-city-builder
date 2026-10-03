-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles table (public info, linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  player_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cities table (one per user for now)
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_name TEXT NOT NULL DEFAULT 'New Haven',
  era TEXT NOT NULL DEFAULT 'settlement',
  coins BIGINT NOT NULL DEFAULT 10000,
  population BIGINT NOT NULL DEFAULT 5,
  housing_capacity BIGINT NOT NULL DEFAULT 0,
  population_progress NUMERIC DEFAULT 0,
  age_sec BIGINT NOT NULL DEFAULT 0,
  satisfaction NUMERIC NOT NULL DEFAULT 0,
  highest_stage_id TEXT NOT NULL DEFAULT 'settlement',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buildings table (individual instances)
CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  x INT NOT NULL,
  y INT NOT NULL,
  level INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Technologies (per city)
CREATE TABLE IF NOT EXISTS city_technologies (
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  tech_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (city_id, tech_id)
);

-- Achievements (per city)
CREATE TABLE IF NOT EXISTS city_achievements (
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  progress NUMERIC DEFAULT 0,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (city_id, achievement_id)
);

-- Unlocks (per city, derived but cached for convenience)
CREATE TABLE IF NOT EXISTS city_unlocks (
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  unlock_id TEXT NOT NULL,
  PRIMARY KEY (city_id, unlock_id)
);

-- Map state (which expansion zones are unlocked)
CREATE TABLE IF NOT EXISTS city_map (
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  unlocked_expansion_ids TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (city_id)
);

-- Friendships
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id)
);

-- Transactions (fund transfers, append-only)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL,
  type TEXT NOT NULL DEFAULT 'gift' CHECK (type IN ('gift', 'tax_adjust', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- profiles: public read username/avatar/player_code, owner full
CREATE POLICY profiles_select_public ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert_owner ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_update_owner ON profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- cities: owner full access
CREATE POLICY cities_all_owner ON cities FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- buildings: owner via city
CREATE POLICY buildings_all_owner ON buildings FOR ALL USING (
  EXISTS (SELECT 1 FROM cities WHERE cities.id = buildings.city_id AND cities.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM cities WHERE cities.id = buildings.city_id AND cities.owner_id = auth.uid())
);

-- city_technologies: owner via city
CREATE POLICY city_tech_all_owner ON city_technologies FOR ALL USING (
  EXISTS (SELECT 1 FROM cities WHERE cities.id = city_technologies.city_id AND cities.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM cities WHERE cities.id = city_technologies.city_id AND cities.owner_id = auth.uid())
);

-- city_achievements: owner via city
CREATE POLICY city_ach_all_owner ON city_achievements FOR ALL USING (
  EXISTS (SELECT 1 FROM cities WHERE cities.id = city_achievements.city_id AND cities.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM cities WHERE cities.id = city_achievements.city_id AND cities.owner_id = auth.uid())
);

-- city_unlocks: owner via city
CREATE POLICY city_unlocks_all_owner ON city_unlocks FOR ALL USING (
  EXISTS (SELECT 1 FROM cities WHERE cities.id = city_unlocks.city_id AND cities.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM cities WHERE cities.id = city_unlocks.city_id AND cities.owner_id = auth.uid())
);

-- city_map: owner via city
CREATE POLICY city_map_all_owner ON city_map FOR ALL USING (
  EXISTS (SELECT 1 FROM cities WHERE cities.id = city_map.city_id AND cities.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM cities WHERE cities.id = city_map.city_id AND cities.owner_id = auth.uid())
);

-- friendships: involved users can read, requester can insert, addressee can update (accept)
CREATE POLICY friendships_select_involved ON friendships FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = addressee_id
);
CREATE POLICY friendships_insert_requester ON friendships FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY friendships_update_addressee ON friendships FOR UPDATE USING (auth.uid() = addressee_id) WITH CHECK (auth.uid() = addressee_id);

-- transactions: involved users can read
CREATE POLICY transactions_select_involved ON transactions FOR SELECT USING (
  auth.uid() = from_user_id OR auth.uid() = to_user_id
);

-- Helper functions
-- Update updated_at on city changes
CREATE OR REPLACE FUNCTION update_city_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_city_updated_at
BEFORE UPDATE ON cities FOR EACH ROW
EXECUTE FUNCTION update_city_updated_at();

-- Secure fund transfer (atomic, with balance check)
CREATE OR REPLACE FUNCTION transfer_funds(p_to_user_id UUID, p_amount BIGINT, p_idempotency_key UUID, p_type TEXT DEFAULT 'gift')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_from_city RECORD;
  v_to_city RECORD;
  v_tx_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF auth.uid() = p_to_user_id THEN
    RAISE EXCEPTION 'Cannot send to yourself';
  END IF;

  -- Lock both cities in consistent order to avoid deadlock
  SELECT * INTO v_from_city FROM cities WHERE owner_id = auth.uid() FOR UPDATE;
  SELECT * INTO v_to_city FROM cities WHERE owner_id = p_to_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipient city not found';
  END IF;

  IF v_from_city.coins < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Check idempotency
  IF EXISTS (SELECT 1 FROM transactions WHERE id = p_idempotency_key) THEN
    RETURN jsonb_build_object('status', 'duplicate', 'transaction_id', p_idempotency_key);
  END IF;

  UPDATE cities SET coins = coins - p_amount WHERE id = v_from_city.id;
  UPDATE cities SET coins = coins + p_amount WHERE id = v_to_city.id;

  INSERT INTO transactions (id, from_user_id, to_user_id, amount, type)
  VALUES (p_idempotency_key, auth.uid(), p_to_user_id, p_amount, p_type);

  RETURN jsonb_build_object('status', 'ok', 'new_balance', v_from_city.coins - p_amount);
END;
$$;

-- Auto-create city on first signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO profiles (user_id, username, avatar_url, player_code)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'Player' || SUBSTRING(NEW.id::TEXT, 1, 6)), NULL, 'PKT-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 4)))
  ON CONFLICT DO NOTHING;

  INSERT INTO cities (owner_id, city_name, era, coins, population, housing_capacity, population_progress, age_sec, satisfaction, highest_stage_id)
  VALUES (NEW.id, 'New Haven', 'settlement', 10000, 5, 0, 0, 0, 0, 'settlement')
  ON CONFLICT DO NOTHING;

  INSERT INTO city_map (city_id, unlocked_expansion_ids)
  SELECT id, '{}'::TEXT[] FROM cities WHERE owner_id = NEW.id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_buildings_city_id ON buildings(city_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_user_id);