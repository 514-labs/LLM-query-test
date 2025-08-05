#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Command } from 'commander';
import * as cliProgress from 'cli-progress';
import { DATABASE_TYPES } from '../constants/database';

// Configure CLI with Commander.js
const program = new Command();

program
  .name('npm run latency-sim')
  .description('Interactive latency simulator using pre-recorded test data')
  .version('1.0.0')
  .option('-d, --output-dir <dir>', 'directory containing test results', 'output')
  .addHelpText('after', `
This simulator demonstrates the real-world impact of database performance
on user experience by using pre-recorded performance statistics from
actual benchmark tests.

Make sure to run tests first:
  npm start && npm run query-test
  
Examples:
  npm run latency-sim                        # Use default output directory
  npm run latency-sim -- --output-dir my-results # Use custom results directory
`);

// Parse CLI arguments
program.parse();
const options = program.opts();

interface DatabaseConfig {
  name: string;
  key: string;
}

interface ChatMessage {
  user: string;
  assistant: string;
  description: string;
}

class LatencySimulator {
  private outputDir = path.join(process.cwd(), options.outputDir);
  private databases: DatabaseConfig[] = [
    { name: 'ClickHouse', key: DATABASE_TYPES.CLICKHOUSE },
    { name: 'PostgreSQL (no index)', key: 'postgresql-no-idx' },
    { name: 'PostgreSQL (with index)', key: 'postgresql-idx' }
  ];

  private chatMessages: ChatMessage[] = [
    {
      user: "How many unique aircraft are currently in our tracking system?",
      assistant: "We're tracking 847 unique aircraft in the system.",
      description: "Database discovery and counting"
    },
    {
      user: "Can you show me a sample of the recent tracking data?",
      assistant: "Here's recent data: Flight UAL123 at 35,000ft, 420mph; Delta456 at 28,000ft, 380mph; Southwest789 at 32,000ft, 450mph.",
      description: "Sample data retrieval"
    },
    {
      user: "What's the average altitude of aircraft in the last hour?",
      assistant: "The average altitude of aircraft in the last hour is 31,247 feet.",
      description: "Analytical query with aggregation"
    },
    {
      user: "How many aircraft are in the air on average every minute?",
      assistant: "Based on the last hour's data, there are approximately 523 aircraft in the air on average every minute.",
      description: "Complex analytical calculation"
    }
  ];

  private async promptUser(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  private getLatencyData(): Record<string, Record<string, number>> {
    // Find JSON result files (same logic as graph generator)
    if (!fs.existsSync(this.outputDir)) {
      throw new Error('No test results found. Run tests first: npm start && npm run query-test');
    }

    const files = fs.readdirSync(this.outputDir)
      .filter(file => file.endsWith('.json') && !file.includes('bulk-session'))
      .map(file => ({
        name: file,
        path: path.join(this.outputDir, file)
      }));

    if (files.length === 0) {
      throw new Error('No test results found. Run tests first: npm start && npm run query-test');
    }

    // Get results by dataset size (same logic as graph generator)
    const sizeMap: Record<string, {results: any[], timestamp: number}> = {};

    for (const file of files) {
      try {
        const content = fs.readFileSync(file.path, 'utf8');
        const results = JSON.parse(content);
        if (results.length === 0) continue;

        // Extract timestamp from filename
        const timestampMatch = file.name.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
        const timestamp = timestampMatch ? new Date(timestampMatch[1].replace('_', 'T').replace(/-/g, ':')).getTime() : 0;

        // Group by dataset size
        const grouped = this.groupBySize(results);
        for (const [size, sizeResults] of Object.entries(grouped)) {
          const key = size;
          
          // Keep only the most recent results for each size
          if (!sizeMap[key] || timestamp > sizeMap[key].timestamp) {
            sizeMap[key] = { results: sizeResults, timestamp };
          }
        }
      } catch (error) {
        console.log(`⚠️  Skipping corrupted file: ${file.name}`);
      }
    }

    // Convert to latency data format
    const data: Record<string, Record<string, number>> = {};
    
    for (const [size, { results }] of Object.entries(sizeMap)) {
      data[size] = {};
      
      for (const result of results) {
        // Calculate total query time
        const totalTime = result.queryResults.reduce((sum: number, query: any) => sum + (query?.duration || 0), 0);
        
        // Format database key
        let dbKey: string;
        if (result.configuration.database === DATABASE_TYPES.CLICKHOUSE) {
          dbKey = DATABASE_TYPES.CLICKHOUSE;
        } else if (result.configuration.database === DATABASE_TYPES.POSTGRESQL) {
          dbKey = result.configuration.withIndex ? 'postgresql-idx' : 'postgresql-no-idx';
        } else {
          continue;
        }
        
        data[size][dbKey] = totalTime;
      }
    }
    
    return data;
  }

  private groupBySize(results: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const result of results) {
      const size = result.configuration.rowCount >= 1000000 
        ? `${(result.configuration.rowCount / 1000000).toFixed(0)}M`
        : `${(result.configuration.rowCount / 1000).toFixed(0)}K`;
      
      if (!grouped[size]) {
        grouped[size] = [];
      }
      grouped[size].push(result);
    }
    
    return grouped;
  }

  private getAvailableSizes(data: Record<string, Record<string, number>>): string[] {
    return Object.keys(data).sort((a, b) => {
      const aNum = this.parseSize(a);
      const bNum = this.parseSize(b);
      return aNum - bNum;
    });
  }

  private parseSize(size: string): number {
    const match = size.match(/^([\d.]+)([KMB]?)$/);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'K': return num * 1000;
      case 'M': return num * 1000000;
      case 'B': return num * 1000000000;
      default: return num;
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async showSpinner(duration: number, message: string): Promise<void> {
    // Use cli-progress library like the rest of the project
    const progressBar = new cliProgress.SingleBar({
      format: `{spinner} ${message} | {duration_formatted}`,
      hideCursor: true,
      clearOnComplete: true,
      linewrap: false
    }, cliProgress.Presets.shades_classic);
    
    const startTime = Date.now();
    progressBar.start(duration, 0, {
      spinner: '⠋',
      duration_formatted: '0ms'
    });
    
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIndex = 0;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      progressBar.update(Math.min(elapsed, duration), {
        spinner: spinnerChars[spinnerIndex],
        duration_formatted: `${elapsed}ms`
      });
      spinnerIndex = (spinnerIndex + 1) % spinnerChars.length;
      
      if (elapsed >= duration) {
        clearInterval(interval);
      }
    }, 100);
    
    await this.sleep(duration);
    clearInterval(interval);
    
    progressBar.stop();
    console.log(`✓ ${message} (${duration.toFixed(1)}ms)`);
  }

  private async typeMessage(message: string, speed: number = 50): Promise<void> {
    for (const char of message) {
      process.stdout.write(char);
      await this.sleep(speed);
    }
    console.log();
  }

  async run(): Promise<void> {
    console.log('Database Latency Simulator');
    console.log('=========================\n');
    console.log('⚠️  IMPORTANT: This simulator uses pre-recorded performance data from bulk tests.');
    console.log('   No actual database queries are executed during this simulation.');
    console.log('   All delays are based on statistical analysis from real query test results.\n');
    console.log('This simulator demonstrates the real-world impact of database performance');
    console.log('by simulating a chat conversation with realistic query delays.\n');

    try {
      const latencyData = this.getLatencyData();
      const availableSizes = this.getAvailableSizes(latencyData);

      // Dataset selection
      console.log('Available dataset sizes:');
      availableSizes.forEach((size, index) => {
        console.log(`  ${index + 1}. ${size} rows`);
      });
      
      const sizeChoice = await this.promptUser('\nSelect dataset size (1-' + availableSizes.length + '): ');
      const sizeIndex = parseInt(sizeChoice) - 1;
      
      if (sizeIndex < 0 || sizeIndex >= availableSizes.length) {
        console.log('Invalid selection');
        return;
      }
      
      const selectedSize = availableSizes[sizeIndex];
      const sizeData = latencyData[selectedSize];

      // Database selection
      console.log('\nAvailable databases:');
      this.databases.forEach((db, index) => {
        const latency = sizeData[db.key];
        if (latency !== undefined) {
          console.log(`  ${index + 1}. ${db.name} (${latency.toFixed(1)}ms total)`);
        }
      });
      
      const dbChoice = await this.promptUser('\nSelect database (1-' + this.databases.length + '): ');
      const dbIndex = parseInt(dbChoice) - 1;
      
      if (dbIndex < 0 || dbIndex >= this.databases.length) {
        console.log('Invalid selection');
        return;
      }
      
      const selectedDb = this.databases[dbIndex];
      const totalLatency = sizeData[selectedDb.key];
      
      if (totalLatency === undefined) {
        console.log('No performance data available for this combination');
        return;
      }

      // Start simulation
      console.log(`\nStarting chat simulation with ${selectedDb.name} on ${selectedSize} dataset`);
      console.log(`Expected delay per question: ${totalLatency.toFixed(1)}ms`);
      console.log('💡 Reminder: This uses pre-recorded performance statistics, not live database queries\n');
      console.log('=' .repeat(60));
      
      for (const [index, message] of this.chatMessages.entries()) {
        console.log(`\nUser: ${message.user}`);
        
        await this.showSpinner(totalLatency, `Processing query (${message.description})`);
        
        process.stdout.write('Assistant: ');
        await this.typeMessage(message.assistant, 15); // Much faster typing
        
        if (index < this.chatMessages.length - 1) {
          await this.sleep(1000); // Brief pause between messages
        }
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('Chat simulation complete!\n');
      
      // Show comparison
      console.log('Performance comparison for this dataset:');
      this.databases.forEach(db => {
        const latency = sizeData[db.key];
        if (latency !== undefined) {
          const indicator = db.key === selectedDb.key ? '→' : ' ';
          console.log(`${indicator} ${db.name}: ${latency.toFixed(1)}ms per question`);
        }
      });
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }
  }
}

// Main execution
async function main() {
  const simulator = new LatencySimulator();
  await simulator.run();
}

if (require.main === module) {
  main().catch(console.error);
}