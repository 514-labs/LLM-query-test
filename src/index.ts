import { PerformanceTester } from './performance-tester';
import { ResultsReporter } from './reporter';

async function main() {
  const tester = new PerformanceTester();
  
  try {
    console.log('Starting Database Performance Testing Application');
    console.log('===============================================');
    
    await tester.initialize();
    
    const results = await tester.runAllTests();
    
    ResultsReporter.printResults(results);
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