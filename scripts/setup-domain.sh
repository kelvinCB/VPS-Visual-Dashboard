#!/bin/bash

# Configuration
DOMAIN="kelvin-vps.site"
APP_PORT="7847"
EMAIL="kelvinr02@hotmail.com"

# Colors
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== VPS Dashboard Domain Setup ===${NC}"
echo "Configuring $DOMAIN to proxy to localhost:$APP_PORT"
echo ""

# 1. Check for root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./setup-domain.sh)"
  exit
fi

# 2. Ask for Email for Certbot
read -p "Enter your email for SSL renewal notifications: " EMAIL

if [ -z "$EMAIL" ]; then
  echo "Email is required for SSL setup."
  exit 1
fi

# 3. Update and Install Nginx & Certbot
echo -e "${GREEN}>>> Installing Nginx and Certbot...${NC}"
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# 4. Create Nginx Config
echo -e "${GREEN}>>> Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/$DOMAIN <<EOF
server {
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# 5. Enable Site
ln -s -f /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 6. Test Nginx Config
nginx -t
if [ $? -ne 0 ]; then
    echo "Nginx configuration error. Aborting."
    exit 1
fi

# 7. Reload Nginx
systemctl reload nginx

# 8. Obtain SSL Certificate
echo -e "${GREEN}>>> Obtaining SSL Certificate with Let's Encrypt...${NC}"
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL --redirect

echo ""
echo -e "${GREEN}=== Setup Complete! ===${NC}"
echo "Your dashboard should now be available at: https://$DOMAIN"
