import * as fs from 'fs';
import * as path from 'path';
import { TestConfiguration, TestResults } from './performance-tester';

export interface TestCheckpoint {
  sessionId: string;
  timestamp: string;
  totalConfigurations: number;
  completedConfigurations: TestConfiguration[];
  pendingConfigurations: TestConfiguration[];
  partialResults: TestResults[];
  testType: 'load' | 'query-only';
  queryOnlySettings?: {
    iterations: number;
    timeLimitMinutes: number;
  };
}

export class CheckpointManager {
  private static readonly CHECKPOINT_DIR = path.join(process.cwd(), 'output', 'checkpoints');
  private static readonly CHECKPOINT_FILE = 'test-session.checkpoint.json';

  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static async saveCheckpoint(checkpoint: TestCheckpoint): Promise<void> {
    // Ensure checkpoint directory exists
    if (!fs.existsSync(this.CHECKPOINT_DIR)) {
      fs.mkdirSync(this.CHECKPOINT_DIR, { recursive: true });
    }

    const filePath = path.join(this.CHECKPOINT_DIR, this.CHECKPOINT_FILE);
    fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));
    
    // Checkpoint saved silently
  }

  static loadCheckpoint(): TestCheckpoint | null {
    const filePath = path.join(this.CHECKPOINT_DIR, this.CHECKPOINT_FILE);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const checkpoint: TestCheckpoint = JSON.parse(content);
      
      // Validate checkpoint isn't too old (24 hours)
      const checkpointTime = new Date(checkpoint.timestamp);
      const now = new Date();
      const hoursDiff = (now.getTime() - checkpointTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        console.log('⚠️  Found old checkpoint (>24h), ignoring...');
        this.clearCheckpoint();
        return null;
      }

      return checkpoint;
    } catch (error) {
      console.log('⚠️  Corrupted checkpoint file, ignoring...');
      this.clearCheckpoint();
      return null;
    }
  }

  static clearCheckpoint(): void {
    const filePath = path.join(this.CHECKPOINT_DIR, this.CHECKPOINT_FILE);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  static async promptUserForResume(checkpoint: TestCheckpoint): Promise<boolean> {
    const completedCount = checkpoint.completedConfigurations.length;
    const totalCount = checkpoint.totalConfigurations;
    const remainingCount = totalCount - completedCount;
    
    console.log(`\n🔄 Previous test session found:`);
    console.log(`   Session: ${checkpoint.sessionId}`);
    console.log(`   Started: ${new Date(checkpoint.timestamp).toLocaleString()}`);
    console.log(`   Progress: ${completedCount}/${totalCount} configurations completed`);
    console.log(`   Remaining: ${remainingCount} configurations`);
    console.log(`   Type: ${checkpoint.testType === 'query-only' ? 'Query-only test' : 'Load test'}`);
    
    if (checkpoint.testType === 'query-only' && checkpoint.queryOnlySettings) {
      console.log(`   Settings: ${checkpoint.queryOnlySettings.iterations} iterations, ${checkpoint.queryOnlySettings.timeLimitMinutes}min timeout`);
    }
    
    console.log(`\n🔄 Automatically resuming from checkpoint...`);
    console.log(`💡 To start fresh next time, run: npm run clean:output`);
    
    return true; // Always resume for now (users can clean if they want fresh start)
  }

  static createInitialCheckpoint(
    configurations: TestConfiguration[], 
    testType: 'load' | 'query-only',
    queryOnlySettings?: { iterations: number; timeLimitMinutes: number }
  ): TestCheckpoint {
    return {
      sessionId: this.generateSessionId(),
      timestamp: new Date().toISOString(),
      totalConfigurations: configurations.length,
      completedConfigurations: [],
      pendingConfigurations: [...configurations],
      partialResults: [],
      testType,
      queryOnlySettings
    };
  }

  static updateCheckpoint(
    checkpoint: TestCheckpoint, 
    completedConfig: TestConfiguration, 
    result: TestResults
  ): TestCheckpoint {
    return {
      ...checkpoint,
      completedConfigurations: [...checkpoint.completedConfigurations, completedConfig],
      pendingConfigurations: checkpoint.pendingConfigurations.filter(
        config => !this.configsEqual(config, completedConfig)
      ),
      partialResults: [...checkpoint.partialResults, result],
      timestamp: new Date().toISOString()
    };
  }

  private static configsEqual(a: TestConfiguration, b: TestConfiguration): boolean {
    return a.database === b.database && 
           a.withIndex === b.withIndex && 
           a.rowCount === b.rowCount;
  }

  static async handleGracefulShutdown(checkpoint: TestCheckpoint): Promise<void> {
    console.log('\n🛑 Received shutdown signal...');
    await this.saveCheckpoint(checkpoint);
    console.log('💾 Progress saved. Run the same command to resume from checkpoint.');
    
    // Save partial results if any exist
    if (checkpoint.partialResults.length > 0) {
      const { ResultsReporter } = await import('./reporter');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
      const filename = `partial-results_${timestamp}.json`;
      
      ResultsReporter.saveToFile(checkpoint.partialResults, filename);
      console.log(`📊 Partial results saved to output/${filename}`);
    }
    
    process.exit(0);
  }
}