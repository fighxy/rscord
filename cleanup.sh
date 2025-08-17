#!/bin/bash
# RSCORD Cleanup Script - Удаление технического долга

echo "🧹 Starting RSCORD deep cleanup..."

# Список файлов для удаления
REMOVE_MD_FILES=(
    "api-testing-guide.md"
    "desktop-readme.md"
    "readme2.md"
    "production-readme.md"
    "LIVEKIT_SETUP.md"
    "MICROSERVICES_ARCHITECTURE.md"
    "RSCORD_PROJECT_DOCUMENTATION.md"
    "server-commands.md"
    "VPS_deploy.md"
    "BUILD_GUIDE.md"
    "apps/desktop/SHADCN_TAILWIND_GUIDE.md"
    "apps/desktop/TAILWIND_GUIDE.md"
    "apps/desktop/SERVER_CONFIGURATION.md"
)

REMOVE_SH_FILES=(
    "build-and-deploy.sh"
    "check-binaries.sh"
    "complete-server-fix.sh"
    "deploy-on-server.sh"
    "deploy.sh"
    "diagnose-services.sh"
    "fix-and-build.sh"
    "fix-config-and-restart.sh"
    "fix-services.sh"
    "quick-deploy.sh"
    "server-init.sh"
    "setup-server.sh"
    "test-backend.sh"
)

REMOVE_CONFIG_FILES=(
    "livekit.yaml"
    "turnserver.conf"
    "docker-compose.production.yml"
    "nginx.conf"
    "test_auth.http"
)

echo "📋 Files to be removed:"
for file in "${REMOVE_MD_FILES[@]}" "${REMOVE_SH_FILES[@]}" "${REMOVE_CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  - $file"
    fi
done

echo ""
read -p "⚠️  Proceed with cleanup? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing files..."
    
    for file in "${REMOVE_MD_FILES[@]}" "${REMOVE_SH_FILES[@]}" "${REMOVE_CONFIG_FILES[@]}"; do
        if [ -f "$file" ]; then
            rm -f "$file"
            echo "  ✓ Removed: $file"
        fi
    done
    
    # Удаление неиспользуемых сервисов
    echo "🗑️  Removing unused services..."
    rm -rf servers/voice-service
    rm -rf servers/signaling
    echo "  ✓ Removed voice-service and signaling"
    
    echo "✅ Cleanup complete!"
else
    echo "❌ Cleanup cancelled"
fi
