/**
 * Interface for query execution results
 */
export interface QueryResult {
  name: string;
  duration: number;
  rows: number;
  data?: any[];
}

/**
 * Generate LLM-style query definitions for performance testing
 * @returns Object containing queries for different database types
 */
export function getQueries() {
  const currentTime = new Date();
  
  // Today (start of day to now)
  const todayStart = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
  const todayStartStr = todayStart.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  
  // Day before yesterday (full day)
  const dayBeforeYesterday = new Date(currentTime.getTime() - 2 * 24 * 60 * 60 * 1000);
  const dayBeforeYesterdayStart = new Date(dayBeforeYesterday.getFullYear(), dayBeforeYesterday.getMonth(), dayBeforeYesterday.getDate());
  const dayBeforeYesterdayEnd = new Date(dayBeforeYesterdayStart.getTime() + 24 * 60 * 60 * 1000);
  const dayBeforeYesterdayStartStr = dayBeforeYesterdayStart.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  const dayBeforeYesterdayEndStr = dayBeforeYesterdayEnd.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  
  return {
    q1_show_tables: {
      name: 'Q1 Show tables',
      clickhouse: `SHOW TABLES`,
      postgresql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    },
    q2_explore_schema: {
      name: 'Q2 Explore schema with sample data',
      clickhouse: `
        SELECT 
          hex, flight, aircraft_type, lat, lon, alt_baro, gs, track,
          timestamp, alt_baro_is_ground, nav_qnh, category
        FROM performance_test
        ORDER BY timestamp DESC
        LIMIT 10
      `,
      postgresql: `
        SELECT 
          hex, flight, aircraft_type, lat, lon, alt_baro, gs, track,
          timestamp, alt_baro_is_ground, nav_qnh, category
        FROM performance_test
        ORDER BY timestamp DESC
        LIMIT 10
      `
    },
    q3_hourly_aircraft_today: {
      name: 'Q3 Hourly aircraft count - today',
      clickhouse: `
        SELECT
          toStartOfHour(timestamp) AS hour_bucket,
          uniq(hex) AS unique_aircraft_count
        FROM performance_test
        WHERE
          timestamp >= '${todayStartStr}'
          AND alt_baro_is_ground = 0
        GROUP BY hour_bucket
        ORDER BY hour_bucket ASC
      `,
      postgresql: `
        SELECT
          date_trunc('hour', timestamp) AS hour_bucket,
          count(DISTINCT hex) AS unique_aircraft_count
        FROM performance_test
        WHERE
          timestamp >= '${todayStartStr}'::timestamp
          AND alt_baro_is_ground = false
        GROUP BY hour_bucket
        ORDER BY hour_bucket ASC
      `
    },
    q4_hourly_aircraft_day_before_yesterday: {
      name: 'Q4 Hourly aircraft count - day before yesterday',
      clickhouse: `
        SELECT
          toStartOfHour(timestamp) AS hour_bucket,
          uniq(hex) AS unique_aircraft_count,
          avg(alt_baro) AS avg_altitude
        FROM performance_test
        WHERE
          timestamp >= '${dayBeforeYesterdayStartStr}'
          AND timestamp < '${dayBeforeYesterdayEndStr}'
          AND alt_baro_is_ground = 0
        GROUP BY hour_bucket
        ORDER BY hour_bucket ASC
      `,
      postgresql: `
        SELECT
          date_trunc('hour', timestamp) AS hour_bucket,
          count(DISTINCT hex) AS unique_aircraft_count,
          avg(alt_baro) AS avg_altitude
        FROM performance_test
        WHERE
          timestamp >= '${dayBeforeYesterdayStartStr}'::timestamp
          AND timestamp < '${dayBeforeYesterdayEndStr}'::timestamp
          AND alt_baro_is_ground = false
        GROUP BY hour_bucket
        ORDER BY hour_bucket ASC
      `
    }
  };
}

/**
 * Execute a query against a database and measure performance
 * @param database Database instance to execute query on
 * @param query SQL query string to execute
 * @param queryName Descriptive name for the query
 * @param silent Whether to suppress console output (default: false)
 * @returns Promise that resolves to QueryResult with timing and row count
 */
export async function executeQuery(database: any, query: string, queryName: string, silent: boolean = false): Promise<QueryResult> {
  if (!silent) {
    console.log(`Executing ${queryName}...`);
  }
  
  const startTime = process.hrtime.bigint();
  
  try {
    const result = await database.query(query);
    const endTime = process.hrtime.bigint();
    
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    const rows = Array.isArray(result) ? result.length : (result?.data?.length || 0);
    
    if (!silent) {
      console.log(`${queryName} completed in ${duration.toFixed(2)}ms, returned ${rows} rows`);
    }
    
    return {
      name: queryName,
      duration,
      rows,
      data: result
    };
  } catch (error) {
    console.error(`Error executing ${queryName}:`, error);
    throw error;
  }
}