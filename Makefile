# Asset Tracker Enterprise - Makefile
# This file contains all the commands needed to develop, test, and deploy the enterprise asset tracking platform

.PHONY: help install install-dev build test lint clean docker k8s deploy monitor

# Default target
help: ## Show this help message
	@echo "Asset Tracker Enterprise - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# =============================================================================
# INSTALLATION COMMANDS
# =============================================================================

install: ## Install all dependencies for production
	@echo "Installing production dependencies..."
	cd services/user && npm ci --only=production
	cd services/asset && npm ci --only=production
	cd services/audit && npm ci --only=production
	cd services/notification && npm ci --only=production
	cd services/integration && npm ci --only=production
	cd services/analytics && npm ci --only=production
	cd client && npm ci --only=production

install-dev: ## Install all dependencies for development
	@echo "Installing development dependencies..."
	cd services/user && npm install
	cd services/asset && npm install
	cd services/audit && npm install
	cd services/notification && npm install
	cd services/integration && npm install
	cd services/analytics && npm install
	cd client && npm install
	npm install # Root dependencies for testing

# =============================================================================
# DEVELOPMENT COMMANDS
# =============================================================================

dev: ## Start all services in development mode
	@echo "Starting development environment..."
	docker-compose -f docker-compose.enterprise.yml up -d mongo redis elasticsearch kafka zookeeper
	@echo "Waiting for infrastructure services to be ready..."
	sleep 30
	@echo "Starting application services..."
	concurrently \
		"cd services/user && npm run dev" \
		"cd services/asset && npm run dev" \
		"cd services/audit && npm run dev" \
		"cd services/notification && npm run dev" \
		"cd services/integration && npm run dev" \
		"cd services/analytics && npm run dev" \
		"cd client && npm run dev"

dev-services: ## Start only backend services in development mode
	@echo "Starting backend services..."
	docker-compose -f docker-compose.enterprise.yml up -d mongo redis elasticsearch kafka zookeeper
	sleep 30
	concurrently \
		"cd services/user && npm run dev" \
		"cd services/asset && npm run dev" \
		"cd services/audit && npm run dev" \
		"cd services/notification && npm run dev" \
		"cd services/integration && npm run dev" \
		"cd services/analytics && npm run dev"

dev-frontend: ## Start only frontend in development mode
	cd client && npm run dev

# =============================================================================
# BUILD COMMANDS
# =============================================================================

build: ## Build all services for production
	@echo "Building all services..."
	cd client && npm run build
	docker build -t asset-tracker/user-service:latest -f services/user/Dockerfile services/user
	docker build -t asset-tracker/asset-service:latest -f services/asset/Dockerfile services/asset
	docker build -t asset-tracker/audit-service:latest -f services/audit/Dockerfile services/audit
	docker build -t asset-tracker/notification-service:latest -f services/notification/Dockerfile services/notification
	docker build -t asset-tracker/integration-service:latest -f services/integration/Dockerfile services/integration
	docker build -t asset-tracker/analytics-service:latest -f services/analytics/Dockerfile services/analytics
	docker build -t asset-tracker/client:latest -f client/Dockerfile client

build-dev: ## Build all services for development
	@echo "Building development images..."
	docker-compose -f docker-compose.enterprise.yml build

# =============================================================================
# TESTING COMMANDS
# =============================================================================

test: ## Run all tests
	@echo "Running all tests..."
	npm run test:unit
	npm run test:integration
	npm run test:e2e

test-unit: ## Run unit tests for all services
	@echo "Running unit tests..."
	cd services/user && npm test
	cd services/asset && npm test
	cd services/audit && npm test
	cd services/notification && npm test
	cd services/integration && npm test
	cd services/analytics && npm test
	cd client && npm test

test-integration: ## Run integration tests
	@echo "Running integration tests..."
	docker-compose -f docker-compose.test.yml up -d mongo redis elasticsearch
	sleep 20
	npm run test:integration
	docker-compose -f docker-compose.test.yml down

test-e2e: ## Run end-to-end tests
	@echo "Running E2E tests..."
	docker-compose -f docker-compose.enterprise.yml up -d
	sleep 60 # Wait for all services to be ready
	npm run test:e2e
	docker-compose -f docker-compose.enterprise.yml down

test-security: ## Run security tests
	@echo "Running security scans..."
	npm audit --audit-level=moderate
	cd services/user && npm audit --audit-level=moderate
	cd services/asset && npm audit --audit-level=moderate
	cd services/audit && npm audit --audit-level=moderate
	cd services/notification && npm audit --audit-level=moderate
	cd services/integration && npm audit --audit-level=moderate
	cd services/analytics && npm audit --audit-level=moderate
	cd client && npm audit --audit-level=moderate

test-performance: ## Run performance tests
	@echo "Running performance tests..."
	docker-compose -f docker-compose.enterprise.yml up -d
	sleep 60
	k6 run tests/performance/load-test.js
	docker-compose -f docker-compose.enterprise.yml down

test-coverage: ## Generate test coverage reports
	@echo "Generating coverage reports..."
	cd services/user && npm run test:coverage
	cd services/asset && npm run test:coverage
	cd services/audit && npm run test:coverage
	cd services/notification && npm run test:coverage
	cd services/integration && npm run test:coverage
	cd services/analytics && npm run test:coverage

# =============================================================================
# LINTING AND FORMATTING
# =============================================================================

lint: ## Run linting for all services
	@echo "Running linting..."
	cd services/user && npm run lint
	cd services/asset && npm run lint
	cd services/audit && npm run lint
	cd services/notification && npm run lint
	cd services/integration && npm run lint
	cd services/analytics && npm run lint
	cd client && npm run lint

lint-fix: ## Fix linting issues automatically
	@echo "Fixing linting issues..."
	cd services/user && npm run lint:fix
	cd services/asset && npm run lint:fix
	cd services/audit && npm run lint:fix
	cd services/notification && npm run lint:fix
	cd services/integration && npm run lint:fix
	cd services/analytics && npm run lint:fix
	cd client && npm run lint:fix

# =============================================================================
# DOCKER COMMANDS
# =============================================================================

docker-up: ## Start all services with Docker Compose
	@echo "Starting services with Docker Compose..."
	docker-compose -f docker-compose.enterprise.yml up -d

docker-down: ## Stop all Docker services
	@echo "Stopping Docker services..."
	docker-compose -f docker-compose.enterprise.yml down

docker-logs: ## Show logs from all Docker services
	docker-compose -f docker-compose.enterprise.yml logs -f

docker-restart: ## Restart all Docker services
	@echo "Restarting Docker services..."
	docker-compose -f docker-compose.enterprise.yml restart

docker-clean: ## Clean up Docker containers and images
	@echo "Cleaning up Docker resources..."
	docker-compose -f docker-compose.enterprise.yml down -v
	docker system prune -f
	docker volume prune -f

# =============================================================================
# KUBERNETES COMMANDS
# =============================================================================

k8s-apply: ## Apply all Kubernetes manifests
	@echo "Applying Kubernetes manifests..."
	kubectl apply -f infrastructure/kubernetes/namespace.yaml
	kubectl apply -f infrastructure/kubernetes/mongodb.yaml
	kubectl apply -f infrastructure/kubernetes/redis.yaml
	kubectl apply -f infrastructure/kubernetes/user-service.yaml
	kubectl apply -f infrastructure/kubernetes/asset-service.yaml
	kubectl apply -f infrastructure/kubernetes/audit-service.yaml
	kubectl apply -f infrastructure/kubernetes/kong-gateway.yaml
	kubectl apply -f infrastructure/kubernetes/monitoring.yaml

k8s-delete: ## Delete all Kubernetes resources
	@echo "Deleting Kubernetes resources..."
	kubectl delete -f infrastructure/kubernetes/ --recursive

k8s-status: ## Check status of Kubernetes resources
	@echo "Kubernetes cluster status:"
	kubectl get pods -n asset-tracker
	kubectl get services -n asset-tracker
	kubectl get ingress -n asset-tracker

k8s-logs: ## Show logs from Kubernetes pods
	kubectl logs -f -l app=user-service -n asset-tracker

# =============================================================================
# MONITORING COMMANDS
# =============================================================================

monitor-up: ## Start monitoring stack
	@echo "Starting monitoring stack..."
	docker-compose -f docker-compose.enterprise.yml up -d prometheus grafana jaeger

monitor-down: ## Stop monitoring stack
	docker-compose -f docker-compose.enterprise.yml stop prometheus grafana jaeger

monitor-dashboard: ## Open monitoring dashboards
	@echo "Opening monitoring dashboards..."
	@echo "Grafana: http://localhost:3001 (admin/grafanaSecurePassword123)"
	@echo "Prometheus: http://localhost:9090"
	@echo "Jaeger: http://localhost:16686"

# =============================================================================
# DEPLOYMENT COMMANDS
# =============================================================================

deploy-staging: ## Deploy to staging environment
	@echo "Deploying to staging..."
	./scripts/deploy-staging.sh

deploy-production: ## Deploy to production environment
	@echo "Deploying to production..."
	./scripts/deploy-production.sh

deploy-local: ## Deploy to local Kubernetes
	@echo "Deploying to local Kubernetes..."
	make k8s-apply
	@echo "Waiting for services to be ready..."
	kubectl wait --for=condition=available --timeout=300s deployment/user-service -n asset-tracker

# =============================================================================
# DATABASE COMMANDS
# =============================================================================

db-migrate: ## Run database migrations
	@echo "Running database migrations..."
	cd services/user && npm run migrate
	cd services/asset && npm run migrate
	cd services/audit && npm run migrate

db-seed: ## Seed database with sample data
	@echo "Seeding database..."
	cd services/user && npm run seed
	cd services/asset && npm run seed

db-backup: ## Backup all databases
	@echo "Creating database backup..."
	./scripts/backup-databases.sh

db-restore: ## Restore databases from backup
	@echo "Restoring databases..."
	./scripts/restore-databases.sh

# =============================================================================
# SECURITY COMMANDS
# =============================================================================

security-scan: ## Run comprehensive security scan
	@echo "Running security scans..."
	make test-security
	./scripts/security-scan.sh

security-generate-keys: ## Generate new encryption keys
	@echo "Generating new security keys..."
	./scripts/generate-keys.sh

security-rotate-secrets: ## Rotate all secrets
	@echo "Rotating secrets..."
	./scripts/rotate-secrets.sh

# =============================================================================
# MAINTENANCE COMMANDS
# =============================================================================

clean: ## Clean up temporary files and caches
	@echo "Cleaning up..."
	rm -rf node_modules
	rm -rf services/*/node_modules
	rm -rf client/node_modules
	rm -rf services/*/logs/*
	rm -rf client/dist
	rm -rf coverage
	rm -rf .nyc_output

logs: ## Show application logs
	@echo "Showing application logs..."
	tail -f services/*/logs/*.log

health-check: ## Check health of all services
	@echo "Checking service health..."
	curl -f http://localhost:3002/health || echo "User service not healthy"
	curl -f http://localhost:3001/health || echo "Asset service not healthy"
	curl -f http://localhost:3003/health || echo "Audit service not healthy"
	curl -f http://localhost:3004/health || echo "Notification service not healthy"
	curl -f http://localhost:3005/health || echo "Integration service not healthy"
	curl -f http://localhost:3006/health || echo "Analytics service not healthy"

# =============================================================================
# CI/CD COMMANDS
# =============================================================================

ci-build: ## Run CI build pipeline
	@echo "Running CI build pipeline..."
	make lint
	make test-unit
	make build
	make test-integration

ci-deploy: ## Run CI deployment pipeline
	@echo "Running CI deployment pipeline..."
	make security-scan
	make test-performance
	make deploy-staging

# =============================================================================
# ENVIRONMENT SETUP
# =============================================================================

env-setup: ## Set up environment files
	@echo "Setting up environment files..."
	cp config/environments/.env.enterprise.example config/environments/.env.enterprise
	@echo "Please edit config/environments/.env.enterprise with your configuration"

env-validate: ## Validate environment configuration
	@echo "Validating environment configuration..."
	./scripts/validate-environment.sh

# =============================================================================
# DOCUMENTATION COMMANDS
# =============================================================================

docs-generate: ## Generate API documentation
	@echo "Generating API documentation..."
	cd services/user && npm run docs
	cd services/asset && npm run docs
	cd services/audit && npm run docs

docs-serve: ## Serve documentation locally
	@echo "Serving documentation..."
	cd docs && python3 -m http.server 8080

# =============================================================================
# INITIALIZATION
# =============================================================================

init: ## Initialize the project for first-time setup
	@echo "Initializing Asset Tracker Enterprise..."
	make install-dev
	make env-setup
	make docker-up
	sleep 60
	make db-migrate
	make db-seed
	@echo ""
	@echo "🎉 Asset Tracker Enterprise initialized successfully!"
	@echo ""
	@echo "Next steps:"
	@echo "1. Edit config/environments/.env.enterprise with your configuration"
	@echo "2. Run 'make dev' to start development environment"
	@echo "3. Open http://localhost:3000 in your browser"
	@echo ""

quick-start: ## Quick start for development
	@echo "Quick starting Asset Tracker..."
	make docker-up
	sleep 30
	make dev

# =============================================================================
# VARIABLES
# =============================================================================

# Version
VERSION ?= 1.0.0

# Environment
ENV ?= development

# Docker registry
REGISTRY ?= asset-tracker

# Kubernetes namespace
NAMESPACE ?= asset-tracker