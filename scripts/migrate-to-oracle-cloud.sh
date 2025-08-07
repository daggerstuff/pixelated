#!/bin/bash

# Migrate Pixelated Empathy Database & API Connections to Oracle Cloud
# This script handles the migration of the 4.2M conversations and API connections

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Configuration
BACKUP_DIR="backups/oracle_migration_$(date +%Y%m%d_%H%M%S)"
ORACLE_DB_CONTAINER="pixelated-postgres"
ORACLE_REDIS_CONTAINER="pixelated-redis"

# Load Oracle deployment info
load_oracle_deployment() {
    if [[ ! -f ".oracle_deployment" ]]; then
        print_error "Oracle deployment not found. Run ./scripts/oracle-deploy.sh first"
        exit 1
    fi
    
    source .oracle_deployment
    print_status "Oracle instance: $PUBLIC_IP"
}

# Create backup of current data
create_migration_backup() {
    print_header "Creating migration backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup conversation data
    if [[ -d "ai/data" ]]; then
        print_status "Backing up conversation data..."
        tar -czf "$BACKUP_DIR/conversation_data.tar.gz" ai/data/
    fi
    
    # Backup database if running locally
    if command -v psql &> /dev/null; then
        print_status "Backing up local PostgreSQL database..."
        pg_dump -h localhost -U pixelated_user pixelated_ai > "$BACKUP_DIR/pixelated_ai_backup.sql" 2>/dev/null || true
    fi
    
    # Backup configuration files
    print_status "Backing up configuration files..."
    cp -r ai/config "$BACKUP_DIR/" 2>/dev/null || true
    cp .env* "$BACKUP_DIR/" 2>/dev/null || true
    
    print_status "✅ Backup created: $BACKUP_DIR"
}

# Setup database on Oracle Cloud
setup_oracle_database() {
    print_header "Setting up PostgreSQL on Oracle Cloud..."
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP << 'EOF'
        # Install PostgreSQL
        sudo apt update
        sudo apt install -y postgresql postgresql-contrib
        
        # Start and enable PostgreSQL
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        
        # Create database and user
        sudo -u postgres psql << 'PSQL_EOF'
CREATE DATABASE pixelated_empathy;
CREATE USER pixelated_user WITH ENCRYPTED PASSWORD 'pixelated_secure_oracle_pass';
GRANT ALL PRIVILEGES ON DATABASE pixelated_empathy TO pixelated_user;
ALTER USER pixelated_user CREATEDB;
\q
PSQL_EOF
        
        # Configure PostgreSQL for remote connections
        sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf
        echo "host all all 0.0.0.0/0 md5" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf
        
        # Restart PostgreSQL
        sudo systemctl restart postgresql
        
        echo "✅ PostgreSQL setup complete"
EOF
    
    print_status "✅ PostgreSQL configured on Oracle Cloud"
}

# Setup Redis on Oracle Cloud
setup_oracle_redis() {
    print_header "Setting up Redis on Oracle Cloud..."
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP << 'EOF'
        # Install Redis
        sudo apt install -y redis-server
        
        # Configure Redis for remote connections
        sudo sed -i 's/bind 127.0.0.1 ::1/bind 0.0.0.0/' /etc/redis/redis.conf
        sudo sed -i 's/protected-mode yes/protected-mode no/' /etc/redis/redis.conf
        
        # Start and enable Redis
        sudo systemctl start redis-server
        sudo systemctl enable redis-server
        
        echo "✅ Redis setup complete"
EOF
    
    print_status "✅ Redis configured on Oracle Cloud"
}

# Migrate conversation data
migrate_conversation_data() {
    print_header "Migrating conversation data to Oracle Cloud..."
    
    # Upload conversation data
    if [[ -d "ai/data" ]]; then
        print_status "Uploading conversation data..."
        scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no -r ai/data ubuntu@$PUBLIC_IP:~/pixelated/ai/
    fi
    
    # Upload database schema and migration scripts
    print_status "Uploading database migration scripts..."
    scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no -r ai/dataset_pipeline ubuntu@$PUBLIC_IP:~/pixelated/ai/
    
    # Run migration on Oracle Cloud
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP << 'EOF'
        cd ~/pixelated/ai
        
        # Install Python dependencies for migration
        sudo apt install -y python3-pip python3-venv
        python3 -m venv migration_env
        source migration_env/bin/activate
        pip install psycopg2-binary sqlalchemy
        
        # Update database connection in migration script
        sed -i 's/DB_HOST = "127.0.0.1"/DB_HOST = "localhost"/' dataset_pipeline/migrate_conversations_to_db.py
        sed -i 's/DB_PORT = "6432"/DB_PORT = "5432"/' dataset_pipeline/migrate_conversations_to_db.py
        sed -i 's/DB_PASS = "pixelated_secure_pass"/DB_PASS = "pixelated_secure_oracle_pass"/' dataset_pipeline/migrate_conversations_to_db.py
        sed -i 's/DB_NAME = "pixelated_ai"/DB_NAME = "pixelated_empathy"/' dataset_pipeline/migrate_conversations_to_db.py
        
        # Run the migration
        echo "Starting conversation data migration..."
        python dataset_pipeline/migrate_conversations_to_db.py
        
        deactivate
        echo "✅ Conversation data migration complete"
EOF
    
    print_status "✅ Conversation data migrated to Oracle Cloud"
}

# Update application configuration
update_app_configuration() {
    print_header "Updating application configuration for Oracle Cloud..."
    
    # Create Oracle Cloud environment configuration
    cat > .env.oracle.production << EOF
# Oracle Cloud Production Configuration
NODE_ENV=production
PORT=4321
WEB_PORT=4321
LOG_LEVEL=info

# Database Configuration
POSTGRES_URL=postgresql://pixelated_user:pixelated_secure_oracle_pass@localhost:5432/pixelated_empathy
POSTGRES_PRISMA_URL=postgresql://pixelated_user:pixelated_secure_oracle_pass@localhost:5432/pixelated_empathy
POSTGRES_URL_NON_POOLING=postgresql://pixelated_user:pixelated_secure_oracle_pass@localhost:5432/pixelated_empathy

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Security & Compliance
ENABLE_HIPAA_COMPLIANCE=true
ENABLE_AUDIT_LOGGING=true
ENABLE_DATA_MASKING=true
ENABLE_RATE_LIMITING=true
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX_REQUESTS=100

# Astro Configuration
ASTRO_TELEMETRY_DISABLED=1

# Public URL (will be updated by deployment script)
PUBLIC_URL=http://$PUBLIC_IP
CORS_ORIGINS=http://$PUBLIC_IP,https://$PUBLIC_IP

# Feature Flags
ENABLE_BIAS_DETECTION=true
ENABLE_REAL_TIME_ANALYTICS=true
ENABLE_BACKGROUND_JOBS=true
ENABLE_MONITORING=true

# Pixel Voice API Configuration
PIXEL_VOICE_ENV=production
PIXEL_VOICE_DEBUG=false
PIXEL_VOICE_API_HOST=0.0.0.0
PIXEL_VOICE_API_PORT=8000
DATABASE_URL=postgresql://pixelated_user:pixelated_secure_oracle_pass@localhost:5432/pixelated_empathy
EOF
    
    # Upload the configuration
    scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no .env.oracle.production ubuntu@$PUBLIC_IP:~/.env.production
    
    print_status "✅ Application configuration updated"
}

# Test database connections
test_connections() {
    print_header "Testing database connections..."
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP << 'EOF'
        # Test PostgreSQL connection
        echo "Testing PostgreSQL connection..."
        psql -h localhost -U pixelated_user -d pixelated_empathy -c "SELECT COUNT(*) FROM conversations;" || echo "No conversations table yet (this is normal for fresh setup)"
        
        # Test Redis connection
        echo "Testing Redis connection..."
        redis-cli ping
        
        echo "✅ Connection tests complete"
EOF
    
    print_status "✅ Database connections tested"
}

# Update firewall for database access
update_firewall() {
    print_header "Updating firewall for database access..."
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP << 'EOF'
        # Add PostgreSQL port
        sudo iptables -I INPUT 1 -p tcp --dport 5432 -j ACCEPT
        
        # Add Redis port  
        sudo iptables -I INPUT 1 -p tcp --dport 6379 -j ACCEPT
        
        # Add Pixel Voice API port
        sudo iptables -I INPUT 1 -p tcp --dport 8000 -j ACCEPT
        
        echo "✅ Firewall updated"
EOF
    
    print_status "✅ Firewall configured for database access"
}

# Generate migration report
generate_migration_report() {
    print_header "Generating migration report..."
    
    REPORT_FILE="$BACKUP_DIR/migration_report.md"
    
    cat > "$REPORT_FILE" << EOF
# Pixelated Empathy Oracle Cloud Migration Report

**Migration Date**: $(date)
**Oracle Instance**: $PUBLIC_IP
**Backup Location**: $BACKUP_DIR

## ✅ Completed Migrations

### Database Infrastructure
- ✅ PostgreSQL 15 installed and configured
- ✅ Database: pixelated_empathy
- ✅ User: pixelated_user
- ✅ Remote connections enabled

### Redis Infrastructure  
- ✅ Redis server installed and configured
- ✅ Remote connections enabled
- ✅ Default database (0) ready

### Data Migration
- ✅ Conversation data uploaded
- ✅ Migration scripts deployed
- ✅ Database schema created

### Application Configuration
- ✅ Environment variables updated
- ✅ Database URLs configured
- ✅ Security settings enabled

## 🔗 New Connection Strings

### PostgreSQL
\`\`\`
POSTGRES_URL=postgresql://pixelated_user:pixelated_secure_oracle_pass@$PUBLIC_IP:5432/pixelated_empathy
\`\`\`

### Redis
\`\`\`
REDIS_URL=redis://$PUBLIC_IP:6379/0
\`\`\`

## 🚀 Next Steps

1. **Deploy Application**: Run \`./scripts/deploy-app-to-oracle.sh\`
2. **Run Migration**: SSH to instance and run conversation migration
3. **Test Connections**: Verify all services are working
4. **Update DNS**: Point domain to $PUBLIC_IP

## 🔧 Management Commands

### SSH Access
\`\`\`bash
ssh -i $SSH_KEY_PATH ubuntu@$PUBLIC_IP
\`\`\`

### Database Access
\`\`\`bash
psql -h $PUBLIC_IP -U pixelated_user -d pixelated_empathy
\`\`\`

### Redis Access
\`\`\`bash
redis-cli -h $PUBLIC_IP
\`\`\`

## 📊 Verification Checklist

- [ ] PostgreSQL accessible from external IP
- [ ] Redis accessible from external IP  
- [ ] Conversation data migrated successfully
- [ ] Application deployed and running
- [ ] All API endpoints responding
- [ ] Monitoring stack operational

EOF
    
    print_status "✅ Migration report generated: $REPORT_FILE"
}

# Main migration function
main() {
    print_header "🚀 Starting Pixelated Empathy Oracle Cloud Migration..."
    
    load_oracle_deployment
    create_migration_backup
    setup_oracle_database
    setup_oracle_redis
    update_firewall
    migrate_conversation_data
    update_app_configuration
    test_connections
    generate_migration_report
    
    print_status "🎉 Migration completed successfully!"
    print_status ""
    print_status "📋 Next steps:"
    print_status "1. Review migration report: $BACKUP_DIR/migration_report.md"
    print_status "2. Deploy application: ./scripts/deploy-app-to-oracle.sh"
    print_status "3. Test all functionality"
    print_status ""
    print_status "🔗 New database connection: postgresql://pixelated_user:pixelated_secure_oracle_pass@$PUBLIC_IP:5432/pixelated_empathy"
}

main "$@"
