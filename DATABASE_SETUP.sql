-- ============================================================================
-- WORLD CUP PREDICTOR GAME - DATABASE INITIALIZATION SCRIPT
-- Run this script in your Supabase SQL Editor to set up the schema.
-- ============================================================================

-- Clean up existing tables if they exist (CAUTION: deletes all data)
drop table if exists public.predictions;
drop table if exists public.matches;
drop table if exists public.users;

-- 1. Create the Users Table
create table public.users (
  id text primary key,
  username text not null,
  group_code text not null default 'global',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.users disable row level security;

-- 2. Create the Predictions Table (single row per user with all predictions as JSON)
create table public.predictions (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.users(id) on delete cascade not null,
  match_id text not null, -- 'all_group_stage' or specific match key
  predictions jsonb not null default '{}', -- {"HomeTeam_vs_AwayTeam": {"home_score": 2, "away_score": 1}, ...}
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_user_prediction unique (user_id, match_id)
);

alter table public.predictions disable row level security;