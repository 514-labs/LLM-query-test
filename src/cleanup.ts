#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { ClickHouseDatabase } from './database/clickhouse';
import { PostgreSQLDatabase } from './database/postgresql';

export class DatabaseCleaner {
  private static readonly OUTPUT_DIR = path.join(process.cwd(), 'output');

  static async cleanup(): Promise<void> {
    console.log('🧹 Database and Results Cleanup');
    console.log('=' .repeat(50));

    let hasErrors = false;

    // Clean databases
    console.log('\n📊 Clearing Database Tables...');
    try {
      await this.clearDatabases();
      console.log('✅ Database tables cleared successfully');
    } catch (error) {
      console.log(`❌ Database cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      hasErrors = true;
    }

    // Clean output files
    console.log('\n📁 Clearing Output Files...');
    try {
      const clearedCount = this.clearOutputFiles();
      if (clearedCount > 0) {
        console.log(`✅ Cleared ${clearedCount} result file(s)`);
      } else {
        console.log('ℹ️  No result files to clear');
      }
    } catch (error) {
      console.log(`❌ Output file cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      hasErrors = true;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (hasErrors) {
      console.log('⚠️  Cleanup completed with some errors');
      console.log('💡 Check database connections and file permissions');
      process.exit(1);
    } else {
      console.log('✅ Cleanup completed successfully');
      console.log('🚀 Ready for fresh testing: npm start or npm run query-test');
    }
  }

  private static async clearDatabases(): Promise<void> {
    const clickhouse = new ClickHouseDatabase();
    const postgresql = new PostgreSQLDatabase();

    try {
      // Connect to databases
      console.log('   🔌 Connecting to databases...');
      await clickhouse.connect();
      await postgresql.connect();

      // Drop tables
      console.log('   🗑️  Dropping ClickHouse table...');
      await clickhouse.dropTable();
      
      console.log('   🗑️  Dropping PostgreSQL table...');
      await postgresql.dropTable();

      // Disconnect
      await clickhouse.disconnect();
      await postgresql.disconnect();
      
    } catch (error) {
      // Ensure connections are closed even on error
      try {
        await clickhouse.disconnect();
        await postgresql.disconnect();
      } catch (disconnectError) {
        // Ignore disconnect errors if already disconnected
      }
      throw error;
    }
  }

  private static clearOutputFiles(): number {
    if (!fs.existsSync(this.OUTPUT_DIR)) {
      return 0;
    }

    return this.clearDirectoryRecursive(this.OUTPUT_DIR);
  }

  private static clearDirectoryRecursive(dirPath: string): number {
    const items = fs.readdirSync(dirPath);
    let clearedCount = 0;

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        console.log(`   📁 Clearing directory ${path.relative(process.cwd(), itemPath)}/`);
        clearedCount += this.clearDirectoryRecursive(itemPath);
        fs.rmdirSync(itemPath);
        console.log(`   🗑️  Removed directory ${path.relative(process.cwd(), itemPath)}/`);
      } else {
        console.log(`   🗑️  Removing ${path.relative(process.cwd(), itemPath)}`);
        fs.unlinkSync(itemPath);
        clearedCount++;
      }
    }

    // Remove the output directory itself if we're back at the root level
    if (dirPath === this.OUTPUT_DIR) {
      fs.rmdirSync(this.OUTPUT_DIR);
      console.log('   📁 Removed output directory');
    }

    return clearedCount;
  }

  static async clearDatabasesOnly(): Promise<void> {
    console.log('🧹 Database Tables Cleanup');
    console.log('=' .repeat(40));

    try {
      await this.clearDatabases();
      console.log('✅ Database tables cleared successfully');
    } catch (error) {
      console.log(`❌ Database cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  static clearOutputOnly(): void {
    console.log('🧹 Output Files Cleanup');
    console.log('=' .repeat(40));

    try {
      const clearedCount = this.clearOutputFiles();
      if (clearedCount > 0) {
        console.log(`✅ Cleared ${clearedCount} result file(s)`);
      } else {
        console.log('ℹ️  No result files to clear');
      }
    } catch (error) {
      console.log(`❌ Output file cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--db-only')) {
  DatabaseCleaner.clearDatabasesOnly();
} else if (args.includes('--output-only')) {
  DatabaseCleaner.clearOutputOnly();
} else {
  DatabaseCleaner.cleanup();
}