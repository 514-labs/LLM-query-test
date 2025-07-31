import { Pool, Client } from 'pg';
import { config } from '../index';

export class PostgreSQLDatabase {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.username,
      password: config.postgres.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async connect(): Promise<void> {
    // Simple connection test
    const client = await this.pool.connect();
    await client.query('SELECT NOW()');
    client.release();
  }

  async ensureDatabaseExists(): Promise<void> {
    const defaultClient = new Client({
      host: config.postgres.host,
      port: config.postgres.port,
      database: 'postgres',
      user: config.postgres.username,
      password: config.postgres.password,
    });

    try {
      await defaultClient.connect();
      
      // Check if database exists
      const result = await defaultClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [config.postgres.database]
      );
      
      if (result.rows.length === 0) {
        // Database doesn't exist, create it
        await defaultClient.query(`CREATE DATABASE ${config.postgres.database}`);
        console.log(`Created PostgreSQL database: ${config.postgres.database}`);
      }
    } catch (error) {
      console.log(`PostgreSQL database creation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await defaultClient.end();
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async query(sql: string): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS performance_test (
        zordercoordinate BIGINT,
        approach BOOLEAN,
        autopilot BOOLEAN,
        althold BOOLEAN,
        lnav BOOLEAN,
        tcas BOOLEAN,
        hex CHAR(6),
        transponder_type VARCHAR(50),
        flight VARCHAR(50),
        r VARCHAR(10),
        aircraft_type VARCHAR(50) DEFAULT '',
        dbflags INTEGER,
        lat DOUBLE PRECISION,
        lon DOUBLE PRECISION,
        alt_baro INTEGER,
        alt_geom INTEGER,
        gs DOUBLE PRECISION,
        ias INTEGER,
        tas INTEGER,
        mach DOUBLE PRECISION,
        track DOUBLE PRECISION,
        track_rate DOUBLE PRECISION,
        roll DOUBLE PRECISION,
        mag_heading DOUBLE PRECISION,
        true_heading DOUBLE PRECISION,
        baro_rate INTEGER,
        geom_rate INTEGER,
        squawk CHAR(4),
        emergency VARCHAR(50),
        category VARCHAR(10),
        nav_qnh DOUBLE PRECISION,
        nav_altitude_mcp INTEGER,
        nav_altitude_fms INTEGER,
        nav_heading DOUBLE PRECISION,
        nav_modes TEXT[],
        nic INTEGER,
        rc INTEGER,
        version INTEGER,
        nic_baro INTEGER,
        nac_p INTEGER,
        nac_v INTEGER,
        sil INTEGER,
        sil_type VARCHAR(50),
        gva INTEGER,
        sda INTEGER,
        mlat TEXT[],
        tisb TEXT[],
        messages INTEGER,
        seen DOUBLE PRECISION,
        seen_pos DOUBLE PRECISION,
        rssi DOUBLE PRECISION,
        alert INTEGER,
        spi INTEGER,
        alt_baro_is_ground BOOLEAN,
        timestamp TIMESTAMP
      )
    `);
  }

  async createTableWithIndex(): Promise<void> {
    await this.createTable();
    
    // Add performance indexes
    try {
      await this.query('CREATE INDEX IF NOT EXISTS idx_performance_test_timestamp ON performance_test(timestamp)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_performance_test_hex ON performance_test(hex)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_performance_test_flight ON performance_test(flight)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_performance_test_lat_lon ON performance_test(lat, lon)');
    } catch (error) {
      console.log(`Index creation warning: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async dropTable(): Promise<void> {
    await this.query('DROP TABLE IF EXISTS performance_test');
  }

  async insertBatch(records: any[]): Promise<void> {
    if (records.length === 0) return;

    const client = await this.pool.connect();
    try {
      const columns = Object.keys(records[0]);
      const maxParamsPerQuery = 60000; // PostgreSQL limit is ~65,535
      const maxRecordsPerQuery = Math.floor(maxParamsPerQuery / columns.length);
      
      // Split large batches to avoid PostgreSQL parameter limit
      for (let i = 0; i < records.length; i += maxRecordsPerQuery) {
        const chunk = records.slice(i, i + maxRecordsPerQuery);
        
        const placeholders = chunk.map((_, recordIndex) => 
          `(${columns.map((_, colIndex) => `$${recordIndex * columns.length + colIndex + 1}`).join(', ')})`
        ).join(', ');
        
        const values = chunk.flatMap(record => columns.map(col => record[col]));
        
        const query = `INSERT INTO performance_test (${columns.join(', ')}) VALUES ${placeholders}`;
        await client.query(query, values);
      }
    } finally {
      client.release();
    }
  }
}