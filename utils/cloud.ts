import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { BackupData } from './backup';

/**
 * Optional cloud sync via Supabase.
 *
 * The whole vault is stored as ONE jsonb document per user (last write wins,
 * newer `updatedAt` decides). That is plenty for a single owner using the app
 * from a phone and a laptop, and keeps conflict handling trivial.
 *
 * When the env vars are missing the app behaves exactly as before — pure
 * localStorage, no cloud UI at all.
 *
 * Required setup (one time):
 *   1. Project at supabase.com → Settings → API: copy URL + anon key.
 *   2. Env vars (locally in .env.local, on Vercel in Project Settings → Environment Variables):
 *        VITE_SUPABASE_URL=...
 *        VITE_SUPABASE_ANON_KEY=...
 *   3. SQL editor → run:
 *        create table vault (
 *          user_id uuid primary key references auth.users(id) on delete cascade,
 *          doc jsonb not null,
 *          updated_at bigint not null
 *        );
 *        alter table vault enable row level security;
 *        create policy "own vault" on vault for all
 *          using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *   4. Authentication → Users → Add user (email + password для владельца).
 */

// People often paste the Data API URL (…/rest/v1/) from the dashboard —
// normalize to the project origin so auth and storage paths stay correct.
const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const url = rawUrl ? rawUrl.replace(/\/(rest|auth|storage)\/v\d+\/?$/, '').replace(/\/+$/, '') : undefined;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isCloudConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (!isCloudConfigured) return null;
  if (!client) client = createClient(url!, anonKey!);
  return client;
}

export interface CloudDoc {
  data: BackupData;
  updatedAt: number;
}

export async function cloudGetSession(): Promise<Session | null> {
  const c = getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session;
}

export function cloudOnAuthChange(cb: (session: Session | null) => void): () => void {
  const c = getClient();
  if (!c) return () => {};
  const { data } = c.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function cloudSignIn(email: string, password: string): Promise<{ error?: string }> {
  const c = getClient();
  if (!c) return { error: 'Облако не настроено' };
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message === 'Invalid login credentials' ? 'Неверный email или пароль' : error.message };
  return {};
}

export async function cloudSignOut(): Promise<void> {
  await getClient()?.auth.signOut();
}

export interface CloudLoadResult {
  doc: CloudDoc | null;
  error?: string; // human-readable reason when the read itself failed
}

export async function cloudLoad(): Promise<CloudLoadResult> {
  const c = getClient();
  if (!c || !url || !anonKey) return { doc: null, error: 'облако не настроено' };
  const { data: sess } = await c.auth.getSession();
  const token = sess.session?.access_token;
  const userId = sess.session?.user.id;
  if (!token || !userId) return { doc: null, error: 'сессия истекла — выйдите из облака и войдите заново' };
  try {
    // Cache-buster: iOS (especially installed PWAs) aggressively caches GET
    // responses and can keep returning a stale cloud copy. An extra filter
    // that is ALWAYS true but changes on every call makes each request URL
    // unique, so the HTTP cache can never answer it. updated_at is an epoch
    // in ms (~1.7e12), while the buster stays below 86 400 000.
    const buster = Date.now() % 86400000;
    const { data, error } = await c
      .from('vault')
      .select('doc, updated_at')
      .eq('user_id', userId)
      .gte('updated_at', buster)
      .maybeSingle();
    if (error) return { doc: null, error: error.message };
    if (!data) return { doc: null }; // записи для этого пользователя нет
    return { doc: { data: data.doc as BackupData, updatedAt: Number(data.updated_at) } };
  } catch {
    return { doc: null, error: 'нет связи с сервером' };
  }
}

export async function cloudSave(doc: CloudDoc): Promise<{ error?: string }> {
  const c = getClient();
  if (!c) return { error: 'Облако не настроено' };
  const { data: sess } = await c.auth.getSession();
  const userId = sess.session?.user.id;
  if (!userId) return { error: 'Нет входа' };
  const { error } = await c.from('vault').upsert({ user_id: userId, doc: doc.data, updated_at: doc.updatedAt });
  return error ? { error: error.message } : {};
}
