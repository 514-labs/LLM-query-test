#!/usr/bin/env node
import dotenv from 'dotenv';
import { Command } from 'commander';
import { execSync } from 'child_process';
import { ConfigValidator } from '../config/validator';

dotenv.config();

// Configure CLI with Commander.js
const program = new Command();

program
  .name('npm run start-dbs')
  .description('Start ClickHouse and PostgreSQL database containers for performance testing')
  .version('1.0.0')
  .option('--cleanup-first', 'cleanup existing containers before starting', false)
  .option('--databases <databases>', 'comma-separated database types to start (clickhouse,postgresql,postgresql-indexed)')
  .addHelpText('after', `

This tool starts the required database containers:
  • ClickHouse on port 8123
  • PostgreSQL (no indexes) on port 5432  
  • PostgreSQL (with indexes) on port 5433

Configuration is read from .env file:
  Environment variables:
    CLICKHOUSE_MEMORY/CPUS - ClickHouse container resources
    POSTGRES_MEMORY/CPUS - PostgreSQL container resources  
    POSTGRES_INDEXED_MEMORY/CPUS - PostgreSQL (indexed) container resources
    POSTGRES_PORT/POSTGRES_INDEXED_PORT - Custom port assignments

Examples:
  npm run start-dbs                    # Start with existing containers
  npm run start-dbs -- --cleanup-first # Remove existing containers first
  npm run start-dbs -- --databases clickhouse # Start only ClickHouse
`);

// Parse CLI arguments
program.parse();
const options = program.opts();

// Validate environment variables early
const validator = new ConfigValidator();

// Validate Docker resource formats
const clickhouseMemory = validator.validateMemory('CLICKHOUSE_MEMORY', '4g');
const clickhouseCpus = validator.validateCpus('CLICKHOUSE_CPUS', '2');
const postgresMemory = validator.validateMemory('POSTGRES_MEMORY', '4g');
const postgresCpus = validator.validateCpus('POSTGRES_CPUS', '2');
const postgresIndexedMemory = validator.validateMemory('POSTGRES_INDEXED_MEMORY', '4g');
const postgresIndexedCpus = validator.validateCpus('POSTGRES_INDEXED_CPUS', '2');

// Validate ports
const postgresPort = validator.validatePort('POSTGRES_PORT', 5432);
const postgresIndexedPort = validator.validatePort('POSTGRES_INDEXED_PORT', 5433);

// Check for port conflicts
validator.validatePortConflicts({
  'POSTGRES_PORT': postgresPort,
  'POSTGRES_INDEXED_PORT': postgresIndexedPort,
});

// Throw error if validation failed
validator.throwIfInvalid();

interface ContainerConfig {
  name: string;
  image: string;
  ports: string[];
  environment: string[];
  additionalFlags: string[];
}

class DatabaseStarter {
  private getContainerConfigs(): ContainerConfig[] {
    return [
      {
        name: 'clickhouse-server',
        image: 'clickhouse/clickhouse-server',
        ports: ['8123:8123', '9000:9000'],
        environment: [
          `CLICKHOUSE_PASSWORD=${process.env.CLICKHOUSE_PASSWORD || 'password'}`
        ],
        additionalFlags: [
          '--ulimit', 'nofile=262144:262144',
          '--memory', clickhouseMemory,
          '--cpus', clickhouseCpus
        ]
      },
      {
        name: 'postgres',
        image: 'postgres:15',
        ports: [`${postgresPort}:5432`],
        environment: [
          `POSTGRES_PASSWORD=${process.env.POSTGRES_PASSWORD || 'postgres'}`
        ],
        additionalFlags: [
          '--memory', postgresMemory,
          '--cpus', postgresCpus
        ]
      },
      {
        name: 'postgres-indexed',
        image: 'postgres:15',
        ports: [`${postgresIndexedPort}:5432`],
        environment: [
          `POSTGRES_PASSWORD=${process.env.POSTGRES_INDEXED_PASSWORD || 'postgres'}`
        ],
        additionalFlags: [
          '--memory', postgresIndexedMemory,
          '--cpus', postgresIndexedCpus
        ]
      }
    ];
  }

  private buildDockerCommand(config: ContainerConfig): string {
    const parts = [
      'docker run -d',
      `--name ${config.name}`,
      ...config.additionalFlags
    ];

    // Add port mappings
    config.ports.forEach(port => {
      parts.push(`-p ${port}`);
    });

    // Add environment variables
    config.environment.forEach(env => {
      parts.push(`-e ${env}`);
    });

    // Add image
    parts.push(config.image);

    return parts.join(' ');
  }

  private async executeCommand(command: string, description: string): Promise<void> {
    try {
      console.log(`🔧 ${description}...`);
      execSync(command, { stdio: 'inherit' });
      console.log(`✅ ${description} completed`);
    } catch (error) {
      console.error(`❌ ${description} failed:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Database Containers');
    console.log('================================\n');

    // Show resource configuration
    console.log('📊 Resource Configuration:');
    console.log(`   ClickHouse: ${clickhouseMemory} RAM, ${clickhouseCpus} CPUs`);
    console.log(`   PostgreSQL: ${postgresMemory} RAM, ${postgresCpus} CPUs`);
    console.log(`   PostgreSQL (indexed): ${postgresIndexedMemory} RAM, ${postgresIndexedCpus} CPUs\n`);

    let configs = this.getContainerConfigs();

    // Optionally filter by databases
    if (options.databases) {
      const requested = String(options.databases)
        .split(',')
        .map((d: string) => d.trim().toLowerCase());

      const nameMatches = (cfg: ContainerConfig): boolean => {
        if (cfg.name === 'clickhouse-server') return requested.includes('clickhouse');
        if (cfg.name === 'postgres') return requested.includes('postgresql');
        if (cfg.name === 'postgres-indexed') return requested.includes('postgresql-indexed');
        return false;
      };

      configs = configs.filter(nameMatches);

      if (configs.length === 0) {
        console.error('No valid databases selected for startup.');
        process.exit(1);
      }
    }

    try {
      // Optionally stop and remove existing containers
      if (options.cleanupFirst) {
        await this.executeCommand(
          'docker rm -f clickhouse-server postgres postgres-indexed 2>/dev/null || true',
          'Cleaning up existing containers'
        );
      }

      // Start each container
      for (const config of configs) {
        const command = this.buildDockerCommand(config);
        console.log(`\n🐳 Starting ${config.name}:`);
        console.log(`   Command: ${command}`);
        
        await this.executeCommand(command, `Starting ${config.name}`);
      }

      console.log('\n🎉 Selected database containers started successfully!');
      console.log('\n📋 Container Status:');
      if (configs.some(c => c.name === 'clickhouse-server')) {
        console.log('   • ClickHouse: http://localhost:8123');
      }
      if (configs.some(c => c.name === 'postgres')) {
        console.log(`   • PostgreSQL (no index): localhost:${postgresPort}`);
      }
      if (configs.some(c => c.name === 'postgres-indexed')) {
        console.log(`   • PostgreSQL (with index): localhost:${postgresIndexedPort}`);
      }
      
      console.log('\n⏳ Waiting 10 seconds for containers to be ready...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log('✅ Ready to run tests!');

    } catch (error) {
      console.error('\n💥 Failed to start database containers');
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const starter = new DatabaseStarter();
  await starter.start();
}

if (require.main === module) {
  main().catch(console.error);
}