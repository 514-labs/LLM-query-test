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
  .allowUnknownOption() // Allow test-specific options without showing them in help
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
program.parse();

// Re-export config for backward compatibility
export { config };


async function main() {
  // Manually parse test-specific options from process.argv
  const args = process.argv;
  const queryOnly = args.includes('--query-only');
  
  const iterationsIndex = args.findIndex(arg => arg === '--iterations');
  const iterationsArg = iterationsIndex !== -1 && iterationsIndex + 1 < args.length ? args[iterationsIndex + 1] : null;
  
  const timeLimitIndex = args.findIndex(arg => arg === '--time-limit');
  const timeLimitArg = timeLimitIndex !== -1 && timeLimitIndex + 1 < args.length ? args[timeLimitIndex + 1] : null;
  
  // Get configuration from .env first, then override with CLI options
  const iterations = parseInt(iterationsArg || config.test.queryIterations.toString());
  const timeLimitMinutes = parseInt(timeLimitArg || config.test.queryTimeLimit.toString());
  
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