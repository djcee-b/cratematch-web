#!/bin/bash

# Simple Server Monitoring Script
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

# Function to get CPU usage
get_cpu_usage() {
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    echo $cpu_usage
}

# Function to get memory usage
get_memory_usage() {
    memory_info=$(free | grep Mem)
    total=$(echo $memory_info | awk '{print $2}')
    used=$(echo $memory_info | awk '{print $3}')
    usage_percent=$(echo "scale=2; $used * 100 / $total" | bc)
    echo $usage_percent
}

# Function to get load average
get_load_average() {
    load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    echo $load_avg
}

# Function to get active connections
get_active_connections() {
    connections=$(netstat -an | grep :80 | wc -l)
    echo $connections
}

# Function to get Node.js process info
get_node_process() {
    node_pid=$(pgrep -f "node server.js" | head -1)
    if [ -n "$node_pid" ]; then
        node_memory=$(ps -p $node_pid -o %mem --no-headers)
        node_cpu=$(ps -p $node_pid -o %cpu --no-headers)
        echo "$node_memory,$node_cpu"
    else
        echo "0,0"
    fi
}

# Function to get disk usage
get_disk_usage() {
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    echo $disk_usage
}

# Main monitoring loop
while true; do
    clear
    echo -e "${BLUE}🖥️  Server Monitoring Dashboard${NC}"
    echo "=================================="
    echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # CPU Usage
    cpu_usage=$(get_cpu_usage)
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        echo -e "CPU Usage: ${RED}${cpu_usage}%${NC}"
    elif (( $(echo "$cpu_usage > 60" | bc -l) )); then
        echo -e "CPU Usage: ${YELLOW}${cpu_usage}%${NC}"
    else
        echo -e "CPU Usage: ${GREEN}${cpu_usage}%${NC}"
    fi
    
    # Memory Usage
    memory_usage=$(get_memory_usage)
    if (( $(echo "$memory_usage > 80" | bc -l) )); then
        echo -e "Memory Usage: ${RED}${memory_usage}%${NC}"
    elif (( $(echo "$memory_usage > 60" | bc -l) )); then
        echo -e "Memory Usage: ${YELLOW}${memory_usage}%${NC}"
    else
        echo -e "Memory Usage: ${GREEN}${memory_usage}%${NC}"
    fi
    
    # Load Average
    load_avg=$(get_load_average)
    cpu_cores=$(nproc)
    load_per_core=$(echo "scale=2; $load_avg / $cpu_cores" | bc)
    
    if (( $(echo "$load_per_core > 1.0" | bc -l) )); then
        echo -e "Load Average: ${RED}${load_avg} (${load_per_core} per core)${NC}"
    elif (( $(echo "$load_per_core > 0.7" | bc -l) )); then
        echo -e "Load Average: ${YELLOW}${load_avg} (${load_per_core} per core)${NC}"
    else
        echo -e "Load Average: ${GREEN}${load_avg} (${load_per_core} per core)${NC}"
    fi
    
    # Active Connections
    connections=$(get_active_connections)
    echo -e "Active Connections: ${BLUE}${connections}${NC}"
    
    # Node.js Process
    node_info=$(get_node_process)
    if [ "$node_info" != "0,0" ]; then
        node_memory=$(echo $node_info | cut -d',' -f1)
        node_cpu=$(echo $node_info | cut -d',' -f2)
        echo -e "Node.js Memory: ${BLUE}${node_memory}%${NC}"
        echo -e "Node.js CPU: ${BLUE}${node_cpu}%${NC}"
    else
        echo -e "Node.js Process: ${RED}Not Found${NC}"
    fi
    
    # Disk Usage
    disk_usage=$(get_disk_usage)
    if [ "$disk_usage" -gt 80 ]; then
        echo -e "Disk Usage: ${RED}${disk_usage}%${NC}"
    elif [ "$disk_usage" -gt 60 ]; then
        echo -e "Disk Usage: ${YELLOW}${disk_usage}%${NC}"
    else
        echo -e "Disk Usage: ${GREEN}${disk_usage}%${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}"
    
    # Wait 2 seconds before next update
    sleep 2
done 