-- MyCapital database schema for Supabase
-- Run this entire script in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null default 'بانکی',
  balance numeric(20,2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  amount numeric(20,2) not null check (amount > 0),
  title text not null,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "Users manage their own accounts" on public.accounts;
create policy "Users manage their own accounts"
on public.accounts for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage their own transactions" on public.transactions;
create policy "Users manage their own transactions"
on public.transactions for all to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.accounts a
    where a.id = account_id and a.user_id = auth.uid()
  )
);

grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

-- Futures trade journal (crypto only). Each user can access only their own trades.
create table if not exists public.futures_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('long', 'short')),
  entry_price numeric(30,10) not null check (entry_price > 0),
  exit_price numeric(30,10) check (exit_price is null or exit_price > 0),
  stop_loss numeric(30,10) check (stop_loss is null or stop_loss > 0),
  take_profit numeric(30,10) check (take_profit is null or take_profit > 0),
  quantity numeric(30,10) not null default 1 check (quantity > 0),
  leverage numeric(10,2) not null default 1 check (leverage >= 1),
  entry_at timestamptz not null default now(),
  exit_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  constraint futures_trade_status_check check (
    (status = 'open' and exit_price is null and exit_at is null)
    or (status = 'closed' and exit_price is not null and exit_at is not null)
  )
);

alter table public.futures_trades enable row level security;
drop policy if exists "Users manage their own futures trades" on public.futures_trades;
create policy "Users manage their own futures trades"
on public.futures_trades for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.futures_trades to authenticated;
create index if not exists futures_trades_user_created_idx
on public.futures_trades (user_id, created_at desc);
