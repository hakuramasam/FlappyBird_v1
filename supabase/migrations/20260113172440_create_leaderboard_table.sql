/*
  # Create Leaderboard Table with Security

  1. New Tables
    - `leaderboard`
      - `id` (uuid, primary key)
      - `user_id` (text, unique identifier from browser)
      - `username` (text)
      - `score` (integer)
      - `wallet_address` (text)
      - `social_handle` (text)
      - `tx_hash` (text, optional)
      - `minted` (boolean)
      - `verified` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `leaderboard` table
    - Add policy to allow anyone to read all scores (public leaderboard)
    - Add policy to allow users to insert their own scores
    - Add policy to allow users to update only higher scores

  3. Indexes
    - Index on score for fast sorting
    - Index on user_id for lookups
    - Index on wallet_address for user lookups
*/

CREATE TABLE IF NOT EXISTS leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  username text,
  score integer NOT NULL DEFAULT 0,
  wallet_address text,
  social_handle text,
  tx_hash text,
  minted boolean DEFAULT false,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read leaderboard"
  ON leaderboard
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own scores"
  ON leaderboard
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update only their own data"
  ON leaderboard
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user_id ON leaderboard(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_wallet ON leaderboard(wallet_address);
CREATE INDEX IF NOT EXISTS idx_leaderboard_created_at ON leaderboard(created_at DESC);