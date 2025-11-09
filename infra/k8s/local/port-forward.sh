#!/bin/bash

# Kill any existing port-forwards
echo "Cleaning up existing port-forwards..."
pkill -f "port-forward.*fm-app-svc.*8080:8080" 2>/dev/null || true
pkill -f "port-forward.*dbmeta-svc.*8081:8080" 2>/dev/null || true

sleep 2

# Start port-forwards
echo "Starting port-forward for fm-app on localhost:8080..."
kubectl port-forward -n local svc/fm-app-svc 8080:8080 > /dev/null 2>&1 &

echo "Starting port-forward for db-meta on localhost:8081..."
kubectl port-forward -n local svc/dbmeta-svc 8081:8080 > /dev/null 2>&1 &

sleep 2

# Verify
if lsof -nP -iTCP:8080 -sTCP:LISTEN > /dev/null 2>&1; then
    echo "✓ fm-app accessible at http://localhost:8080"
else
    echo "⚠ fm-app port-forward failed"
fi

if lsof -nP -iTCP:8081 -sTCP:LISTEN > /dev/null 2>&1; then
    echo "✓ db-meta accessible at http://localhost:8081"
else
    echo "⚠ db-meta port-forward failed"
fi

echo ""
echo "To stop port-forwards: pkill -f 'port-forward.*local'"
