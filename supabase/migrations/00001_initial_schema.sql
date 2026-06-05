-- テナント（会社）管理
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique,
  plan text default 'free',
  email_limit integer default 500,
  created_at timestamptz default now(),
  stripe_customer_id text
);

-- ユーザー（Supabase Auth と連携）
create table profiles (
  id uuid primary key references auth.users(id),
  tenant_id uuid references tenants(id),
  name text,
  role text default 'member',
  created_at timestamptz default now()
);

-- メールデータ
create table mails (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  message_id text unique,
  subject text,
  sender text,
  sender_name text,
  received_at timestamptz,
  body_text text,
  body_summary text,
  category text,
  priority text,
  related_people text[],
  action_required boolean default false,
  status text default '未処理',
  tags text[],
  ai_raw_response jsonb,
  created_at timestamptz default now()
);

-- 添付ファイル管理
create table attachments (
  id uuid primary key default gen_random_uuid(),
  mail_id uuid references mails(id),
  tenant_id uuid references tenants(id),
  file_name text,
  file_type text,
  storage_path text,
  extracted_text text,
  structured_data jsonb,
  person_name text,
  skills text[],
  available_from date,
  status text default 'pending',
  created_at timestamptz default now()
);

-- インデックス
create index idx_mails_tenant_id on mails(tenant_id);
create index idx_mails_category on mails(category);
create index idx_mails_priority on mails(priority);
create index idx_mails_status on mails(status);
create index idx_mails_received_at on mails(received_at desc);
create index idx_mails_message_id on mails(message_id);
create index idx_attachments_mail_id on attachments(mail_id);
create index idx_attachments_tenant_id on attachments(tenant_id);

-- RLS (Row Level Security) 設定
alter table tenants enable row level security;
alter table profiles enable row level security;
alter table mails enable row level security;
alter table attachments enable row level security;

create policy "テナントごとにデータ分離" on mails
  using (tenant_id = (
    select tenant_id from profiles where id = auth.uid()
  ));

create policy "テナントごとにデータ分離" on attachments
  using (tenant_id = (
    select tenant_id from profiles where id = auth.uid()
  ));

create policy "自分のプロフィールのみ参照" on profiles
  using (id = auth.uid());

create policy "所属テナントのみ参照" on tenants
  using (id = (
    select tenant_id from profiles where id = auth.uid()
  ));
