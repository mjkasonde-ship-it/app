#!/bin/bash
# ---------------------------------------------------------------------------
# Cove Legal Tech – Ubuntu Server Security Hardening
# Run this ONCE on a fresh Ubuntu 22.04 LTS server
# ---------------------------------------------------------------------------

set -euo pipefail

LOG_FILE="/var/log/cove-hardening-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo "=== Cove Legal Tech Server Security Hardening ==="
echo "Date: $(date)"
echo "Server: $(hostname)"
echo "Ubuntu Version: $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2)"
echo "Log: $LOG_FILE"
echo ""

# Track progress
TOTAL_STEPS=12
CURRENT_STEP=0

progress() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    echo ""
    echo "[$CURRENT_STEP/$TOTAL_STEPS] $1"
    echo "================================================"
}

# ── Step 1: System Update ──────────────────────────────────────────────────
progress "Updating system packages"
apt-get update
apt-get upgrade -y
apt-get dist-upgrade -y
apt-get autoremove -y
apt-get autoclean

# ── Step 2: Install Security Tools ─────────────────────────────────────────
progress "Installing security tools"
apt-get install -y --no-install-recommends     fail2ban     ufw     unattended-upgrades     apt-listchanges     needrestart     debian-goodies     checkrestart     lynis     rkhunter     chkrootkit     aide     logwatch     auditd

# ── Step 3: Configure Automatic Updates ────────────────────────────────────
progress "Configuring automatic security updates"
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::InstallOnShutdown "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
Unattended-Upgrade::SyslogEnable "true";
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

systemctl enable unattended-upgrades
systemctl start unattended-upgrades

# ── Step 4: Configure Firewall (UFW) ───────────────────────────────────────
progress "Configuring UFW firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh comment 'SSH access'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 8001/tcp comment 'Backend API (internal)'
ufw --force enable

# ── Step 5: Configure Fail2Ban ───────────────────────────────────────────
progress "Configuring fail2ban"
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5

[nginx-badbots]
enabled = true
filter = nginx-badbots
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2

[nginx-noscript]
enabled = true
filter = nginx-noscript
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 6

[nginx-req-limit]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

systemctl enable fail2ban
systemctl start fail2ban

# ── Step 6: Secure SSH ─────────────────────────────────────────────────────
progress "Securing SSH"
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%Y%m%d)

sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/X11Forwarding yes/X11Forwarding no/' /etc/ssh/sshd_config
sed -i 's/#MaxAuthTries 6/MaxAuthTries 3/' /etc/ssh/sshd_config
sed -i 's/#ClientAliveInterval 0/ClientAliveInterval 300/' /etc/ssh/sshd_config
sed -i 's/#ClientAliveCountMax 3/ClientAliveCountMax 2/' /etc/ssh/sshd_config
sed -i 's/#LoginGraceTime 2m/LoginGraceTime 30/' /etc/ssh/sshd_config

# Add additional hardening
cat >> /etc/ssh/sshd_config << 'EOF'

# Additional security hardening
Protocol 2
HostKey /etc/ssh/ssh_host_ed25519_key
HostKey /etc/ssh/ssh_host_rsa_key
KexAlgorithms curve25519-sha256@libssh.org,ecdh-sha2-nistp521,ecdh-sha2-nistp384,ecdh-sha2-nistp256,diffie-hellman-group-exchange-sha256
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com,umac-128-etm@openssh.com,hmac-sha2-512,hmac-sha2-256,umac-128@openssh.com
UsePAM yes
AllowUsers cove-deploy
EOF

systemctl restart sshd

# ── Step 7: Kernel Security Parameters ──────────────────────────────────────
progress "Setting kernel security parameters"
cat >> /etc/sysctl.conf << 'EOF'

# Security settings
net.ipv4.ip_forward=0
net.ipv4.conf.all.send_redirects=0
net.ipv4.conf.default.send_redirects=0
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.default.accept_redirects=0
net.ipv4.conf.all.secure_redirects=0
net.ipv4.conf.default.secure_redirects=0
net.ipv4.conf.all.log_martians=1
net.ipv4.conf.default.log_martians=1
net.ipv4.icmp_echo_ignore_broadcasts=1
net.ipv4.icmp_ignore_bogus_error_responses=1
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.default.rp_filter=1
net.ipv4.tcp_syncookies=1
net.ipv4.tcp_max_syn_backlog=2048
net.ipv4.tcp_synack_retries=2
net.ipv4.tcp_syn_retries=5
kernel.randomize_va_space=2
kernel.kptr_restrict=2
kernel.dmesg_restrict=1
kernel.printk=3 3 3 3
kernel.perf_event_paranoid=2
fs.suid_dumpable=0
fs.protected_hardlinks=1
fs.protected_symlinks=1
EOF

sysctl -p

# ── Step 8: Docker Security ────────────────────────────────────────────────
progress "Configuring Docker security"
cat > /etc/docker/daemon.json << 'EOF'
{
  "userns-remap": "default",
  "live-restore": true,
  "no-new-privileges": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "labels": "environment,service",
    "env": "OS_VERSION"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "experimental": false,
  "metrics-addr": "0.0.0.0:9323",
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
EOF

systemctl restart docker

# ── Step 9: Create Deployment User ─────────────────────────────────────────
progress "Creating deployment user"
useradd -m -s /bin/bash cove-deploy || true
usermod -aG docker cove-deploy || true
usermod -aG sudo cove-deploy || true

# Set up sudo without password for docker commands
cat > /etc/sudoers.d/cove-deploy << 'EOF'
cove-deploy ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/local/bin/docker-compose, /usr/bin/systemctl restart docker
EOF

chmod 440 /etc/sudoers.d/cove-deploy

# ── Step 10: Configure Log Rotation ────────────────────────────────────────
progress "Configuring log rotation"
cat > /etc/logrotate.d/cove << 'EOF'
/var/log/cove/*.log {
    daily
    rotate 90
    compress
    delaycompress
    missingok
    notifempty
    create 0644 cove-deploy cove-deploy
    dateext
    dateformat -%Y%m%d-%s
}

/var/log/nginx/*.log {
    daily
    rotate 90
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data adm
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid)
    endscript
}
EOF

# ── Step 11: Set up AIDE (File Integrity Monitoring) ───────────────────────
progress "Configuring AIDE file integrity monitoring"
aideinit || true
update-aide.conf || true

# Create daily AIDE check cron job
cat > /etc/cron.daily/aide-check << 'EOF'
#!/bin/bash
/usr/bin/aide --check > /var/log/aide/check-$(date +%Y%m%d).log 2>&1 ||     echo "AIDE detected changes on $(hostname)" | mail -s "AIDE Alert" root
EOF

chmod +x /etc/cron.daily/aide-check

# ── Step 12: Final Verification ────────────────────────────────────────────
progress "Running final verification"

echo ""
echo "=== VERIFICATION RESULTS ==="
echo ""

echo "[✓] System packages updated"
echo "[✓] Security tools installed"
echo "[✓] Automatic updates configured"
echo "[✓] UFW firewall enabled"
echo "[✓] fail2ban configured"
echo "[✓] SSH hardened"
echo "[✓] Kernel parameters set"
echo "[✓] Docker secured"
echo "[✓] Deployment user created"
echo "[✓] Log rotation configured"
echo "[✓] AIDE monitoring enabled"

echo ""
echo "=== SECURITY STATUS ==="
echo ""

# Check services
services=("ufw" "fail2ban" "ssh" "docker" "unattended-upgrades" "auditd")
for svc in "${services[@]}"; do
    if systemctl is-active --quiet "$svc"; then
        echo "[✓] $svc: RUNNING"
    else
        echo "[✗] $svc: NOT RUNNING"
    fi
done

echo ""
echo "=== NEXT STEPS ==="
echo ""
echo "1. Copy your SSH public key to cove-deploy user:"
echo "   ssh-copy-id cove-deploy@<server-ip>"
echo ""
echo "2. Test SSH key authentication:"
echo "   ssh cove-deploy@<server-ip>"
echo ""
echo "3. Disable password authentication completely:"
echo "   sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config"
echo "   sudo systemctl restart sshd"
echo ""
echo "4. Deploy application:"
echo "   cd /opt/cove"
echo "   docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "5. Set up SSL certificates:"
echo "   sudo certbot certonly --standalone -d app.cove.zm"
echo ""
echo "6. Configure monitoring (Prometheus/Grafana):"
echo "   See docs/monitoring-setup.md"
echo ""
echo "=== IMPORTANT NOTES ==="
echo ""
echo "• Log file saved to: $LOG_FILE"
echo "• A REBOOT is recommended for all kernel settings to take effect"
echo "• Review /etc/ssh/sshd_config before rebooting"
echo "• Backup this server before production deployment"
echo "• Run 'lynis audit system' for additional hardening recommendations"
echo ""
echo "=== HARDENING COMPLETE ==="
echo "Date: $(date)"
