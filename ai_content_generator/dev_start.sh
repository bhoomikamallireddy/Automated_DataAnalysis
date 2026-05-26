#!/bin/bash

echo "🧹 Clearing stale port allocations..."
sudo fuser -k 8000/tcp 2>/dev/null
sudo fuser -k 6379/tcp 2>/dev/null

echo "🚀 Booting Redis Server Subsystem..."
sudo service redis-server start

echo "🧹 Flushing out active Redis cache allocations..."
redis-cli flushall

echo "🟢 Subsystem bridges are stabilized. You are ready to launch!"
