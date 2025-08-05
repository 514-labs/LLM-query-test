import { Command } from 'commander';
import { PerformanceTester } from './testing/performance-tester';
import { ResultsReporter } from './reporting/reporter';
import { config } from './config/config';

// Configure CLI with Commander.js first to handle --help before config validation
const program = new Command();

program
  .name('db-performance-tester')
  .description('Performance testing application for ClickHouse vs PostgreSQL with LLM query patterns')
  .version('1.0.0')
  .option('--query-only', 'Run only query tests (skip data generation)')
  .option('--iterations <number>', 'Number of iterations per test')
  .option('--time-limit <minutes>', 'Time limit per test in minutes')
  .addHelpText('after', `

Available commands:
  npm run bulk-test            Comprehensive bulk testing (starts databases automatically)
  npm run generate-graphs      Generate performance visualizations (requires test results)
  npm run start-dbs            Start database containers
  npm start                    Full benchmark with data generation (requires start-dbs)
  npm run query-test           Statistical query tests (requires npm start)
  npm run clean                Clear databases and results
`);

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
  
  const tester = new PerformanceTester();
  
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