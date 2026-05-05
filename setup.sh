#!/bin/bash

# Asset Tracker Enterprise Setup Script
# This script sets up the development environment for the Asset Tracker platform

set -e

echo "🏢 Asset Tracker Enterprise Setup"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ LTS"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//')
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)
    
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        log_error "Node.js version $NODE_VERSION is not supported. Please install Node.js 18+ LTS"
        exit 1
    fi
    
    log_success "Node.js $NODE_VERSION detected"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_warning "Docker is not installed. Some features may not work without Docker"
    else
        log_success "Docker detected"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_warning "Docker Compose is not installed. Infrastructure services will need manual setup"
    else
        log_success "Docker Compose detected"
    fi
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    directories=(
        "logs"
        "uploads"
        "services/asset/logs"
        "services/user/logs" 
        "services/audit/logs"
        "services/notification/logs"
        "services/integration/logs"
        "services/analytics/logs"
        "client/dist"
        "config/secrets"
    )
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_success "Created directory: $dir"
        fi
    done
    
    # Create .gitkeep files for empty directories
    touch logs/.gitkeep
    touch uploads/.gitkeep
    find services -name "logs" -type d -exec touch {}/.gitkeep \;
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    services=(
        "services/asset"
        "services/user"
        "services/audit" 
        "services/notification"
        "services/integration"
        "services/analytics"
        "client"
    )
    
    for service in "${services[@]}"; do
        if [ -f "$service/package.json" ]; then
            log_info "Installing dependencies for $service"
            (cd "$service" && npm install)
            log_success "Dependencies installed for $service"
        else
            log_warning "No package.json found in $service"
        fi
    done
    
    # Install root dependencies if present
    if [ -f "package.json" ]; then
        log_info "Installing root dependencies"
        npm install
        log_success "Root dependencies installed"
    fi
}

# Setup environment files
setup_environment() {
    log_info "Setting up environment configuration..."
    
    # Copy example env files
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_success "Created .env from .env.example"
            log_warning "Please update .env with your specific configuration"
        else
            log_warning "No .env.example found. Please create .env manually"
        fi
    else
        log_info ".env already exists"
    fi
    
    # Setup service-specific env files
    services=("services/asset" "services/user" "services/audit" "services/notification")
    
    for service in "${services[@]}"; do
        if [ -f "$service/.env.example" ] && [ ! -f "$service/.env" ]; then
            cp "$service/.env.example" "$service/.env"
            log_success "Created $service/.env"
        fi
    done
}

# Generate secrets
generate_secrets() {
    log_info "Generating secure secrets..."
    
    # Generate JWT secret if not exists
    if ! grep -q "JWT_SECRET=" .env 2>/dev/null || grep -q "JWT_SECRET=your_very_secure_jwt_secret" .env 2>/dev/null; then
        JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
        if [ -f ".env" ]; then
            sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
            rm .env.bak 2>/dev/null || true
        else
            echo "JWT_SECRET=${JWT_SECRET}" >> .env
        fi
        log_success "Generated JWT secret"
    fi
    
    # Generate session secret if not exists
    if ! grep -q "SESSION_SECRET=" .env 2>/dev/null; then
        SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
        echo "SESSION_SECRET=${SESSION_SECRET}" >> .env
        log_success "Generated session secret"
    fi
    
    # Generate encryption key if not exists
    if ! grep -q "ENCRYPTION_KEY=" .env 2>/dev/null; then
        ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
        echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}" >> .env
        log_success "Generated encryption key"
    fi
}

# Setup database
setup_database() {
    log_info "Setting up database services..."
    
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        # Check if services are already running
        if docker ps | grep -q "mongo\|redis"; then
            log_info "Database services already running"
        else
            log_info "Starting database services with Docker Compose..."
            if command -v docker-compose &> /dev/null; then
                docker-compose up -d mongo redis
            else
                docker compose up -d mongo redis
            fi
            log_success "Database services started"
            
            # Wait for services to be ready
            log_info "Waiting for database services to be ready..."
            sleep 10
        fi
    else
        log_warning "Docker not available. Please ensure MongoDB and Redis are running manually"
        log_info "MongoDB: mongodb://localhost:27017"
        log_info "Redis: redis://localhost:6379"
    fi
}

# Verify setup
verify_setup() {
    log_info "Verifying setup..."
    
    # Check if .env exists and has required variables
    required_vars=("JWT_SECRET" "MONGO_URI")
    
    if [ -f ".env" ]; then
        for var in "${required_vars[@]}"; do
            if ! grep -q "^${var}=" .env; then
                log_error "Missing required environment variable: $var"
                return 1
            fi
        done
        log_success "Environment variables configured"
    else
        log_error ".env file not found"
        return 1
    fi
    
    # Check if key services have their dependencies installed
    key_services=("services/asset" "services/notification" "client")
    
    for service in "${key_services[@]}"; do
        if [ -d "$service/node_modules" ]; then
            log_success "$service dependencies installed"
        else
            log_warning "$service dependencies not installed"
        fi
    done
}

# Main setup function
main() {
    echo
    log_info "Starting Asset Tracker Enterprise setup..."
    echo
    
    check_prerequisites
    echo
    
    create_directories
    echo
    
    setup_environment
    echo
    
    generate_secrets
    echo
    
    install_dependencies
    echo
    
    setup_database
    echo
    
    verify_setup
    echo
    
    log_success "🎉 Asset Tracker Enterprise setup completed!"
    echo
    echo "Next steps:"
    echo "1. Review and update .env file with your specific configuration"
    echo "2. Start the development environment: make dev"
    echo "3. Open http://localhost:3000 in your browser"
    echo
    echo "Useful commands:"
    echo "  make help          - Show all available commands"
    echo "  make dev           - Start development environment"
    echo "  make test          - Run tests"
    echo "  make docker-up     - Start infrastructure services"
    echo "  make health-check  - Check service health"
    echo
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "clean")
        log_info "Cleaning up..."
        rm -rf node_modules services/*/node_modules client/node_modules
        rm -rf logs/* uploads/*
        log_success "Cleanup completed"
        ;;
    "reset")
        log_info "Resetting environment..."
        rm -f .env services/*/.env
        $0 clean
        $0 setup
        ;;
    "help")
        echo "Asset Tracker Setup Script"
        echo "Usage: $0 [command]"
        echo
        echo "Commands:"
        echo "  setup (default)  - Run full setup"
        echo "  clean           - Clean node_modules and logs"
        echo "  reset           - Clean and re-setup everything"
        echo "  help            - Show this help"
        ;;
    *)
        log_error "Unknown command: $1"
        $0 help
        exit 1
        ;;
esac