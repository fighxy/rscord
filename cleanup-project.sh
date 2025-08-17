#!/bin/bash
# RSCORD Cleanup Script - Удаление технического долга

echo "🧹 Starting RSCORD cleanup (keeping microservices)..."

# Удаляем лишние markdown файлы
echo "📝 Removing duplicate markdown files..."
rm -f api-testing-guide.md
rm -f desktop-readme.md
rm -f readme2.md
rm -f production-readme.md
rm -f LIVEKIT_SETUP.md
rm -f server-commands.md
rm -f VPS_deploy.md
rm -f BUILD_GUIDE.md

# Удаляем лишние shell скрипты
echo "🔧 Removing unnecessary scripts..."
rm -f build-and-deploy.sh
rm -f check-binaries.sh
rm -f complete-server-fix.sh
rm -f deploy-on-server.sh
rm -f deploy.sh
rm -f diagnose-services.sh
rm -f fix-and-build.sh
rm -f fix-config-and-restart.sh
rm -f fix-services.sh
rm -f quick-deploy.sh
rm -f server-init.sh
rm -f setup-server.sh
rm -f test-backend.sh

# Удаляем LiveKit конфигурации
echo "🎤 Removing LiveKit configs..."
rm -f livekit.yaml
rm -f turnserver.conf

# Удаляем неиспользуемые сервисы
echo "📦 Removing unused services..."
rm -rf servers/voice-service
rm -rf servers/signaling

echo "✅ Cleanup complete!"
