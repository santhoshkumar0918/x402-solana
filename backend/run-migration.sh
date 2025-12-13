#!/bin/bash

# Database migration script for cross-chain payments table
# Usage: ./run-migration.sh

set -e

echo "Running cross-chain payments migration..."

# Database connection details
DB_HOST="ouawxjbbxejxmfvjfumz.supabase.co"
DB_USER="postgres.ouawxjbbxejxmfvjfumz"
DB_NAME="postgres"
DB_PASSWORD="Santhosh0918"

# SQL migration file
MIGRATION_FILE="migrations/001_cross_chain_payments.sql"

# Run migration (note: requires psql to be installed)
# Alternative: Use Supabase dashboard SQL editor and paste the migration

echo "Note: If psql is not installed, copy the SQL from $MIGRATION_FILE"
echo "      and run it in Supabase dashboard SQL editor:"
echo "      https://supabase.com/dashboard/project/ouawxjbbxejxmfvjfumz/sql/new"
echo ""
echo "Migration SQL:"
cat $MIGRATION_FILE

echo ""
echo "Migration ready to run. Use Supabase SQL editor or install psql."
