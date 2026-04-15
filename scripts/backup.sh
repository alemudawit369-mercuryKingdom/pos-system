#!/bin/bash

# Libanos Epoxy POS - Database Backup Script
# Usage: ./backup.sh [backup_dir]

BACKUP_DIR=${1:-"./backups"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pos_db_backup_$TIMESTAMP.sql"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Starting database backup..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set."
    exit 1
fi

# Run pg_dump
# We use the DATABASE_URL directly which contains all connection info
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Backup successful: $BACKUP_FILE"
    
    # Optional: Remove backups older than 30 days
    find "$BACKUP_DIR" -name "pos_db_backup_*.sql" -mtime +30 -delete
    echo "Old backups cleaned up."
else
    echo "Error: Backup failed."
    exit 1
fi
