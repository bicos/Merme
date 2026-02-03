-- Enable Row Level Security (RLS) is recommended but for this prototype we can start open
-- Drop tables if they exist to start fresh (Optional, be careful)
-- DROP TABLE IF EXISTS messages;
-- DROP TABLE IF EXISTS players;
-- DROP TABLE IF EXISTS rooms;

-- 1. Rooms Table
create table rooms (
  code text primary key,
  host_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text default 'waiting' check (status in ('waiting', 'generating', 'playing', 'voting', 'ended')),
  settings jsonb not null default '{}'::jsonb,
  scenario jsonb,
  votes jsonb default '{}'::jsonb
);

-- 2. Players Table
create table players (
  id uuid default gen_random_uuid() primary key,
  room_code text references rooms(code) on delete cascade not null,
  session_id text not null, -- Socket ID replacement (client generated UUID)
  nickname text not null,
  is_host boolean default false,
  character_index integer,
  is_ready boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(room_code, nickname)
);

-- 3. Messages Table
create table messages (
  id uuid default gen_random_uuid() primary key,
  room_code text references rooms(code) on delete cascade not null,
  player_id text not null,
  nickname text not null,
  character_name text,
  character_emoji text,
  content text not null,
  as_character boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Realtime for these tables
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table messages;

-- Optional: RLS Policies (Open for now to simplify, lock down later)
alter table rooms enable row level security;
create policy "Public access to rooms" on rooms for all using (true) with check (true);

alter table players enable row level security;
create policy "Public access to players" on players for all using (true) with check (true);

alter table messages enable row level security;
create policy "Public access to messages" on messages for all using (true) with check (true);
