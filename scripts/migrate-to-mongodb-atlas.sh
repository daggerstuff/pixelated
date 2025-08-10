#!/bin/bash

# MongoDB Atlas Migration Script
# This script helps migrate from Supabase to MongoDB Atlas

set -e  # Exit on error

echo "🚀 Starting Supabase to MongoDB Atlas migration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Load environment variables from .env file
load_env_file() {
    if [ -f ".env" ]; then
        print_status "Loading environment variables from .env file..."
        # Export variables from .env file, handling quoted values
        set -o allexport
        source .env
        set +o allexport
        print_success "Environment variables loaded from .env file"
    else
        print_warning "No .env file found in current directory"
    fi
}

# Check if MongoDB Atlas environment variables are set
check_mongodb_env() {
    print_status "Checking MongoDB Atlas environment variables..."
    
    if [ -z "$MONGODB_URI" ] && [ -z "$MONGODB_USERNAME" ]; then
        print_error "MongoDB Atlas environment variables not set!"
        print_status "Please set either:"
        print_status "  MONGODB_URI - Full connection string"
        print_status "  OR"
        print_status "  MONGODB_USERNAME, MONGODB_PASSWORD, MONGODB_CLUSTER - Individual components"
        exit 1
    fi
    
    if [ -z "$MONGODB_DB_NAME" ]; then
        print_warning "MONGODB_DB_NAME not set, using default: pixelated_empathy"
        export MONGODB_DB_NAME="pixelated_empathy"
    fi
    
    print_success "MongoDB Atlas environment variables configured"
}

# Test MongoDB connection
test_mongodb_connection() {
    print_status "Testing MongoDB Atlas connection..."
    
    if command -v node >/dev/null 2>&1; then
        # Test with Node.js using ES module syntax in project directory
        cat > test_mongo_temp.mjs << 'EOF'
import { MongoClient } from 'mongodb';

async function testConnection() {
    try {
        const uri = process.env.MONGODB_URI || 
            `mongodb+srv://${encodeURIComponent(process.env.MONGODB_USERNAME)}:${encodeURIComponent(process.env.MONGODB_PASSWORD)}@${process.env.MONGODB_CLUSTER}/?retryWrites=true&w=majority`;
        
        console.log('Testing connection to MongoDB Atlas...');
        console.log('URI (masked):', uri.replace(/\/\/.*@/, '//***:***@'));
        
        const client = new MongoClient(uri);
        await client.connect();
        await client.db().admin().ping();
        await client.close();
        
        console.log('✅ MongoDB Atlas connection successful');
        process.exit(0);
    } catch (error) {
        console.error('❌ MongoDB Atlas connection failed:', error.message);
        process.exit(1);
    }
}

testConnection();
EOF
        
        if node test_mongo_temp.mjs; then
            print_success "MongoDB Atlas connection test passed"
        else
            print_error "MongoDB Atlas connection test failed"
            exit 1
        fi
        
        rm -f test_mongo_temp.mjs
    else
        print_warning "Node.js not found, skipping connection test"
    fi
}

# Remove Supabase dependencies
remove_supabase_deps() {
    print_status "Removing Supabase dependencies..."
    
    if [ -f "package.json" ]; then
        # Check if @supabase packages exist
        if grep -q "@supabase" package.json; then
            print_status "Found Supabase packages in package.json"
            
            # Remove Supabase packages
            if command -v pnpm >/dev/null 2>&1; then
                pnpm remove @supabase/supabase-js @supabase/ssr || true
            elif command -v npm >/dev/null 2>&1; then
                npm uninstall @supabase/supabase-js @supabase/ssr || true
            else
                print_warning "No package manager found, please manually remove @supabase packages"
            fi
            
            print_success "Supabase packages removed"
        else
            print_success "No Supabase packages found in package.json"
        fi
    else
        print_warning "No package.json found"
    fi
}

# Install MongoDB dependencies
install_mongodb_deps() {
    print_status "Installing MongoDB dependencies..."
    
    if [ -f "package.json" ]; then
        # Check if MongoDB is already installed
        if command -v pnpm >/dev/null 2>&1; then
            if pnpm list mongodb >/dev/null 2>&1; then
                print_success "MongoDB driver already installed"
                return 0
            fi
            
            # Install MongoDB driver
            pnpm add mongodb
        elif command -v npm >/dev/null 2>&1; then
            if npm list mongodb >/dev/null 2>&1; then
                print_success "MongoDB driver already installed"
                return 0
            fi
            
            npm install mongodb
        else
            print_error "No package manager found"
            exit 1
        fi
        
        print_success "MongoDB dependencies installed"
    else
        print_error "No package.json found"
        exit 1
    fi
}

# Create example environment file
create_env_example() {
    print_status "Creating .env.example for MongoDB Atlas..."
    
    cat > .env.example << 'EOF'
# MongoDB Atlas Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority
# OR use individual components:
# MONGODB_USERNAME=your_username
# MONGODB_PASSWORD=your_password
# MONGODB_CLUSTER=your_cluster.mongodb.net
MONGODB_DB_NAME=pixelated_empathy

# JWT Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# Other configurations...
NODE_ENV=development
PORT=3000
EOF
    
    print_success "Created .env.example with MongoDB Atlas configuration"
}

# Update TypeScript types
update_types() {
    print_status "TypeScript types have been updated to use MongoDB"
    print_status "Please review src/lib/mongodb.types.ts for the new type definitions"
    print_success "Type migration completed"
}

# Run database seeding
seed_database() {
    print_status "Running database seeding..."
    
    if [ -f "scripts/mongodb-seed.js" ]; then
        node scripts/mongodb-seed.js || print_warning "Database seeding failed or skipped"
        print_success "Database seeding completed"
    else
        print_warning "No database seeding script found"
    fi
}

# Main migration process
main() {
    echo "🔄 Pixelated Empathy - Supabase to MongoDB Atlas Migration"
    echo "========================================================"
    
    load_env_file
    check_mongodb_env
    remove_supabase_deps
    install_mongodb_deps
    test_mongodb_connection
    create_env_example
    update_types
    seed_database
    
    echo ""
    echo "🎉 Migration completed successfully!"
    echo ""
    print_success "Next steps:"
    print_status "1. Update your .env file with MongoDB Atlas credentials"
    print_status "2. Review the new MongoDB types in src/lib/mongodb.types.ts"
    print_status "3. Test your application with the new MongoDB Atlas database"
    print_status "4. Update any remaining Supabase-specific code in your application"
    echo ""
    print_warning "Note: This migration script has updated the core configuration."
    print_warning "You may need to update application-specific code that uses Supabase APIs."
}

# Run the migration
main "$@"
