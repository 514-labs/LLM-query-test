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

# Clean up any orphaned volumes from database containers
echo "🧹 Cleaning up orphaned Docker volumes..."
ORPHANED_VOLUMES=$(docker volume ls -q --filter dangling=true)
if [ ! -z "$ORPHANED_VOLUMES" ]; then
    echo "Removing $(echo "$ORPHANED_VOLUMES" | wc -l) orphaned volume(s)..."
    echo "$ORPHANED_VOLUMES" | xargs docker volume rm
    echo "✅ Orphaned volumes cleaned up"
else
    echo "ℹ️  No orphaned volumes to clean"
fi

echo "🎉 Database container and volume cleanup complete!"