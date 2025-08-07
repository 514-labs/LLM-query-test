#!/usr/bin/env tsx
/**
 * Generate embeddable charts for PostgreSQL vs ClickHouse benchmark results
 */

import * as d3 from 'd3';
import { JSDOM } from 'jsdom';
import fs from 'fs/promises';
import path from 'path';

// Load data
const dataPath = path.join(process.cwd(), '..', 'visualization-data.json');
const rawData = await fs.readFile(dataPath, 'utf-8');
const data = JSON.parse(rawData);

const width = 800;
const height = 500;
const margin = { top: 60, right: 80, bottom: 80, left: 80 };

function createSVG() {
    const dom = new JSDOM(`<!DOCTYPE html><body></body>`);
    const document = dom.window.document;
    const body = d3.select(document.body);
    return body.append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('xmlns', 'http://www.w3.org/2000/svg');
}

async function saveSVG(svg: any, filename: string) {
    const svgString = svg.node().outerHTML;
    await fs.writeFile(filename, svgString);
}

async function createCrossoverDiagram() {
    const svg = createSVG();
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    
    const datasets = data.query_performance_crossover.datasets;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Scales
    const xScale = d3.scaleBand()
        .domain(datasets.map((d: any) => d.size))
        .range([0, chartWidth])
        .padding(0.1);
    
    const yScale = d3.scaleLog()
        .domain([1, d3.max(datasets, (d: any) => Math.max(d.clickhouse_ms, d.postgresql_ms, d.postgresql_indexed_ms)) as number])
        .range([chartHeight, 0])
        .nice();
    
    // Line generator
    const line = d3.line<any>()
        .x(d => xScale(d.size)! + xScale.bandwidth() / 2)
        .y(d => yScale(d.clickhouse_ms));
    
    // Add axes
    g.append('g')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('font-size', '12px');
    
    g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(d => d.toString()))
        .selectAll('text')
        .style('font-size', '12px');
    
    // Add axis labels
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (chartHeight / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text('Query Time (ms) - Log Scale');
    
    g.append('text')
        .attr('transform', `translate(${chartWidth / 2}, ${chartHeight + margin.bottom - 20})`)
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text('Dataset Size');
    
    // Draw lines
    const colors = { clickhouse: '#f39c12', postgresql: '#3498db', postgresql_indexed: '#9b59b6' };
    
    // ClickHouse line
    g.append('path')
        .datum(datasets)
        .attr('fill', 'none')
        .attr('stroke', colors.clickhouse)
        .attr('stroke-width', 4)
        .attr('d', line);
    
    // PostgreSQL line
    const pgLine = d3.line<any>()
        .x(d => xScale(d.size)! + xScale.bandwidth() / 2)
        .y(d => yScale(d.postgresql_ms));
    
    g.append('path')
        .datum(datasets)
        .attr('fill', 'none')
        .attr('stroke', colors.postgresql)
        .attr('stroke-width', 4)
        .attr('d', pgLine);
    
    // PostgreSQL indexed line
    const pgIdxLine = d3.line<any>()
        .x(d => xScale(d.size)! + xScale.bandwidth() / 2)
        .y(d => yScale(d.postgresql_indexed_ms));
    
    g.append('path')
        .datum(datasets)
        .attr('fill', 'none')
        .attr('stroke', colors.postgresql_indexed)
        .attr('stroke-width', 4)
        .attr('d', pgIdxLine);
    
    // Add points
    datasets.forEach((d: any) => {
        const x = xScale(d.size)! + xScale.bandwidth() / 2;
        
        g.append('circle')
            .attr('cx', x)
            .attr('cy', yScale(d.clickhouse_ms))
            .attr('r', 6)
            .attr('fill', colors.clickhouse)
            .attr('stroke', 'white')
            .attr('stroke-width', 2);
        
        g.append('circle')
            .attr('cx', x)
            .attr('cy', yScale(d.postgresql_ms))
            .attr('r', 6)
            .attr('fill', colors.postgresql)
            .attr('stroke', 'white')
            .attr('stroke-width', 2);
        
        g.append('circle')
            .attr('cx', x)
            .attr('cy', yScale(d.postgresql_indexed_ms))
            .attr('r', 6)
            .attr('fill', colors.postgresql_indexed)
            .attr('stroke', 'white')
            .attr('stroke-width', 2);
    });
    
    // Add crossover annotation at 50K
    const crossoverX = xScale('50K')! + xScale.bandwidth() / 2;
    g.append('line')
        .attr('x1', crossoverX)
        .attr('x2', crossoverX)
        .attr('y1', 0)
        .attr('y2', chartHeight)
        .attr('stroke', 'red')
        .attr('stroke-dasharray', '5,5')
        .attr('stroke-width', 2);
    
    g.append('text')
        .attr('x', crossoverX + 10)
        .attr('y', chartHeight / 3)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', 'red')
        .text('Crossover Point');
    
    g.append('text')
        .attr('x', crossoverX + 10)
        .attr('y', chartHeight / 3 + 15)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', 'red')
        .text('~50K rows');
    
    // Add legend
    const legend = g.append('g')
        .attr('transform', `translate(${chartWidth - 150}, 20)`);
    
    const legendData = [
        { name: 'ClickHouse', color: colors.clickhouse },
        { name: 'PostgreSQL', color: colors.postgresql },
        { name: 'PostgreSQL + Index', color: colors.postgresql_indexed }
    ];
    
    legendData.forEach((d, i) => {
        const legendRow = legend.append('g')
            .attr('transform', `translate(0, ${i * 20})`);
        
        legendRow.append('line')
            .attr('x1', 0)
            .attr('x2', 15)
            .attr('y1', 0)
            .attr('y2', 0)
            .attr('stroke', d.color)
            .attr('stroke-width', 3);
        
        legendRow.append('text')
            .attr('x', 20)
            .attr('y', 4)
            .style('font-size', '12px')
            .text(d.name);
    });
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('font-weight', 'bold')
        .text('PostgreSQL vs ClickHouse: The 50K Row Crossover Point');
    
    await saveSVG(svg, 'crossover_diagram.svg');
    console.log('✓ Generated crossover_diagram.svg');
}

async function createBulkLoadingChart() {
    const svg = createSVG();
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    
    const phases = data.bulk_loading_performance.phases;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Scales
    const xScale = d3.scaleBand()
        .domain(phases.map((p: any) => p.name))
        .range([0, chartWidth])
        .padding(0.1);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(phases, (p: any) => p.time_minutes) as number])
        .range([chartHeight, 0])
        .nice();
    
    // Add axes
    g.append('g')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('font-size', '10px')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');
    
    g.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-size', '12px');
    
    // Add axis labels
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (chartHeight / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text('Loading Time (minutes)');
    
    // Color scale
    const colors = ['#e74c3c', '#f39c12', '#f1c40f', '#3498db', '#2ecc71'];
    
    // Draw bars
    g.selectAll('.bar')
        .data(phases)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', (d: any) => xScale(d.name)!)
        .attr('width', xScale.bandwidth())
        .attr('y', (d: any) => yScale(d.time_minutes))
        .attr('height', (d: any) => chartHeight - yScale(d.time_minutes))
        .attr('fill', (d: any, i: number) => colors[i])
        .attr('stroke', 'white')
        .attr('stroke-width', 2);
    
    // Add value labels
    g.selectAll('.bar-label')
        .data(phases)
        .enter().append('text')
        .attr('class', 'bar-label')
        .attr('x', (d: any) => xScale(d.name)! + xScale.bandwidth() / 2)
        .attr('y', (d: any) => yScale(d.time_minutes) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text((d: any) => `${d.time_minutes}m`);
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('font-weight', 'bold')
        .text('Bulk Loading Journey: From 450 Minutes to 13 Minutes');
    
    await saveSVG(svg, 'bulk_loading_performance.svg');
    console.log('✓ Generated bulk_loading_performance.svg');
}

async function createFunctionComparison() {
    const svg = createSVG();
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    
    const funcData = data.function_comparison.unique_count_5m_records;
    const chartData = [
        { name: 'PostgreSQL\n(COUNT DISTINCT)', time: funcData.postgresql_exact.time_ms },
        { name: 'ClickHouse\n(uniq)', time: funcData.clickhouse_approx.time_ms }
    ];
    
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Scales
    const xScale = d3.scaleBand()
        .domain(chartData.map(d => d.name))
        .range([0, chartWidth])
        .padding(0.3);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.time) as number])
        .range([chartHeight, 0])
        .nice();
    
    // Add axes
    g.append('g')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('font-size', '12px');
    
    g.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-size', '12px');
    
    // Add axis labels
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (chartHeight / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text('Query Time (milliseconds)');
    
    // Draw bars
    const colors = ['#3498db', '#f39c12'];
    
    g.selectAll('.bar')
        .data(chartData)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.name)!)
        .attr('width', xScale.bandwidth())
        .attr('y', d => yScale(d.time))
        .attr('height', d => chartHeight - yScale(d.time))
        .attr('fill', (d, i) => colors[i])
        .attr('stroke', 'white')
        .attr('stroke-width', 2);
    
    // Add value labels
    g.selectAll('.bar-label')
        .data(chartData)
        .enter().append('text')
        .attr('class', 'bar-label')
        .attr('x', d => xScale(d.name)! + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.time) - 10)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(d => `${d.time}ms`);
    
    // Add 40x faster annotation
    const arrow = g.append('g')
        .attr('transform', `translate(${xScale('ClickHouse\n(uniq)')! + xScale.bandwidth() / 2}, ${yScale(funcData.clickhouse_approx.time_ms) - 50})`);
    
    arrow.append('text')
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .style('fill', 'red')
        .text('40x faster!');
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('font-weight', 'bold')
        .text('Unique Count Functions: 40x Speed Improvement (5M Records)');
    
    await saveSVG(svg, 'function_comparison.svg');
    console.log('✓ Generated function_comparison.svg');
}

async function main() {
    console.log('Generating database benchmark visualizations with D3...');
    
    try {
        await createCrossoverDiagram();
        await createBulkLoadingChart();
        await createFunctionComparison();
        
        console.log('\n✅ All charts generated successfully!');
        console.log('Generated SVG files:');
        console.log('  - crossover_diagram.svg (key insight)');
        console.log('  - bulk_loading_performance.svg');
        console.log('  - function_comparison.svg');
        console.log('\nNote: SVG files can be easily embedded in blog posts and converted to PNG if needed.');
        
    } catch (error) {
        console.error('❌ Error generating charts:', error);
        process.exit(1);
    }
}

await main();