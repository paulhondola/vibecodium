-- VibeMatch persistent matching tables
-- Run this in your Supabase SQL editor (project dashboard → SQL Editor)

-- Swipes: one row per swiper/swiped pair, direction is 'left' or 'right'
create table if not exists swipes (
  id        uuid primary key default gen_random_uuid(),
  swiper_id text not null,
  swiped_id text not null,
  direction text not null check (direction in ('left', 'right')),
  created_at timestamptz default now(),
  unique (swiper_id, swiped_id)
);

create index if not exists swipes_swiper_idx on swipes(swiper_id);
create index if not exists swipes_swiped_idx on swipes(swiped_id);

-- Matches: created when both users swiped right on each other.
-- user_a_id < user_b_id always (lexicographic) for stable uniqueness.
-- is_active=false means soft-deleted (unmatched) — swipe record kept so
-- the profile never reappears in the feed.
create table if not exists matches (
  id              uuid primary key default gen_random_uuid(),
  user_a_id       text not null,
  user_b_id       text not null,
  is_active       boolean not null default true,
  user_a_last_read timestamptz,
  user_b_last_read timestamptz,
  created_at      timestamptz default now(),
  unique (user_a_id, user_b_id)
);

create index if not exists matches_user_a_idx on matches(user_a_id);
create index if not exists matches_user_b_idx on matches(user_b_id);

-- Messages: stored permanently, cascade-deleted when a match row is deleted.
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  sender_id  text not null,
  body       text not null,
  created_at timestamptz default now()
);

create index if not exists messages_match_idx on messages(match_id, created_at desc);
