import * as cliProgress from 'cli-progress';

export interface ProgressOptions {
  total: number;
  label?: string;
  width?: number;
  showRate?: boolean;
  showETA?: boolean;
  updateInterval?: number;
}

// Memory monitoring (merged from memory-monitor.ts)
export class MemoryMonitor {
  private static readonly WARNING_THRESHOLD = 0.85; // 85% of available memory
  private static readonly CRITICAL_THRESHOLD = 0.95; // 95% of available memory
  private static monitoringInterval?: NodeJS.Timeout;

  static startMonitoring(): void {
    this.logCurrentUsage();
    
    // Monitor every 30 seconds during long operations
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000);
  }

  static stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  static checkMemoryUsage(): boolean {
    const usage = process.memoryUsage();
    const totalSystemMemory = this.getTotalSystemMemory();
    const usedPercentage = usage.heapUsed / totalSystemMemory;

    if (usedPercentage >= this.CRITICAL_THRESHOLD) {
      console.log('\n🚨 CRITICAL MEMORY WARNING:');
      console.log(`   Memory usage: ${this.formatBytes(usage.heapUsed)} (${(usedPercentage * 100).toFixed(1)}%)`);
      console.log(`   Consider reducing dataset size or batch size in .env`);
      console.log(`   Current heap limit: ${this.formatBytes(usage.heapTotal)}`);
      return false; // Critical level reached
    } else if (usedPercentage >= this.WARNING_THRESHOLD) {
      console.log(`\n⚠️  Memory warning: ${this.formatBytes(usage.heapUsed)} (${(usedPercentage * 100).toFixed(1)}%) - approaching limits`);
      return true; // Warning level
    }

    return true; // Normal level
  }

  static logCurrentUsage(): void {
    const usage = process.memoryUsage();
    const totalSystemMemory = this.getTotalSystemMemory();
    
    console.log('\n💾 Memory Status:');
    console.log(`   Heap Used: ${this.formatBytes(usage.heapUsed)}`);
    console.log(`   Heap Total: ${this.formatBytes(usage.heapTotal)}`);
    console.log(`   System Memory: ${this.formatBytes(totalSystemMemory)}`);
    console.log(`   Usage: ${((usage.heapUsed / totalSystemMemory) * 100).toFixed(1)}%`);
  }

  static async checkBeforeOperation(operationName: string, estimatedMemoryMB: number): Promise<boolean> {
    const usage = process.memoryUsage();
    const totalSystemMemory = this.getTotalSystemMemory();
    const estimatedBytes = estimatedMemoryMB * 1024 * 1024;
    const projectedUsage = (usage.heapUsed + estimatedBytes) / totalSystemMemory;

    console.log(`\n🔍 Pre-operation memory check: ${operationName}`);
    console.log(`   Current usage: ${this.formatBytes(usage.heapUsed)} (${((usage.heapUsed / totalSystemMemory) * 100).toFixed(1)}%)`);
    console.log(`   Estimated additional: ${this.formatBytes(estimatedBytes)}`);
    console.log(`   Projected total: ${((projectedUsage) * 100).toFixed(1)}%`);

    if (projectedUsage > this.CRITICAL_THRESHOLD) {
      console.log(`\n❌ Operation rejected: Would exceed ${(this.CRITICAL_THRESHOLD * 100).toFixed(0)}% memory threshold`);
      console.log(`   Recommendation: Reduce dataset size or batch size in .env file`);
      return false;
    } else if (projectedUsage > this.WARNING_THRESHOLD) {
      console.log(`\n⚠️  Warning: Operation will use ${(projectedUsage * 100).toFixed(1)}% of available memory`);
      console.log(`   Monitor closely for memory issues during execution`);
    } else {
      console.log(`   ✅ Memory check passed`);
    }

    return true;
  }

  static estimateDatasetMemory(records: number): number {
    // Rough estimate: ~2KB per record in memory (including JS object overhead)
    const bytesPerRecord = 2048;
    return (records * bytesPerRecord) / (1024 * 1024); // Convert to MB
  }

  private static getTotalSystemMemory(): number {
    const os = require('os');
    return os.totalmem();
  }

  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export class ProgressReporter {
  private total: number;
  private current: number = 0;
  private startTime: number;
  private lastUpdate: number = 0;
  private label: string;
  private showRate: boolean;
  private showETA: boolean;
  private updateInterval: number;
  private progressBar: cliProgress.SingleBar;

  constructor(options: ProgressOptions) {
    this.total = options.total;
    this.label = options.label || 'Progress';
    this.showRate = options.showRate ?? true;
    this.showETA = options.showETA ?? true;
    this.updateInterval = options.updateInterval || 1000; // 1 second
    this.startTime = Date.now();

    // Create cli-progress bar
    this.progressBar = new cliProgress.SingleBar({
      format: `${this.label}: [{bar}] {percentage}% | {value}/{total} | {rate}/sec | {duration_formatted} | ETA: {eta_formatted}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      barsize: 40,
      stopOnComplete: true
    }, cliProgress.Presets.shades_classic);

    this.progressBar.start(this.total, 0, {
      rate: 0,
      duration_formatted: '0s',  
      eta_formatted: 'N/A'
    });
  }

  update(current: number, data?: { rate?: number; customMessage?: string }): void {
    this.current = Math.min(current, this.total);
    const now = Date.now();
    
    // Only update display if enough time has passed or we're complete
    if (now - this.lastUpdate < this.updateInterval && this.current < this.total) {
      return;
    }
    
    this.lastUpdate = now;
    
    const elapsed = Date.now() - this.startTime;
    const rate = data?.rate ?? (this.current / (elapsed / 1000));
    const eta = this.current > 0 && this.current < this.total 
      ? (this.total - this.current) / rate 
      : 0;

    this.progressBar.update(this.current, {
      rate: this.formatNumber(Math.round(rate)),
      duration_formatted: this.formatTime(elapsed),
      eta_formatted: eta > 0 ? this.formatTime(eta * 1000) : '0s'
    });
  }

  increment(amount: number = 1, data?: { rate?: number; customMessage?: string }): void {
    this.update(this.current + amount, data);
  }

  complete(message?: string): void {
    this.current = this.total;
    const elapsed = Date.now() - this.startTime;
    const rate = this.current / (elapsed / 1000);
    
    this.progressBar.update(this.total, {
      rate: this.formatNumber(Math.round(rate)),
      duration_formatted: this.formatTime(elapsed),
      eta_formatted: '0s'
    });
    
    this.progressBar.stop();
    
    if (message) {
      console.log(message);
    }
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }
}

// Simple logger with configurable verbosity
export enum LogLevel {
  QUIET = 0,
  NORMAL = 1,
  VERBOSE = 2
}

export class Logger {
  private static level: LogLevel = LogLevel.NORMAL;

  static setLevel(level: LogLevel): void {
    this.level = level;
  }

  static info(message: string): void {
    if (this.level >= LogLevel.NORMAL) {
      console.log(message);
    }
  }

  static verbose(message: string): void {
    if (this.level >= LogLevel.VERBOSE) {
      console.log(`[VERBOSE] ${message}`);
    }
  }

  static error(message: string): void {
    console.error(`ERROR: ${message}`);
  }

  static warn(message: string): void {
    if (this.level >= LogLevel.NORMAL) {
      console.warn(`WARNING: ${message}`);
    }
  }
}