#!/bin/bash
set -e

echo "=== Deployment started ==="

# 1. Navigate to the project root
PROJECT_DIR="/home/base-ubuntu/messenger"
cd "$PROJECT_DIR"

# 2. Pull the latest updates
echo "Fetching latest changes from Git..."
git reset --hard HEAD
git pull origin main

# 3. Add JWT_SECRET to .env if not already present
if ! grep -q "JWT_SECRET" .env; then
  echo "Adding JWT_SECRET to .env..."
  echo "JWT_SECRET=super-secret-key-12345" >> .env
fi

# 4. Install backend dependencies & build
echo "Installing backend dependencies & compiling..."
cd backend
npm install
npm run build

# 5. Run migrations & seeding
echo "Running migrations and database seeding..."
npm run db:init

# 6. Skip frontend compilation (pre-built locally)
echo "Frontend is pre-compiled and tracked in Git. Skipping frontend build on VM."

# 7. Start/Restart application under PM2 on port 80
echo "Configuring and restarting application under PM2..."
cd ../backend

# Make sure PM2 is running with the correct env variables on port 80
sudo PORT=80 pm2 restart messenger || sudo PORT=80 pm2 start dist/index.js --name "messenger"

echo "=== Deployment completed successfully! ==="
