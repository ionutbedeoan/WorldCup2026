import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Handle case where user inputs only the project ID
if (supabaseUrl && !supabaseUrl.startsWith('http')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`;
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing! Make sure to set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserScore {
  id: string;
  username: string;
  group_predictions: Record<string, { home_score: number; away_score: number }>;
  submitted_at: string;
}

/**
 * Ensures the user exists in the database.
 * If not, creates a new user entry.
 */
export async function ensureUserInDb(userId: string, username: string): Promise<void> {
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (fetchError) {
    // Table does not exist — throw a clear setup message
    if (fetchError.message?.includes('relation') || fetchError.message?.includes('table') || fetchError.code === '42P01') {
      throw new Error(
        'Database tables not found. Please open your Supabase SQL Editor and run the DATABASE_SETUP.sql script to create the required tables.'
      );
    }
    console.warn('Error checking user existence:', fetchError);
  }

  if (existingUser) return;

  const { error: insertError } = await supabase
    .from('users')
    .insert({ id: userId, username, group_code: 'global' });

  if (insertError) {
    if (insertError.message?.includes('relation') || insertError.message?.includes('table') || insertError.code === '42P01') {
      throw new Error(
        'Database tables not found. Please open your Supabase SQL Editor and run the DATABASE_SETUP.sql script to create the required tables.'
      );
    }
    if (insertError.code !== '23505') {
      throw insertError;
    }
  }
}

/**
 * Saves all predictions for a user as a JSON object.
 * predictions is a map of matchKey -> { home_score, away_score }
 * matchKey format: "HomeTeam_vs_AwayTeam" (e.g. "Mexico_vs_South Africa")
 */
export async function saveUserPredictions(
  userId: string,
  predictions: Record<string, { home_score: number; away_score: number }>
): Promise<void> {
  const { error } = await supabase
    .from('predictions')
    .upsert(
      {
        user_id: userId,
        match_id: 'all_group_stage',
        predictions: predictions,
      },
      { onConflict: 'user_id,match_id' }
    );

  if (error) throw error;
}

/**
 * Loads predictions for a specific user.
 * Returns a map of matchKey -> { home_score, away_score } or null if none saved.
 */
export async function getUserPredictions(
  userId: string
): Promise<Record<string, { home_score: number; away_score: number }> | null> {
  const { data, error } = await supabase
    .from('predictions')
    .select('predictions')
    .eq('user_id', userId)
    .eq('match_id', 'all_group_stage')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data.predictions as Record<string, { home_score: number; away_score: number }>;
}

/**
 * Loads all users' predictions for the leaderboard.
 */
export async function getAllUserPredictions(): Promise<{ user_id: string; predictions: Record<string, { home_score: number; away_score: number }> }[]> {
  const { data, error } = await supabase
    .from('predictions')
    .select('user_id, predictions')
    .eq('match_id', 'all_group_stage');

  if (error) throw error;
  return data || [];
}

/**
 * Fetches all users for leaderboard display.
 */
export async function getAllUsers(): Promise<{ id: string; username: string }[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, username');

  if (error) throw error;
  return data || [];
}

/**
 * Deletes all predictions for a user.
 */
export async function deleteUserPredictions(userId: string): Promise<void> {
  const { error } = await supabase
    .from('predictions')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}