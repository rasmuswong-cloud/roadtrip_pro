import * as SQLite from 'expo-sqlite';
import { OFFLINE_SCHEMA_SQL } from './sqliteSchema';

const DATABASE_NAME = 'reseapp.db';

export async function openOfflineDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync(OFFLINE_SCHEMA_SQL);
  return database;
}

export async function cacheEntity(
  database: SQLite.SQLiteDatabase,
  input: {
    tableName: string;
    rowId: string;
    tripId?: string;
    payload: Record<string, unknown>;
    version: number;
    syncStatus?: 'synced' | 'pending' | 'conflict' | 'failed';
  },
): Promise<void> {
  await database.runAsync(
    `insert or replace into offline_entities
      (table_name, row_id, trip_id, payload, version, sync_status, updated_at)
     values (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.tableName,
      input.rowId,
      input.tripId ?? null,
      JSON.stringify(input.payload),
      input.version,
      input.syncStatus ?? 'synced',
      new Date().toISOString(),
    ],
  );
}
