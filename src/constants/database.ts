/**
 * Database-related constants to avoid magic strings throughout the codebase
 */

// Database type constants
export const DATABASE_TYPES = {
  CLICKHOUSE: 'clickhouse',
  POSTGRESQL: 'postgresql'
} as const;

// Database display names
export const DATABASE_DISPLAY_NAMES = {
  [DATABASE_TYPES.CLICKHOUSE]: 'ClickHouse',
  [DATABASE_TYPES.POSTGRESQL]: 'PostgreSQL'
} as const;

// PostgreSQL variant display names
export const POSTGRESQL_DISPLAY_NAMES = {
  INDEXED: 'PG (w/ Index)',
  NO_INDEX: 'PostgreSQL'
} as const;

// Type definitions for better type safety
export type DatabaseType = typeof DATABASE_TYPES[keyof typeof DATABASE_TYPES];

/**
 * Helper function to get display name for a database configuration
 * @param databaseType Type of database (clickhouse or postgresql)
 * @param withIndex Whether PostgreSQL has indexes (ignored for ClickHouse)
 * @returns Formatted display name for the database configuration
 * @throws Error if unknown database type is provided
 */
export function getDatabaseDisplayName(
  databaseType: DatabaseType, 
  withIndex?: boolean
): string {
  if (databaseType === DATABASE_TYPES.CLICKHOUSE) {
    return DATABASE_DISPLAY_NAMES[DATABASE_TYPES.CLICKHOUSE];
  }
  
  if (databaseType === DATABASE_TYPES.POSTGRESQL) {
    return withIndex 
      ? POSTGRESQL_DISPLAY_NAMES.INDEXED 
      : POSTGRESQL_DISPLAY_NAMES.NO_INDEX;
  }
  
  throw new Error(`Unknown database type: ${databaseType}`);
}

/**
 * Database configuration interface using the constant types
 */
export interface DatabaseConfiguration {
  database: DatabaseType;
  withIndex?: boolean;
  rowCount: number;
}