import dotenv from 'dotenv';
import { ConfigValidator } from './validator';

dotenv.config();

// Validate and configure environment variables
const validator = new ConfigValidator();

// Configuration with validation
export const config = {
  clickhouse: {
    host: validator.validateString('CLICKHOUSE_HOST', 'localhost'),
    port: validator.validatePort('CLICKHOUSE_PORT', 8123),
    database: validator.validateString('CLICKHOUSE_DATABASE', 'performance_test'),
    username: validator.validateString('CLICKHOUSE_USERNAME', 'default'),
    password: validator.validateString('CLICKHOUSE_PASSWORD', ''),
    memory: validator.validateMemory('CLICKHOUSE_MEMORY', '4g'),
    cpus: validator.validateCpus('CLICKHOUSE_CPUS', '2'),
  },
  postgres: {
    host: validator.validateString('POSTGRES_HOST', 'localhost'),
    port: validator.validatePort('POSTGRES_PORT', 5432),
    database: validator.validateString('POSTGRES_DATABASE', 'performance_test'),
    username: validator.validateString('POSTGRES_USERNAME', 'postgres'),
    password: validator.validateString('POSTGRES_PASSWORD', 'postgres'),
    memory: validator.validateMemory('POSTGRES_MEMORY', '4g'),
    cpus: validator.validateCpus('POSTGRES_CPUS', '2'),
  },
  postgresIndexed: {
    host: validator.validateString('POSTGRES_INDEXED_HOST', 'localhost'),
    port: validator.validatePort('POSTGRES_INDEXED_PORT', 5433),
    database: validator.validateString('POSTGRES_INDEXED_DATABASE', 'performance_test'),
    username: validator.validateString('POSTGRES_INDEXED_USERNAME', 'postgres'),
    password: validator.validateString('POSTGRES_INDEXED_PASSWORD', 'postgres'),
    memory: validator.validateMemory('POSTGRES_INDEXED_MEMORY', '4g'),
    cpus: validator.validateCpus('POSTGRES_INDEXED_CPUS', '2'),
  },
  pgHydra: {
    host: validator.validateString('PG_HYDRA_HOST', 'localhost'),
    port: validator.validatePort('PG_HYDRA_PORT', 5434),
    database: validator.validateString('PG_HYDRA_DATABASE', 'performance_test'),
    username: validator.validateString('PG_HYDRA_USERNAME', 'postgres'),
    password: validator.validateString('PG_HYDRA_PASSWORD', 'postgres'),
    memory: validator.validateMemory('PG_HYDRA_MEMORY', '4g'),
    cpus: validator.validateCpus('PG_HYDRA_CPUS', '2'),
  },
  pgHydraSharded: {
    host: validator.validateString('PG_HYDRA_SHARDED_HOST', 'localhost'),
    port: validator.validatePort('PG_HYDRA_SHARDED_PORT', 5435),
    database: validator.validateString('PG_HYDRA_SHARDED_DATABASE', 'performance_test'),
    username: validator.validateString('PG_HYDRA_SHARDED_USERNAME', 'postgres'),
    password: validator.validateString('PG_HYDRA_SHARDED_PASSWORD', 'postgres'),
    memory: validator.validateMemory('PG_HYDRA_SHARDED_MEMORY', '4g'),
    cpus: validator.validateCpus('PG_HYDRA_SHARDED_CPUS', '2'),
  },
  test: {
    datasetSize: validator.validateInteger('DATASET_SIZE', 10000000, 1000, 100000000, 'Dataset size (1000-100M records)'),
    batchSize: validator.validateInteger('BATCH_SIZE', 50000, 1000, 1000000, 'Batch size (1K-1M records)'),
    parallelInsert: validator.validateString('PARALLEL_INSERT', 'false', ['true', 'false']) === 'true',
    parallelWorkers: validator.validateInteger('PARALLEL_WORKERS', 4, 1, 16, 'Worker threads (1-16)'),
    queryIterations: validator.validateInteger('QUERY_TEST_ITERATIONS', 100, 1, 10000, 'Query test iterations (1-10000)'),
    queryTimeLimit: validator.validateInteger('QUERY_TEST_TIME_LIMIT', 60, 1, 1440, 'Query test time limit in minutes (1-1440)'),
  },
};

// Validate port conflicts
validator.validatePortConflicts({
  'CLICKHOUSE_PORT': config.clickhouse.port,
  'POSTGRES_PORT': config.postgres.port,
  'POSTGRES_INDEXED_PORT': config.postgresIndexed.port,
  'PG_HYDRA_PORT': config.pgHydra.port,
});

// Throw error if validation failed
validator.throwIfInvalid();
