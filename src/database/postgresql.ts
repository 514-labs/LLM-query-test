import { Pool, Client } from 'pg';
import { config } from '../config';

export class PostgreSQLDatabase {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.username,
      password: config.postgres.password,
      max: 10,
    });
  }

  async connect(): Promise<void> {
    // First connect to default database to create the target database if needed
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
        console.log(`Created database: ${config.postgres.database}`);
      }
    } catch (error) {
      console.log(`Database creation failed or database already exists: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await defaultClient.end();
    }

    // Now connect to the target database
    const client = await this.pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('PostgreSQL connected successfully');
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async query(sql: string): Promise<any> {
    const result = await this.pool.query(sql);
    return result.rows;
  }

  async createTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS performance_test (
        zorderCoordinate BIGINT,
        approach BOOLEAN,
        autopilot BOOLEAN,
        althold BOOLEAN,
        lnav BOOLEAN,
        tcas BOOLEAN,
        hex VARCHAR(6),
        transponder_type VARCHAR(50),
        flight VARCHAR(20),
        r VARCHAR(20),
        aircraft_type VARCHAR(10),
        dbFlags DOUBLE PRECISION,
        lat DOUBLE PRECISION,
        lon DOUBLE PRECISION,
        alt_baro DOUBLE PRECISION,
        alt_baro_is_ground BOOLEAN,
        alt_geom DOUBLE PRECISION,
        gs DOUBLE PRECISION,
        track DOUBLE PRECISION,
        baro_rate DOUBLE PRECISION,
        geom_rate DOUBLE PRECISION,
        squawk VARCHAR(4),
        emergency VARCHAR(20),
        category VARCHAR(5),
        nav_qnh DOUBLE PRECISION,
        nav_altitude_mcp DOUBLE PRECISION,
        nav_heading DOUBLE PRECISION,
        nav_modes TEXT[],
        nic DOUBLE PRECISION,
        rc DOUBLE PRECISION,
        seen_pos DOUBLE PRECISION,
        version DOUBLE PRECISION,
        nic_baro DOUBLE PRECISION,
        nac_p DOUBLE PRECISION,
        nac_v DOUBLE PRECISION,
        sil DOUBLE PRECISION,
        sil_type VARCHAR(20),
        gva DOUBLE PRECISION,
        sda DOUBLE PRECISION,
        alert DOUBLE PRECISION,
        spi DOUBLE PRECISION,
        mlat TEXT[],
        tisb TEXT[],
        messages DOUBLE PRECISION,
        seen DOUBLE PRECISION,
        rssi DOUBLE PRECISION,
        timestamp TIMESTAMP
      )
    `);
  }

  async createTableWithIndex(): Promise<void> {
    await this.createTable();
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_test_timestamp 
      ON performance_test (timestamp)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_test_hex_timestamp 
      ON performance_test (hex, timestamp)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_performance_test_lat_lon 
      ON performance_test (lat, lon)
    `);
  }

  async dropTable(): Promise<void> {
    await this.pool.query('DROP TABLE IF EXISTS performance_test');
  }

  async insertBatch(data: any[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Use bulk INSERT with VALUES clause for much better performance
      const chunkSize = 100; // Smaller chunks due to many columns (46 * 100 = 4600 parameters)
      
      const columns = [
        'zorderCoordinate', 'approach', 'autopilot', 'althold', 'lnav', 'tcas', 'hex', 'transponder_type',
        'flight', 'r', 'aircraft_type', 'dbFlags', 'lat', 'lon', 'alt_baro', 'alt_baro_is_ground',
        'alt_geom', 'gs', 'track', 'baro_rate', 'geom_rate', 'squawk', 'emergency', 'category',
        'nav_qnh', 'nav_altitude_mcp', 'nav_heading', 'nav_modes', 'nic', 'rc', 'seen_pos', 'version',
        'nic_baro', 'nac_p', 'nac_v', 'sil', 'sil_type', 'gva', 'sda', 'alert', 'spi', 'mlat',
        'tisb', 'messages', 'seen', 'rssi', 'timestamp'
      ];
      
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        
        // Build VALUES clause for bulk insert
        const values: any[] = [];
        const placeholders = chunk.map((_, index) => {
          const base = index * columns.length;
          const record = chunk[index];
          
          // Push all values in order
          values.push(
            record.zorderCoordinate, record.approach, record.autopilot, record.althold, record.lnav,
            record.tcas, record.hex, record.transponder_type, record.flight, record.r, record.aircraft_type,
            record.dbFlags, record.lat, record.lon, record.alt_baro, record.alt_baro_is_ground,
            record.alt_geom, record.gs, record.track, record.baro_rate, record.geom_rate, record.squawk,
            record.emergency, record.category, record.nav_qnh, record.nav_altitude_mcp, record.nav_heading,
            record.nav_modes, record.nic, record.rc, record.seen_pos, record.version, record.nic_baro,
            record.nac_p, record.nac_v, record.sil, record.sil_type, record.gva, record.sda, record.alert,
            record.spi, record.mlat, record.tisb, record.messages, record.seen, record.rssi, record.timestamp
          );
          
          // Generate parameter placeholders
          const paramPlaceholders = [];
          for (let j = 0; j < columns.length; j++) {
            paramPlaceholders.push(`$${base + j + 1}`);
          }
          return `(${paramPlaceholders.join(', ')})`;
        }).join(', ');
        
        const sql = `INSERT INTO performance_test (${columns.join(', ')}) VALUES ${placeholders}`;
        await client.query(sql, values);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  getPool(): Pool {
    return this.pool;
  }
}