# 🤖 CLAUDE.md — Claude Code Assistant Instructions

> Use this file to assist Claude Code in understanding and working with this enterprise-grade asset tracking platform effectively.

## 📌 Project Overview

This is an enterprise-grade asset tracking platform built using a microservices architecture with strict enterprise compliance and scalability requirements. It includes:

- **Multi-tenant SaaS** with tenant isolation
- **Real-time asset tracking** with WebSocket and event streaming
- **QR/RFID support** with mobile-first scanning
- **Role-based access control** (RBAC) with fine-grained permissions
- **Enterprise file storage** (S3 with CDN)
- **Comprehensive audit logging** for compliance
- **Elasticsearch indexing** for advanced search and analytics
- **Redis caching** with clustering support
- **Kafka/Redis Streams** for event-driven architecture
- **Container orchestration** with Kubernetes
- **Enterprise CI/CD** with security scanning and automated testing

## 🏢 Enterprise Requirements

### Compliance & Security
- **SOC 2 Type II** compliance required
- **GDPR** compliant data handling and deletion
- **ISO 27001** security management standards
- **HIPAA** ready for healthcare asset tracking
- **PCI DSS** for payment card industry compliance
- **Zero-trust security model** implementation

### Performance & Scalability
- **99.99% uptime** SLA requirement
- **<100ms API response time** (95th percentile)
- **Support 10,000+ concurrent users** per tenant
- **Handle 1M+ assets** per tenant
- **Real-time event processing** <5 second latency
- **Auto-scaling** based on demand (2-50 instances per service)

### Business Requirements
- **Multi-region deployment** (US, EU, APAC)
- **24/7 customer support** integration
- **Enterprise SSO** (SAML 2.0, OIDC)
- **White-label** customization support
- **API rate limiting** (1000 req/min per tenant)
- **Data retention policies** (7-year audit trail)

## 🧭 Project Structure

```txt
.
├── services/
│   ├── user/           # Authentication, authorization, org management
│   │   ├── src/
│   │   ├── tests/
│   │   ├── k8s/        # Kubernetes manifests
│   │   └── Dockerfile
│   ├── asset/          # Asset CRUD, transfers, search, analytics
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── events/
│   │   │   └── validators/
│   │   ├── tests/
│   │   ├── k8s/
│   │   └── migrations/
│   ├── audit/          # Compliance logging, reporting
│   ├── notification/   # Email, SMS, push notifications
│   ├── integration/    # ERP, WMS, external API connectors
│   └── analytics/      # Business intelligence, reporting
├── gateway/
│   ├── kong/          # API Gateway with enterprise plugins
│   ├── nginx/         # Load balancer and SSL termination
│   └── istio/         # Service mesh configuration
├── client/
│   ├── admin/         # Administrative dashboard
│   ├── mobile/        # Field worker mobile app
│   ├── public/        # Customer-facing portal
│   └── shared/        # Shared components and utilities
├── infrastructure/
│   ├── kubernetes/    # K8s cluster configuration
│   ├── terraform/     # Infrastructure as code
│   ├── helm/         # Application deployment charts
│   └── monitoring/   # Observability stack
├── config/
│   ├── environments/ # Per-environment configuration
│   ├── secrets/      # Encrypted secrets management
│   └── policies/     # Security and access policies
├── docs/
│   ├── api/          # OpenAPI specifications
│   ├── architecture/ # System design documents
│   ├── runbooks/     # Operational procedures
│   └── compliance/   # Audit and compliance documentation
├── scripts/
│   ├── migration/    # Database migration utilities
│   ├── deployment/   # CI/CD deployment scripts
│   └── monitoring/   # Health check and alerting scripts
└── tests/
    ├── integration/  # Cross-service integration tests
    ├── performance/  # Load and stress testing
    ├── security/     # Security penetration tests
    └── e2e/         # End-to-end user workflow tests
```

## 📂 Entry Points & Service Boundaries

### Backend Services (Domain-Driven Design)
- **User Service**: `services/user/src/index.js`
  - Authentication, authorization, user management
  - Organization and tenant management
  - RBAC policy enforcement
- **Asset Service**: `services/asset/src/index.js`
  - Asset lifecycle management
  - Location tracking and transfers
  - Search and analytics
- **Audit Service**: `services/audit/src/index.js`
  - Compliance logging
  - Event sourcing
  - Reporting and analytics
- **Integration Service**: `services/integration/src/index.js`
  - ERP system connectors
  - Webhook management
  - External API adapters

### Frontend Applications
- **Admin Dashboard**: `client/admin/src/main.jsx`
- **Mobile App**: `client/mobile/src/App.jsx` (React Native)
- **Public Portal**: `client/public/src/index.js`

### Infrastructure
- **API Gateway**: `gateway/kong/kong.yaml`
- **Service Mesh**: `gateway/istio/gateway.yaml`
- **Kubernetes**: `infrastructure/kubernetes/`
- **Monitoring**: `infrastructure/monitoring/prometheus/`

## 🏗️ Architecture Guidelines

### Domain-Driven Design Patterns
- **Bounded contexts** clearly defined per service
- **Event storming** results documented in `/docs/architecture/`
- **Aggregate roots** enforce business invariants
- **Domain events** for cross-service communication
- **Anti-corruption layers** for external system integration

### Microservices Patterns
- **Database per service** with event-driven consistency
- **Saga pattern** for distributed transactions
- **Circuit breaker** pattern for resilience (Hystrix/resilience4j)
- **Bulkhead isolation** for resource protection
- **Strangler fig** pattern for legacy system migration

### Event-Driven Architecture
- **Event sourcing** for audit service
- **CQRS** for read/write optimization
- **Event streaming** via Kafka for real-time updates
- **Dead letter queues** for failed event processing
- **Event schema registry** for version management

### Security Patterns
- **Zero-trust architecture** with mutual TLS
- **OAuth 2.0 + OIDC** for authentication
- **JWT with short expiry** (15min access, 7d refresh)
- **API key management** for service-to-service auth
- **Encryption at rest and in transit** (AES-256)
- **Secret rotation** automated via Vault/AWS Secrets Manager

## ⚙️ Development Environment

### Prerequisites
- **Node.js 18+ LTS**
- **Docker 24+ with Compose V2**
- **Kubernetes 1.28+** (minikube for local)
- **MongoDB 6+** with replica set
- **Redis 7+** with clustering
- **Elasticsearch 8+** with security enabled
- **Kafka 3.5+** (optional, Redis Streams as fallback)
- **AWS CLI 2+** for S3 and secrets management

### Local Development Setup
```bash
# Install dependencies
make install

# Start infrastructure services
make infra-up

# Start application services
make services-up

# Start frontend applications
make client-up

# Run integration tests
make test-integration

# Deploy to local k8s
make deploy-local
```

### Environment Configuration
- **Development**: Full stack with mocked external services
- **Staging**: Production-like with test data
- **Production**: Multi-region with full monitoring

## 📏 Quality Standards

### Code Quality
- **Test Coverage**: 85% unit, 70% integration, 60% E2E
- **Code Quality Gates**: SonarQube quality gate must pass
- **Static Analysis**: ESLint, Prettier, dependency vulnerability scanning
- **Performance Testing**: Load tests must pass before deployment
- **Security Scanning**: SAST, DAST, and dependency scanning required

### Documentation Standards
- **API Documentation**: OpenAPI 3.0 specifications required
- **Architecture Decision Records** (ADRs) for major decisions
- **Runbooks** for operational procedures
- **Code Comments**: JSDoc for all public APIs

### Review Requirements
- **Peer Review**: 2 approvals required for production changes
- **Security Review**: Security team review for auth/data changes
- **Architecture Review**: Architecture team review for structural changes
- **Performance Review**: Performance testing for critical path changes

## 🔐 Auth & Security

### Authentication & Authorization
- **Multi-factor authentication** required for admin users
- **Single Sign-On** (SAML 2.0, OIDC) for enterprise customers
- **Role-based permissions**: `super-admin`, `tenant-admin`, `manager`, `operator`, `viewer`
- **Resource-based authorization** with fine-grained permissions
- **API key management** for service integrations
- **Session management** with secure cookie handling

### Security Controls
- **Web Application Firewall** (WAF) with OWASP rule sets
- **Rate limiting** per user/IP/API key
- **Input validation** and sanitization
- **SQL injection prevention** with parameterized queries
- **XSS protection** with CSP headers
- **CSRF protection** with secure tokens
- **Audit logging** for all security events

### Data Protection
- **Encryption at rest** (database, file storage, backups)
- **Encryption in transit** (TLS 1.3 minimum)
- **PII data classification** and handling
- **Right to be forgotten** (GDPR compliance)
- **Data anonymization** for analytics
- **Backup encryption** and secure storage

## 🚀 Production Deployment

### Container Orchestration
- **Kubernetes** production clusters (EKS/GKE/AKS)
- **Helm charts** for application deployment
- **Service mesh** (Istio) for traffic management
- **Ingress controllers** with SSL termination
- **Horizontal Pod Autoscaling** (HPA) configuration
- **Vertical Pod Autoscaling** (VPA) for resource optimization

### Deployment Strategy
- **Blue/Green deployments** for zero-downtime releases
- **Canary releases** for gradual rollouts
- **Feature flags** for runtime configuration
- **Database migrations** with rollback capability
- **Infrastructure as Code** (Terraform/CloudFormation)
- **GitOps** workflow with ArgoCD

### High Availability
- **Multi-AZ deployment** for fault tolerance
- **Database clustering** with automatic failover
- **Redis clustering** with sentinel monitoring
- **Load balancing** with health checks
- **Circuit breakers** for cascade failure prevention
- **Disaster recovery** procedures documented

### Backup & Recovery
- **Automated backups** with 7-year retention
- **Point-in-time recovery** capability
- **Cross-region backup replication**
- **Recovery Time Objective** (RTO): 4 hours
- **Recovery Point Objective** (RPO): 1 hour
- **Backup testing** and validation procedures

## 📊 Monitoring & Observability

### Application Monitoring
- **Prometheus** metrics collection
- **Grafana** dashboards for visualization
- **Jaeger** distributed tracing
- **ELK Stack** (Elasticsearch, Logstash, Kibana) for log aggregation
- **APM** (Application Performance Monitoring) integration
- **Custom business metrics** and KPIs

### Infrastructure Monitoring
- **Kubernetes monitoring** (node, pod, service health)
- **Database monitoring** (performance, replication lag)
- **Network monitoring** (latency, throughput, errors)
- **Security monitoring** (intrusion detection, anomaly detection)
- **Cost monitoring** and optimization alerts

### Alerting & Incident Response
- **PagerDuty/OpsGenie** integration for incident management
- **Slack/Teams** integration for team notifications
- **Alert fatigue** prevention with intelligent routing
- **Incident response playbooks**
- **Post-incident review** process

## 🔗 Enterprise Integrations

### Single Sign-On (SSO)
- **SAML 2.0** identity provider integration
- **OpenID Connect** (OIDC) support
- **Active Directory** / LDAP integration
- **Multi-tenant SSO** configuration
- **Just-in-time** (JIT) user provisioning

### ERP System Integration
- **SAP** connector for asset master data
- **Oracle EBS** integration for financial data
- **Microsoft Dynamics** synchronization
- **Custom REST/SOAP** API adapters
- **ETL pipelines** for data synchronization
- **Conflict resolution** strategies

### External API Management
- **API versioning** strategy (semantic versioning)
- **Rate limiting** per client/integration
- **Webhook delivery** with retry logic
- **API key lifecycle** management
- **Partner portal** for API documentation
- **SLA monitoring** and reporting

### Third-Party Services
- **AWS S3** for file storage with CDN
- **Twilio** for SMS notifications
- **SendGrid** for email delivery
- **Stripe** for payment processing (if applicable)
- **Auth0/Okta** for identity management
- **DataDog/New Relic** for APM

## 🧪 Test Instructions

### Local Development Testing
```bash
# Unit tests with coverage
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Performance tests
npm run test:performance

# Security tests
npm run test:security

# All tests with coverage report
npm run test:all
```

### CI/CD Pipeline Testing
```bash
# Build and test pipeline
make ci-build

# Security scanning
make security-scan

# Performance benchmark
make performance-test

# Deployment validation
make deploy-test
```

### Load Testing
- **JMeter/k6** scripts for load testing
- **Baseline performance** metrics established
- **Stress testing** to identify breaking points
- **Volume testing** with large datasets
- **Spike testing** for traffic surges

## 🔁 Caching & Event Processing

### Caching Strategy
- **Redis Cluster** for distributed caching
- **Application-level** caching with TTL policies
- **Database query** result caching
- **API response** caching with invalidation
- **CDN caching** for static assets
- **Cache warming** strategies

### Event Processing
- **Kafka** for high-throughput event streaming
- **Redis Streams** as lightweight alternative
- **Event schema** validation and evolution
- **Dead letter queues** for failed processing
- **Event replay** capability for debugging
- **Exactly-once** processing guarantees

### Message Patterns
- **Publish-subscribe** for real-time updates
- **Request-reply** for synchronous operations
- **Message queues** for background processing
- **Event sourcing** for audit trails
- **Saga orchestration** for distributed workflows

## 🗂️ Git Workflow & CI/CD

### Branch Strategy
- **GitFlow** with protected main/develop branches
- **Feature branches**: `feat/TICKET-123-description`
- **Hotfix branches**: `hotfix/TICKET-456-critical-fix`
- **Release branches**: `release/v2.1.0`
- **Branch protection** rules enforced

### Pull Request Process
- **Template** with checklist and testing requirements
- **Required reviews**: 2 approvals minimum
- **Automated checks**: tests, security scan, code quality
- **Squash merge** for clean history
- **Conventional commits** for automated changelog

### CI/CD Pipeline (GitHub Actions / GitLab CI)
```yaml
stages:
  - build          # Docker image build
  - test           # Unit, integration, security tests
  - quality        # SonarQube analysis
  - security       # SAST, DAST, dependency scanning
  - deploy-dev     # Automated deployment to dev
  - deploy-staging # Manual approval for staging
  - deploy-prod    # Manual approval for production
```

### Release Management
- **Semantic versioning** (MAJOR.MINOR.PATCH)
- **Release notes** generation from conventional commits
- **Database migration** validation
- **Rollback procedures** documented and tested
- **Feature flag** management for gradual rollouts

## 🚨 Known Issues & Technical Debt

### High Priority
- [ ] **Search service** Elasticsearch dependency startup race condition
- [ ] **Audit service** Event sourcing performance optimization needed
- [ ] **User service** Password policy enforcement inconsistency
- [ ] **Asset service** Bulk import memory optimization required

### Medium Priority
- [ ] **API Gateway** Rate limiting per tenant implementation
- [ ] **Mobile app** Offline sync conflict resolution
- [ ] **Admin UI** Performance optimization for large datasets
- [ ] **Integration service** Webhook retry logic hardening

### Low Priority / Future Enhancements
- [ ] **Analytics service** Machine learning for predictive maintenance
- [ ] **Notification service** Advanced routing rules
- [ ] **Asset service** IoT sensor integration framework
- [ ] **Client apps** Progressive Web App (PWA) capabilities

### Infrastructure Concerns
- [ ] **MongoDB** TTL indexes may need recreation after schema changes
- [ ] **Redis** Cluster failover testing needed
- [ ] **S3** Bucket policies require validation for new regions
- [ ] **Kubernetes** Resource quotas and limits need optimization

## 📋 Enterprise Checklists

### Security Checklist
- [ ] OWASP Top 10 vulnerabilities addressed
- [ ] Penetration testing completed quarterly
- [ ] Security headers configured (HSTS, CSP, etc.)
- [ ] Secrets rotation implemented
- [ ] Audit logging comprehensive and tamper-proof
- [ ] Incident response plan tested

### Compliance Checklist
- [ ] GDPR compliance verified (data mapping, privacy policies)
- [ ] SOC 2 controls implemented and tested
- [ ] Data retention policies automated
- [ ] Breach notification procedures documented
- [ ] Third-party vendor assessments completed
- [ ] Regular compliance audits scheduled

### Performance Checklist
- [ ] SLA metrics monitored and alerting configured
- [ ] Database indexes optimized for query patterns
- [ ] CDN configuration optimized for global users
- [ ] Auto-scaling policies tested under load
- [ ] Performance regression testing automated
- [ ] Capacity planning models updated

### Operational Checklist
- [ ] Runbooks created for all services
- [ ] Disaster recovery procedures tested
- [ ] Backup restoration validated monthly
- [ ] Monitoring dashboards comprehensive
- [ ] On-call rotation and escalation defined
- [ ] Change management process documented

---

## 🎯 Enterprise Transformation Priorities

### Phase 1: Foundation (Months 1-3)
1. **Security hardening** - Implement zero-trust architecture
2. **Observability** - Full monitoring and alerting setup
3. **CI/CD maturity** - Automated testing and deployment
4. **Documentation** - Complete API docs and runbooks

### Phase 2: Scale (Months 4-6)
1. **Performance optimization** - Sub-100ms response times
2. **Multi-tenancy** - Complete tenant isolation
3. **High availability** - 99.99% uptime achievement
4. **Compliance** - SOC 2 Type II certification

### Phase 3: Innovation (Months 7-12)
1. **Advanced analytics** - ML-powered insights
2. **IoT integration** - Real-time sensor data
3. **Global deployment** - Multi-region architecture
4. **Partner ecosystem** - API marketplace and integrations

---

*This file serves as the comprehensive guide for Claude Code to understand the enterprise requirements, architecture patterns, and operational standards needed to transform this asset tracking platform into a world-class enterprise solution.*