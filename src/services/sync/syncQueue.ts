import { supabase } from '@/services/supabaseClient';
import type { ConflictRecord, PendingMutation } from './types';

export type SyncQueueResult =
  | { status: 'synced'; mutationId: string }
  | { status: 'conflict'; conflict: ConflictRecord }
  | { status: 'failed'; mutationId: string; error: Error };

export async function flushMutation(mutation: PendingMutation): Promise<SyncQueueResult> {
  try {
    if (mutation.operation === 'delete') {
      const { error } = await supabase
        .from(mutation.table)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', mutation.rowId);

      if (error) {
        throw error;
      }

      return { status: 'synced', mutationId: mutation.id };
    }

    const writePayload = { ...mutation.payload, id: mutation.rowId };

    const query =
      mutation.operation === 'insert'
        ? supabase.from(mutation.table).insert(writePayload)
        : supabase.from(mutation.table).update(writePayload).eq('id', mutation.rowId);

    if (mutation.operation === 'update' && mutation.baseVersion !== undefined) {
      query.eq('version', mutation.baseVersion);
    }

    const { data, error } = await query.select('id');

    if (error) {
      throw error;
    }

    if (mutation.operation === 'update' && (data?.length ?? 0) === 0) {
      const { data, error: fetchError } = await supabase.from(mutation.table).select('*').eq('id', mutation.rowId).single();
      if (fetchError) {
        throw fetchError;
      }

      return {
        status: 'conflict',
        conflict: {
          mutation,
          serverPayload: data as Record<string, unknown>,
          detectedAt: new Date().toISOString(),
        },
      };
    }

    return { status: 'synced', mutationId: mutation.id };
  } catch (error) {
    return {
      status: 'failed',
      mutationId: mutation.id,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
