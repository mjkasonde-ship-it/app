# Cove Legal Tech – Incident Response Runbook

## 1. Severity Classification

| Severity | Definition | Response Time | Examples |
|----------|-----------|---------------|----------|
| **P1 (Critical)** | Complete platform outage, data breach, financial loss | 15 minutes | All users cannot access platform, unauthorized data access, payment system compromised |
| **P2 (High)** | Major functionality impaired, security vulnerability | 1 hour | Payment processing down, AI summaries failing, authentication bypass |
| **P3 (Medium)** | Partial functionality affected, performance degradation | 4 hours | Single company data unavailable, slow response times, non-critical feature broken |
| **P4 (Low)** | Minor issue, workaround available | 24 hours | UI glitch, documentation error, cosmetic issue |

## 2. Escalation Matrix

| Time | Action | Contact |
|------|--------|---------|
| 0 min | Acknowledge incident, begin investigation | On-call engineer |
| 15 min | If P1 unresolved, escalate to Engineering Lead | Engineering Lead |
| 30 min | If P1 unresolved, escalate to CTO | CTO / Technical Director |
| 1 hour | If P1 unresolved, notify CEO and Legal Counsel | CEO + Legal Counsel |
| 2 hours | Prepare external communication | Communications Lead |
| 4 hours | Regulatory notification (if required) | Compliance Officer |

## 3. Response Team Roles

| Role | Responsibilities |
|------|-----------------|
| **Incident Commander** | Coordinates response, makes decisions, communicates status |
| **Technical Lead** | Leads technical investigation and remediation |
| **Communications Lead** | Manages internal and external communications |
| **Legal Counsel** | Advises on regulatory obligations and liability |
| **Compliance Officer** | Ensures regulatory reporting requirements met |

## 4. Common Incident Procedures

### 4.1 Database Connection Failure

**Symptoms:** Health check failing, users cannot log in, data not loading

**Immediate Actions:**
```bash
# Check MongoDB status
docker exec cove_mongo_prod mongosh --eval "db.adminCommand('serverStatus')"

# Check logs
docker logs cove_mongo_prod --tail 200

# Check disk space
docker exec cove_mongo_prod df -h

# Restart MongoDB (if safe)
docker compose -f production/docker-compose.prod.yml restart mongo

# Verify health
curl -f https://app.cove.zm/api/v1/health
```

**Escalation:** P2 if partial, P1 if complete outage

---

### 4.2 High Memory / CPU Usage

**Symptoms:** Slow response times, container restarts, OOM errors

**Immediate Actions:**
```bash
# Check resource usage
docker stats --no-stream

# Check process details
docker exec cove_backend_prod ps aux --sort=-%mem

# Check for memory leaks
docker logs cove_backend_prod --tail 500 | grep -i "memory\|leak\|oom"

# Restart affected container
docker restart cove_backend_prod

# Scale up if needed (ECS)
aws ecs update-service --cluster cove-production-cluster --service cove-production-backend --desired-count 4
```

**Escalation:** P3 if intermittent, P2 if sustained

---

### 4.3 SSL Certificate Expiry

**Symptoms:** Browsers show security warnings, HTTPS connections fail

**Immediate Actions:**
```bash
# Check certificate expiry
echo | openssl s_client -servername app.cove.zm -connect app.cove.zm:443 2>/dev/null | openssl x509 -noout -dates

# Renew with Let's Encrypt
sudo certbot renew --nginx

# Verify renewal
curl -v https://app.cove.zm 2>&1 | grep "SSL connection"

# Restart nginx
docker compose -f production/docker-compose.prod.yml restart nginx
```

**Escalation:** P2 (affects all users)

---

### 4.4 Suspected Security Breach

**Symptoms:** Unauthorized access alerts, unusual API activity, data exfiltration indicators

**CRITICAL – Follow this exactly:**

1. **IMMEDIATE (0-5 minutes):**
   ```bash
   # Isolate affected containers
   docker network disconnect cove_backend cove_backend_prod

   # Preserve evidence
   docker logs cove_backend_prod > /tmp/incident-$(date +%Y%m%d-%H%M%S).log
   docker inspect cove_backend_prod > /tmp/container-inspect-$(date +%Y%m%d-%H%M%S).json

   # Capture network state
   netstat -tulpn > /tmp/network-state-$(date +%Y%m%d-%H%M%S).txt
   ```

2. **NOTIFY (5-15 minutes):**
   - Security team
   - Legal counsel
   - CEO (if P1)

3. **INVESTIGATE (15-60 minutes):**
   ```bash
   # Review audit logs
   docker exec cove_mongo_prod mongosh --eval "
     db.audit_logs.find({
       timestamp: { \$gte: new Date(Date.now() - 3600000) },
       action: { \$in: ['login', 'data_access', 'admin_action'] }
     }).sort({timestamp: -1}).limit(100)
   "

   # Check for unauthorized users
   docker exec cove_mongo_prod mongosh --eval "
     db.users.find({
       created_at: { \$gte: new Date(Date.now() - 86400000) }
     })
   "
   ```

4. **RECOVER (1-4 hours):**
   - Rotate ALL secrets (JWT, API keys, DB passwords)
   - Rebuild containers from clean images
   - Force password reset for all users
   - Review and revoke suspicious sessions

5. **POST-INCIDENT (24-48 hours):**
   - Document timeline
   - File regulatory reports (ZICTA, BoZ if financial data)
   - Notify affected companies
   - Update security measures

**Escalation:** P1 – treat all suspected breaches as critical

---

### 4.5 Payment Provider Outage

**Symptoms:** Payment transactions failing, wallet top-ups not processing

**Immediate Actions:**
```bash
# Check payment provider status
curl -f https://api.cgrate.com/health || echo "cGrate down"
curl -f https://secure.3gdirectpay.com/health || echo "DPO down"

# Check circuit breaker status
# (View in application logs)
docker logs cove_backend_prod --tail 100 | grep -i "circuit\|breaker\|payment"

# Switch to backup provider (if configured)
# Edit backend/.env.prod to prioritize working provider
# Restart backend
```

**Escalation:** P2 if one provider down, P1 if all providers down

---

### 4.6 DDoS Attack

**Symptoms:** Extreme traffic spike, server unresponsive, legitimate users blocked

**Immediate Actions:**
```bash
# Check connection count
netstat -an | grep :443 | wc -l

# Check nginx access logs for patterns
docker exec cove_nginx_prod tail -n 1000 /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -20

# Enable rate limiting (if not already active)
# nginx rate limiting is always active in production config

# Block IP ranges (if identifiable)
# Add to nginx config or UFW
sudo ufw deny from <suspicious-ip>/24

# Contact hosting provider for upstream DDoS protection
# AWS Shield Standard is included with ALB
```

**Escalation:** P1 if platform unavailable

---

## 5. Backup and Recovery

### 5.1 Automated Backup Schedule

| Data | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| MongoDB | Daily at 3 AM | 35 days | mongodump + S3 |
| S3 VDR Documents | Real-time | Versioned | S3 versioning |
| Application Logs | Continuous | 90 days | CloudWatch |
| System Configuration | Weekly | 52 weeks | Git + S3 |

### 5.2 Point-in-Time Recovery

```bash
# 1. Identify backup to restore
aws s3 ls s3://cove-backups/mongodb/ | sort

# 2. Stop application
docker compose -f production/docker-compose.prod.yml stop backend

# 3. Restore MongoDB
docker exec cove_mongo_prod mongorestore --drop /data/backup/20260513

# 4. Verify data integrity
curl https://app.cove.zm/api/v1/admin/analytics

# 5. Restart application
docker compose -f production/docker-compose.prod.yml start backend
```

### 5.3 Disaster Recovery – Full Platform Restore

```bash
# 1. Provision new server (follow DEPLOYMENT.md)

# 2. Restore MongoDB from latest backup
aws s3 sync s3://cove-backups/mongodb/latest/ /tmp/mongodb-restore/
docker exec cove_mongo_prod mongorestore /tmp/mongodb-restore/

# 3. Verify S3 bucket contents
aws s3 ls s3://cove-production-vdr-documents/

# 4. Update DNS to point to new server

# 5. Verify all services
curl https://app.cove.zm/api/v1/health
curl https://app.cove.zm/api/v1/ready
```

**RTO (Recovery Time Objective):** 4 hours  
**RPO (Recovery Point Objective):** 24 hours (daily backups)

## 6. Communication Templates

### 6.1 Internal Slack Notification

```
:rotating_light: INCIDENT ALERT :rotating_light:

Severity: P{1-4}
Service: {backend/frontend/database/payments/security}
Impact: {description of user impact}
Started: {timestamp}
Detected by: {monitoring/alert/user-report}
On-call: {engineer-name}
Status: {investigating/identified/fixing/monitoring/resolved}

Thread: {link-to-incident-channel-thread}
```

### 6.2 Customer Notification (Email)

```
Subject: [Cove Legal Tech] Service Status Update

Dear Valued Customer,

We are writing to inform you of a service incident affecting [component].

Impact: [description of user impact]
Status: [current status]
Started: [time]
Estimated Resolution: [time or "under investigation"]

What we're doing:
- [Action 1]
- [Action 2]

What you should do:
- [Instruction 1 if applicable]

We will provide updates every [30 minutes/1 hour/4 hours] until resolved.

For urgent matters, contact:
- Email: support@cove.zm
- Phone: +260-XXX-XXXX

We sincerely apologize for any inconvenience caused.

Regards,
Cove Legal Tech Operations Team
Incident ID: [UUID]
```

### 6.3 Regulatory Notification (ZICTA)

```
To: ZICTA Cybersecurity Division
From: Cove Legal Tech
Date: [date]
Subject: Data Security Incident Notification

Incident Reference: [UUID]
Date of Discovery: [date]
Nature of Incident: [breach type]
Affected Systems: [list]
Data Involved: [types of data]
Number of Affected Individuals: [count]
Root Cause: [initial assessment]
Remediation Actions Taken: [list]

We are conducting a full investigation and will provide updates as required.

Contact: security@cove.zm
```

## 7. Post-Incident Review

Within 48 hours of resolution:

1. **Timeline Documentation**
   - When was the incident detected?
   - When was it acknowledged?
   - What actions were taken and when?
   - When was it resolved?

2. **Impact Assessment**
   - Number of users affected
   - Data lost or compromised (if any)
   - Financial impact
   - Reputational impact

3. **Root Cause Analysis**
   - What caused the incident?
   - Why wasn't it prevented?
   - What monitoring/alerting gaps exist?

4. **Action Items**
   - Short-term fixes (1 week)
   - Medium-term improvements (1 month)
   - Long-term strategic changes (3 months)

5. **Runbook Updates**
   - Update this runbook with lessons learned
   - Update monitoring thresholds
   - Update alert rules

## 8. Contact Information

| Role | Name | Phone | Email |
|------|------|-------|-------|
| On-call Engineer | [TBD] | [TBD] | oncall@cove.zm |
| Engineering Lead | [TBD] | [TBD] | eng-lead@cove.zm |
| Security Officer | [TBD] | [TBD] | security@cove.zm |
| Legal Counsel | [TBD] | [TBD] | legal@cove.zm |
| CEO | [TBD] | [TBD] | ceo@cove.zm |
| ZICTA Cybersecurity | N/A | 991 | cyber@zicta.zm |
| Bank of Zambia | N/A | [TBD] | [TBD] |

## 9. Regulatory Reporting Requirements

### Zambia
- **ZICTA**: Report data breaches within 72 hours
- **Bank of Zambia**: Report financial data breaches within 24 hours
- **Companies Registry**: Report if company registration data affected

### International (if applicable)
- **GDPR**: Report to supervisory authority within 72 hours
- **PCI DSS**: Report cardholder data breaches immediately

---

**Version:** 1.0.0  
**Last Updated:** 2026-05-13  
**Next Review:** 2026-08-13  
**Owner:** Security Team
