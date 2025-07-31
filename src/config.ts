import dotenv from 'dotenv';

dotenv.config();

export const config = {
  clickhouse: {
    host: process.env.CLICKHOUSE_HOST || 'localhost',
    port: parseInt(process.env.CLICKHOUSE_PORT || '8123'),
    database: process.env.CLICKHOUSE_DATABASE || 'performance_test',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  },
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'performance_test',
    username: process.env.POSTGRES_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  },
  test: {
    smallDataset: parseInt(process.env.SMALL_DATASET_SIZE || '1000'),
    largeDataset: parseInt(process.env.LARGE_DATASET_SIZE || '10000'),
    batchSize: parseInt(process.env.BATCH_SIZE || '50000'),
  },
};