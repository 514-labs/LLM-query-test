import { MemoryMonitor } from '../reporting/progress-reporter';
import { generateAndInsertParallel, generateAndInsertSequentialWithMultiBar } from './inserter';
import { DATABASE_TYPES, DatabaseType } from '../constants/database';
import seedrandom from 'seedrandom';

export interface AircraftTrackingRecord {
  zorderCoordinate: number;
  approach: boolean;
  autopilot: boolean;
  althold: boolean;
  lnav: boolean;
  tcas: boolean;
  hex: string;
  transponder_type: string;
  flight: string;
  r: string;
  aircraft_type: string | null;
  dbFlags: number;
  lat: number;
  lon: number;
  alt_baro: number;
  alt_baro_is_ground: boolean;
  alt_geom: number;
  gs: number;
  track: number;
  baro_rate: number;
  geom_rate: number | null;
  squawk: string;
  emergency: string;
  category: string;
  nav_qnh: number | null;
  nav_altitude_mcp: number | null;
  nav_heading: number | null;
  nav_modes: string[];
  nic: number;
  rc: number;
  seen_pos: number;
  version: number;
  nic_baro: number;
  nac_p: number;
  nac_v: number;
  sil: number;
  sil_type: string;
  gva: number;
  sda: number;
  alert: number;
  spi: number;
  mlat: string[];
  tisb: string[];
  messages: number;
  seen: number;
  rssi: number;
  timestamp: string;
}

export class DataGenerator {
  private aircraftCategories = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'B1', 'B2', 'C1', 'C2'];
  private emergencyStates = ['none', 'general', 'lifeguard', 'minfuel', 'nordo', 'unlawful', 'downed'];
  private silTypes = ['perhour', 'persample'];
  private navModes = ['autopilot', 'althold', 'approach', 'lnav', 'tcas', 'vnav'];
  
  // Realistic flight callsigns and registrations
  private flightPrefixes = ['AAL', 'DAL', 'UAL', 'SWA', 'JBU', 'ASA', 'SKW', 'TETON', 'REACH', 'CTM', 'BAW', 'AFR'];
  private militaryCallsigns = ['TETON', 'REACH', 'SENTRY', 'KNIFE', 'VAPOR', 'RIDER'];
  private registrationPrefixes = ['N', 'G-', 'F-', 'D-', 'C-', '92-', '11-', '86-'];
  
  // Deterministic random generation
  private seed: string;
  private rng: seedrandom.PRNG;

  constructor(seed?: string) {
    this.seed = seed || 'default-benchmark-seed';
    this.rng = seedrandom(this.seed);
    console.log(`DataGenerator initialized with seed: ${this.seed}`);
  }

  // Helper method to get random number from seeded RNG
  private random(): number {
    return this.rng();
  }
  
  // Geographic regions for realistic positioning
  private regions = [
    { name: 'US_EAST', latRange: [25, 47], lonRange: [-85, -65] },
    { name: 'US_WEST', latRange: [32, 48], lonRange: [-125, -100] },
    { name: 'EUROPE', latRange: [35, 60], lonRange: [-10, 25] },
    { name: 'ATLANTIC', latRange: [30, 50], lonRange: [-60, -20] }
  ];

  generateTestData(rowCount: number, database?: DatabaseType): AircraftTrackingRecord[] {
    console.log(`Generating ${rowCount.toLocaleString()} aircraft tracking records...`);
    
    this.logMemoryWarningForLargeDataset(rowCount);
    
    const data: AircraftTrackingRecord[] = [];
    const { startDate, timeRange } = this.setupTimeRange(1); // Last 24 hours
    const aircraft = this.generateAircraft(Math.min(rowCount / 10, 5000));

    for (let i = 0; i < rowCount; i++) {
      const record = this.generateSingleRecord(aircraft, startDate, timeRange, database);
      data.push(record);

      if (i % 100000 === 0 && i > 0) {
        console.log(`Generated ${i.toLocaleString()} records...`);
      }
    }

    console.log(`Aircraft tracking data generation complete: ${rowCount.toLocaleString()} records`);
    return data;
  }

  /**
   * Log memory warning for large datasets
   */
  private logMemoryWarningForLargeDataset(rowCount: number): void {
    const estimatedMemoryMB = (rowCount * 1024) / (1024 * 1024); // ~1KB per record
    if (estimatedMemoryMB > 1000) {
      console.warn(`⚠️  Large dataset (${estimatedMemoryMB.toFixed(0)}MB estimated). Using non-streaming generation.`);
    }
  }

  private generateAircraft(count: number) {
    const aircraft = [];
    for (let i = 0; i < count; i++) {
      const isMilitary = this.random() < 0.1;
      const prefix = isMilitary 
        ? this.militaryCallsigns[Math.floor(this.random() * this.militaryCallsigns.length)]
        : this.flightPrefixes[Math.floor(this.random() * this.flightPrefixes.length)];
      
      aircraft.push({
        hex: this.generateHex(),
        flight: isMilitary 
          ? `${prefix}${Math.floor(this.random() * 99).toString().padStart(2, '0')} `
          : `${prefix}${Math.floor(this.random() * 9999).toString().padStart(4, '0')}`,
        registration: this.generateRegistration(),
        category: this.aircraftCategories[Math.floor(this.random() * this.aircraftCategories.length)]
      });
    }
    return aircraft;
  }

  private generateHex(): string {
    return Math.floor(this.random() * 16777215).toString(16).padStart(6, '0');
  }

  private generateRegistration(): string {
    const prefix = this.registrationPrefixes[Math.floor(this.random() * this.registrationPrefixes.length)];
    const suffix = Math.floor(this.random() * 99999).toString().padStart(4, '0');
    return `${prefix}${suffix}`;
  }

  private generateSquawk(): string {
    // Common squawk codes with realistic distribution
    const common = ['1200', '7000', '2000', '0400'];
    if (this.random() < 0.3) {
      return common[Math.floor(this.random() * common.length)];
    }
    return Math.floor(this.random() * 7777).toString().padStart(4, '0');
  }

  private generateNavModes(): string[] {
    const modes: string[] = [];
    this.navModes.forEach(mode => {
      if (this.random() < 0.3) modes.push(mode);
    });
    return modes;
  }

  private generateAircraftType(): string {
    const types = ['B738', 'A320', 'B777', 'A330', 'C172', 'PA28', 'B752', 'E145', 'CRJ2', 'DH8D'];
    return types[Math.floor(this.random() * types.length)];
  }

  /**
   * Generate timestamp for a given date in the format expected by the database
   */
  private generateTimestamp(date: Date, databaseType: DatabaseType): string {
    // Both databases now use the same format for consistency
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  }

  /**
   * Generate a single aircraft tracking record with given parameters
   */
  private generateSingleRecord(
    aircraft: any[],
    startDate: Date,
    timeRange: number,
    databaseType?: DatabaseType
  ): AircraftTrackingRecord {
    const randomTime = startDate.getTime() + this.random() * timeRange;
    const date = new Date(randomTime);
    const timestamp = databaseType 
      ? this.generateTimestamp(date, databaseType)
      : date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

    const aircraftData = aircraft[Math.floor(this.random() * aircraft.length)];
    const region = this.regions[Math.floor(this.random() * this.regions.length)];
    
    const lat = region.latRange[0] + this.random() * (region.latRange[1] - region.latRange[0]);
    const lon = region.lonRange[0] + this.random() * (region.lonRange[1] - region.lonRange[0]);
    
    const isCommercial = aircraftData.category.startsWith('A') && !aircraftData.flight.includes('TETON');
    const altBaro = isCommercial 
      ? 20000 + this.random() * 20000
      : this.random() * 15000;
    
    return {
      zorderCoordinate: Math.floor((lat + 90) * 1000000 + (lon + 180) * 1000),
      approach: this.random() < 0.05,
      autopilot: isCommercial ? this.random() < 0.8 : this.random() < 0.3,
      althold: this.random() < 0.7,
      lnav: isCommercial ? this.random() < 0.6 : this.random() < 0.2,
      tcas: isCommercial ? this.random() < 0.9 : this.random() < 0.4,
      hex: aircraftData.hex,
      transponder_type: '',
      flight: aircraftData.flight,
      r: aircraftData.registration,
      aircraft_type: this.random() < 0.8 ? this.generateAircraftType() : null,
      dbFlags: 1,
      lat: Math.round(lat * 1000000) / 1000000,
      lon: Math.round(lon * 1000000) / 1000000,
      alt_baro: Math.round(altBaro),
      alt_baro_is_ground: altBaro < 50,
      alt_geom: Math.round(altBaro + (this.random() - 0.5) * 200),
      gs: Math.round(this.random() * 500 + 100),
      track: Math.round(this.random() * 360),
      baro_rate: Math.round((this.random() - 0.5) * 4000),
      geom_rate: this.random() < 0.9 ? Math.round((this.random() - 0.5) * 128) : null,
      squawk: this.generateSquawk(),
      emergency: this.emergencyStates[Math.floor(this.random() * this.emergencyStates.length)],
      category: aircraftData.category,
      nav_qnh: this.random() < 0.8 ? Math.max(0, Math.round(1013 + (this.random() - 0.5) * 50)) : null,
      nav_altitude_mcp: this.random() < 0.7 ? Math.max(0, Math.round(altBaro + (this.random() - 0.5) * 1000)) : null,
      nav_heading: this.random() < 0.6 ? Math.round(this.random() * 360) : null,
      nav_modes: this.generateNavModes(),
      nic: Math.floor(this.random() * 11),
      rc: Math.floor(this.random() * 500),
      seen_pos: this.random() * 10,
      version: this.random() < 0.9 ? 2 : 1,
      nic_baro: Math.floor(this.random() * 2),
      nac_p: Math.floor(this.random() * 12),
      nac_v: Math.floor(this.random() * 5),
      sil: Math.floor(this.random() * 4),
      sil_type: this.silTypes[Math.floor(this.random() * this.silTypes.length)],
      gva: Math.floor(this.random() * 3),
      sda: Math.floor(this.random() * 3),
      alert: 0,
      spi: 0,
      mlat: [],
      tisb: [],
      messages: Math.floor(this.random() * 100000),
      seen: this.random() * 60,
      rssi: -5 - this.random() * 15,
      timestamp: timestamp
    };
  }

  /**
   * Setup time range for data generation
   */
  private setupTimeRange(daysPast: number = 1): { startDate: Date; endDate: Date; timeRange: number } {
    const startDate = new Date(Date.now() - daysPast * 24 * 60 * 60 * 1000);
    const endDate = new Date();
    const timeRange = endDate.getTime() - startDate.getTime();
    return { startDate, endDate, timeRange };
  }

  /**
   * Validate memory requirements before generation
   */
  private async validateMemoryRequirements(rowCount: number, operation: string): Promise<void> {
    const estimatedMemory = MemoryMonitor.estimateDatasetMemory(rowCount);
    const memoryOk = await MemoryMonitor.checkBeforeOperation(operation, estimatedMemory);
    
    if (!memoryOk) {
      throw new Error('Insufficient memory for requested dataset size. Reduce DATASET_SIZE or BATCH_SIZE in .env');
    }
  }

  async generateAndInsertInBatches(database: any, rowCount: number, databaseType: DatabaseType, batchSize: number = 50000): Promise<void> {
    console.log(`Generating and inserting ${rowCount.toLocaleString()} aircraft records in batches of ${batchSize.toLocaleString()}...`);
    
    await this.validateMemoryRequirements(rowCount, `Data generation (${rowCount.toLocaleString()} rows)`);
    
    MemoryMonitor.startMonitoring();
    
    try {
      const { startDate, timeRange } = this.setupTimeRange(7); // 7 days ago
      const aircraft = this.generateAircraft(Math.min(rowCount / 10, 5000));
      
      await this.processBatchesSequentially(database, rowCount, databaseType, batchSize, aircraft, startDate, timeRange);
      
    } finally {
      MemoryMonitor.stopMonitoring();
      MemoryMonitor.logCurrentUsage();
    }
  }

  /**
   * Process data generation and insertion in batches
   */
  private async processBatchesSequentially(
    database: any,
    rowCount: number,
    databaseType: DatabaseType,
    batchSize: number,
    aircraft: any[],
    startDate: Date,
    timeRange: number
  ): Promise<void> {
    const overallStartTime = Date.now();
    const totalBatches = Math.ceil(rowCount / batchSize);
    
    for (let i = 0; i < rowCount; i += batchSize) {
      const batchStartTime = Date.now();
      const currentBatch = Math.floor(i / batchSize) + 1;
      const currentBatchSize = Math.min(batchSize, rowCount - i);
      
      const batch = this.generateBatch(currentBatchSize, aircraft, startDate, timeRange, databaseType);
      
      await database.insertBatch(batch);
      
      this.checkMemoryUsageEveryFewBatches(currentBatch);
      this.logBatchProgress(currentBatch, totalBatches, rowCount, i + batchSize, batchStartTime, overallStartTime);
    }
    
    const totalTime = Date.now() - overallStartTime;
    console.log(`Data insertion complete in ${this.formatTime(totalTime)}`);
  }

  /**
   * Generate a batch of records
   */
  private generateBatch(
    batchSize: number,
    aircraft: any[],
    startDate: Date,
    timeRange: number,
    databaseType: DatabaseType
  ): AircraftTrackingRecord[] {
    const batch: AircraftTrackingRecord[] = [];
    
    for (let j = 0; j < batchSize; j++) {
      const record = this.generateSingleRecord(aircraft, startDate, timeRange, databaseType);
      batch.push(record);
    }
    
    return batch;
  }

  /**
   * Check memory usage every 5 batches
   */
  private checkMemoryUsageEveryFewBatches(currentBatch: number): void {
    if (currentBatch % 5 === 0) {
      const memoryOk = MemoryMonitor.checkMemoryUsage();
      if (!memoryOk) {
        MemoryMonitor.stopMonitoring();
        throw new Error('Critical memory usage detected. Consider reducing dataset size or batch size.');
      }
    }
  }

  /**
   * Log progress for each batch
   */
  private logBatchProgress(
    currentBatch: number,
    totalBatches: number,
    rowCount: number,
    progress: number,
    batchStartTime: number,
    overallStartTime: number
  ): void {
    const batchEndTime = Date.now();
    const batchDuration = batchEndTime - batchStartTime;
    const totalElapsed = batchEndTime - overallStartTime;
    const actualProgress = Math.min(progress, rowCount);
    
    // Calculate ETA
    const avgBatchTime = totalElapsed / currentBatch;
    const remainingBatches = totalBatches - currentBatch;
    const estimatedRemaining = remainingBatches * avgBatchTime;
    
    console.log(`Batch ${currentBatch}/${totalBatches}: ${actualProgress.toLocaleString()}/${rowCount.toLocaleString()} records (${this.formatTime(batchDuration)}) | Elapsed: ${this.formatTime(totalElapsed)} | ETA: ${this.formatTime(estimatedRemaining)}`);
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  /**
   * Validate memory requirements for parallel insertion
   */
  private async validateParallelMemoryRequirements(batchSize: number, parallelWorkers: number): Promise<void> {
    const chunkSize = Math.min(500000, Math.max(batchSize * parallelWorkers * 2, 100000));
    const estimatedMemory = MemoryMonitor.estimateDatasetMemory(chunkSize);
    const memoryOk = await MemoryMonitor.checkBeforeOperation(`Parallel data generation (${chunkSize.toLocaleString()} records per chunk)`, estimatedMemory);
    
    if (!memoryOk) {
      throw new Error('Insufficient memory for requested dataset size. Reduce DATASET_SIZE or BATCH_SIZE in .env');
    }
  }

  /**
   * Validate memory requirements for multi-database insertion
   */
  private async validateMultiDBMemoryRequirements(batchSize: number, parallelWorkers: number): Promise<void> {
    const chunkSize = Math.min(500000, Math.max(batchSize * parallelWorkers * 2, 100000));
    const estimatedMemory = MemoryMonitor.estimateDatasetMemory(chunkSize);
    const memoryOk = await MemoryMonitor.checkBeforeOperation(`Multi-DB sequential data generation (${chunkSize.toLocaleString()} records per chunk)`, estimatedMemory);
    
    if (!memoryOk) {
      throw new Error('Insufficient memory for requested dataset size. Reduce DATASET_SIZE or BATCH_SIZE in .env');
    }
  }


  // New parallel insertion method
  async generateAndInsertInBatchesParallel(
    database: any, 
    rowCount: number, 
    databaseType: DatabaseType, 
    batchSize: number = 50000,
    parallelWorkers: number = 4
  ): Promise<void> {
    console.log(`🚀 PARALLEL MODE: Generating and inserting ${rowCount.toLocaleString()} records with ${parallelWorkers} workers`);
    
    await this.validateParallelMemoryRequirements(batchSize, parallelWorkers);
    
    try {
      await generateAndInsertParallel(rowCount, databaseType, batchSize, parallelWorkers);
    } catch (error) {
      console.log(`⚠️  Parallel insertion failed: ${error instanceof Error ? error.message : String(error)}`);
      console.log(`🔄 Falling back to sequential insertion...`);
      
      // Fall back to sequential insertion
      await this.generateAndInsertInBatches(database, rowCount, databaseType, batchSize);
    }
  }

  // New sequential insertion method for multiple database configurations
  async generateAndInsertInBatchesSequentialMultiDB(
    databases: { database: any; databaseType: DatabaseType; withIndex?: boolean }[],
    rowCount: number,
    batchSize: number = 50000,
    parallelWorkers: number = 4
  ): Promise<void> {
    console.log(`🚀 MULTI-DB SEQUENTIAL MODE: Generating and inserting ${rowCount.toLocaleString()} records into ${databases.length} database configurations with ${parallelWorkers} workers each`);
    
    await this.validateMultiDBMemoryRequirements(batchSize, parallelWorkers);
    
    try {
      // Run sequential insertion for all database configurations with comparative progress bars
      await generateAndInsertSequentialWithMultiBar(databases, rowCount, batchSize, parallelWorkers);
      
    } catch (error) {
      console.error(`Multi-database sequential insertion failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}