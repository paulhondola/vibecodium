#!/bin/bash
set -e

DROPLET_IP="167.172.169.59"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  iTECify — DigitalOcean Droplet Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. System update ──────────────────────────────────────
echo ""
echo "▶ [1/7] Updating system..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq nginx git curl

# ── 2. Install Docker ─────────────────────────────────────
echo ""
echo "▶ [2/7] Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
echo "✅ Docker $(docker --version)"

# ── 3. Install Bun ───────────────────────────────────────
echo ""
echo "▶ [3/7] Installing Bun..."
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
echo "✅ Bun $(bun --version)"

# ── 4. Clone repo ─────────────────────────────────────────
echo ""
echo "▶ [4/7] Cloning repository..."
cd /opt
if [ -d "vibecodium" ]; then
    echo "Repo exists — pulling latest..."
    cd vibecodium && git pull
else
    git clone https://github.com/paulhondola/vibecodium.git
    cd vibecodium
fi

# ── 5. Environment ────────────────────────────────────────
echo ""
echo "▶ [5/7] Setting up environment..."
if [ ! -f "server/.env" ]; then
    cp server/.env.example server/.env
    echo ""
    echo "⚠️  Edit server/.env with your actual keys before starting:"
    echo "    nano /opt/vibecodium/server/.env"
    echo ""
fi

# ── 6. Install deps + build Docker images + frontend ──────
echo ""
echo "▶ [6/7] Installing dependencies and building..."

# Skip the postinstall docker build (already done via setup_docker.sh below)
bun install --ignore-scripts
bash setup_docker.sh

# Build frontend with production API URL
echo "Building frontend..."
cd client
VITE_API_URL="http://${DROPLET_IP}:3000" bun run build
cd ..

# ── 7. Nginx config ───────────────────────────────────────
echo ""
echo "▶ [7/7] Configuring nginx..."
cat > /etc/nginx/sites-available/itecify << EOF
server {
    listen 80;
    server_name ${DROPLET_IP};

    # Serve built frontend
    root /opt/vibecodium/client/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API to backend
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Proxy WebSockets to backend
    location /ws/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }
}
EOF

ln -sf /etc/nginx/sites-available/itecify /etc/nginx/sites-enabled/itecify
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
systemctl enable nginx

# ── Firewall ──────────────────────────────────────────────
echo ""
echo "▶ Opening firewall ports..."
ufw allow 22    # SSH
ufw allow 80    # Frontend via nginx
ufw allow 3000  # Backend API (direct access)
ufw --force enable

# ── Systemd service for backend ───────────────────────────
echo ""
echo "▶ Creating systemd service for backend..."
cat > /etc/systemd/system/itecify.service << 'EOF'
[Unit]
Description=iTECify Backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/vibecodium/server
ExecStart=/root/.bun/bin/bun run src/index.ts
Restart=always
RestartSec=5
EnvironmentFile=/opt/vibecodium/server/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable itecify

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Fill in your env vars:  nano /opt/vibecodium/server/.env"
echo "  2. Start the backend:      systemctl start itecify"
echo "  3. Check backend logs:     journalctl -u itecify -f"
echo ""
echo "  Frontend: http://${DROPLET_IP}"
echo "  Backend:  http://${DROPLET_IP}:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
