-- Local development seed. Applied only by `supabase db reset` on the local stack;
-- `supabase db push` never runs seeds against the hosted project.

-- Development user for the local login flow: dev@baru.local / baru-dev-123
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current
)
values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'dev@baru.local',
  extensions.crypt('baru-dev-123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"display_name": "Dev Local"}',
  now(),
  now(),
  '',
  '',
  '',
  '',
  ''
);

insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'email',
  '{"sub": "00000000-0000-4000-8000-000000000001", "email": "dev@baru.local", "email_verified": true}',
  now(),
  now(),
  now()
);
