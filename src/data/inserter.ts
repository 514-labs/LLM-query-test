import { Worker } from 'worker_threads';
import * as path from 'path';
import { AircraftTrackingRecord } from './generator';
import { MemoryMonitor } from '../reporting/progress-reporter';
import { ProgressReporter, Logger } from '../reporting/progress-reporter';
import { DATABASE_TYPES, DatabaseType, getDatabaseDisplayName } from '../constants/database';

export interface InsertJob {
  records: AircraftTrackingRecord[];
  database: DatabaseType;
  jobId: number;
  dbConfig?: any; // Configuration for PostgreSQL instances
}

export interface InsertResult {
  jobId: number;
  success: boolean;
  error?: string;
  duration: number;
}

export class ParallelInserter {
  private workers: Worker[] = [];
  private workerPool: Worker[] = [];
  private maxWorkers: number;
  private createdWorkers = 0;
  
  constructor(private workerCount: number = 4) {
    this.maxWorkers = workerCount;
    Logger.verbose(`Initializing parallel inserter with up to ${workerCount} workers`);
  }

  async initialize(): Promise<void> {
    Logger.verbose(`Parallel inserter ready (lazy worker creation enabled)`);
    // Workers will be created on-demand to save memory
  }

  async cleanup(): Promise<void> {
    // Terminate all workers
    await Promise.all(this.workers.map(worker => worker.terminate()));
    await Promise.all(this.workerPool.map(worker => worker.terminate()));
    this.workers = [];
    this.workerPool = [];
  }

  private async createWorker(): Promise<Worker> {
    const fs = require('fs');
    
    // Worker threads require compiled JS files - determine correct path
    let workerPath: string;
    
    // Check if we're in development mode with ts-node
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         process.argv[0].includes('ts-node') ||
                         process.argv.some(arg => arg.includes('ts-node'));
    
    if (isDevelopment) {
      // In development, use the built version from dist/
      const distWorkerPath = path.resolve(__dirname, '../dist/insert-worker.js');
      
      if (!fs.existsSync(distWorkerPath)) {
        throw new Error(
          `Development mode requires built worker file. Run 'npm run build' first, then use 'npm run dev'. ` +
          `Missing file: ${distWorkerPath}`
        );
      }
      workerPath = distWorkerPath;
    } else {
      // In production, use the worker file in the same directory
      workerPath = path.join(__dirname, 'insert-worker.js');
      
      if (!fs.existsSync(workerPath)) {
        throw new Error(`Worker file not found: ${workerPath}`);
      }
    }
    
    Logger.verbose(`Creating worker with path: ${workerPath} (development: ${isDevelopment})`);
    
    const worker = new Worker(workerPath);
    
    // Configurable timeout (default 15s, can be set via env var)
    const timeoutMs = parseInt(process.env.WORKER_TIMEOUT_MS || '15000');
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Worker initialization timeout after ${timeoutMs}ms. Try increasing WORKER_TIMEOUT_MS environment variable.`));
      }, timeoutMs);
      
      worker.once('online', () => {
        clearTimeout(timeout);
        Logger.verbose(`Worker initialized successfully: ${workerPath}`);
        resolve(worker);
      });
      
      worker.once('error', (error) => {
        clearTimeout(timeout);
        const errorMsg = `Worker initialization failed: ${error instanceof Error ? error.message : String(error)} (Path: ${workerPath})`;
        Logger.error(errorMsg);
        reject(new Error(errorMsg));
      });
    });
  }

  async insertBatchParallel(
    records: AircraftTrackingRecord[], 
    database: DatabaseType,
    batchSize: number = 50000,
    suppressOutput: boolean = false,
    dbConfig?: any
  ): Promise<void> {
    const startTime = Date.now();
    const totalRecords = records.length;
    const batches: AircraftTrackingRecord[][] = [];
    
    // Split into batches
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    if (!suppressOutput) {
      Logger.verbose(`Split ${totalRecords.toLocaleString()} records into ${batches.length} batches`);
      Logger.verbose(`Processing with ${this.workerCount} parallel workers...`);
    }

    let completedBatches = 0;
    let batchIndex = 0;
    
    // Process batches with limited concurrency
    const processBatchWithWorker = async (): Promise<void> => {
      while (batchIndex < batches.length) {
        const currentIndex = batchIndex++;
        const batch = batches[currentIndex];
        
        try {
          const result = await this.processBatch(batch, database, currentIndex, dbConfig);
          
          if (!result.success) {
            throw new Error(`Batch ${currentIndex} failed: ${result.error}`);
          }
          
          completedBatches++;
          if (!suppressOutput) {
            const progress = (completedBatches / batches.length * 100).toFixed(1);
            const elapsed = Date.now() - startTime;
            const rate = (completedBatches * batchSize) / (elapsed / 1000);
            Logger.verbose(`Batch ${completedBatches}/${batches.length} (${progress}%) - ${rate.toFixed(0)} records/sec`);
          }
          
          // Memory check every 10 batches
          if (completedBatches % 10 === 0) {
            MemoryMonitor.checkMemoryUsage();
          }
        } catch (error) {
          throw error;
        }
      }
    };

    // Start workers up to the worker count
    const workerPromises: Promise<void>[] = [];
    for (let i = 0; i < Math.min(this.workerCount, batches.length); i++) {
      workerPromises.push(processBatchWithWorker());
    }

    // Wait for all workers to complete
    try {
      await Promise.all(workerPromises);
    } catch (error) {
      Logger.error(`Parallel insertion failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }

    if (!suppressOutput) {
      const totalTime = Date.now() - startTime;
      const totalRate = totalRecords / (totalTime / 1000);
      Logger.info(`Parallel insertion complete: ${totalRecords.toLocaleString()} records in ${(totalTime/1000).toFixed(1)}s (${totalRate.toFixed(0)} records/sec)`);
    }
  }

  private async processBatch(
    records: AircraftTrackingRecord[], 
    database: DatabaseType,
    jobId: number,
    dbConfig?: any
  ): Promise<InsertResult> {
    // Wait for an available worker
    const worker = await this.getAvailableWorker();
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeout = setTimeout(() => {
        this.releaseWorker(worker);
        reject(new Error(`Job ${jobId} timed out`));
      }, 300000); // 5 minute timeout per batch

      const messageHandler = (result: InsertResult) => {
        clearTimeout(timeout);
        worker.removeListener('message', messageHandler);
        worker.removeListener('error', errorHandler);
        this.releaseWorker(worker);
        result.duration = Date.now() - startTime;
        resolve(result);
      };

      const errorHandler = (error: Error) => {
        clearTimeout(timeout);
        worker.removeListener('message', messageHandler);
        worker.removeListener('error', errorHandler);
        this.releaseWorker(worker);
        resolve({
          jobId,
          success: false,
          error: error.message,
          duration: Date.now() - startTime
        });
      };

      worker.on('message', messageHandler);
      worker.on('error', errorHandler);

      // Send job to worker
      worker.postMessage({ records, database, jobId, dbConfig });
    });
  }

  private async getAvailableWorker(): Promise<Worker> {
    // If we have available workers in the pool, use one
    if (this.workerPool.length > 0) {
      return this.workerPool.shift()!;
    }
    
    // If we haven't created all workers yet, create a new one
    if (this.createdWorkers < this.maxWorkers) {
      try {
        const worker = await this.createWorker();
        this.createdWorkers++;
        Logger.verbose(`Created worker ${this.createdWorkers}/${this.maxWorkers} on demand`);
        return worker;
      } catch (error) {
        Logger.error(`Failed to create worker: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }
    
    // Otherwise wait for a worker to become available
    while (this.workerPool.length === 0) {
      // Wait a bit and check again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return this.workerPool.shift()!;
  }

  private releaseWorker(worker: Worker): void {
    if (!this.workerPool.includes(worker)) {
      this.workerPool.push(worker);
    }
  }
}

// Parallel generation and insertion method
export async function generateAndInsertParallel(
  rowCount: number,
  databaseType: DatabaseType,
  batchSize: number = 50000,
  workerCount: number = 4,
  seed: string = 'default-benchmark-seed'
): Promise<void> {
  const inserter = new ParallelInserter(workerCount);
  const startTime = Date.now();
  
  Logger.info(`Initializing parallel insertion: ${rowCount.toLocaleString()} records, ${workerCount} workers`);
  
  const progress = setupProgressReporter(rowCount, databaseType);
  const { shutdownRequested, handleShutdown } = setupGracefulShutdown();
  
  try {
    await inserter.initialize();
    Logger.verbose(`Initialized ${workerCount} worker threads`);
    
    // Prepare generation context
    const context = await prepareGenerationContext(seed, rowCount);
    
    const processedRecords = await processChunksInParallel(
      inserter, 
      context, 
      rowCount, 
      databaseType, 
      batchSize, 
      workerCount, 
      startTime, 
      progress, 
      shutdownRequested
    );
    
    finalizParallelInsertion(progress, processedRecords, rowCount, shutdownRequested);
    
  } catch (error) {
    progress.complete('Failed');
    Logger.error(`Insertion failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    process.removeListener('SIGINT', handleShutdown);
    process.removeListener('SIGTERM', handleShutdown);
    await inserter.cleanup();
  }
}

/**
 * Setup progress reporter for parallel insertion
 */
function setupProgressReporter(rowCount: number, databaseType: DatabaseType): ProgressReporter {
  return new ProgressReporter({
    total: rowCount,
    label: `Inserting ${databaseType}`,
    showRate: true,
    showETA: true,
    updateInterval: 500 // Update every 500ms
  });
}

/**
 * Setup graceful shutdown handling
 */
function setupGracefulShutdown(): { shutdownRequested: { value: boolean }, handleShutdown: () => void } {
  const shutdownRequested = { value: false };
  const handleShutdown = () => {
    if (!shutdownRequested.value) {
      shutdownRequested.value = true;
      Logger.warn('Shutdown requested. Finishing current operations...');
      process.stdout.write('\n');
    }
  };
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
  
  return { shutdownRequested, handleShutdown };
}

/**
 * Prepare generation context (aircraft pool and time range)
 */
async function prepareGenerationContext(seed: string, rowCount: number): Promise<{
  startDate: Date;
  timeRange: number;
  aircraft: any[];
  generator: any;
}> {
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const endDate = new Date();
  const timeRange = endDate.getTime() - startDate.getTime();
  
  // Pre-generate aircraft pool (small memory footprint)
  const { DataGenerator } = await import('./generator');
  const generator = new DataGenerator(seed);
  const aircraftCount = Math.min(rowCount / 10, 5000);
  const aircraft = (generator as any).generateAircraft(aircraftCount);
  Logger.verbose(`Generated ${aircraftCount} unique aircraft profiles with seed: ${seed}`);
  
  return { startDate, timeRange, aircraft, generator };
}

/**
 * Process chunks in parallel with progress tracking
 */
async function processChunksInParallel(
  inserter: ParallelInserter,
  context: { startDate: Date; timeRange: number; aircraft: any[]; generator: any },
  rowCount: number,
  databaseType: DatabaseType,
  batchSize: number,
  workerCount: number,
  startTime: number,
  progress: ProgressReporter,
  shutdownRequested: { value: boolean }
): Promise<number> {
  const chunkSize = Math.min(500000, Math.max(batchSize * workerCount * 2, 100000));
  const totalChunks = Math.ceil(rowCount / chunkSize);
  let processedRecords = 0;
  
  for (let chunkIndex = 0; chunkIndex < totalChunks && !shutdownRequested.value; chunkIndex++) {
    const chunkStart = chunkIndex * chunkSize;
    const currentChunkSize = Math.min(chunkSize, rowCount - chunkStart);
    
    Logger.verbose(`Processing chunk ${chunkIndex + 1}/${totalChunks}: ${currentChunkSize.toLocaleString()} records`);
    
    const records = generateChunkRecords(currentChunkSize, context, databaseType);
    
    // Insert chunk in parallel
    await inserter.insertBatchParallel(records, databaseType, batchSize, true);
    
    processedRecords += currentChunkSize;
    const totalElapsed = Date.now() - startTime;
    const overallRate = processedRecords / (totalElapsed / 1000);
    
    // Update progress bar
    progress.update(processedRecords, { rate: overallRate });
    
    // Memory check every few chunks
    if ((chunkIndex + 1) % 3 === 0) {
      const memoryOk = MemoryMonitor.checkMemoryUsage();
      if (!memoryOk) {
        Logger.warn('High memory usage detected. Consider reducing batch size.');
      }
    }
  }
  
  return processedRecords;
}

/**
 * Generate records for a single chunk
 */
function generateChunkRecords(
  currentChunkSize: number,
  context: { startDate: Date; timeRange: number; aircraft: any[]; generator: any },
  databaseType: DatabaseType
): AircraftTrackingRecord[] {
  const records: AircraftTrackingRecord[] = [];
  const { startDate, timeRange, aircraft, generator } = context;
  
  for (let i = 0; i < currentChunkSize; i++) {
    const randomTime = startDate.getTime() + Math.random() * timeRange;
    const date = new Date(randomTime);
    const timestamp = databaseType === DATABASE_TYPES.CLICKHOUSE 
      ? date.toISOString().replace('T', ' ').replace(/\\.\\d{3}Z$/, '')
      : date.toISOString();
    
    const aircraftData = aircraft[Math.floor(Math.random() * aircraft.length)];
    const region = (generator as any).regions[Math.floor(Math.random() * (generator as any).regions.length)];
    
    const lat = region.latRange[0] + Math.random() * (region.latRange[1] - region.latRange[0]);
    const lon = region.lonRange[0] + Math.random() * (region.lonRange[1] - region.lonRange[0]);
    
    const isCommercial = aircraftData.category.startsWith('A') && !aircraftData.flight.includes('TETON');
    const altBaro = isCommercial ? 20000 + Math.random() * 20000 : Math.random() * 15000;
    
    records.push({
      zorderCoordinate: Math.floor((lat + 90) * 1000000 + (lon + 180) * 1000),
      approach: Math.random() < 0.05,
      autopilot: isCommercial ? Math.random() < 0.8 : Math.random() < 0.3,
      althold: Math.random() < 0.7,
      lnav: isCommercial ? Math.random() < 0.6 : Math.random() < 0.2,
      tcas: isCommercial ? Math.random() < 0.9 : Math.random() < 0.4,
      hex: aircraftData.hex,
      transponder_type: '',
      flight: aircraftData.flight,
      r: aircraftData.registration,
      aircraft_type: Math.random() < 0.8 ? (generator as any).generateAircraftType() : null,
      dbFlags: 1,
      lat: Math.round(lat * 1000000) / 1000000,
      lon: Math.round(lon * 1000000) / 1000000,
      alt_baro: Math.round(altBaro),
      alt_baro_is_ground: altBaro < 50,
      alt_geom: Math.round(altBaro + (Math.random() - 0.5) * 200),
      gs: Math.round(Math.random() * 500 + 100),
      track: Math.round(Math.random() * 360),
      baro_rate: Math.round((Math.random() - 0.5) * 4000),
      geom_rate: Math.random() < 0.9 ? Math.round((Math.random() - 0.5) * 128) : null,
      squawk: (generator as any).generateSquawk(),
      emergency: (generator as any).emergencyStates[Math.floor(Math.random() * (generator as any).emergencyStates.length)],
      category: aircraftData.category,
      nav_qnh: Math.random() < 0.8 ? Math.max(0, Math.round(1013 + (Math.random() - 0.5) * 50)) : null,
      nav_altitude_mcp: Math.random() < 0.7 ? Math.max(0, Math.round(altBaro + (Math.random() - 0.5) * 1000)) : null,
      nav_heading: Math.random() < 0.6 ? Math.round(Math.random() * 360) : null,
      nav_modes: (generator as any).generateNavModes(),
      nic: Math.floor(Math.random() * 11),
      rc: Math.floor(Math.random() * 500),
      seen_pos: Math.random() * 10,
      version: Math.random() < 0.9 ? 2 : 1,
      nic_baro: Math.floor(Math.random() * 2),
      nac_p: Math.floor(Math.random() * 12),
      nac_v: Math.floor(Math.random() * 5),
      sil: Math.floor(Math.random() * 4),
      sil_type: (generator as any).silTypes[Math.floor(Math.random() * (generator as any).silTypes.length)],
      gva: Math.floor(Math.random() * 3),
      sda: Math.floor(Math.random() * 3),
      alert: 0,
      spi: 0,
      mlat: [],
      tisb: [],
      messages: Math.floor(Math.random() * 100000),
      seen: Math.random() * 60,
      rssi: -5 - Math.random() * 15,
      timestamp: timestamp
    });
  }
  
  return records;
}

/**
 * Finalize parallel insertion with completion status
 */
function finalizParallelInsertion(
  progress: ProgressReporter,
  processedRecords: number,
  rowCount: number,
  shutdownRequested: { value: boolean }
): void {
  if (shutdownRequested.value) {
    progress.complete(`Cancelled at ${processedRecords.toLocaleString()} records`);
    Logger.warn('Operation cancelled by user');
  } else {
    progress.complete('Complete');
    Logger.info(`Successfully inserted ${rowCount.toLocaleString()} records`);
  }
}

// Multi-database sequential insertion with individual progress bars
export async function generateAndInsertSequentialWithMultiBar(
  databases: { database: any; databaseType: DatabaseType; withIndex?: boolean }[],
  rowCount: number,
  batchSize: number = 50000,
  workerCount: number = 4
): Promise<void> {
  Logger.info(`Multi-DB sequential insertion: ${rowCount.toLocaleString()} records (batch size: ${batchSize.toLocaleString()})`);
  
  const displayNames = databases.map(({ databaseType, withIndex }) => getDatabaseDisplayName(databaseType, withIndex));
  const { shutdownRequested, handleShutdown } = setupMultiDBShutdownHandling();
  const completionTimes: number[] = [];
  const finalBars: string[] = [];

  try {
    const context = await prepareMultiDBContext();
    await initializeDatabases(databases);
    
    console.log(); // Add spacing before progress bars

    await processAllDatabasesSequentially(
      databases, 
      displayNames, 
      context, 
      rowCount, 
      batchSize, 
      workerCount, 
      shutdownRequested, 
      completionTimes, 
      finalBars
    );
    
    displayFinalResults(shutdownRequested, finalBars, rowCount, databases.length, displayNames, completionTimes);

  } catch (error) {
    console.error(`Multi-database insertion failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    process.removeListener('SIGINT', handleShutdown);
    process.removeListener('SIGTERM', handleShutdown);
  }
}

/**
 * Setup shutdown handling for multi-database operations
 */
function setupMultiDBShutdownHandling(): { shutdownRequested: { value: boolean }, handleShutdown: () => void } {
  const shutdownRequested = { value: false };
  const handleShutdown = () => {
    if (!shutdownRequested.value) {
      shutdownRequested.value = true;
      Logger.warn('Shutdown requested. Finishing current operations...');
    }
  };
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
  
  return { shutdownRequested, handleShutdown };
}

/**
 * Prepare context for multi-database generation
 */
async function prepareMultiDBContext(): Promise<{
  startDate: Date;
  timeRange: number;
  aircraft: any[];
  generator: any;
}> {
  const { DataGenerator } = await import('./generator');
  const generator = new DataGenerator();
  const aircraftCount = Math.min(10000 / 10, 5000); // Use a reasonable default
  const aircraft = (generator as any).generateAircraft(aircraftCount);
  
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const endDate = new Date();
  const timeRange = endDate.getTime() - startDate.getTime();
  
  return { startDate, timeRange, aircraft, generator };
}

/**
 * Initialize all databases before processing
 */
async function initializeDatabases(databases: { database: any; databaseType: DatabaseType; withIndex?: boolean }[]): Promise<void> {
  console.log('Initializing databases...');
  
  // Create databases first (once only)
  const seenDatabases = new Set();
  for (let dbIndex = 0; dbIndex < databases.length; dbIndex++) {
    const { database, databaseType } = databases[dbIndex];
    
    if (!seenDatabases.has(databaseType)) {
      await database.ensureDatabaseExists();
      seenDatabases.add(databaseType);
    }
  }
  
  // Then connect and set up tables
  for (let dbIndex = 0; dbIndex < databases.length; dbIndex++) {
    const { database } = databases[dbIndex];
    await database.connect();
  }
  console.log('Database setup complete');
}

/**
 * Process all databases sequentially with progress tracking
 */
async function processAllDatabasesSequentially(
  databases: { database: any; databaseType: DatabaseType; withIndex?: boolean }[],
  displayNames: string[],
  context: { startDate: Date; timeRange: number; aircraft: any[]; generator: any },
  rowCount: number,
  batchSize: number,
  workerCount: number,
  shutdownRequested: { value: boolean },
  completionTimes: number[],
  finalBars: string[]
): Promise<void> {
  const cliProgress = await import('cli-progress');
  
  for (let dbIndex = 0; dbIndex < databases.length && !shutdownRequested.value; dbIndex++) {
    const { database, databaseType } = databases[dbIndex];
    const inserter = new ParallelInserter(workerCount);
    
    // Extract database configuration for worker threads
    const dbConfig = databaseType === DATABASE_TYPES.POSTGRESQL && (database as any).dbConfig ? (database as any).dbConfig : undefined;
    
    const progressBar = createProgressBar(cliProgress, displayNames[dbIndex], rowCount);
    const startTime = Date.now();
    
    await inserter.initialize();
    
    await processSingleDatabaseInChunks(
      inserter, 
      context, 
      rowCount, 
      databaseType, 
      batchSize, 
      workerCount, 
      dbConfig, 
      shutdownRequested, 
      progressBar, 
      startTime
    );
    
    completionTimes[dbIndex] = Date.now() - startTime;
    finalizeProgressBar(progressBar, rowCount, completionTimes[dbIndex]);
    
    await inserter.cleanup();

    // Store the final bar representation for display at end
    const finalRate = rowCount / (completionTimes[dbIndex] / 1000);
    const finalBar = `${displayNames[dbIndex].padEnd(15)}: [${'█'.repeat(30)}] 100% | ${rowCount.toLocaleString()}/${rowCount.toLocaleString()} | ${formatNumber(Math.round(finalRate))}/sec | ${formatTimeInMinSec(completionTimes[dbIndex] / 1000)} | ETA: 0:00`;
    finalBars.push(finalBar);
  }
}

/**
 * Create progress bar for a database
 */
function createProgressBar(cliProgress: any, dbName: string, rowCount: number): any {
  const progressBar = new cliProgress.SingleBar({
    format: `${dbName.padEnd(15)}: [{bar}] {percentage}% | {value}/{total} | {rate}/sec | {duration_formatted} | ETA: {eta_formatted}`,
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
    clearOnComplete: false,
    stopOnComplete: false,
    barsize: 30
  }, cliProgress.Presets.shades_classic);

  progressBar.start(rowCount, 0, {
    rate: '0',
    duration_formatted: '0:00',
    eta_formatted: 'N/A'
  });
  
  return progressBar;
}

/**
 * Process a single database in chunks
 */
async function processSingleDatabaseInChunks(
  inserter: ParallelInserter,
  context: { startDate: Date; timeRange: number; aircraft: any[]; generator: any },
  rowCount: number,
  databaseType: DatabaseType,
  batchSize: number,
  workerCount: number,
  dbConfig: any,
  shutdownRequested: { value: boolean },
  progressBar: any,
  startTime: number
): Promise<void> {
  const chunkSize = Math.min(500000, Math.max(batchSize * workerCount * 2, 100000));
  const totalChunks = Math.ceil(rowCount / chunkSize);
  let processedRecords = 0;
  
  for (let chunkIndex = 0; chunkIndex < totalChunks && !shutdownRequested.value; chunkIndex++) {
    const currentChunkSize = Math.min(chunkSize, rowCount - (chunkIndex * chunkSize));
    
    const chunkRecords = generateRecordsForChunk(currentChunkSize, context.startDate, context.timeRange, context.aircraft, context.generator);
    await inserter.insertBatchParallel(chunkRecords, databaseType, batchSize, true, dbConfig);
    
    processedRecords += currentChunkSize;
    updateProgressBar(progressBar, processedRecords, rowCount, startTime);
  }
}

/**
 * Update progress bar with current status
 */
function updateProgressBar(progressBar: any, processedRecords: number, rowCount: number, startTime: number): void {
  const elapsed = Date.now() - startTime;
  const rate = processedRecords / (elapsed / 1000);
  const eta = processedRecords > 0 && processedRecords < rowCount
    ? (rowCount - processedRecords) / rate
    : 0;
    
  progressBar.update(processedRecords, {
    rate: formatNumber(Math.round(rate)),
    duration_formatted: formatTimeInMinSec(elapsed / 1000),
    eta_formatted: formatTimeInMinSec(eta)
  });
}

/**
 * Finalize progress bar with final status
 */
function finalizeProgressBar(progressBar: any, rowCount: number, completionTimeMs: number): void {
  const finalRate = rowCount / (completionTimeMs / 1000);
  progressBar.update(rowCount, {
    rate: formatNumber(Math.round(finalRate)),
    duration_formatted: formatTimeInMinSec(completionTimeMs / 1000),
    eta_formatted: '0:00'
  });
  progressBar.stop();
}

/**
 * Display final results summary
 */
function displayFinalResults(
  shutdownRequested: { value: boolean },
  finalBars: string[],
  rowCount: number,
  databaseCount: number,
  displayNames: string[],
  completionTimes: number[]
): void {
  if (shutdownRequested.value) {
    console.log('\nOperation cancelled by user');
    return;
  }

  // Show all final bars together
  console.log('\nFinal Results:');
  finalBars.forEach(bar => console.log(bar));

  // Summary
  console.log(`\nSuccessfully inserted ${rowCount.toLocaleString()} records into ${databaseCount} database configurations`);
  const summaryParts = displayNames.map((name, index) => 
    completionTimes[index] ? `${name}: ${formatTimeInMinSec(completionTimes[index] / 1000)}` : `${name}: incomplete`
  );
  console.log(`  ${summaryParts.join('   ')}`);
}

/**
 * Format time in mm:ss format
 */
function formatTimeInMinSec(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Helper function to generate records for a chunk
function generateRecordsForChunk(
  chunkSize: number,
  startDate: Date,
  timeRange: number,
  aircraft: any[],
  generator: any
): any[] {
  const records: any[] = [];
  
  for (let i = 0; i < chunkSize; i++) {
    const randomTime = startDate.getTime() + Math.random() * timeRange;
    const date = new Date(randomTime);
    const timestamp = date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    
    const aircraftData = aircraft[Math.floor(Math.random() * aircraft.length)];
    const region = (generator as any).regions[Math.floor(Math.random() * (generator as any).regions.length)];
    
    const lat = region.latRange[0] + Math.random() * (region.latRange[1] - region.latRange[0]);
    const lon = region.lonRange[0] + Math.random() * (region.lonRange[1] - region.lonRange[0]);
    
    const isCommercial = aircraftData.category.startsWith('A') && !aircraftData.flight.includes('TETON');
    const altBaro = isCommercial ? 20000 + Math.random() * 20000 : Math.random() * 15000;
    
    records.push({
      zorderCoordinate: Math.floor((lat + 90) * 1000000 + (lon + 180) * 1000),
      approach: Math.random() < 0.05,
      autopilot: isCommercial ? Math.random() < 0.8 : Math.random() < 0.3,
      althold: Math.random() < 0.7,
      lnav: isCommercial ? Math.random() < 0.6 : Math.random() < 0.2,
      tcas: isCommercial ? Math.random() < 0.9 : Math.random() < 0.4,
      hex: aircraftData.hex,
      transponder_type: '',
      flight: aircraftData.flight,
      r: aircraftData.registration,
      aircraft_type: Math.random() < 0.8 ? (generator as any).generateAircraftType() : null,
      dbFlags: 1,
      lat: Math.round(lat * 1000000) / 1000000,
      lon: Math.round(lon * 1000000) / 1000000,
      alt_baro: Math.round(altBaro),
      alt_baro_is_ground: altBaro < 50,
      alt_geom: Math.round(altBaro + (Math.random() - 0.5) * 200),
      gs: Math.round(Math.random() * 500 + 100),
      track: Math.round(Math.random() * 360),
      baro_rate: Math.round((Math.random() - 0.5) * 4000),
      geom_rate: Math.random() < 0.9 ? Math.round((Math.random() - 0.5) * 128) : null,
      squawk: (generator as any).generateSquawk(),
      emergency: (generator as any).emergencyStates[Math.floor(Math.random() * (generator as any).emergencyStates.length)],
      category: aircraftData.category,
      nav_qnh: Math.random() < 0.8 ? Math.max(0, Math.round(1013 + (Math.random() - 0.5) * 50)) : null,
      nav_altitude_mcp: Math.random() < 0.7 ? Math.max(0, Math.round(altBaro + (Math.random() - 0.5) * 1000)) : null,
      nav_heading: Math.random() < 0.6 ? Math.round(Math.random() * 360) : null,
      nav_modes: (generator as any).generateNavModes(),
      nic: Math.floor(Math.random() * 11),
      rc: Math.floor(Math.random() * 500),
      seen_pos: Math.random() * 10,
      version: Math.random() < 0.9 ? 2 : 1,
      nic_baro: Math.floor(Math.random() * 2),
      nac_p: Math.floor(Math.random() * 12),
      nac_v: Math.floor(Math.random() * 5),
      sil: Math.floor(Math.random() * 4),
      sil_type: (generator as any).silTypes[Math.floor(Math.random() * (generator as any).silTypes.length)],
      gva: Math.floor(Math.random() * 3),
      sda: Math.floor(Math.random() * 3),
      alert: 0,
      spi: 0,
      mlat: [],
      tisb: [],
      messages: Math.floor(Math.random() * 100000),
      seen: Math.random() * 60,
      rssi: -5 - Math.random() * 15,
      timestamp: timestamp
    });
  }
  
  return records;
}

// Helper function for number formatting
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}