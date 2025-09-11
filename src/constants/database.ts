/**
 * Database-related constants to avoid magic strings throughout the codebase
 */

// Database type constants
export const DATABASE_TYPES = {
  CLICKHOUSE: 'clickhouse',
  POSTGRESQL: 'postgresql',
  PG_HYDRA: 'pg_hydra'
} as const;

// Database display names
export const DATABASE_DISPLAY_NAMES = {
  [DATABASE_TYPES.CLICKHOUSE]: 'ClickHouse',
  [DATABASE_TYPES.POSTGRESQL]: 'PostgreSQL',
  [DATABASE_TYPES.PG_HYDRA]: 'PG Hydra'
} as const;

// PostgreSQL variant display names
export const POSTGRESQL_DISPLAY_NAMES = {
  INDEXED: 'PG (w/ Index)',
  NO_INDEX: 'PostgreSQL'
} as const;

// PG Hydra variant display names
export const PG_HYDRA_DISPLAY_NAMES = {
  SHARDED: 'PG Hydra (Sharded)',
  SINGLE_NODE: 'PG Hydra (Single Node)'
} as const;

// Type definitions for better type safety
export type DatabaseType = typeof DATABASE_TYPES[keyof typeof DATABASE_TYPES];

/**
 * Helper function to get display name for a database configuration
 * @param databaseType Type of database (clickhouse, postgresql, or pg_hydra)
 * @param withIndex Whether PostgreSQL has indexes (ignored for ClickHouse)
 * @param sharded Whether PG Hydra is using sharding (ignored for other databases)
 * @returns Formatted display name for the database configuration
 * @throws Error if unknown database type is provided
 */
export function getDatabaseDisplayName(
  databaseType: DatabaseType, 
  withIndex?: boolean,
  sharded?: boolean
): string {
  if (databaseType === DATABASE_TYPES.CLICKHOUSE) {
    return DATABASE_DISPLAY_NAMES[DATABASE_TYPES.CLICKHOUSE];
  }
  
  if (databaseType === DATABASE_TYPES.POSTGRESQL) {
    return withIndex 
      ? POSTGRESQL_DISPLAY_NAMES.INDEXED 
      : POSTGRESQL_DISPLAY_NAMES.NO_INDEX;
  }
  
  if (databaseType === DATABASE_TYPES.PG_HYDRA) {
    return sharded 
      ? PG_HYDRA_DISPLAY_NAMES.SHARDED 
      : PG_HYDRA_DISPLAY_NAMES.SINGLE_NODE;
  }
  
  throw new Error(`Unknown database type: ${databaseType}`);
}

/**
 * Database configuration interface using the constant types
 */
export interface DatabaseConfiguration {
  database: DatabaseType;
  withIndex?: boolean;
  sharded?: boolean;
  rowCount: number;
}
