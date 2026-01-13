import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getLeaderboard() {
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Unexpected error fetching leaderboard:', err);
    return [];
  }
}

export async function saveScore(userId, username, score, walletAddress, socialHandle) {
  try {
    const { data: existing } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let result;
    if (existing) {
      if (score <= existing.score) {
        return { success: false, error: 'Score not higher than existing score' };
      }
      result = await supabase
        .from('leaderboard')
        .update({
          score: score,
          wallet_address: walletAddress || 'Not Connected',
          social_handle: socialHandle || 'Anonymous',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select();
    } else {
      result = await supabase
        .from('leaderboard')
        .insert([
          {
            user_id: userId,
            username: username,
            score: score,
            wallet_address: walletAddress || 'Not Connected',
            social_handle: socialHandle || 'Anonymous',
            minted: false,
            verified: false,
          },
        ])
        .select();
    }

    if (result.error) {
      console.error('Error saving score:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true, data: result.data };
  } catch (err) {
    console.error('Unexpected error saving score:', err);
    return { success: false, error: err.message };
  }
}

export async function verifyScoreOnChain(verifyData) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/verify_score`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verifyData),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Verification failed' };
    }

    return { success: true, data: result };
  } catch (err) {
    console.error('Error verifying score:', err);
    return { success: false, error: err.message };
  }
}

export function subscribeToLeaderboard(callback) {
  const subscription = supabase
    .from('leaderboard')
    .on('*', (payload) => {
      callback(payload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Subscribed to leaderboard updates');
      }
    });

  return subscription;
}
