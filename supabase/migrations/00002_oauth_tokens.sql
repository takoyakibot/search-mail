-- OAuth トークン管理（リフレッシュトークン保存用）
create table oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  user_id uuid references auth.users(id) not null,
  provider text not null, -- 'google' | 'microsoft'
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, provider)
);

alter table oauth_tokens enable row level security;

create policy "テナントごとにデータ分離" on oauth_tokens
  using (tenant_id = (
    select tenant_id from profiles where id = auth.uid()
  ));
