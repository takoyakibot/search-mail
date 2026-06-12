-- テナントごとの除外送信者リスト + メルマガ自動除外設定
alter table tenants add column if not exists exclude_senders text[] default '{}';
alter table tenants add column if not exists skip_newsletters boolean default true;
