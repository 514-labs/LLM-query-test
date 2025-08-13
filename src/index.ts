import { Command } from 'commander';
import { PerformanceTester } from './testing/performance-tester';
import { ResultsReporter } from './reporting/reporter';
import { config } from './config/config';

// Configure CLI with Commander.js first to handle --help before config validation  
const program = new Command();

// Check if this is being run from package.json "help" script
const isHelpScript = process.argv[1]?.endsWith('index.js') && process.argv.includes('--help');

if (isHelpScript) {
  // Simple help for npm run help - no options shown
  console.log(`db-performance-tester

Performance testing application for ClickHouse vs PostgreSQL with LLM query patterns

Available commands:
  npm run bulk-test            Comprehensive bulk testing (starts databases automatically)
  npm run generate-graphs      Generate performance visualizations (requires test results)
  npm run latency-sim          Simulate chat conversation latency patterns
  npm run start-dbs            Start database containers
  npm run kill-dbs             Stop and remove all database containers
  npm start                    Full benchmark with data generation (requires start-dbs)
  npm run query-test           Statistical query tests (requires npm start)
  npm run clean                Clear databases and results
  npm run clean:db             Clear only databases
  npm run clean:output         Clear only output files
  npm run test:smoke           Run basic smoke tests
  npm run dev                  Run in development mode with ts-node
`);
  process.exit(0);
}

program
  .name('db-performance-tester')
  .description('Performance testing application for ClickHouse vs PostgreSQL with LLM query patterns')
  .version('1.0.0')
  .option('--query-only', 'Run only query tests (skip data generation)')
  .option('--iterations <number>', 'Number of iterations per test')
  .option('--time-limit <minutes>', 'Time limit per test in minutes')
  .option('--databases <databases>', 'Comma-separated database types (clickhouse,postgresql,postgresql-indexed)');

// Parse CLI arguments early to handle --help before any initialization
program.parse(process.argv);
const options = program.opts();

// Re-export config for backward compatibility
export { config };


async function main() {
  // Use parsed Commander.js options
  const queryOnly = options.queryOnly || false;
  
  // Get configuration from .env first, then override with CLI options
  const iterations = parseInt(options.iterations || config.test.queryIterations.toString());
  const timeLimitMinutes = parseInt(options.timeLimit || config.test.queryTimeLimit.toString());
  
  // Parse databases selection
  let databases: string[] | undefined;
  if (options.databases) {
    try {
      const parsedDatabases = options.databases.split(',').map((d: string) => d.trim().toLowerCase());
      
      // Validate database types
      const validDatabases = ['clickhouse', 'postgresql', 'postgresql-indexed'];
      const invalidDatabases = parsedDatabases.filter((db: string) => !validDatabases.includes(db));
      if (invalidDatabases.length > 0) {
        console.error(`Invalid database types: ${invalidDatabases.join(', ')}`);
        console.error(`Valid options: ${validDatabases.join(', ')}`);
        process.exit(1);
      }
      
      if (parsedDatabases.length === 0) {
        console.error('No databases specified');
        process.exit(1);
      }
      
      databases = parsedDatabases;
    } catch (error) {
      console.error(`Invalid databases format: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }
  
  const tester = new PerformanceTester();
  
  try {
    console.log('Starting Database Performance Testing Application');
    console.log('===============================================');
    
    if (queryOnly) {
      console.log(`Running query-only tests with ${iterations} iterations per configuration (${timeLimitMinutes}min time limit)`);
      if (databases) {
        console.log(`Testing databases: ${databases.join(', ')}`);
      }
    }
    
    await tester.initialize();
    
    const results = queryOnly 
      ? await tester.runQueryOnlyTests(iterations, timeLimitMinutes, databases)
      : await tester.runAllTests(databases);
    
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