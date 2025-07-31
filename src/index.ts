import { PerformanceTester } from './performance-tester';
import { ResultsReporter } from './reporter';

interface CommandLineArgs {
  queryOnly: boolean;
  iterations: number;
}

function parseArgs(): CommandLineArgs {
  const args = process.argv.slice(2);
  const queryOnly = args.includes('--query-only');
  const iterationsArg = args.find(arg => arg.startsWith('--iterations='));
  const iterations = iterationsArg ? parseInt(iterationsArg.split('=')[1]) : 1;
  
  return { queryOnly, iterations };
}

async function main() {
  const tester = new PerformanceTester();
  const { queryOnly, iterations } = parseArgs();
  
  try {
    console.log('Starting Database Performance Testing Application');
    console.log('===============================================');
    
    if (queryOnly) {
      console.log(`Running query-only tests with ${iterations} iterations per configuration`);
    }
    
    await tester.initialize();
    
    const results = queryOnly 
      ? await tester.runQueryOnlyTests(iterations)
      : await tester.runAllTests();
    
    ResultsReporter.printResults(results);
    
    if (queryOnly) {
      ResultsReporter.saveToFile(results, `query-test-${iterations}x-results.json`);
      ResultsReporter.saveCSV(results, `query-test-${iterations}x-results.csv`);
    } else {
      ResultsReporter.saveToFile(results);
      ResultsReporter.saveCSV(results);
    }
    
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