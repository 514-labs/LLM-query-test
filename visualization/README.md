# Database Benchmark Visualization

Generate embeddable PNG charts for the PostgreSQL vs ClickHouse benchmark results using TypeScript and Chart.js.

## Charts Generated

1. **Crossover Diagram** - Line chart showing the critical 50K row crossover point
2. **Bulk Loading Performance** - Bar chart showing the 450→13 minute optimization journey
3. **Function Comparison** - Bar chart showing 40x speed improvement with approximate functions
4. **Type Optimization Impact** - Bar chart showing 15% improvements from type optimization

## Usage

```bash
cd visualization
npm install
npm run generate
```

This generates 4 PNG files ready for embedding in blog posts or documentation.

## Key Insights Visualized

- **50K row crossover point** where ClickHouse overtakes PostgreSQL
- **34.6x bulk loading improvement** from architecture-aware optimization
- **40x faster unique counting** with ClickHouse's approximate functions
- **15% storage & performance gains** from precise type selection