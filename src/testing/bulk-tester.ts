import dotenv from 'dotenv';
import { Command } from 'commander';
import { spawn, execSync } from 'child_process';
import { DATABASE_TYPES } from '../constants/database';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

dotenv.config();

// Configure CLI with Commander.js
const program = new Command();

program
  .name('npm run bulk-test')
  .description('Comprehensive bulk testing across multiple dataset sizes')
  .version('1.0.0')
  .option('-s, --sizes <sizes>', 'comma-separated dataset sizes (e.g., "1000,10000,100000")')
  .option('-t, --time-limit <minutes>', 'time limit in minutes for each query test')
  .option('-o, --output-dir <dir>', 'output directory for results')
  .option('-d, --databases <databases>', 'comma-separated database types (e.g., "clickhouse,postgresql,postgresql-indexed")')
  .option('-i, --interactive', 'interactively select databases to test and manage results')
  .addHelpText('after', `

Configuration:
  Configuration is read from .env file first, then overridden by CLI flags.
  
  Environment variables:
    BULK_TEST_SIZES - comma-separated dataset sizes
    BULK_TEST_TIME_LIMIT - time limit in minutes  
    BULK_TEST_OUTPUT_DIR - output directory
    BULK_TEST_DATABASES - comma-separated database types
    BULK_TEST_CLEAR_RESULTS - set to 'true' to automatically clear previous results

  Supported database types:
    clickhouse           ClickHouse database
    postgresql           PostgreSQL without index
    postgresql-indexed   PostgreSQL with index

  Examples:
    npm run bulk-test                                      # Use .env configuration (all databases)
    npm run bulk-test -- --sizes "1000,10000,100000"     # Override dataset sizes
    npm run bulk-test -- --time-limit 30                  # Override time limit
    npm run bulk-test -- --databases "clickhouse"         # Test only ClickHouse
    npm run bulk-test -- --databases "postgresql,postgresql-indexed"  # Test only PostgreSQL variants
    npm run bulk-test -- --interactive                    # Interactive mode: select databases and manage results
    BULK_TEST_CLEAR_RESULTS=true npm run bulk-test        # Clear results automatically (for CI/CD)
`);

// Parse CLI arguments
program.parse();
const options = program.opts();

// ASCII Art Banner
function showBanner() {
  console.log('\x1b[36m'); // Cyan color
  console.log('██████  ██████      ██████  ███████ ███    ██  ██████ ██   ██ ███    ███  █████  ██████  ██   ██');
  console.log('██   ██ ██   ██     ██   ██ ██      ████   ██ ██      ██   ██ ████  ████ ██   ██ ██   ██ ██  ██ ');
  console.log('██   ██ ██████      ██████  █████   ██ ██  ██ ██      ███████ ██ ████ ██ ███████ ██████  █████  ');
  console.log('██   ██ ██   ██     ██   ██ ██      ██  ██ ██ ██      ██   ██ ██  ██  ██ ██   ██ ██   ██ ██  ██ ');
  console.log('██████  ██████      ██████  ███████ ██   ████  ██████ ██   ██ ██      ██ ██   ██ ██   ██ ██   ██');
  console.log('\x1b[0m'); // Reset color
  console.log('');
  console.log('\x1b[33m                            DB BENCHMARK\x1b[0m');
  console.log('\x1b[35m                ═══════════════════════════════════\x1b[0m');
  console.log('');
}

interface BulkTestConfig {
  sizes: number[];
  timeLimit: number; // in minutes
  outputDir: string;
  databases: string[];
  interactive?: boolean;
  clearResults?: boolean; // from env variable only
}

interface TestResult {
  size: number;
  dataGenTime: number;
  queryTime: number;
  success: boolean;
  error?: string;
  timestamp: string;
}

interface BulkTestSession {
  sessionId: string;
  startTime: string;
  totalSizes: number;
  completedSizes: number;
  results: TestResult[];
  currentSize?: number;
  estimatedEndTime?: string;
}

class BulkTester {
  private config: BulkTestConfig;
  private session: BulkTestSession;
  private sessionFile: string;

  constructor() {
    // Get configuration from .env first, then override with CLI options
    const envSizes = process.env.BULK_TEST_SIZES || '10000,50000,100000,500000,1000000,5000000,10000000,25000000';
    const envTimeLimit = process.env.BULK_TEST_TIME_LIMIT || '60';
    const envOutputDir = process.env.BULK_TEST_OUTPUT_DIR || 'output';
    const envDatabases = process.env.BULK_TEST_DATABASES || 'clickhouse,postgresql,postgresql-indexed';
    const envClearResults = process.env.BULK_TEST_CLEAR_RESULTS === 'true';

    // Parse sizes (CLI overrides .env)
    let sizes: number[];
    const sizesInput = options.sizes || envSizes;
    try {
      sizes = sizesInput.split(',').map((s: string) => parseInt(s.trim()));
      if (sizes.some(isNaN)) {
        throw new Error('Invalid number in sizes');
      }
    } catch (error) {
      console.warn('⚠️  Invalid sizes format, using defaults');
      sizes = [10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, 25000000];
    }

    // Parse databases (CLI overrides .env)
    let databases: string[];
    const databasesInput = options.databases || envDatabases;
    try {
      databases = databasesInput.split(',').map((d: string) => d.trim().toLowerCase());
      
      // Validate database types
      const validDatabases = ['clickhouse', 'postgresql', 'postgresql-indexed'];
      const invalidDatabases = databases.filter(db => !validDatabases.includes(db));
      if (invalidDatabases.length > 0) {
        throw new Error(`Invalid database types: ${invalidDatabases.join(', ')}`);
      }
      
      if (databases.length === 0) {
        throw new Error('No databases specified');
      }
    } catch (error) {
      console.warn(`⚠️  Invalid databases format (${error instanceof Error ? error.message : 'Unknown error'}), using all databases`);
      databases = ['clickhouse', 'postgresql', 'postgresql-indexed'];
    }

    this.config = {
      sizes: sizes.sort((a, b) => a - b), // Sort ascending
      timeLimit: parseInt(options.timeLimit || envTimeLimit),
      outputDir: options.outputDir || envOutputDir,
      databases: databases,
      interactive: options.interactive,
      clearResults: envClearResults
    };

    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    // Initialize session
    const sessionId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sessionFile = path.join(this.config.outputDir, `bulk-session-${sessionId}.json`);
    
    this.session = {
      sessionId,
      startTime: new Date().toISOString(),
      totalSizes: this.config.sizes.length,
      completedSizes: 0,
      results: []
    };

    this.saveSession();
  }

  private async promptUser(question: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        const response = answer.toLowerCase().trim();
        resolve(response === 'y' || response === 'yes');
      });
    });
  }

  private async promptForDatabases(): Promise<string[]> {
    console.log('\n\x1b[36mSelect databases to test:\x1b[0m');
    console.log('1) ClickHouse only');
    console.log('2) PostgreSQL (no index) only');
    console.log('3) PostgreSQL (with index) only');
    console.log('4) Both PostgreSQL variants');
    console.log('5) All databases (default)');
    console.log('6) Custom selection');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('\x1b[36mEnter your choice (1-6) [5]: \x1b[0m', (answer) => {
        rl.close();
        const choice = answer.trim() || '5';
        
        switch(choice) {
          case '1':
            resolve(['clickhouse']);
            break;
          case '2':
            resolve(['postgresql']);
            break;
          case '3':
            resolve(['postgresql-indexed']);
            break;
          case '4':
            resolve(['postgresql', 'postgresql-indexed']);
            break;
          case '5':
            resolve(['clickhouse', 'postgresql', 'postgresql-indexed']);
            break;
          case '6':
            // For custom selection, prompt again
            this.promptForCustomDatabases().then(resolve);
            break;
          default:
            console.log('Invalid choice, using all databases');
            resolve(['clickhouse', 'postgresql', 'postgresql-indexed']);
        }
      });
    });
  }

  private async promptForCustomDatabases(): Promise<string[]> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('\x1b[36mEnter databases (comma-separated): \x1b[0m', (answer) => {
        rl.close();
        const databases = answer.split(',').map(d => d.trim().toLowerCase());
        const validDatabases = ['clickhouse', 'postgresql', 'postgresql-indexed'];
        const valid = databases.filter(db => validDatabases.includes(db));
        const invalid = databases.filter(db => !validDatabases.includes(db));
        
        if (invalid.length > 0) {
          console.log(`\x1b[31mInvalid databases: ${invalid.join(', ')}\x1b[0m`);
          console.log('Using all databases instead');
          resolve(['clickhouse', 'postgresql', 'postgresql-indexed']);
        } else if (valid.length === 0) {
          console.log('No valid databases specified, using all databases');
          resolve(['clickhouse', 'postgresql', 'postgresql-indexed']);
        } else {
          resolve(valid);
        }
      });
    });
  }

  private async checkAndCleanPreviousResults(): Promise<void> {
    // Check for existing result files
    const resultFiles = fs.readdirSync(this.config.outputDir)
      .filter(file => file.startsWith('test-results_') || file.startsWith('query-test_'))
      .filter(file => file.endsWith('.json') || file.endsWith('.csv'));

    if (resultFiles.length > 0) {
      console.log(`\x1b[33mFound ${resultFiles.length} existing result files:\x1b[0m`);
      
      // Show a few examples
      const examples = resultFiles.slice(0, 3);
      examples.forEach(file => {
        console.log(`   ${file}`);
      });
      
      if (resultFiles.length > 3) {
        console.log(`   ... and ${resultFiles.length - 3} more files`);
      }
      
      console.log('');
      
      let shouldDelete = false;
      
      // Check if we should delete results
      if (this.config.clearResults) {
        console.log('\x1b[36mClearing existing results (BULK_TEST_CLEAR_RESULTS=true)\x1b[0m');
        shouldDelete = true;
      } else if (this.config.interactive) {
        // Only prompt in interactive mode
        shouldDelete = await this.promptUser('\x1b[36mDelete previous results before starting? (y/N): \x1b[0m');
      } else {
        // Default: keep results (safe for automation)
        console.log('\x1b[36mKeeping existing results. New results will be timestamped separately.\x1b[0m');
      }
      
      if (shouldDelete) {
        console.log('\x1b[33mCleaning up previous results...\x1b[0m');
        
        let deletedCount = 0;
        resultFiles.forEach(file => {
          try {
            fs.unlinkSync(path.join(this.config.outputDir, file));
            deletedCount++;
          } catch (error) {
            console.log(`\x1b[31mFailed to delete ${file}\x1b[0m`);
          }
        });
        
        console.log(`\x1b[32mDeleted ${deletedCount} result files\x1b[0m`);
        console.log('');
      }
    }
  }

  private saveSession(): void {
    fs.writeFileSync(this.sessionFile, JSON.stringify(this.session, null, 2));
  }

  private formatTime(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }

  private estimateTimeRemaining(): string {
    if (this.session.completedSizes === 0) return 'Calculating...';
    
    const elapsed = Date.now() - new Date(this.session.startTime).getTime();
    const avgTimePerSize = elapsed / this.session.completedSizes;
    const remaining = (this.session.totalSizes - this.session.completedSizes) * avgTimePerSize;
    
    return this.formatTime(remaining);
  }

  private async runCommand(command: string, args: string[] = [], suppressVerbose: boolean = false): Promise<{ success: boolean; time: number; error?: string }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      if (!suppressVerbose) {
        console.log(`\x1b[36m🔧 Running: ${command} ${args.join(' ')}\x1b[0m`);
      }
      
      if (suppressVerbose) {
        // Filter output while preserving progress bars
        const process = spawn(command, args, { 
          stdio: ['inherit', 'pipe', 'pipe'],
          shell: true 
        });

        let buffer = '';
        process.stdout?.on('data', (data: any) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          lines.forEach(line => {
            // Only show progress bars and key status messages
            if (line.includes('[█') || // Progress bars
                line.includes('✅') || // Success messages  
                line.includes('Final Results:') ||
                line.includes('Successfully inserted') ||
                line.includes('completed all') ||
                line.includes('iter/sec') ||
                line.includes('Database connections established') ||
                line.includes('Database setup complete') ||
                line.match(/^\s*(ClickHouse|PostgreSQL|PG \(w\/ Index\))\s*:/)) {
              console.log(line);
            }
          });
        });
        
        // Handle remaining buffer on end
        process.stdout?.on('end', () => {
          if (buffer.trim()) {
            if (buffer.includes('[█') || buffer.includes('✅') || buffer.includes('Final Results:')) {
              console.log(buffer);
            }
          }
        });

        process.on('close', (code: any) => {
          const time = Date.now() - startTime;
          if (code === 0) {
            resolve({ success: true, time });
          } else {
            resolve({ success: false, time, error: `Command failed with code ${code}` });
          }
        });

        process.on('error', (error: any) => {
          const time = Date.now() - startTime;
          resolve({ success: false, time, error: error.message });
        });
      } else {
        // Normal output
        const process = spawn(command, args, { 
          stdio: ['inherit', 'inherit', 'inherit'],
          shell: true 
        });

        process.on('close', (code: any) => {
          const time = Date.now() - startTime;
          if (code === 0) {
            resolve({ success: true, time });
          } else {
            resolve({ success: false, time, error: `Command failed with code ${code}` });
          }
        });

        process.on('error', (error: any) => {
          const time = Date.now() - startTime;
          resolve({ success: false, time, error: error.message });
        });
      }
    });
  }

  private async startDatabases(): Promise<boolean> {
    console.log('\x1b[33mStarting database containers...\x1b[0m');
    const result = await this.runCommand('npm', ['run', 'start-dbs', '--', '--cleanup-first']);
    
    if (result.success) {
      console.log('\x1b[32mDatabases started successfully\x1b[0m');
      // Wait a bit for containers to be ready
      await new Promise(resolve => setTimeout(resolve, 10000));
      return true;
    } else {
      console.log('\x1b[31mFailed to start databases\x1b[0m');
      return false;
    }
  }

  private async killDatabases(): Promise<void> {
    console.log('\x1b[33mStopping database containers...\x1b[0m');
    await this.runCommand('npm', ['run', 'kill-dbs']);
    console.log('\x1b[32mDatabases stopped\x1b[0m');
  }

  private async runDataGeneration(size: number): Promise<{ success: boolean; time: number; error?: string }> {
    console.log(`\x1b[34mGenerating ${this.formatNumber(size)} records...\x1b[0m`);
    
    // Set environment variable for this test
    process.env.DATASET_SIZE = size.toString();
    
    const result = await this.runCommand('npm', ['start'], true); // Filter verbose output
    
    if (result.success) {
      console.log(`\x1b[32mData generation completed in ${this.formatTime(result.time)}\x1b[0m`);
    } else {
      console.log(`\x1b[31mData generation failed: ${result.error}\x1b[0m`);
    }
    
    return result;
  }

  private async runQueryTest(): Promise<{ success: boolean; time: number; error?: string }> {
    console.log(`\x1b[35mRunning query tests (${this.config.timeLimit}min limit, databases: ${this.config.databases.join(',')})...\x1b[0m`);
    
    const result = await this.runCommand('npm', ['run', 'query-test', '--', `--time-limit=${this.config.timeLimit}`, `--databases=${this.config.databases.join(',')}`], true); // Filter verbose output
    
    if (result.success) {
      console.log(`\x1b[32mQuery tests completed in ${this.formatTime(result.time)}\x1b[0m`);
    } else {
      console.log(`\x1b[31mQuery tests failed: ${result.error}\x1b[0m`);
    }
    
    return result;
  }

  private async generateGraphs(): Promise<void> {
    console.log('\x1b[36mGenerating performance graphs...\x1b[0m');
    const result = await this.runCommand('npm', ['run', 'generate-graphs'], true); // Filter verbose output
    
    if (result.success) {
      console.log('\x1b[32mGraphs generated\x1b[0m');
    } else {
      console.log('\x1b[31mGraph generation failed, continuing...\x1b[0m');
    }
  }

  private showProgress(): void {
    const progress = (this.session.completedSizes / this.session.totalSizes) * 100;
    const eta = this.estimateTimeRemaining();
    const elapsed = this.formatTime(Date.now() - new Date(this.session.startTime).getTime());
    
    console.log('\x1b[35m═══════════════════════════════════════\x1b[0m');
    console.log(`\x1b[33mBULK TEST PROGRESS\x1b[0m`);
    console.log(`   Progress: ${this.session.completedSizes}/${this.session.totalSizes} (${progress.toFixed(1)}%)`);
    console.log(`   Elapsed:  ${elapsed}`);
    console.log(`   ETA:      ${eta}`);
    console.log(`   Current:  ${this.session.currentSize ? this.formatNumber(this.session.currentSize) + ' rows' : 'N/A'}`);
    console.log('\x1b[35m═══════════════════════════════════════\x1b[0m');
  }

  private showSummary(): void {
    console.log('\n\x1b[33mBULK TEST RESULTS SUMMARY\x1b[0m');
    console.log('\x1b[35m═══════════════════════════════════════════════\x1b[0m\n');

    const totalTime = Date.now() - new Date(this.session.startTime).getTime();
    const successful = this.session.results.filter(r => r.success).length;
    const failed = this.session.results.filter(r => !r.success).length;

    console.log(`\x1b[36mTotal Tests Run:\x1b[0m ${this.session.results.length}`);
    console.log(`\x1b[32mSuccessful:\x1b[0m     ${successful}`);
    console.log(`\x1b[31mFailed:\x1b[0m         ${failed}`);
    console.log(`\x1b[33mTotal Time:\x1b[0m     ${this.formatTime(totalTime)}\n`);

    if (successful > 0) {
      console.log('\x1b[35mPERFORMANCE BREAKDOWN:\x1b[0m');
      console.log('┌─────────┬─────────┬──────────┬────────────┬─────────────┬─────────────┬─────────────────┐');
      console.log('│ Dataset │ Status  │ Data Gen │ Query Test │ CH Query    │ PG Query    │ PG w/Idx Query  │');
      console.log('├─────────┼─────────┼──────────┼────────────┼─────────────┼─────────────┼─────────────────┤');

      // Read the latest result files to get query timing details
      this.session.results.forEach(result => {
        const size = this.formatNumber(result.size).padEnd(7);
        const status = result.success ? '\x1b[32mSuccess\x1b[0m' : '\x1b[31mFailed\x1b[0m ';
        const dataTime = this.formatTime(result.dataGenTime).padEnd(8);
        const queryTime = this.formatTime(result.queryTime).padEnd(10);
        
        // Try to read detailed query results from the most recent test file
        let chTime = 'N/A';
        let pgTime = 'N/A';
        let pgIdxTime = 'N/A';
        
        try {
          // Find the most recent query-test CSV files for this dataset size
          const outputDir = this.config.outputDir;
          const files = fs.readdirSync(outputDir)
            .filter(file => file.startsWith('query-test_') && file.endsWith('.csv'))
            .map(file => ({
              name: file,
              path: path.join(outputDir, file),
              time: fs.statSync(path.join(outputDir, file)).mtime
            }))
            .sort((a, b) => b.time.getTime() - a.time.getTime()); // Most recent first
          
          // Look for query results that match our dataset size
          for (const file of files.slice(0, 5)) { // Check last 5 files
            try {
              const csvContent = fs.readFileSync(file.path, 'utf8');
              const lines = csvContent.split('\n').filter(line => line.trim());
              
              if (lines.length > 1) {
                // Parse CSV header and data
                const header = lines[0].split(',');
                const dataLines = lines.slice(1);
                
                // Look for rows matching our dataset size
                for (const line of dataLines) {
                  const values = line.split(',');
                  const rows = parseInt(values[1]); // Rows column
                  
                  if (Math.abs(rows - result.size) < result.size * 0.1) {
                    // Found matching dataset size
                    const database = values[0]; // Database column
                    const index = values[2]; // Index column
                    const totalMean = parseFloat(values[26]); // Total_Mean_ms column
                    
                    if (database.includes(DATABASE_TYPES.CLICKHOUSE)) {
                      chTime = `${totalMean.toFixed(1)}ms`;
                    } else if (database.includes(DATABASE_TYPES.POSTGRESQL)) {
                      if (index === 'yes') {
                        pgIdxTime = `${totalMean.toFixed(1)}ms`;
                      } else {
                        pgTime = `${totalMean.toFixed(1)}ms`;
                      }
                    }
                  }
                }
                
                // If we found data for this size, break
                if (chTime !== 'N/A' || pgTime !== 'N/A' || pgIdxTime !== 'N/A') {
                  break;
                }
              }
            } catch (e) {
              // Continue to next file
            }
          }
        } catch (e) {
          // Use N/A values
        }
        
        chTime = chTime.padEnd(11);
        pgTime = pgTime.padEnd(11);
        pgIdxTime = pgIdxTime.padEnd(15);
        
        console.log(`│ ${size} │ ${status} │ ${dataTime} │ ${queryTime} │ ${chTime} │ ${pgTime} │ ${pgIdxTime} │`);
      });

      console.log('└─────────┴─────────┴──────────┴────────────┴─────────────┴─────────────┴─────────────────┘\n');
    }

    if (failed > 0) {
      console.log('\x1b[31mFAILED TESTS:\x1b[0m');
      this.session.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`   ${this.formatNumber(result.size)} rows: ${result.error}`);
        });
      console.log();
    }

    console.log(`\x1b[36mSession saved to:\x1b[0m ${this.sessionFile}`);
    console.log(`\x1b[36mResults available in:\x1b[0m ${this.config.outputDir}/`);
    console.log('\x1b[35m═══════════════════════════════════════════════\x1b[0m');
    console.log('\x1b[33mDB BENCHMARKING COMPLETE\x1b[0m\n');
  }

  async run(): Promise<void> {
    showBanner();
    
    // Check for previous results and offer to clean them
    await this.checkAndCleanPreviousResults();
    
    // Handle interactive database selection
    // Only prompt if:
    // 1. Interactive flag is set
    // 2. No databases specified via CLI
    // 3. No databases specified via env (or using default)
    if (this.config.interactive && !options.databases && (!process.env.BULK_TEST_DATABASES || process.env.BULK_TEST_DATABASES === '')) {
      this.config.databases = await this.promptForDatabases();
    }
    
    console.log(`\x1b[33mBULK TESTING CONFIGURATION:\x1b[0m`);
    console.log(`   Dataset sizes: ${this.config.sizes.map(s => this.formatNumber(s)).join(', ')}`);
    console.log(`   Query time limit: ${this.config.timeLimit} minutes`);
    console.log(`   Databases: ${this.config.databases.join(', ')}`);
    console.log(`   Total tests: ${this.config.sizes.length}`);
    console.log(`   Session ID: ${this.session.sessionId}\n`);

    // Handle graceful shutdown
    let shutdownRequested = false;
    const handleShutdown = () => {
      if (!shutdownRequested) {
        shutdownRequested = true;
        console.log('\n\x1b[31m🛑 SHUTDOWN REQUESTED - Finishing current test and cleaning up...\x1b[0m');
      }
    };
    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);

    try {
      for (let i = 0; i < this.config.sizes.length && !shutdownRequested; i++) {
        const size = this.config.sizes[i];
        this.session.currentSize = size;
        this.showProgress();

        console.log(`\n\x1b[33mSTARTING TEST ${i + 1}/${this.config.sizes.length}: ${this.formatNumber(size)} ROWS\x1b[0m`);
        console.log('\x1b[35m═══════════════════════════════════════\x1b[0m');

        const testResult: TestResult = {
          size,
          dataGenTime: 0,
          queryTime: 0,
          success: false,
          timestamp: new Date().toISOString()
        };

        // Step 1: Start databases
        if (!await this.startDatabases()) {
          testResult.error = 'Failed to start databases';
          this.session.results.push(testResult);
          this.saveSession();
          continue;
        }

        try {
          // Step 2: Generate data
          const dataResult = await this.runDataGeneration(size);
          testResult.dataGenTime = dataResult.time;
          
          if (!dataResult.success) {
            testResult.error = `Data generation failed: ${dataResult.error}`;
            this.session.results.push(testResult);
            this.saveSession();
            continue;
          }

          // Step 3: Run query tests
          const queryResult = await this.runQueryTest();
          testResult.queryTime = queryResult.time;
          
          if (!queryResult.success) {
            testResult.error = `Query test failed: ${queryResult.error}`;
          } else {
            testResult.success = true;
            
            // Step 4: Generate graphs after successful test
            await this.generateGraphs();
          }

        } finally {
          // Step 5: Always kill databases
          await this.killDatabases();
        }

        this.session.results.push(testResult);
        this.session.completedSizes++;
        this.saveSession();

        const status = testResult.success ? '\x1b[32mSUCCESS\x1b[0m' : '\x1b[31mFAILED\x1b[0m';
        console.log(`\n\x1b[33mTEST ${i + 1} COMPLETE: ${status}\x1b[0m`);
        
        // Memory cleanup between tests
        if (global.gc) {
          global.gc();
        }
        
        // Brief pause between tests
        if (i < this.config.sizes.length - 1 && !shutdownRequested) {
          console.log('\x1b[36mBrief pause before next test...\x1b[0m');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      if (shutdownRequested) {
        console.log('\n\x1b[31mBULK TEST INTERRUPTED BY USER\x1b[0m');
      }

      // Final graph generation
      if (this.session.results.some(r => r.success)) {
        console.log('\n\x1b[36mGENERATING FINAL COMPREHENSIVE GRAPHS...\x1b[0m');
        await this.generateGraphs();
      }

      this.showSummary();

    } catch (error) {
      console.error('\x1b[31m💥 BULK TEST CRASHED:\x1b[0m', error);
      throw error;
    } finally {
      // Cleanup
      process.removeListener('SIGINT', handleShutdown);
      process.removeListener('SIGTERM', handleShutdown);
      
      // Ensure databases are stopped
      await this.killDatabases();
    }
  }
}

// Main execution
async function main() {
  try {
    const bulkTester = new BulkTester();
    await bulkTester.run();
    process.exit(0);
  } catch (error) {
    console.error('\x1b[31m💥 FATAL ERROR:\x1b[0m', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}