import { createClient, ClickHouseClient } from '@clickhouse/client';
import { config } from '../config';

export class ClickHouseDatabase {
  private client: ClickHouseClient;

  constructor() {
    this.client = createClient({
      host: `http://${config.clickhouse.host}:${config.clickhouse.port}`,
      database: config.clickhouse.database,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
    });
  }

  async connect(): Promise<void> {
    await this.client.ping();
    console.log('ClickHouse connected successfully');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  async query(sql: string): Promise<any> {
    const result = await this.client.query({
      query: sql,
      format: 'JSONEachRow',
    });
    return result.json();
  }

  async createTable(): Promise<void> {
    await this.client.command({
      query: `
        CREATE TABLE IF NOT EXISTS performance_test (
          zorderCoordinate UInt64,
          approach UInt8,
          autopilot UInt8,
          althold UInt8,
          lnav UInt8,
          tcas UInt8,
          hex FixedString(6),
          transponder_type LowCardinality(String),
          flight String,
          r String,
          aircraft_type LowCardinality(String) DEFAULT '',
          dbFlags UInt32,
          lat Float64,
          lon Float64,
          alt_baro Int32,
          alt_baro_is_ground UInt8,
          alt_geom Int32,
          gs UInt16,
          track UInt16,
          baro_rate Int16,
          geom_rate Int16 DEFAULT 0,
          squawk FixedString(4),
          emergency LowCardinality(String),
          category LowCardinality(String),
          nav_qnh UInt16 DEFAULT 0,
          nav_altitude_mcp UInt16 DEFAULT 0,
          nav_heading UInt16 DEFAULT 0,
          nav_modes Array(LowCardinality(String)),
          nic UInt8,
          rc UInt16,
          seen_pos Float32,
          version UInt8,
          nic_baro UInt8,
          nac_p UInt8,
          nac_v UInt8,
          sil UInt8,
          sil_type LowCardinality(String),
          gva UInt8,
          sda UInt8,
          alert UInt8,
          spi UInt8,
          mlat Array(LowCardinality(String)),
          tisb Array(LowCardinality(String)),
          messages UInt32,
          seen Float32,
          rssi Float32,
          timestamp DateTime
        ) ENGINE = MergeTree()
        ORDER BY (timestamp, hex)
      `
    });
  }

  async createTableWithIndex(): Promise<void> {
    await this.createTable();
  }

  async dropTable(): Promise<void> {
    await this.client.command({
      query: 'DROP TABLE IF EXISTS performance_test'
    });
  }

  async insertBatch(data: any[]): Promise<void> {
    await this.client.insert({
      table: 'performance_test',
      values: data,
      format: 'JSONEachRow',
    });
  }

  getClient(): ClickHouseClient {
    return this.client;
  }
}