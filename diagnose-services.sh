#!/bin/bash

echo "🔍 Диагностика сервисов RSCORD"
echo "================================"

# Проверяем статус systemd сервисов
echo "📊 Статус systemd сервисов:"
for service in rscord-gateway rscord-auth-service rscord-voice-service rscord-presence-service; do
    echo "--- $service ---"
    sudo systemctl status $service --no-pager -l
    echo
done

echo "📋 Логи последних ошибок:"
for service in rscord-gateway rscord-auth-service rscord-voice-service rscord-presence-service; do
    echo "--- $service logs ---"
    sudo journalctl -u $service -n 20 --no-pager
    echo
done

echo "🔗 Проверяем порты:"
netstat -tlnp | grep -E "(14700|14701|14705|14706)"

echo "📁 Проверяем файлы конфигурации:"
ls -la /opt/rscord/
ls -la /opt/rscord/config/

echo "🔑 Проверяем права доступа:"
ls -la /opt/rscord/bin/

echo "📝 Содержимое systemd unit файлов:"
for service in rscord-gateway rscord-auth-service rscord-voice-service rscord-presence-service; do
    echo "--- /etc/systemd/system/$service.service ---"
    cat /etc/systemd/system/$service.service
    echo
done
