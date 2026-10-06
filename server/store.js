// Database access for the server, through a Supabase client created with the secret key.
// That key bypasses row-level security, so every query here is scoped to the given user id.

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export function createBattleStore(supabase) {
  return {
    async linkedNameIds(userId) {
      const rows = unwrap(await supabase.from('showdown_names').select('name_id').eq('user_id', userId));
      return new Set(rows.map(r => r.name_id));
    },

    async existingReplayIds(userId, replayIds) {
      if (!replayIds.length) return new Set();
      const rows = unwrap(await supabase.from('battles').select('replay_id').eq('user_id', userId).in('replay_id', replayIds));
      return new Set(rows.map(r => r.replay_id));
    },

    async saveBattle(userId, record) {
      return unwrap(await supabase
        .from('battles')
        .upsert({ ...record, user_id: userId }, { onConflict: 'user_id,replay_id' })
        .select()
        .single());
    },
  };
}
