#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import select from '@inquirer/select';
import confirm from '@inquirer/confirm';
import chalk from 'chalk';

interface DatabaseConfig {
  name: string;
  key: string;
  color: string;
}

interface ChatMessage {
  user: string;
  assistant: string;
  description: string;
}

class CharmLatencySimulator {
  private outputDir = path.join(process.cwd(), 'output');
  private databases: DatabaseConfig[] = [
    { name: 'ClickHouse', key: 'clickhouse', color: 'green' },
    { name: 'PostgreSQL (no index)', key: 'postgresql-no-idx', color: 'red' },
    { name: 'PostgreSQL (with index)', key: 'postgresql-idx', color: 'yellow' }
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

  private showHeader(): void {
    console.clear();
    console.log(chalk.bold.cyan('╭─────────────────────────────────────────────────────────╮'));
    console.log(chalk.bold.cyan('│') + chalk.bold.white('           Database Latency Simulator') + chalk.bold.cyan('                │'));
    console.log(chalk.bold.cyan('╰─────────────────────────────────────────────────────────╯'));
    console.log();
    console.log(chalk.yellow.bold('⚠️  IMPORTANT:') + chalk.white(' This simulator uses pre-recorded performance data from bulk tests.'));
    console.log(chalk.gray('   No actual database queries are executed during this simulation.'));
    console.log(chalk.gray('   All delays are based on statistical analysis from real query test results.'));
    console.log();
  }

  private getLatencyData(): Record<string, Record<string, number>> {
    // Find JSON result files (same logic as original)
    if (!fs.existsSync(this.outputDir)) {
      throw new Error('No test results found. Run tests first: ' + chalk.cyan('npm start && npm run query-test'));
    }

    const files = fs.readdirSync(this.outputDir)
      .filter(file => file.endsWith('.json') && !file.includes('bulk-session'))
      .map(file => ({
        name: file,
        path: path.join(this.outputDir, file)
      }));

    if (files.length === 0) {
      throw new Error('No test results found. Run tests first: ' + chalk.cyan('npm start && npm run query-test'));
    }

    // Get results by dataset size (same logic as original)
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
        console.log(chalk.gray(`⚠️  Skipping corrupted file: ${file.name}`));
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
        if (result.configuration.database === 'clickhouse') {
          dbKey = 'clickhouse';
        } else if (result.configuration.database === 'postgresql') {
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

  private async showSpinnerWithDelay(duration: number, message: string, dbColor: string): Promise<void> {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const frame = chalk.hex(dbColor === 'green' ? '#00ff00' : dbColor === 'red' ? '#ff0000' : '#ffff00')(frames[i]);
      process.stdout.write(`\r${frame} ${chalk.gray(message)} ${chalk.cyan(`${elapsed.toFixed(0)}ms`)}`);
      i = (i + 1) % frames.length;
    }, 100);
    
    await this.sleep(duration);
    clearInterval(interval);
    
    const finalColor = dbColor === 'green' ? chalk.green : dbColor === 'red' ? chalk.red : chalk.yellow;
    process.stdout.write(`\r✅ ${chalk.gray(message)} ${finalColor(`${duration.toFixed(1)}ms`)}\n`);
  }

  private async typeMessage(message: string, color: string = 'white'): Promise<void> {
    const chalkColor = color === 'green' ? chalk.green : color === 'red' ? chalk.red : color === 'yellow' ? chalk.yellow : chalk.white;
    
    for (const char of message) {
      process.stdout.write(chalkColor(char));
      await this.sleep(20); // Fast typing
    }
    console.log();
  }

  private async createTypedChatBubble(message: string, isUser: boolean, dbColor?: string): Promise<void> {
    const bubbleWidth = 58; // Total inside width
    const words = message.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    // Word wrap to fit exactly inside bubble
    words.forEach(word => {
      if ((currentLine + word).length > bubbleWidth) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });
    if (currentLine) lines.push(currentLine.trim());

    console.log();

    if (isUser) {
      // User bubbles appear instantly (blue)
      const color = chalk.blue;
      
      console.log(color('╭' + '─'.repeat(bubbleWidth + 2) + '╮'));
      lines.forEach(line => {
        const paddedLine = line.padEnd(bubbleWidth);
        console.log(color('│ ') + chalk.white(paddedLine) + color(' │'));
      });
      console.log(color('╰' + '─'.repeat(bubbleWidth + 2) + '╯'));
    } else {
      // Assistant responses get typed out with animation
      const color = dbColor === 'green' ? chalk.green : dbColor === 'red' ? chalk.red : chalk.yellow;
      
      // Show bubble frame first
      console.log(color('╭' + '─'.repeat(bubbleWidth + 2) + '╮'));
      
      // Type each line with animation
      for (const line of lines) {
        process.stdout.write(color('│ '));
        
        // Type out the line character by character
        for (const char of line) {
          process.stdout.write(chalk.white(char));
          await this.sleep(15); // Typing speed
        }
        
        // Fill remaining space and close the line
        const remainingSpace = bubbleWidth - line.length;
        process.stdout.write(' '.repeat(remainingSpace) + color(' │\n'));
      }
      
      console.log(color('╰' + '─'.repeat(bubbleWidth + 2) + '╯'));
    }
  }

  private createChatBubble(message: string, isUser: boolean, dbColor?: string): void {
    const maxWidth = 60;
    const padding = 2;
    const words = message.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    // Word wrap
    words.forEach(word => {
      if ((currentLine + word).length > maxWidth - padding * 2) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });
    if (currentLine) lines.push(currentLine.trim());

    if (isUser) {
      // User bubble (blue, right-aligned)
      const color = chalk.blue;
      console.log();
      lines.forEach((line, i) => {
        const paddedLine = line.padStart(maxWidth - padding);
        if (i === 0) {
          console.log(color('╭' + '─'.repeat(line.length + padding * 2) + '╮'));
        }
        console.log(color('│') + chalk.white(` ${line} `) + color('│'));
        if (i === lines.length - 1) {
          console.log(color('╰' + '─'.repeat(line.length + padding * 2) + '╯'));
        }
      });
    } else {
      // Assistant bubble (colored by database performance)
      const color = dbColor === 'green' ? chalk.green : dbColor === 'red' ? chalk.red : chalk.yellow;
      console.log();
      lines.forEach((line, i) => {
        if (i === 0) {
          console.log(color('╭' + '─'.repeat(line.length + padding * 2) + '╮'));
        }
        console.log(color('│') + chalk.white(` ${line} `) + color('│'));
        if (i === lines.length - 1) {
          console.log(color('╰' + '─'.repeat(line.length + padding * 2) + '╯'));
        }
      });
    }
  }

  async run(): Promise<void> {
    try {
      this.showHeader();
      
      const latencyData = this.getLatencyData();
      const availableSizes = this.getAvailableSizes(latencyData);

      // Dataset selection with enhanced UI
      console.log(chalk.bold('📊 Available Dataset Sizes:'));
      const sizeChoices = availableSizes.map(size => ({
        name: `${size} rows`,
        value: size,
        description: `${this.parseSize(size).toLocaleString()} aircraft tracking records`
      }));

      const selectedSize = await select({
        message: 'Select dataset size:',
        choices: sizeChoices,
      });

      const sizeData = latencyData[selectedSize];

      // Database selection with performance preview
      console.log('\n' + chalk.bold('🗄️  Available Databases:'));
      const dbChoices = this.databases
        .filter(db => sizeData[db.key] !== undefined)
        .map(db => {
          const latency = sizeData[db.key];
          const performanceIcon = latency < 50 ? '🚀' : latency < 200 ? '⚡' : latency < 1000 ? '🐌' : '🐌💨';
          return {
            name: `${performanceIcon} ${db.name}`,
            value: db.key,
            description: `Average: ${latency.toFixed(1)}ms per question`
          };
        });

      const selectedDbKey = await select({
        message: 'Select database:',
        choices: dbChoices,
      });

      const selectedDb = this.databases.find(db => db.key === selectedDbKey)!;
      const totalLatency = sizeData[selectedDb.key];

      // Start simulation confirmation
      console.log('\n' + chalk.bold('🎬 Simulation Setup:'));
      console.log(chalk.gray(`  Database: ${selectedDb.name}`));
      console.log(chalk.gray(`  Dataset: ${selectedSize} rows`));
      console.log(chalk.gray(`  Expected delay: ${totalLatency.toFixed(1)}ms per question`));
      console.log(chalk.gray(`  💡 Uses pre-recorded performance statistics`));

      const shouldStart = await confirm({
        message: 'Start chat simulation?',
        default: true,
      });

      if (!shouldStart) {
        console.log(chalk.yellow('Simulation cancelled.'));
        return;
      }

      // Chat simulation with enhanced UI
      console.clear();
      console.log(chalk.bold.cyan('🎭 Chat Simulation Active'));
      console.log(chalk.gray('────────────────────────────────────────────────────────'));
      console.log(chalk.gray(`Database: ${selectedDb.name} | Dataset: ${selectedSize} | Avg: ${totalLatency.toFixed(1)}ms`));
      
      for (const [index, message] of this.chatMessages.entries()) {
        await this.createTypedChatBubble(message.user, true);
        
        await this.showSpinnerWithDelay(totalLatency, message.description, selectedDb.color);
        
        await this.createTypedChatBubble(message.assistant, false, selectedDb.color);
        
        if (index < this.chatMessages.length - 1) {
          await this.sleep(1500); // Brief pause between messages
        }
      }

      // Results summary
      console.log('\n' + chalk.bold.green('✅ Chat Simulation Complete!'));
      console.log(chalk.cyan('═══════════════════════════════════════════════'));
      
      console.log('\n' + chalk.bold('📊 Performance Comparison for ' + selectedSize + ' dataset:'));
      this.databases.forEach(db => {
        const latency = sizeData[db.key];
        if (latency !== undefined) {
          const color = db.color === 'green' ? chalk.green : db.color === 'red' ? chalk.red : chalk.yellow;
          const indicator = db.key === selectedDb.key ? color('●') : chalk.gray('○');
          const perfIcon = latency < 50 ? '🚀' : latency < 200 ? '⚡' : latency < 1000 ? '🐌' : '🐌💨';
          console.log(`  ${indicator} ${perfIcon} ${db.name}: ${color(latency.toFixed(1) + 'ms')} per question`);
        }
      });
      
      console.log('\n' + chalk.gray('💡 Experience the difference in real-time response speeds!'));
      
    } catch (error) {
      console.error(chalk.red('\n💥 Error:'), error instanceof Error ? error.message : String(error));
    }
  }
}

// Main execution
async function main() {
  const simulator = new CharmLatencySimulator();
  await simulator.run();
}

if (require.main === module) {
  main().catch(console.error);
}