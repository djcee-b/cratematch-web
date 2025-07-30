#!/bin/bash

# Simple Server Monitoring Script (Robust Version)
# Run this on your production server during load testing

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🖥️  Server Monitoring Dashboard${NC}"
echo "=================================="
echo "Press Ctrl+C to stop monitoring"
echo ""

# Main monitoring loop
while true; do
    # Clear the line and move cursor to beginning
    echo -en "\r\033[K"
    
    # Get current timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # CPU Usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    
    # Memory Usage
    memory_info=$(free | grep Mem)
    total=$(echo $memory_info | awk '{print $2}')
    used=$(echo $memory_info | awk '{print $3}')
    memory_usage=$(echo "scale=1; $used * 100 / $total" | bc -l 2>/dev/null || echo "0")
    
    # Load Average
    load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    
    # Active Connections
    connections=$(netstat -an | grep :80 | wc -l 2>/dev/null || echo "0")
    
    # Node.js Process
    node_pid=$(pgrep -f "node server.js" | head -1)
    if [ -n "$node_pid" ]; then
        node_memory=$(ps -p $node_pid -o %mem --no-headers 2>/dev/null || echo "0")
        node_cpu=$(ps -p $node_pid -o %cpu --no-headers 2>/dev/null || echo "0")
    else
        node_memory="0"
        node_cpu="0"
    fi
    
    # Disk Usage
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//' 2>/dev/null || echo "0")
    
    # Print status line
    echo -n "CPU: "
    if (( $(echo "$cpu_usage > 80" | bc -l 2>/dev/null) )); then
        echo -en "${RED}${cpu_usage}%${NC}"
    elif (( $(echo "$cpu_usage > 60" | bc -l 2>/dev/null) )); then
        echo -en "${YELLOW}${cpu_usage}%${NC}"
    else
        echo -en "${GREEN}${cpu_usage}%${NC}"
    fi
    
    echo -n " | Mem: "
    if (( $(echo "$memory_usage > 80" | bc -l 2>/dev/null) )); then
        echo -en "${RED}${memory_usage}%${NC}"
    elif (( $(echo "$memory_usage > 60" | bc -l 2>/dev/null) )); then
        echo -en "${YELLOW}${memory_usage}%${NC}"
    else
        echo -en "${GREEN}${memory_usage}%${NC}"
    fi
    
    echo -n " | Load: ${BLUE}${load_avg}${NC}"
    echo -n " | Connections: ${BLUE}${connections}${NC}"
    echo -n " | Node: ${BLUE}${node_cpu}%${NC}"
    echo -n " | Disk: ${BLUE}${disk_usage}%${NC}"
    echo -n " | ${timestamp}"
    
    # Wait 2 seconds before next update
    sleep 2
done 