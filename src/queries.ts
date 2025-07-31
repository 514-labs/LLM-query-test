export interface QueryResult {
  name: string;
  duration: number;
  rows: number;
  data?: any[];
}

export class TestQueries {
  static getQueries() {
    const currentTime = new Date();
    const oneDayAgo = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);
    const timeFilter = oneDayAgo.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    
    return {
      q1_show_tables: {
        name: 'Q1 Show tables',
        clickhouse: `SHOW TABLES`,
        postgresql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      },
      q2_explore_schema: {
        name: 'Q2 Explore schema with sample data',
        clickhouse: `
          SELECT *
          FROM performance_test
          LIMIT 10
        `,
        postgresql: `
          SELECT *
          FROM performance_test
          LIMIT 10
        `
      },
      q3_hourly_aircraft_counts: {
        name: 'Q3 Hourly aircraft counts',
        clickhouse: `
          SELECT
            toStartOfHour(timestamp) AS hour_bucket,
            count(DISTINCT hex) AS unique_aircraft_count
          FROM performance_test
          WHERE
            timestamp >= '${timeFilter}'
            AND alt_baro_is_ground = false
          GROUP BY hour_bucket
          ORDER BY hour_bucket ASC
        `,
        postgresql: `
          SELECT
            date_trunc('hour', timestamp) AS hour_bucket,
            count(DISTINCT hex) AS unique_aircraft_count
          FROM performance_test
          WHERE
            timestamp >= '${timeFilter}'::timestamp
            AND alt_baro_is_ground = false
          GROUP BY hour_bucket
          ORDER BY hour_bucket ASC
        `
      },
      q4_average_hourly_aircraft: {
        name: 'Q4 Average hourly aircraft calculation',
        clickhouse: `
          WITH HourlyAircraftCounts AS (
            SELECT
              toStartOfHour(timestamp) AS hour_bucket,
              count(DISTINCT hex) AS unique_aircraft_count
            FROM performance_test
            WHERE
              timestamp >= '${timeFilter}'
              AND alt_baro_is_ground = false
            GROUP BY hour_bucket
          )
          SELECT avg(unique_aircraft_count) AS average_hourly_aircraft
          FROM HourlyAircraftCounts
        `,
        postgresql: `
          WITH HourlyAircraftCounts AS (
            SELECT
              date_trunc('hour', timestamp) AS hour_bucket,
              count(DISTINCT hex) AS unique_aircraft_count
            FROM performance_test
            WHERE
              timestamp >= '${timeFilter}'::timestamp
              AND alt_baro_is_ground = false
            GROUP BY hour_bucket
          )
          SELECT avg(unique_aircraft_count) AS average_hourly_aircraft
          FROM HourlyAircraftCounts
        `
      }
    };
  }

  static async executeQuery(database: any, query: string, queryName: string, silent: boolean = false): Promise<QueryResult> {
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
}