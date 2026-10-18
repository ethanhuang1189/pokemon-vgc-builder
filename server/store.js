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

    /** Replays already imported or skipped (out of `replayIds`). */
    async handledReplayIds(userId, replayIds) {
      if (!replayIds.length) return new Set();
      const ids = (table) => supabase.from(table).select('replay_id').eq('user_id', userId).in('replay_id', replayIds);
      const [imported, skipped] = await Promise.all([ids('battles'), ids('skipped_replays')]);
      return new Set([...unwrap(imported), ...unwrap(skipped)].map(r => r.replay_id));
    },

    /** Up to `limit` imported battles written by a parser older than `version`. */
    async outdatedReplayIds(userId, version, limit) {
      const rows = unwrap(await supabase.from('battles').select('replay_id')
        .eq('user_id', userId).lt('parse_version', version).limit(limit));
      return rows.map(r => r.replay_id);
    },

    /** Records that a battle was re-read (even if its replay is gone), so it isn't retried. */
    async markParsed(userId, replayId, version) {
      unwrap(await supabase.from('battles').update({ parse_version: version }).eq('user_id', userId).eq('replay_id', replayId));
    },

    async skipReplay(userId, replayId, reason) {
      unwrap(await supabase.from('skipped_replays').upsert({ user_id: userId, replay_id: replayId, reason: reason.slice(0, 200) }));
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

/** The Top Teams collector's tables (see supabase/migrations/0005_ladder.sql). */
export function createLadderStore(supabase) {
  return {
    async getState(formatId) {
      return unwrap(await supabase.from('ladder_state').select('newest, scan_top, scan_cursor').eq('format_id', formatId).maybeSingle());
    },

    async setState(formatId, { newest, scan_top, scan_cursor }) {
      unwrap(await supabase.from('ladder_state')
        .upsert({ format_id: formatId, newest, scan_top, scan_cursor, updated_at: new Date().toISOString() }));
    },

    /** Replays (out of `replayIds`) that already have rows. */
    async knownReplayIds(replayIds) {
      if (!replayIds.length) return new Set();
      const rows = unwrap(await supabase.from('ladder_entries').select('replay_id').in('replay_id', replayIds));
      return new Set(rows.map(r => r.replay_id));
    },

    async saveEntries(entries) {
      unwrap(await supabase.from('ladder_entries').upsert(entries, { onConflict: 'replay_id,side' }));
    },

    async refreshStats() {
      unwrap(await supabase.rpc('refresh_ladder_stats'));
    },
  };
}
