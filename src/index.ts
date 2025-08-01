import dotenv from 'dotenv';
import { PerformanceTester } from './performance-tester';
import { ResultsReporter } from './reporter';

dotenv.config();

// Configuration (merged from config.ts)
export const config = {
  clickhouse: {
    host: process.env.CLICKHOUSE_HOST || 'localhost',
    port: parseInt(process.env.CLICKHOUSE_PORT || '8123'),
    database: process.env.CLICKHOUSE_DATABASE || 'performance_test',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  },
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'performance_test',
    username: process.env.POSTGRES_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  },
  postgresIndexed: {
    host: process.env.POSTGRES_INDEXED_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_INDEXED_PORT || '5433'),
    database: process.env.POSTGRES_INDEXED_DATABASE || 'performance_test',
    username: process.env.POSTGRES_INDEXED_USERNAME || 'postgres',
    password: process.env.POSTGRES_INDEXED_PASSWORD || 'postgres',
  },
  test: {
    datasetSize: parseInt(process.env.DATASET_SIZE || '10000000'),
    batchSize: parseInt(process.env.BATCH_SIZE || '50000'),
    parallelInsert: process.env.PARALLEL_INSERT === 'true',
    parallelWorkers: parseInt(process.env.PARALLEL_WORKERS || '4'),
  },
};

// Help command (merged from help.ts)
function showHelp(): void {
  console.log('📋 Available Commands:');
  console.log();
  console.log('npm start                    Run full performance test with data generation');
  console.log('npm run query-test           Run 100-iteration statistical test (--iterations=N --time-limit=N)');
  console.log('npm run bulk-test            Run comprehensive bulk testing across multiple dataset sizes');
  console.log('npm run graphs               Generate ASCII performance graphs from results (--update-readme)');
  console.log('npm run latency-sim          Interactive latency simulator showing real-world impact');
  console.log('npm run start-dbs            Start all database containers (ClickHouse + 2x PostgreSQL)');
  console.log('npm run clean                Clear databases and result files');
  console.log('npm run clean:db             Clear database tables only');
  console.log('npm run clean:output         Clear result files only');
  console.log('npm run kill-dbs             Remove all database containers');
  console.log('npm run help                 Show this help');
  console.log();
  console.log('Database Setup:');
  console.log('  • ClickHouse on port 8123');
  console.log('  • PostgreSQL (no indexes) on port 5432');
  console.log('  • PostgreSQL (with indexes) on port 5433');
  console.log();
  console.log('Workflow: npm run clean → npm start → npm run query-test → npm run graphs');
  console.log();
  console.log('🔄 Tests auto-resume from checkpoints if interrupted (Ctrl+C safe)');
}

interface CommandLineArgs {
  queryOnly: boolean;
  iterations: number;
  timeLimitMinutes: number;
}

function parseArgs(): CommandLineArgs {
  const args = process.argv.slice(2);
  
  // Handle help flags
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  const queryOnly = args.includes('--query-only');
  const iterationsArg = args.find(arg => arg.startsWith('--iterations='));
  const timeLimitArg = args.find(arg => arg.startsWith('--time-limit='));
  
  const iterations = iterationsArg ? parseInt(iterationsArg.split('=')[1]) : (queryOnly ? 100 : 1);
  const timeLimitMinutes = timeLimitArg ? parseInt(timeLimitArg.split('=')[1]) : 60;
  
  return { queryOnly, iterations, timeLimitMinutes };
}

async function main() {
  const tester = new PerformanceTester();
  const { queryOnly, iterations, timeLimitMinutes } = parseArgs();
  
  try {
    console.log('Starting Database Performance Testing Application');
    console.log('===============================================');
    
    if (queryOnly) {
      console.log(`Running query-only tests with ${iterations} iterations per configuration (${timeLimitMinutes}min time limit)`);
    }
    
    await tester.initialize();
    
    const results = queryOnly 
      ? await tester.runQueryOnlyTests(iterations, timeLimitMinutes)
      : await tester.runAllTests();
    
    ResultsReporter.printResults(results);
    
    // Save with timestamped filenames (will auto-generate if not specified)
    ResultsReporter.saveToFile(results);
    ResultsReporter.saveCSV(results);
    
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

if (require.main === module) {
  main().catch(console.error);
}