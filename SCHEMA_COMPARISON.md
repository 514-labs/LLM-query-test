# Schema Comparison

Field mapping and type differences between databases.

## Status: ✅ RESOLVED

ClickHouse: 47 fields, PostgreSQL: 47 fields (after fixes)

## Type Mappings

| ClickHouse | PostgreSQL | Notes |
|------------|------------|-------|
| UInt64 | bigint | 64-bit integers |
| FixedString(6) | character(6) | Fixed-length strings |
| LowCardinality(String) | varchar(50) | CH: categorical optimization |
| Float64 | double precision | 64-bit floats |
| Array(String) | text[] | Arrays |
| DateTime | timestamp | Time fields |

## Implementation

**Field Mapping**: camelCase → lowercase for PostgreSQL compatibility

```typescript
private mapFieldNamesToPostgreSQL(fieldName: string): string {
  const fieldMapping = {
    'zorderCoordinate': 'zordercoordinate',
    'dbFlags': 'dbflags'
  };
  return fieldMapping[fieldName] || fieldName;
}
```

**Design Philosophy**:
- ClickHouse: Storage efficiency (UInt8, FixedString, LowCardinality)
- PostgreSQL: SQL compatibility (standard types, flexibility)
- Both approaches valid for their use cases