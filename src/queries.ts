export interface QueryResult {
  name: string;
  duration: number;
  rows: number;
  data?: any[];
}

export class TestQueries {
  static getQueries() {
    const currentTime = new Date();
    const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);
    const timeFilter = oneHourAgo.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    
    return {
      q1_recent_aircraft_by_time: {
        name: 'Q1 Recent aircraft in last hour',
        clickhouse: `
          SELECT hex, flight, lat, lon, alt_baro, timestamp
          FROM performance_test 
          WHERE timestamp >= '${timeFilter}'
          ORDER BY timestamp DESC
          LIMIT 1000
        `,
        postgresql: `
          SELECT hex, flight, lat, lon, alt_baro, timestamp
          FROM performance_test 
          WHERE timestamp >= '${timeFilter}'::timestamp
          ORDER BY timestamp DESC
          LIMIT 1000
        `
      },
      q2_aircraft_track_history: {
        name: 'Q2 Aircraft track history',
        clickhouse: `
          SELECT hex, flight, lat, lon, alt_baro, gs, track, timestamp
          FROM performance_test 
          WHERE hex IN (SELECT hex FROM performance_test LIMIT 1)
          ORDER BY timestamp
        `,
        postgresql: `
          SELECT hex, flight, lat, lon, alt_baro, gs, track, timestamp
          FROM performance_test 
          WHERE hex = (SELECT hex FROM performance_test LIMIT 1)
          ORDER BY timestamp
        `
      },
      q3_high_altitude_aircraft: {
        name: 'Q3 High altitude aircraft',
        clickhouse: `
          SELECT 
            hex, flight, category, alt_baro, lat, lon, timestamp
          FROM performance_test 
          WHERE alt_baro > 30000 
            AND timestamp >= '${timeFilter}'
          ORDER BY alt_baro DESC
          LIMIT 500
        `,
        postgresql: `
          SELECT 
            hex, flight, category, alt_baro, lat, lon, timestamp
          FROM performance_test 
          WHERE alt_baro > 30000 
            AND timestamp >= '${timeFilter}'::timestamp
          ORDER BY alt_baro DESC
          LIMIT 500
        `
      },
      q4_geographic_density: {
        name: 'Q4 Aircraft density by region',
        clickhouse: `
          SELECT 
            floor(lat * 2) / 2 as lat_bucket,
            floor(lon * 2) / 2 as lon_bucket,
            count(*) as aircraft_count,
            avg(alt_baro) as avg_altitude,
            count(DISTINCT hex) as unique_aircraft
          FROM performance_test 
          WHERE timestamp >= '${timeFilter}'
          GROUP BY lat_bucket, lon_bucket
          HAVING aircraft_count > 5
          ORDER BY aircraft_count DESC
        `,
        postgresql: `
          SELECT 
            floor(lat * 2) / 2 as lat_bucket,
            floor(lon * 2) / 2 as lon_bucket,
            count(*) as aircraft_count,
            avg(alt_baro) as avg_altitude,
            count(DISTINCT hex) as unique_aircraft
          FROM performance_test 
          WHERE timestamp >= '${timeFilter}'::timestamp
          GROUP BY lat_bucket, lon_bucket
          HAVING count(*) > 5
          ORDER BY aircraft_count DESC
        `
      }
    };
  }

  static async executeQuery(database: any, query: string, queryName: string): Promise<QueryResult> {
    console.log(`Executing ${queryName}...`);
    
    const startTime = process.hrtime.bigint();
    
    try {
      const result = await database.query(query);
      const endTime = process.hrtime.bigint();
      
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      const rows = Array.isArray(result) ? result.length : (result?.data?.length || 0);
      
      console.log(`${queryName} completed in ${duration.toFixed(2)}ms, returned ${rows} rows`);
      
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