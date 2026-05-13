# Cove Legal Tech – Production Deployment Guide

## Overview

This package contains the **production-hardened** version of Cove Legal Tech, a Zambian regulatory compliance management platform. All security, operational, and infrastructure hardening has been applied by a senior platform architect with 25+ years of experience in fintech, regtech, legaltech, and SaaS.

## What's Included

### Production Infrastructure
| File | Purpose |
|------|---------|
| `production/docker-compose.prod.yml` | Production Docker Compose with secrets, resource limits, network isolation |
| `production/nginx/nginx.conf` | Hardened reverse proxy with SSL, rate limiting, security headers |
| `production/terraform/main.tf` | AWS infrastructure (VPC, ECS, DocumentDB, ALB, S3) |
| `production/terraform/variables.tf` | Terraform variables |
| `production/terraform/outputs.tf` | Terraform outputs |
| `production/terraform/terraform.tfvars.example` | Terraform variables template |
| `production/scripts/harden-server.sh` | Ubuntu server security hardening script |
| `production/monitoring/` | Prometheus/Grafana monitoring setup (to be added) |

### Documentation
| File | Purpose |
|------|---------|
| `docs/SECURITY_AUDIT.md` | Full security and operational audit report |
| `docs/INCIDENT_RESPONSE.md` | P1-P4 incident response procedures |
| `docs/DEPLOYMENT.md` | This file – step-by-step deployment guide |
| `docs/COMPLIANCE.md` | SOC 2, GDPR, and Zambia data protection readiness |

### Hardened Backend
| File | Purpose |
|------|---------|
| `backend/app/main.py` | Refactored FastAPI entry point with security middleware |
| `backend/app/core/config.py` | Validated configuration with Pydantic |
| `backend/app/db/database.py` | MongoDB with connection pooling and health checks |
| `backend/app/middleware/security.py` | Security headers, request limits, input sanitization |
| `backend/app/api/v1/endpoints/health.py` | Deep health probes (/health, /ready, /live, /metrics) |
| `backend/requirements.txt` | Production dependencies |
| `backend/Dockerfile` | Multi-stage build with non-root user |
| `backend/.env.example` | Environment variables template |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Internet                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  nginx (Reverse Proxy)                                               │
│  - SSL termination (TLS 1.2/1.3)                                     │
│  - Rate limiting (100 req/min)                                       │
│  - Security headers (HSTS, CSP, X-Frame-Options)                     │
│  - WAF rules (block common attacks)                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│  Backend (FastAPI)        │    │  Frontend (React/nginx) │
│  - JWT auth + RBAC       │    │  - Static SPA files      │
│  - Rate limiting           │    │  - Gzip compression      │
│  - Input validation        │    │  - Cache headers         │
│  - Circuit breakers      │    │  - Security headers      │
└─────────────────────────┘    └─────────────────────────┘
              │
              ▼
┌─────────────────────────┐
│  MongoDB (DocumentDB)    │
│  - Connection pooling   │
│  - Automated backups    │
│  - Encryption at rest   │
└─────────────────────────┘
```

## Quick Start – Production Deployment

### Prerequisites

- Ubuntu 22.04 LTS server (2 vCPU, 4GB RAM minimum)
- Docker 24.0+ and Docker Compose 2.20+
- Domain name (app.cove.zm) with DNS A record pointing to server
- SSL certificate (Let's Encrypt recommended)

### Step 1: Server Setup

```bash
# 1. Update system
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# 3. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Run security hardening
chmod +x production/scripts/harden-server.sh
sudo ./production/scripts/harden-server.sh

# 5. Reboot
sudo reboot
```

### Step 2: Configure Environment

```bash
# 1. Create production directory
sudo mkdir -p /opt/cove
sudo chown $USER:$USER /opt/cove
cd /opt/cove

# 2. Copy your repository
git clone https://github.com/mjkasonde-ship-it/app.git .

# 3. Create secrets directory
mkdir -p production/secrets

# 4. Generate MongoDB credentials
python3 -c "import secrets; print('cove_admin')" > production/secrets/mongo_root_user.txt
python3 -c "import secrets; print(secrets.token_urlsafe(32))" > production/secrets/mongo_root_pass.txt
chmod 600 production/secrets/*

# 5. Create backend environment file
cp backend/.env.example backend/.env.prod
nano backend/.env.prod  # Edit all REPLACE_WITH_* values

# Generate strong secrets:
# JWT Secret:
python3 -c "import secrets; print(secrets.token_hex(32))"
# MongoDB Password:
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Step 3: SSL Certificates

```bash
# 1. Install certbot
sudo apt-get install -y certbot

# 2. Obtain certificate
sudo certbot certonly --standalone -d app.cove.zm -d staging.cove.zm

# 3. Copy to nginx SSL directory
sudo mkdir -p production/ssl
sudo cp /etc/letsencrypt/live/app.cove.zm/fullchain.pem production/ssl/cove.crt
sudo cp /etc/letsencrypt/live/app.cove.zm/privkey.pem production/ssl/cove.key
sudo chmod 644 production/ssl/cove.crt
sudo chmod 600 production/ssl/cove.key
```

### Step 4: Deploy

```bash
# Deploy all services
docker compose -f production/docker-compose.prod.yml up -d

# Verify deployment
curl https://app.cove.zm/api/v1/health
curl https://app.cove.zm/api/v1/ready

# Check logs
docker logs -f cove_backend_prod
docker logs -f cove_mongo_prod
docker logs -f cove_nginx_prod
```

### Step 5: Verify Security

```bash
# Test security headers
curl -I https://app.cove.zm/api/v1/health
# Should see: X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security

# Test rate limiting
for i in {1..110}; do curl -s https://app.cove.zm/api/v1/health > /dev/null; done
# Should see 429 Too Many Requests after 100 requests

# Test request size limit
curl -X POST https://app.cove.zm/api/v1/vdr/upload -d @<(dd if=/dev/zero bs=1M count=60)
# Should see 413 Payload Too Large
```

## AWS Deployment (Alternative)

```bash
# 1. Install Terraform
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install -y terraform

# 2. Initialize Terraform
cd production/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 3. Deploy
terraform init
terraform plan
terraform apply

# 4. Configure DNS
# Point app.cove.zm to the ALB DNS name from terraform output
```

## Monitoring

### Health Check Endpoints
- **Application Health**: `https://app.cove.zm/api/v1/health`
- **Readiness Probe**: `https://app.cove.zm/api/v1/ready`
- **Liveness Probe**: `https://app.cove.zm/api/v1/live`
- **Metrics**: `https://app.cove.zm/api/v1/metrics`

### Log Locations
```bash
# Application logs
docker logs cove_backend_prod
docker logs cove_mongo_prod

# nginx access logs
docker exec cove_nginx_prod tail -f /var/log/nginx/access.log

# System logs
sudo tail -f /var/log/syslog
sudo tail -f /var/log/auth.log
```

## Backup Strategy

### Automated MongoDB Backup
```bash
# Add to crontab (daily at 3 AM)
0 3 * * * docker exec cove_mongo_prod mongodump --out /data/backup/$(date +\%Y\%m\%d) && aws s3 sync /var/lib/docker/volumes/cove_mongo_data/_data/backup/ s3://cove-backups/mongodb/
```

### S3 Versioning
Already enabled in Terraform. All VDR documents have automatic versioning.

## Security Checklist

- [ ] `.env` files NOT in git history
- [ ] All secrets rotated (JWT, API keys, DB passwords)
- [ ] SSL certificate installed and auto-renewal configured
- [ ] UFW firewall enabled
- [ ] fail2ban running
- [ ] SSH key-only authentication
- [ ] Docker daemon secured
- [ ] Server hardening script executed
- [ ] AIDE file integrity monitoring active
- [ ] Automated security updates enabled
- [ ] Incident response runbook reviewed
- [ ] Backup verification tested
- [ ] Monitoring dashboards configured

## Support

| Contact | Details |
|---------|---------|
| Technical Support | support@cove.zm |
| Security Issues | security@cove.zm |
| Emergency Hotline | +260-XXX-XXXX |
| Zambia Police Cybercrime | cybercrime@zambia.police.zm |

## Cost Estimate (AWS af-south-1)

| Service | Monthly Cost (USD) |
|---------|-------------------|
| ALB | $25 |
| ECS Fargate (backend, 2 tasks) | $75 |
| ECS Fargate (frontend, 2 tasks) | $50 |
| DocumentDB (db.r5.large) | $200 |
| S3 (500GB) | $12 |
| CloudWatch | $20 |
| Data Transfer | $15 |
| **Total** | **~$397** |

---

**Version:** 1.0.0-production  
**Date:** 2026-05-13  
**Classification:** CONFIDENTIAL  
**Prepared by:** Senior Platform Architect (25+ years fintech/regtech/legaltech/SaaS)
