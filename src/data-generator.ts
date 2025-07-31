export interface AircraftTrackingRecord {
  zorderCoordinate: number;
  approach: boolean;
  autopilot: boolean;
  althold: boolean;
  lnav: boolean;
  tcas: boolean;
  hex: string;
  transponder_type: string;
  flight: string;
  r: string;
  aircraft_type: string | null;
  dbFlags: number;
  lat: number;
  lon: number;
  alt_baro: number;
  alt_baro_is_ground: boolean;
  alt_geom: number;
  gs: number;
  track: number;
  baro_rate: number;
  geom_rate: number | null;
  squawk: string;
  emergency: string;
  category: string;
  nav_qnh: number | null;
  nav_altitude_mcp: number | null;
  nav_heading: number | null;
  nav_modes: string[];
  nic: number;
  rc: number;
  seen_pos: number;
  version: number;
  nic_baro: number;
  nac_p: number;
  nac_v: number;
  sil: number;
  sil_type: string;
  gva: number;
  sda: number;
  alert: number;
  spi: number;
  mlat: string[];
  tisb: string[];
  messages: number;
  seen: number;
  rssi: number;
  timestamp: string;
}

export class DataGenerator {
  private aircraftCategories = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'B1', 'B2', 'C1', 'C2'];
  private emergencyStates = ['none', 'general', 'lifeguard', 'minfuel', 'nordo', 'unlawful', 'downed'];
  private silTypes = ['perhour', 'persample'];
  private navModes = ['autopilot', 'althold', 'approach', 'lnav', 'tcas', 'vnav'];
  
  // Realistic flight callsigns and registrations
  private flightPrefixes = ['AAL', 'DAL', 'UAL', 'SWA', 'JBU', 'ASA', 'SKW', 'TETON', 'REACH', 'CTM', 'BAW', 'AFR'];
  private militaryCallsigns = ['TETON', 'REACH', 'SENTRY', 'KNIFE', 'VAPOR', 'RIDER'];
  private registrationPrefixes = ['N', 'G-', 'F-', 'D-', 'C-', '92-', '11-', '86-'];
  
  // Geographic regions for realistic positioning
  private regions = [
    { name: 'US_EAST', latRange: [25, 47], lonRange: [-85, -65] },
    { name: 'US_WEST', latRange: [32, 48], lonRange: [-125, -100] },
    { name: 'EUROPE', latRange: [35, 60], lonRange: [-10, 25] },
    { name: 'ATLANTIC', latRange: [30, 50], lonRange: [-60, -20] }
  ];

  generateTestData(rowCount: number, database?: 'clickhouse' | 'postgresql'): AircraftTrackingRecord[] {
    console.log(`Generating ${rowCount.toLocaleString()} aircraft tracking records...`);
    const data: AircraftTrackingRecord[] = [];
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    const endDate = new Date();
    const timeRange = endDate.getTime() - startDate.getTime();

    // Generate unique aircraft for the dataset
    const aircraftCount = Math.min(rowCount / 10, 5000); // ~10 records per aircraft on average
    const aircraft = this.generateAircraft(aircraftCount);

    for (let i = 0; i < rowCount; i++) {
      const randomTime = startDate.getTime() + Math.random() * timeRange;
      const date = new Date(randomTime);
      
      // Format timestamp based on database type
      let timestamp: string;
      if (database === 'clickhouse') {
        timestamp = date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
      } else {
        timestamp = date.toISOString();
      }

      // Pick a random aircraft and generate realistic tracking data
      const aircraftData = aircraft[Math.floor(Math.random() * aircraft.length)];
      const region = this.regions[Math.floor(Math.random() * this.regions.length)];
      
      // Generate position within region with some flight path continuity
      const lat = region.latRange[0] + Math.random() * (region.latRange[1] - region.latRange[0]);
      const lon = region.lonRange[0] + Math.random() * (region.lonRange[1] - region.lonRange[0]);
      
      // Realistic altitude based on aircraft type
      const isCommercial = aircraftData.category.startsWith('A') && !aircraftData.flight.includes('TETON');
      const altBaro = isCommercial 
        ? 20000 + Math.random() * 20000  // Commercial: 20k-40k ft
        : Math.random() * 15000;         // GA/Military: 0-15k ft
      
      const record: AircraftTrackingRecord = {
        zorderCoordinate: Math.floor((lat + 90) * 1000000 + (lon + 180) * 1000),
        approach: Math.random() < 0.05, // 5% on approach
        autopilot: isCommercial ? Math.random() < 0.8 : Math.random() < 0.3,
        althold: Math.random() < 0.7,
        lnav: isCommercial ? Math.random() < 0.6 : Math.random() < 0.2,
        tcas: isCommercial ? Math.random() < 0.9 : Math.random() < 0.4,
        hex: aircraftData.hex,
        transponder_type: '',
        flight: aircraftData.flight,
        r: aircraftData.registration,
        aircraft_type: Math.random() < 0.8 ? this.generateAircraftType() : null,
        dbFlags: 1,
        lat: Math.round(lat * 1000000) / 1000000,
        lon: Math.round(lon * 1000000) / 1000000,
        alt_baro: Math.round(altBaro),
        alt_baro_is_ground: altBaro < 50,
        alt_geom: Math.round(altBaro + (Math.random() - 0.5) * 200),
        gs: Math.random() * 500 + 100, // Ground speed 100-600 knots
        track: Math.random() * 360,
        baro_rate: (Math.random() - 0.5) * 4000, // ±2000 fpm
        geom_rate: Math.random() < 0.9 ? (Math.random() - 0.5) * 128 : null,
        squawk: this.generateSquawk(),
        emergency: this.emergencyStates[Math.floor(Math.random() * this.emergencyStates.length)],
        category: aircraftData.category,
        nav_qnh: Math.random() < 0.8 ? 1013 + (Math.random() - 0.5) * 50 : null,
        nav_altitude_mcp: Math.random() < 0.7 ? Math.round(altBaro + (Math.random() - 0.5) * 1000) : null,
        nav_heading: Math.random() < 0.6 ? Math.random() * 360 : null,
        nav_modes: this.generateNavModes(),
        nic: Math.floor(Math.random() * 11),
        rc: Math.floor(Math.random() * 500),
        seen_pos: Math.random() * 10,
        version: Math.random() < 0.9 ? 2 : 1,
        nic_baro: Math.floor(Math.random() * 2),
        nac_p: Math.floor(Math.random() * 12),
        nac_v: Math.floor(Math.random() * 5),
        sil: Math.floor(Math.random() * 4),
        sil_type: this.silTypes[Math.floor(Math.random() * this.silTypes.length)],
        gva: Math.floor(Math.random() * 3),
        sda: Math.floor(Math.random() * 3),
        alert: 0,
        spi: 0,
        mlat: [],
        tisb: [],
        messages: Math.floor(Math.random() * 100000),
        seen: Math.random() * 60,
        rssi: -5 - Math.random() * 15, // -5 to -20 dBm
        timestamp: timestamp
      };

      data.push(record);

      if (i % 100000 === 0 && i > 0) {
        console.log(`Generated ${i.toLocaleString()} records...`);
      }
    }

    console.log(`Aircraft tracking data generation complete: ${rowCount.toLocaleString()} records`);
    return data;
  }

  private generateAircraft(count: number) {
    const aircraft = [];
    for (let i = 0; i < count; i++) {
      const isMilitary = Math.random() < 0.1;
      const prefix = isMilitary 
        ? this.militaryCallsigns[Math.floor(Math.random() * this.militaryCallsigns.length)]
        : this.flightPrefixes[Math.floor(Math.random() * this.flightPrefixes.length)];
      
      aircraft.push({
        hex: this.generateHex(),
        flight: isMilitary 
          ? `${prefix}${Math.floor(Math.random() * 99).toString().padStart(2, '0')} `
          : `${prefix}${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
        registration: this.generateRegistration(),
        category: this.aircraftCategories[Math.floor(Math.random() * this.aircraftCategories.length)]
      });
    }
    return aircraft;
  }

  private generateHex(): string {
    return Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  }

  private generateRegistration(): string {
    const prefix = this.registrationPrefixes[Math.floor(Math.random() * this.registrationPrefixes.length)];
    const suffix = Math.floor(Math.random() * 99999).toString().padStart(4, '0');
    return `${prefix}${suffix}`;
  }

  private generateSquawk(): string {
    // Common squawk codes with realistic distribution
    const common = ['1200', '7000', '2000', '0400'];
    if (Math.random() < 0.3) {
      return common[Math.floor(Math.random() * common.length)];
    }
    return Math.floor(Math.random() * 7777).toString().padStart(4, '0');
  }

  private generateNavModes(): string[] {
    const modes: string[] = [];
    this.navModes.forEach(mode => {
      if (Math.random() < 0.3) modes.push(mode);
    });
    return modes;
  }

  private generateAircraftType(): string {
    const types = ['B738', 'A320', 'B777', 'A330', 'C172', 'PA28', 'B752', 'E145', 'CRJ2', 'DH8D'];
    return types[Math.floor(Math.random() * types.length)];
  }

  async generateAndInsertInBatches(database: any, rowCount: number, databaseType: 'clickhouse' | 'postgresql', batchSize: number = 50000): Promise<void> {
    console.log(`Generating and inserting ${rowCount.toLocaleString()} aircraft records in batches of ${batchSize.toLocaleString()}...`);
    
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = new Date();
    const timeRange = endDate.getTime() - startDate.getTime();
    
    // Generate unique aircraft for the dataset (keep this in memory as it's small)
    const aircraftCount = Math.min(rowCount / 10, 5000);
    const aircraft = this.generateAircraft(aircraftCount);
    
    for (let i = 0; i < rowCount; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, rowCount - i);
      const batch: AircraftTrackingRecord[] = [];
      
      // Generate batch in memory
      for (let j = 0; j < currentBatchSize; j++) {
        const randomTime = startDate.getTime() + Math.random() * timeRange;
        const date = new Date(randomTime);
        
        let timestamp: string;
        if (databaseType === 'clickhouse') {
          timestamp = date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
        } else {
          timestamp = date.toISOString();
        }

        const aircraftData = aircraft[Math.floor(Math.random() * aircraft.length)];
        const region = this.regions[Math.floor(Math.random() * this.regions.length)];
        
        const lat = region.latRange[0] + Math.random() * (region.latRange[1] - region.latRange[0]);
        const lon = region.lonRange[0] + Math.random() * (region.lonRange[1] - region.lonRange[0]);
        
        const isCommercial = aircraftData.category.startsWith('A') && !aircraftData.flight.includes('TETON');
        const altBaro = isCommercial 
          ? 20000 + Math.random() * 20000
          : Math.random() * 15000;
        
        const record: AircraftTrackingRecord = {
          zorderCoordinate: Math.floor((lat + 90) * 1000000 + (lon + 180) * 1000),
          approach: Math.random() < 0.05,
          autopilot: isCommercial ? Math.random() < 0.8 : Math.random() < 0.3,
          althold: Math.random() < 0.7,
          lnav: isCommercial ? Math.random() < 0.6 : Math.random() < 0.2,
          tcas: isCommercial ? Math.random() < 0.9 : Math.random() < 0.4,
          hex: aircraftData.hex,
          transponder_type: '',
          flight: aircraftData.flight,
          r: aircraftData.registration,
          aircraft_type: Math.random() < 0.8 ? this.generateAircraftType() : null,
          dbFlags: 1,
          lat: Math.round(lat * 1000000) / 1000000,
          lon: Math.round(lon * 1000000) / 1000000,
          alt_baro: Math.round(altBaro),
          alt_baro_is_ground: altBaro < 50,
          alt_geom: Math.round(altBaro + (Math.random() - 0.5) * 200),
          gs: Math.random() * 500 + 100,
          track: Math.random() * 360,
          baro_rate: (Math.random() - 0.5) * 4000,
          geom_rate: Math.random() < 0.9 ? (Math.random() - 0.5) * 128 : null,
          squawk: this.generateSquawk(),
          emergency: this.emergencyStates[Math.floor(Math.random() * this.emergencyStates.length)],
          category: aircraftData.category,
          nav_qnh: Math.random() < 0.8 ? 1013 + (Math.random() - 0.5) * 50 : null,
          nav_altitude_mcp: Math.random() < 0.7 ? Math.round(altBaro + (Math.random() - 0.5) * 1000) : null,
          nav_heading: Math.random() < 0.6 ? Math.random() * 360 : null,
          nav_modes: this.generateNavModes(),
          nic: Math.floor(Math.random() * 11),
          rc: Math.floor(Math.random() * 500),
          seen_pos: Math.random() * 10,
          version: Math.random() < 0.9 ? 2 : 1,
          nic_baro: Math.floor(Math.random() * 2),
          nac_p: Math.floor(Math.random() * 12),
          nac_v: Math.floor(Math.random() * 5),
          sil: Math.floor(Math.random() * 4),
          sil_type: this.silTypes[Math.floor(Math.random() * this.silTypes.length)],
          gva: Math.floor(Math.random() * 3),
          sda: Math.floor(Math.random() * 3),
          alert: 0,
          spi: 0,
          mlat: [],
          tisb: [],
          messages: Math.floor(Math.random() * 100000),
          seen: Math.random() * 60,
          rssi: -5 - Math.random() * 15,
          timestamp: timestamp
        };

        batch.push(record);
      }
      
      // Insert batch and clear from memory
      await database.insertBatch(batch);
      
      const progress = Math.min(i + batchSize, rowCount);
      console.log(`Inserted ${progress.toLocaleString()} / ${rowCount.toLocaleString()} records`);
      
      // Clear batch to free memory
      batch.length = 0;
    }
    
    console.log('Data insertion complete');
  }

  // Keep the old method for backward compatibility
  async insertDataInBatches(database: any, data: AircraftTrackingRecord[], batchSize: number = 50000): Promise<void> {
    console.log(`Inserting ${data.length.toLocaleString()} records in batches of ${batchSize.toLocaleString()}...`);
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await database.insertBatch(batch);
      
      const progress = Math.min(i + batchSize, data.length);
      console.log(`Inserted ${progress.toLocaleString()} / ${data.length.toLocaleString()} records`);
    }
    
    console.log('Data insertion complete');
  }
}