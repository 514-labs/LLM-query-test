import { parentPort } from 'worker_threads';
import { ClickHouseDatabase } from './database/clickhouse';
import { PostgreSQLDatabase } from './database/postgresql';
import { InsertJob, InsertResult } from './parallel-inserter';

// Worker thread for parallel insertion
async function processInsertJob(job: InsertJob): Promise<InsertResult> {
  const { records, database, jobId, dbConfig } = job;
  
  try {
    let db: ClickHouseDatabase | PostgreSQLDatabase;
    
    if (database === 'clickhouse') {
      db = new ClickHouseDatabase();
      await db.connect();
    } else {
      db = new PostgreSQLDatabase(dbConfig);
      await db.connect();
    }

    const startTime = Date.now();
    await db.insertBatch(records);
    const duration = Date.now() - startTime;

    await db.disconnect();

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
  }
}

// Listen for jobs
if (parentPort) {
  parentPort.on('message', async (job: InsertJob) => {
    const result = await processInsertJob(job);
    parentPort!.postMessage(result);
  });
}