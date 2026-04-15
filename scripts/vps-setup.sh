#!/bin/bash

# Libanos POS - VPS Deployment Script (Ubuntu)
# This script automates the setup of Node.js, PostgreSQL, Nginx, and PM2.

set -e

echo "🚀 Starting Deployment Setup..."

# 1. Update System
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (LTS)
echo "🟢 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PostgreSQL
echo "🐘 Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 4. Install Nginx
echo "🌐 Installing Nginx..."
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# 5. Install PM2
echo "🔄 Installing PM2..."
sudo npm install -g pm2

# 6. Setup Database (Instructions for user)
echo "------------------------------------------------------------"
echo "🛠️ DATABASE SETUP REQUIRED:"
echo "Run the following commands to create your database and user:"
echo ""
echo "sudo -u postgres psql"
echo "CREATE DATABASE libanos_pos;"
echo "CREATE USER libanos_user WITH ENCRYPTED PASSWORD 'your_strong_password';"
echo "GRANT ALL PRIVILEGES ON DATABASE libanos_pos TO libanos_user;"
echo "\q"
echo "------------------------------------------------------------"

# 7. Firewall Setup
echo "🛡️ Configuring Firewall (UFW)..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "✅ Base installation complete!"
echo "Next steps:"
echo "1. Clone your repository to /var/www/libanos-pos"
echo "2. Create a .env file with your production secrets"
echo "3. Run 'npm install' and 'npm run build'"
echo "4. Use PM2 to start the backend: 'pm2 start ecosystem.config.cjs'"
echo "5. Configure Nginx using the provided template."
