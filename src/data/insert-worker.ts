import { parentPort } from 'worker_threads';
import { ClickHouseDatabase } from '../database/clickhouse';
import { PostgreSQLDatabase } from '../database/postgresql';
import { InsertJob, InsertResult } from './inserter';
import { DATABASE_TYPES } from '../constants/database';

// Worker thread for parallel insertion
async function processInsertJob(job: InsertJob): Promise<InsertResult> {
  const { records, database, jobId, dbConfig } = job;
  let db: ClickHouseDatabase | PostgreSQLDatabase | null = null;
  
  try {
    if (database === DATABASE_TYPES.CLICKHOUSE) {
      db = new ClickHouseDatabase();
      await db.connect();
    } else {
      db = new PostgreSQLDatabase(dbConfig);
      await db.connect();
    }

    const startTime = Date.now();
    await db.insertBatch(records);
    const duration = Date.now() - startTime;

    return {
      jobId,
      success: true,
      duration
    };
  } catch (error) {
    return {
      jobId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: 0
    };
  } finally {
    // Always disconnect, even on error
    if (db) {
      try {
        await db.disconnect();
      } catch (disconnectError) {
        // Log but don't throw - connection may already be closed
        console.error(`Worker ${jobId}: Error disconnecting: ${disconnectError}`);
      }
    }
  }
}

// Listen for jobs
if (parentPort) {
  parentPort.on('message', async (job: InsertJob) => {
    const result = await processInsertJob(job);
    parentPort!.postMessage(result);
  });
}