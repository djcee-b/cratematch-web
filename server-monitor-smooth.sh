#!/bin/bash

# Smooth Server Monitoring Script (No Flashing)
# Run this on your production server during load testing

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to print status bar
print_status_bar() {
    local value=$1
    local max=100
    local width=20
    local filled=$((value * width / max))
    local empty=$((width - filled))
    
    printf "["
    for ((i=0; i<filled; i++)); do printf "█"; done
    for ((i=0; i<empty; i++)); do printf "░"; done
    printf "] %3.1f%%" $value
}

# Function to print colored metric
print_metric() {
    local label=$1
    local value=$2
    local unit=$3
    
    if (( $(echo "$value > 80" | bc -l) )); then
        echo -e "$label: ${RED}${value}${unit}${NC}"
    elif (( $(echo "$value > 60" | bc -l) )); then
        echo -e "$label: ${YELLOW}${value}${unit}${NC}"
    else
        echo -e "$label: ${GREEN}${value}${unit}${NC}"
    fi
}

# Clear screen once at start
clear

echo -e "${BLUE}🖥️  Server Monitoring Dashboard${NC}"
echo "=================================="
echo "Press Ctrl+C to stop monitoring"
echo ""

# Main monitoring loop
while true; do
    # Move cursor to top of the metrics area
    echo -en "\033[4;0H"
    
    # Get current timestamp
    echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # CPU Usage
    cpu_usage=$(get_cpu_usage)
    echo -n "CPU Usage: "
    print_status_bar $cpu_usage
    echo ""
    
    # Memory Usage
    memory_usage=$(get_memory_usage)
    echo -n "Memory Usage: "
    print_status_bar $memory_usage
    echo ""
    
    # Load Average
    load_avg=$(get_load_average)
    cpu_cores=$(nproc)
    load_per_core=$(echo "scale=2; $load_avg / $cpu_cores" | bc)
    echo -e "Load Average: ${BLUE}${load_avg}${NC} (${load_per_core} per core)"
    
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
    echo -n "Disk Usage: "
    print_status_bar $disk_usage
    echo ""
    
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}"
    
    # Wait 2 seconds before next update
    sleep 2
done 