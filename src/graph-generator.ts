#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { TestResults } from './performance-tester';

// Graph generation CLI (merged from generate-graphs.ts)
function runGraphsCLI(): void {
  const args = process.argv.slice(2);
  const updateReadme = args.includes('--update-readme');

  if (updateReadme) {
    console.log('🔄 README update mode enabled');
  }

  ASCIIGraphGenerator.generateGraphs(updateReadme);
}

export class ASCIIGraphGenerator {
  private static readonly OUTPUT_DIR = path.join(process.cwd(), 'output');
  private static readonly README_PATH = path.join(process.cwd(), 'README.md');

  static generateGraphs(updateReadme: boolean = false): void {
    console.log('📊 Performance Summary Across Dataset Sizes');
    console.log('=' .repeat(50));

    // Find JSON result files in output directory
    const files = this.findResultFiles();
    
    if (files.length === 0) {
      console.log('❌ No results found. Run: npm start && npm run query-test');
      return;
    }

    // Get latest results for each dataset size
    const resultsBySize = this.getResultsByDatasetSize(files);

    if (Object.keys(resultsBySize).length === 0) {
      console.log('❌ No valid results found');
      return;
    }

    console.log('\n⚡ Query Performance Across Dataset Sizes');
    console.log('-'.repeat(50));
    this.generateDatasetSizeComparison(resultsBySize);

    if (updateReadme) {
      console.log('\n📝 Updating README...');
      this.updateReadmeWithResults(files);
    }
    
    console.log('\n✅ Complete');
  }

  private static findResultFiles(): Array<{name: string, path: string}> {
    if (!fs.existsSync(this.OUTPUT_DIR)) {
      return [];
    }

    return fs.readdirSync(this.OUTPUT_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(this.OUTPUT_DIR, file)
      }));
  }

  private static analyzeTestTypes(files: Array<{name: string, path: string}>): void {
    let hasLoadTest = false;
    let hasQueryTest = false;

    try {
      for (const file of files) {
        const results = this.loadResults(file.path);
        const isQueryOnly = results.some(r => r.iterations && r.iterations > 1);
        
        if (isQueryOnly) {
          hasQueryTest = true;
        } else {
          hasLoadTest = true;
        }
      }

      console.log('\n📋 Test Types Detected:');
      console.log(`   ${hasLoadTest ? '✅' : '❌'} Load Test Results (initial performance)`);
      console.log(`   ${hasQueryTest ? '✅' : '❌'} Query-Only Test Results (statistical analysis)`);

      if (!hasLoadTest || !hasQueryTest) {
        console.log('\n💡 Recommendations:');
        if (!hasLoadTest) {
          console.log('   • Run "npm start" to generate load test results');
        }
        if (!hasQueryTest) {
          console.log('   • Run "npm run query-test" to generate query-only test results');
        }
        console.log('   • Having both test types provides the most comprehensive comparison\n');
      } else {
        console.log('   🎉 Complete test suite detected!\n');
      }
    } catch (error) {
      console.log('   ⚠️  Some files may be corrupted or incomplete\n');
    }
  }

  private static loadResults(filePath: string): TestResults[] {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  private static generateLoadTestGraph(results: TestResults[], fileName: string): void {
    console.log(`\n🚀 INITIAL LOAD TEST PERFORMANCE (${fileName})`);
    console.log('-'.repeat(60));

    // Group by dataset size
    const grouped = this.groupBySize(results);

    for (const [size, sizeResults] of Object.entries(grouped)) {
      console.log(`\n📊 Dataset: ${size} rows`);
      console.log('-'.repeat(40));

      // Create graph for total query times
      this.createHorizontalBarChart(
        sizeResults.map(r => ({
          label: this.formatDatabaseLabel(r),
          value: r.totalQueryTime,
          setupTime: r.setupTime / 1000 // Convert to seconds
        })),
        'Total Query Time (ms)',
        40
      );

      console.log('\n📈 Setup Times:');
      this.createHorizontalBarChart(
        sizeResults.map(r => ({
          label: this.formatDatabaseLabel(r),
          value: r.setupTime / 1000, // Convert to seconds
          setupTime: 0
        })),
        'Setup Time (s)',
        40
      );
    }
  }

  private static generateQueryOnlyGraph(results: TestResults[], fileName: string): void {
    console.log(`\n⚡ QUERY-ONLY TEST PERFORMANCE (${fileName})`);
    console.log('-'.repeat(60));

    // Group by dataset size
    const grouped = this.groupBySize(results);

    for (const [size, sizeResults] of Object.entries(grouped)) {
      console.log(`\n📊 Dataset: ${size} rows`);
      
      // Show timeout warnings
      const timedOutResults = sizeResults.filter(r => r.timedOut);
      if (timedOutResults.length > 0) {
        console.log(`⚠️  TIMEOUT WARNING: ${timedOutResults.length} test(s) timed out`);
        timedOutResults.forEach(r => {
          console.log(`   • ${this.formatDatabaseLabel(r)}: ${r.completedIterations}/${r.iterations} iterations completed`);
        });
      }
      
      console.log('-'.repeat(40));

      if (results[0]?.queryStats) {
        // Show median times (most representative)
        console.log('\n📈 Median Query Times:');
        this.createQueryStatsChart(sizeResults, 'median');

        console.log('\n📊 Mean Query Times:');
        this.createQueryStatsChart(sizeResults, 'mean');

        console.log('\n📏 Standard Deviation:');
        this.createQueryStatsChart(sizeResults, 'stdDev');
      } else {
        // Fallback for single-run results
        this.createHorizontalBarChart(
          sizeResults.map(r => ({
            label: this.formatDatabaseLabel(r),
            value: r.totalQueryTime,
            setupTime: 0
          })),
          'Query Time (ms)',
          40
        );
      }
    }
  }

  private static createQueryStatsChart(results: TestResults[], metric: 'mean' | 'median' | 'stdDev'): void {
    const queryNames = ['Q1', 'Q2', 'Q3', 'Q4'];
    
    for (let queryIndex = 0; queryIndex < 4; queryIndex++) {
      console.log(`\n${queryNames[queryIndex]} - ${metric}:`);
      
      const data = results
        .filter(r => r.queryStats) // Only results with stats
        .map(r => ({
          label: this.formatDatabaseLabel(r),
          value: r.queryStats![metric][queryIndex],
          timedOut: r.timedOut || false
        }));

      this.createHorizontalBarChart(data, `${metric} (ms)`, 35);
    }
  }

  private static createHorizontalBarChart(
    data: Array<{label: string, value: number, setupTime?: number, timedOut?: boolean}>,
    unit: string,
    maxBarLength: number = 40
  ): void {
    if (data.length === 0) return;

    const maxValue = Math.max(...data.map(d => d.value));
    const maxLabelLength = Math.max(...data.map(d => d.label.length));

    data.forEach(item => {
      const barLength = maxValue > 0 ? Math.round((item.value / maxValue) * maxBarLength) : 0;
      const bar = '█'.repeat(barLength);
      const padding = ' '.repeat(Math.max(0, maxLabelLength - item.label.length));
      const timeoutFlag = item.timedOut ? ' ⚠️' : '';
      
      console.log(`  ${item.label}${padding} │${bar.padEnd(maxBarLength)} ${item.value.toFixed(1)} ${unit}${timeoutFlag}`);
      
      // Show setup time if provided
      if (item.setupTime && item.setupTime > 0) {
        const setupBar = '▓'.repeat(Math.min(Math.round((item.setupTime / maxValue) * maxBarLength), maxBarLength));
        console.log(`  ${' '.repeat(maxLabelLength)} │${setupBar.padEnd(maxBarLength)} ${item.setupTime.toFixed(1)} s (setup)`);
      }
    });
  }

  private static formatDatabaseLabel(result: TestResults): string {
    const db = result.configuration.database === 'clickhouse' ? 'ClickHouse' : 'PostgreSQL';
    const index = result.configuration.withIndex ? '(idx)' : '(no-idx)';
    return `${db} ${index}`;
  }

  private static groupBySize(results: TestResults[]): Record<string, TestResults[]> {
    const grouped: Record<string, TestResults[]> = {};
    
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

  private static getResultsByDatasetSize(files: Array<{name: string, path: string}>): Record<string, TestResults[]> {
    const sizeMap: Record<string, {results: TestResults[], timestamp: number}> = {};

    for (const file of files) {
      try {
        const results = this.loadResults(file.path);
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

    // Convert to just results without timestamps
    const result: Record<string, TestResults[]> = {};
    for (const [size, data] of Object.entries(sizeMap)) {
      result[size] = data.results;
    }

    return result;
  }

  private static generateDatasetSizeComparison(resultsBySize: Record<string, TestResults[]>): void {
    // Sort sizes numerically
    const sortedSizes = Object.keys(resultsBySize).sort((a, b) => {
      const aNum = this.parseDatasetSize(a);
      const bNum = this.parseDatasetSize(b);
      return aNum - bNum;
    });

    if (sortedSizes.length === 0) {
      console.log('No results to display');
      return;
    }

    // Show overview table
    console.log('\n📊 Performance Overview by Dataset Size');
    console.log('-'.repeat(80));
    
    // Create headers
    const headers = ['Size', 'ClickHouse (ms)', 'PostgreSQL+Idx (ms)', 'PostgreSQL (ms)', 'CH Advantage'];
    const rows = [headers];

    for (const size of sortedSizes) {
      const results = resultsBySize[size];
      const ch = results.find(r => r.configuration.database === 'clickhouse');
      const pgIdx = results.find(r => r.configuration.database === 'postgresql' && r.configuration.withIndex);
      const pgNoIdx = results.find(r => r.configuration.database === 'postgresql' && !r.configuration.withIndex);

      const chTime = ch ? ch.totalQueryTime.toFixed(1) : 'N/A';
      const pgIdxTime = pgIdx ? pgIdx.totalQueryTime.toFixed(1) : 'N/A';
      const pgNoIdxTime = pgNoIdx ? pgNoIdx.totalQueryTime.toFixed(1) : 'N/A';
      
      let advantage = 'N/A';
      if (ch && pgIdx) {
        const ratio = pgIdx.totalQueryTime / ch.totalQueryTime;
        advantage = ratio > 1.2 ? `${ratio.toFixed(1)}x faster` : 
                   ratio < 0.8 ? `${(1/ratio).toFixed(1)}x slower` : 'Similar';
      }

      rows.push([size, chTime, pgIdxTime, pgNoIdxTime, advantage]);
    }

    this.printTable(rows);

    // Generate individual graphs for each query type
    console.log('\n📈 Query Type Breakdown');
    console.log('-'.repeat(50));
    
    const queryNames = ['Q1 (metadata)', 'Q2 (sample)', 'Q3 (analytical)', 'Q4 (analytical)'];
    
    for (let queryIndex = 0; queryIndex < 4; queryIndex++) {
      console.log(`\n${queryNames[queryIndex]}:`);
      
      const graphData: Array<{label: string, value: number}> = [];
      
      for (const size of sortedSizes) {
        const results = resultsBySize[size];
        const ch = results.find(r => r.configuration.database === 'clickhouse');
        const pg = results.find(r => r.configuration.database === 'postgresql' && !r.configuration.withIndex);
        
        if (ch && ch.queryResults[queryIndex]) {
          graphData.push({
            label: `${size} CH`,
            value: ch.queryResults[queryIndex].duration
          });
        }
        
        if (pg && pg.queryResults[queryIndex]) {
          graphData.push({
            label: `${size} PG`,
            value: pg.queryResults[queryIndex].duration
          });
        }
      }
      
      if (graphData.length > 0) {
        this.createHorizontalBarChart(graphData, 'Time (ms)', 60);
      }
    }
  }

  private static parseDatasetSize(size: string): number {
    const match = size.match(/^([\d.]+)([KMB]?)$/);
    if (!match) return parseInt(size.replace(/\D/g, ''));
    
    const num = parseFloat(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'K': return num * 1000;
      case 'M': return num * 1000000;
      case 'B': return num * 1000000000;
      default: return num;
    }
  }

  private static printTable(data: string[][]): void {
    if (data.length === 0) return;

    // Calculate column widths
    const columnWidths = data[0].map((_, colIndex) => 
      Math.max(...data.map(row => String(row[colIndex] || '').length))
    );

    const printRow = (row: string[], separator = ' ') => {
      const formattedRow = row.map((cell, index) => 
        String(cell || '').padEnd(columnWidths[index])
      ).join(separator + '|' + separator);
      console.log('|' + separator + formattedRow + separator + '|');
    };

    // Print header
    const horizontalLine = '+' + columnWidths.map(width => 
      '-'.repeat(width + 2)
    ).join('+') + '+';
    
    console.log(horizontalLine);
    printRow(data[0]);
    console.log(horizontalLine);
    
    // Print data rows
    for (let i = 1; i < data.length; i++) {
      printRow(data[i]);
    }
    console.log(horizontalLine);
  }

  private static getMostRecentFiles(files: Array<{name: string, path: string}>): {
    loadTest?: {name: string, path: string, results: TestResults[]},
    queryTest?: {name: string, path: string, results: TestResults[]}
  } {
    let mostRecentLoad: {file: {name: string, path: string}, timestamp: number} | null = null;
    let mostRecentQuery: {file: {name: string, path: string}, timestamp: number} | null = null;

    for (const file of files) {
      try {
        const results = this.loadResults(file.path);
        const isQueryOnly = results.some(r => r.iterations && r.iterations > 1);
        
        // Extract timestamp from filename (assumes format: prefix_YYYY-MM-DD_HH-MM-SS.json)
        const timestampMatch = file.name.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
        const timestamp = timestampMatch ? new Date(timestampMatch[1].replace('_', 'T').replace(/-/g, ':')).getTime() : 0;
        
        if (isQueryOnly) {
          if (!mostRecentQuery || timestamp > mostRecentQuery.timestamp) {
            mostRecentQuery = { file, timestamp };
          }
        } else {
          if (!mostRecentLoad || timestamp > mostRecentLoad.timestamp) {
            mostRecentLoad = { file, timestamp };
          }
        }
      } catch (error) {
        console.log(`⚠️  Skipping corrupted file: ${file.name}`);
      }
    }

    const result: any = {};
    if (mostRecentLoad) {
      result.loadTest = {
        ...mostRecentLoad.file,
        results: this.loadResults(mostRecentLoad.file.path)
      };
    }
    if (mostRecentQuery) {
      result.queryTest = {
        ...mostRecentQuery.file,
        results: this.loadResults(mostRecentQuery.file.path)
      };
    }

    // Show which files were selected if multiple exist
    const loadCount = files.filter(f => {
      try {
        const results = this.loadResults(f.path);
        return !results.some(r => r.iterations && r.iterations > 1);
      } catch { return false; }
    }).length;
    
    const queryCount = files.filter(f => {
      try {
        const results = this.loadResults(f.path);
        return results.some(r => r.iterations && r.iterations > 1);
      } catch { return false; }
    }).length;

    if (loadCount > 0 && result.loadTest) {
      console.log(`📄 Using most recent load test: ${result.loadTest.name}${loadCount > 1 ? ` (${loadCount} available)` : ''}`);
    }
    if (queryCount > 0 && result.queryTest) {
      console.log(`📄 Using most recent query test: ${result.queryTest.name}${queryCount > 1 ? ` (${queryCount} available)` : ''}`);
    }

    return result;
  }

  private static generateCompactQueryGraph(testData: {name: string, results: TestResults[]}): void {
    const results = testData.results;
    const grouped = this.groupBySize(results);
    
    // Find max label length for alignment
    const maxLabelLength = Math.max(...results.map(r => this.formatDatabaseLabel(r).length));
    
    // Combine small and large datasets for comparison
    const datasets = Object.entries(grouped).sort((a, b) => {
      const aSize = parseInt(a[0]);
      const bSize = parseInt(b[0]); 
      return aSize - bSize;
    });

    datasets.forEach(([size, sizeResults]) => {
      console.log(`\n${size} Dataset:`);
      
      sizeResults.forEach(result => {
        if (!result.queryStats) return;
        
        const label = this.formatDatabaseLabel(result);
        const medians = result.queryStats.median;
        const total = medians.reduce((sum, val) => sum + val, 0);
        const maxTotal = Math.max(...sizeResults.map(r => 
          r.queryStats ? r.queryStats.median.reduce((sum, val) => sum + val, 0) : 0
        ));
        
        // Create stacked bar with different textures for each query
        const barLength = 30;
        const scale = maxTotal > 0 ? barLength / maxTotal : 0;
        
        const q1Length = Math.round(medians[0] * scale);
        const q2Length = Math.round(medians[1] * scale);
        const q3Length = Math.round(medians[2] * scale);
        const q4Length = Math.round(medians[3] * scale);
        
        const q1Bar = '█'.repeat(q1Length);
        const q2Bar = '▓'.repeat(q2Length);
        const q3Bar = '▒'.repeat(q3Length);
        const q4Bar = '░'.repeat(q4Length);
        
        const timeoutFlag = result.timedOut ? ' ⚠️' : '';
        console.log(`  ${label.padEnd(maxLabelLength)} │${q1Bar}${q2Bar}${q3Bar}${q4Bar} ${total.toFixed(1)}ms${timeoutFlag}`);
      });
    });
    
    console.log('\nLegend: █ Q1(discovery) ▓ Q2(explore) ▒ Q3(aggregate) ░ Q4(calculate)');
  }

  private static generateCompactLoadGraph(testData: {name: string, results: TestResults[]}): void {
    const results = testData.results;
    const grouped = this.groupBySize(results);
    
    // Find max label length for alignment
    const maxLabelLength = Math.max(...results.map(r => this.formatDatabaseLabel(r).length));
    
    // Combine small and large datasets for comparison
    const datasets = Object.entries(grouped).sort((a, b) => {
      const aSize = parseInt(a[0]);
      const bSize = parseInt(b[0]); 
      return aSize - bSize;
    });

    datasets.forEach(([size, sizeResults]) => {
      console.log(`\n${size} Dataset:`);
      
      const maxTotal = Math.max(...sizeResults.map(r => r.setupTime + r.totalQueryTime));
      
      sizeResults.forEach(result => {
        const label = this.formatDatabaseLabel(result);
        const setupTime = result.setupTime;
        const queryTime = result.totalQueryTime;
        const total = setupTime + queryTime;
        
        // Create stacked bar
        const barLength = 30;
        const scale = maxTotal > 0 ? barLength / maxTotal : 0;
        
        const setupLength = Math.round(setupTime * scale);
        const queryLength = Math.round(queryTime * scale);
        
        const setupBar = '█'.repeat(setupLength);
        const queryBar = '▓'.repeat(queryLength);
        
        const totalMs = setupTime + queryTime;
        
        console.log(`  ${label.padEnd(maxLabelLength)} │${setupBar}${queryBar} ${totalMs.toFixed(0)}ms`);
      });
    });
    
    console.log('\nLegend: █ Setup(data+index) ▓ Queries');
  }

  private static updateReadmeWithResults(files: Array<{name: string, path: string}>): void {
    try {
      if (!fs.existsSync(this.README_PATH)) {
        console.log('❌ README.md not found');
        return;
      }

      const readmeContent = fs.readFileSync(this.README_PATH, 'utf8');
      
      // Find the Results section
      const resultsSectionStart = readmeContent.indexOf('### Results');
      if (resultsSectionStart === -1) {
        console.log('❌ "### Results" section not found in README');
        return;
      }

      // Find the end of the Results section (next ## heading)
      const nextSectionStart = readmeContent.indexOf('\n## ', resultsSectionStart);
      if (nextSectionStart === -1) {
        console.log('❌ Could not find end of Results section');
        return;
      }

      // Generate the benchmark results content
      const benchmarkContent = this.generateBenchmarkContent(files);
      
      // Replace the Results section content
      const beforeResults = readmeContent.substring(0, resultsSectionStart);
      const afterResults = readmeContent.substring(nextSectionStart);
      
      const newContent = beforeResults + '### Results\n\n' + benchmarkContent + '\n' + afterResults;
      
      // Write back to README
      fs.writeFileSync(this.README_PATH, newContent);
      console.log('✅ README.md updated with benchmark results');
      
    } catch (error) {
      console.log(`❌ Failed to update README: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private static generateBenchmarkContent(files: Array<{name: string, path: string}>): string {
    const timestamp = new Date().toLocaleString();
    let content = `*Last updated: ${timestamp}*\n\n`;
    
    if (files.length === 0) {
      return content + 'No benchmark results available. Run tests first: `npm start` and `npm run query-test`\n';
    }

    // Process each file and generate summary
    let hasLoadTest = false;
    let hasQueryTest = false;
    const summaries: string[] = [];

    for (const file of files) {
      try {
        const results = this.loadResults(file.path);
        const isQueryOnly = results.some(r => r.iterations && r.iterations > 1);
        
        if (isQueryOnly) {
          hasQueryTest = true;
          summaries.push(this.generateQueryTestSummary(results, file.name));
        } else {
          hasLoadTest = true;
          summaries.push(this.generateLoadTestSummary(results, file.name));
        }
      } catch (error) {
        console.log(`⚠️  Skipping corrupted file: ${file.name}`);
      }
    }

    // Add test type summary
    content += '#### Available Results\n\n';
    content += `- ${hasLoadTest ? '✅' : '❌'} **Load Test**: Initial performance comparison with data generation\n`;
    content += `- ${hasQueryTest ? '✅' : '❌'} **Query Test**: Statistical analysis with multiple iterations\n\n`;

    if (!hasLoadTest && !hasQueryTest) {
      content += '⚠️  No valid benchmark results found.\n\n';
      content += '**To generate results:**\n';
      content += '1. `npm start` - Run load test\n';
      content += '2. `npm run query-test` - Run statistical test\n';
      content += '3. `npm run graphs --update-readme` - Update this section\n';
      return content;
    }

    // Add summaries
    content += summaries.join('\n');
    
    content += '\n#### View Detailed Results\n\n';
    content += '```bash\n';
    content += 'npm run graphs  # Interactive terminal graphs\n';
    content += '```\n\n';
    content += `**Result Files**: Check \`output/\` directory for detailed JSON and CSV results.\n`;

    return content;
  }

  private static generateLoadTestSummary(results: TestResults[], filename: string): string {
    let summary = `#### Load Test Results\n\n`;
    summary += `*Source: ${filename}*\n\n`;
    
    // Group by dataset size
    const grouped = this.groupBySize(results);
    
    for (const [size, sizeResults] of Object.entries(grouped)) {
      summary += `**${size} Dataset:**\n\n`;
      
      // Find fastest for total query time
      const fastest = sizeResults.reduce((min, curr) => 
        curr.totalQueryTime < min.totalQueryTime ? curr : min
      );
      
      const fastestLabel = this.formatDatabaseLabel(fastest);
      summary += `- **Fastest Overall**: ${fastestLabel} (${fastest.totalQueryTime.toFixed(1)}ms total)\n`;
      
      // Show all results
      sizeResults.forEach(result => {
        const label = this.formatDatabaseLabel(result);
        const setupTime = (result.setupTime / 1000).toFixed(1);
        summary += `- **${label}**: ${result.totalQueryTime.toFixed(1)}ms queries + ${setupTime}s setup\n`;
      });
      
      summary += '\n';
    }
    
    return summary;
  }

  private static generateQueryTestSummary(results: TestResults[], filename: string): string {
    let summary = `#### Query Test Results (Statistical)\n\n`;
    summary += `*Source: ${filename}*\n\n`;
    
    const iterations = results[0]?.iterations || 100;
    const timedOutResults = results.filter(r => r.timedOut);
    
    if (timedOutResults.length > 0) {
      summary += `⚠️  **${timedOutResults.length} test(s) timed out** - results may be incomplete\n\n`;
    }
    
    // Group by dataset size
    const grouped = this.groupBySize(results);
    
    for (const [size, sizeResults] of Object.entries(grouped)) {
      summary += `**${size} Dataset** (${iterations} iterations each):\n\n`;
      
      // Find fastest median performance
      const validResults = sizeResults.filter(r => r.queryStats);
      if (validResults.length > 0) {
        const fastest = validResults.reduce((min, curr) => {
          const minTotal = min.queryStats!.median.reduce((sum, val) => sum + val, 0);
          const currTotal = curr.queryStats!.median.reduce((sum, val) => sum + val, 0);
          return currTotal < minTotal ? curr : min;
        });
        
        const fastestLabel = this.formatDatabaseLabel(fastest);
        const medianTotal = fastest.queryStats!.median.reduce((sum, val) => sum + val, 0);
        summary += `- **Fastest (median)**: ${fastestLabel} (${medianTotal.toFixed(1)}ms total)\n`;
      }
      
      // Show all results with key stats
      sizeResults.forEach(result => {
        const label = this.formatDatabaseLabel(result);
        if (result.queryStats) {
          const medianTotal = result.queryStats.median.reduce((sum, val) => sum + val, 0);
          const stdDevAvg = result.queryStats.stdDev.reduce((sum, val) => sum + val, 0) / 4;
          const completedInfo = result.timedOut ? ` (${result.completedIterations}/${result.iterations})` : '';
          summary += `- **${label}**: ${medianTotal.toFixed(1)}ms ±${stdDevAvg.toFixed(1)}ms${completedInfo}\n`;
        }
      });
      
      summary += '\n';
    }
    
    return summary;
  }
}

// CLI entry point
if (require.main === module) {
  runGraphsCLI();
}