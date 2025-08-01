#!/bin/bash

# Cleanup script for database containers
# This script removes all database containers used by the performance testing application

echo "🧹 Cleaning up database containers..."

# Stop and remove ClickHouse container
if docker ps -a --format "table {{.Names}}" | grep -q "clickhouse-server"; then
    echo "Removing ClickHouse container..."
    docker rm -f clickhouse-server
    echo "✅ ClickHouse container removed"
else
    echo "ℹ️  ClickHouse container not found"
fi

# Stop and remove PostgreSQL containers
if docker ps -a --format "table {{.Names}}" | grep -q "postgres"; then
    echo "Removing PostgreSQL container (default)..."
    docker rm -f postgres
    echo "✅ PostgreSQL container removed"
else
    echo "ℹ️  PostgreSQL container not found"
fi

if docker ps -a --format "table {{.Names}}" | grep -q "postgres-indexed"; then
    echo "Removing PostgreSQL container (indexed)..."
    docker rm -f postgres-indexed
    echo "✅ PostgreSQL indexed container removed"
else
    echo "ℹ️  PostgreSQL indexed container not found"
fi

echo "🎉 Database container cleanup complete!"