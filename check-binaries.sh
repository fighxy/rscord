#!/bin/bash

echo "🔍 Проверка скомпилированных бинарников"
echo "======================================"

echo "1. Проверяем target/release:"
if [ -d "target/release" ]; then
    echo "✅ Директория target/release найдена"
    echo "Содержимое:"
    ls -la target/release/ | grep rscord
else
    echo "❌ Директория target/release не найдена"
fi

echo ""
echo "2. Проверяем servers/target/release:"
if [ -d "servers/target/release" ]; then
    echo "✅ Директория servers/target/release найдена"
    echo "Содержимое:"
    ls -la servers/target/release/ | grep rscord
else
    echo "❌ Директория servers/target/release не найдена"
fi

echo ""
echo "3. Поиск всех rscord бинарников на сервере:"
find . -name "*rscord*" -type f -executable 2>/dev/null | head -10

echo ""
echo "4. Проверяем /opt/rscord/bin:"
if [ -d "/opt/rscord/bin" ]; then
    echo "Содержимое /opt/rscord/bin:"
    ls -la /opt/rscord/bin/
else
    echo "Директория /opt/rscord/bin не существует"
fi

echo ""
echo "5. Проверяем текущую директорию для компиляции:"
echo "Текущая директория: $(pwd)"
echo "Содержимое:"
ls -la | grep -E "(target|servers|Cargo)"

echo ""
echo "6. Если нужно перекомпилировать:"
echo "cd /root/rscord/servers && cargo build --release"
