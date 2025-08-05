# Contributing

- [Report bugs](https://github.com/514-labs/llm-test/issues)
- [Discuss features](https://github.com/514-labs/llm-test/discussions)
- Pick up `Good First Issue` tags

## Development

Requirements: Node.js v18+, Docker v20+

```bash
npm install
npm run build
npm run start-dbs
npx ts-node tests/smoke.test.ts
```

## PR Checklist

- [ ] Smoke tests pass
- [ ] `npm run build` succeeds
- [ ] `npm start` runs without errors
- [ ] Performance impact considered

## Guidelines

- TypeScript strict mode
- JSDoc for public APIs
- Commits: "Fix #123: description"
- Test with multiple dataset sizes
- Avoid allocations in hot paths

## Bug Reports

Include:
- Environment (OS, Node, Docker versions)
- Steps to reproduce
- Expected vs actual behavior
- Error logs
- Dataset size