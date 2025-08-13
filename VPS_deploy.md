# RSCORD - Руководство по развертыванию на VPS

## 🎯 Обзор

Данное руководство описывает процесс развертывания RSCORD на VPS сервере в России для тестирования и отладки, а также содержит рекомендации по масштабированию для коммерческого использования.

## 🖥️ Минимальная конфигурация VPS

### Рекомендуемые характеристики:

#### **Минимальная конфигурация (для тестирования):**
- **CPU**: 2 ядра
- **RAM**: 4 GB
- **Диск**: 40 GB SSD
- **Сеть**: 100 Mbps
- **ОС**: Ubuntu 22.04 LTS

#### **Рекомендуемая конфигурация (для стабильной работы):**
- **CPU**: 4 ядра
- **RAM**: 8 GB
- **Диск**: 80 GB SSD
- **Сеть**: 1 Gbps
- **ОС**: Ubuntu 22.04 LTS

### Популярные VPS провайдеры в России:

1. **VScale** - российский провайдер, хорошая поддержка
2. **Timeweb** - стабильные серверы, удобная панель
3. **Reg.ru** - проверенный провайдер
4. **Beget** - доступные тарифы
5. **Jino** - качественные серверы

## 🚀 Процесс развертывания

### 1. Подготовка VPS сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка необходимых пакетов
sudo apt install -y curl wget git build-essential pkg-config libssl-dev

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Установка Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### 2. Настройка файрвола

```bash
# Установка UFW
sudo apt install ufw

# Настройка правил
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 14702/tcp # RSCORD API
sudo ufw allow 14703/tcp # RSCORD WebSocket
sudo ufw enable
```

### 3. Клонирование и настройка проекта

```bash
# Клонирование репозитория
git clone https://github.com/your-username/rscord.git
cd rscord

# Создание конфигурационного файла
cat > rscord.toml << EOF
bind_addr = "0.0.0.0:14702"
mongodb_uri = "mongodb://localhost:27017"
redis_uri = "redis://127.0.0.1:6379/"
rabbitmq_uri = "amqp://guest:guest@127.0.0.1:5672/%2f"
s3_endpoint = "http://127.0.0.1:9000"
s3_bucket = "rscord"
s3_access_key = "minioadmin"
s3_secret_key = "minioadmin"
jwt_secret = "your_super_secret_key_change_this_in_production"
EOF
```

### 4. Настройка Docker Compose

Создайте файл `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  mongo:
    image: mongo:7.0
    container_name: rscord_mongo
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: your_mongo_password
    volumes:
      - mongo_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    ports:
      - "127.0.0.1:27017:27017"

  redis:
    image: redis:7-alpine
    container_name: rscord_redis
    restart: unless-stopped
    command: redis-server --requirepass your_redis_password
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"

  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: rscord_rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: your_rabbitmq_password
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    ports:
      - "127.0.0.1:5672:5672"
      - "127.0.0.1:15672:15672"

  minio:
    image: minio/minio:latest
    container_name: rscord_minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: your_minio_password
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"

volumes:
  mongo_data:
  redis_data:
  rabbitmq_data:
  minio_data:
```

### 5. Создание скрипта запуска

Создайте файл `start_rscord.sh`:

```bash
#!/bin/bash

echo "🚀 Запуск RSCORD на VPS..."

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен"
    exit 1
fi

# Запуск инфраструктуры
echo "📦 Запуск инфраструктуры..."
docker-compose -f docker-compose.prod.yml up -d

# Ожидание готовности сервисов
echo "⏳ Ожидание готовности сервисов..."
sleep 30

# Сборка и запуск API сервера
echo "🔧 Сборка API сервера..."
cd servers
cargo build --release

# Запуск API сервера в фоне
echo "🌐 Запуск API сервера..."
nohup cargo run --release -p rscord-api > ../logs/api.log 2>&1 &

# Запуск WebSocket сервера
echo "🔌 Запуск WebSocket сервера..."
nohup cargo run --release -p rscord-events > ../logs/events.log 2>&1 &

echo "✅ RSCORD запущен!"
echo "📊 API сервер: http://your-server-ip:14702"
echo "🔌 WebSocket: ws://your-server-ip:14703"
echo "📝 Логи: ./logs/"
```

### 6. Настройка systemd сервисов

Создайте файл `/etc/systemd/system/rscord-api.service`:

```ini
[Unit]
Description=RSCORD API Server
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/home/your_username/rscord/servers
ExecStart=/home/your_username/.cargo/bin/cargo run --release -p rscord-api
Restart=always
RestartSec=10
Environment=RSCORD__BIND_ADDR=0.0.0.0:14702

[Install]
WantedBy=multi-user.target
```

Создайте файл `/etc/systemd/system/rscord-events.service`:

```ini
[Unit]
Description=RSCORD Events Server
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/home/your_username/rscord/servers
ExecStart=/home/your_username/.cargo/bin/cargo run --release -p rscord-events
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 7. Запуск сервисов

```bash
# Перезагрузка systemd
sudo systemctl daemon-reload

# Включение автозапуска
sudo systemctl enable rscord-api
sudo systemctl enable rscord-events

# Запуск сервисов
sudo systemctl start rscord-api
sudo systemctl start rscord-events

# Проверка статуса
sudo systemctl status rscord-api
sudo systemctl status rscord-events
```

### 8. Настройка Nginx (опционально)

Создайте файл `/etc/nginx/sites-available/rscord`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:14702;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:14703;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 🔧 Рекомендации по оптимизации

### 1. Мониторинг ресурсов

```bash
# Установка htop для мониторинга
sudo apt install htop

# Установка netdata для веб-мониторинга
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

### 2. Ротация логов

Создайте файл `/etc/logrotate.d/rscord`:

```
/home/your_username/rscord/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 your_username your_username
}
```

### 3. Резервное копирование

Создайте скрипт `backup_rscord.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/home/your_username/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Создание директории для бэкапов
mkdir -p $BACKUP_DIR

# Бэкап MongoDB
docker exec rscord_mongo mongodump --out /tmp/backup
docker cp rscord_mongo:/tmp/backup $BACKUP_DIR/mongo_$DATE

# Бэкап MinIO
docker exec rscord_minio mc mirror /data $BACKUP_DIR/minio_$DATE

# Сжатие бэкапов
tar -czf $BACKUP_DIR/rscord_backup_$DATE.tar.gz -C $BACKUP_DIR mongo_$DATE minio_$DATE

# Удаление временных файлов
rm -rf $BACKUP_DIR/mongo_$DATE $BACKUP_DIR/minio_$DATE

echo "✅ Бэкап создан: $BACKUP_DIR/rscord_backup_$DATE.tar.gz"
```

## 📊 Ожидаемое потребление ресурсов

### Минимальная конфигурация (2 CPU, 4GB RAM):
- **MongoDB**: ~500MB RAM
- **Redis**: ~200MB RAM  
- **RabbitMQ**: ~300MB RAM
- **MinIO**: ~200MB RAM
- **RSCORD API**: ~500MB RAM
- **RSCORD Events**: ~300MB RAM
- **Система**: ~1GB RAM
- **Итого**: ~3GB RAM (с запасом)

### Рекомендуемая конфигурация (4 CPU, 8GB RAM):
- **Все сервисы**: ~4-5GB RAM
- **Запас для роста**: 3-4GB RAM

## 🚀 Масштабирование для коммерческого использования

### Архитектура высоконагруженной системы

#### **Микросервисная архитектура:**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   API Gateway   │    │   Service Mesh  │
│   (Nginx/HAProxy)│◄──►│   (Kong/Traefik)│◄──►│   (Istio/Linkerd)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Servers   │    │   Event Servers │    │   File Servers  │
│   (Multiple)    │    │   (Multiple)    │    │   (Multiple)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MongoDB       │    │   Redis Cluster │    │   MinIO Cluster │
│   (Replica Set) │    │   (Sentinel)    │    │   (Distributed) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Рекомендации по масштабированию

#### **1. Горизонтальное масштабирование API серверов**

```yaml
# docker-compose.scale.yml
version: '3.8'

services:
  rscord-api-1:
    build: ./servers
    ports:
      - "14702:14702"
    environment:
      - RSCORD__BIND_ADDR=0.0.0.0:14702
      - RSCORD__INSTANCE_ID=api-1
    deploy:
      replicas: 3

  rscord-api-2:
    build: ./servers
    ports:
      - "14704:14702"
    environment:
      - RSCORD__BIND_ADDR=0.0.0.0:14702
      - RSCORD__INSTANCE_ID=api-2
    deploy:
      replicas: 3

  rscord-api-3:
    build: ./servers
    ports:
      - "14706:14702"
    environment:
      - RSCORD__BIND_ADDR=0.0.0.0:14702
      - RSCORD__INSTANCE_ID=api-3
    deploy:
      replicas: 3
```

#### **2. Настройка MongoDB Replica Set**

```yaml
# docker-compose.mongo-cluster.yml
version: '3.8'

services:
  mongo-primary:
    image: mongo:7.0
    container_name: mongo_primary
    command: mongod --replSet rs0 --bind_ip_all
    ports:
      - "27017:27017"
    volumes:
      - mongo_primary_data:/data/db

  mongo-secondary-1:
    image: mongo:7.0
    container_name: mongo_secondary_1
    command: mongod --replSet rs0 --bind_ip_all
    ports:
      - "27018:27017"
    volumes:
      - mongo_secondary1_data:/data/db

  mongo-secondary-2:
    image: mongo:7.0
    container_name: mongo_secondary_2
    command: mongod --replSet rs0 --bind_ip_all
    ports:
      - "27019:27017"
    volumes:
      - mongo_secondary2_data:/data/db

  mongo-arbiter:
    image: mongo:7.0
    container_name: mongo_arbiter
    command: mongod --replSet rs0 --bind_ip_all
    ports:
      - "27020:27017"
    volumes:
      - mongo_arbiter_data:/data/db

volumes:
  mongo_primary_data:
  mongo_secondary1_data:
  mongo_secondary2_data:
  mongo_arbiter_data:
```

#### **3. Redis Cluster с Sentinel**

```yaml
# docker-compose.redis-cluster.yml
version: '3.8'

services:
  redis-master:
    image: redis:7-alpine
    container_name: redis_master
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_master_data:/data

  redis-slave-1:
    image: redis:7-alpine
    container_name: redis_slave_1
    command: redis-server --slaveof redis-master 6379 --appendonly yes
    ports:
      - "6380:6379"
    volumes:
      - redis_slave1_data:/data

  redis-slave-2:
    image: redis:7-alpine
    container_name: redis_slave_2
    command: redis-server --slaveof redis-master 6379 --appendonly yes
    ports:
      - "6381:6379"
    volumes:
      - redis_slave2_data:/data

  redis-sentinel-1:
    image: redis:7-alpine
    container_name: redis_sentinel_1
    command: redis-sentinel /usr/local/etc/redis/sentinel.conf
    ports:
      - "26379:26379"
    volumes:
      - ./redis-sentinel.conf:/usr/local/etc/redis/sentinel.conf

volumes:
  redis_master_data:
  redis_slave1_data:
  redis_slave2_data:
```

#### **4. MinIO Distributed Mode**

```yaml
# docker-compose.minio-cluster.yml
version: '3.8'

services:
  minio-1:
    image: minio/minio:latest
    container_name: minio_1
    command: server http://minio-1:9000 http://minio-2:9000 http://minio-3:9000 http://minio-4:9000 /data
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: your_minio_password
    volumes:
      - minio1_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  minio-2:
    image: minio/minio:latest
    container_name: minio_2
    command: server http://minio-1:9000 http://minio-2:9000 http://minio-3:9000 http://minio-4:9000 /data
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: your_minio_password
    volumes:
      - minio2_data:/data
    ports:
      - "9002:9000"
      - "9003:9001"

  minio-3:
    image: minio/minio:latest
    container_name: minio_3
    command: server http://minio-1:9000 http://minio-2:9000 http://minio-3:9000 http://minio-4:9000 /data
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: your_minio_password
    volumes:
      - minio3_data:/data
    ports:
      - "9004:9000"
      - "9005:9001"

  minio-4:
    image: minio/minio:latest
    container_name: minio_4
    command: server http://minio-1:9000 http://minio-2:9000 http://minio-3:9000 http://minio-4:9000 /data
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: your_minio_password
    volumes:
      - minio4_data:/data
    ports:
      - "9006:9000"
      - "9007:9001"

volumes:
  minio1_data:
  minio2_data:
  minio3_data:
  minio4_data:
```

### Настройка Load Balancer

#### **Nginx Load Balancer**

```nginx
# /etc/nginx/sites-available/rscord-lb
upstream rscord_api {
    least_conn;
    server 127.0.0.1:14702;
    server 127.0.0.1:14704;
    server 127.0.0.1:14706;
    keepalive 32;
}

upstream rscord_events {
    ip_hash;
    server 127.0.0.1:14703;
    server 127.0.0.1:14705;
    server 127.0.0.1:14707;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://rscord_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503 http_504;
    }

    location /ws {
        proxy_pass http://rscord_events;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Мониторинг и метрики

#### **Prometheus + Grafana**

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  prometheus_data:
  grafana_data:
```

### Автоматическое масштабирование

#### **Docker Swarm с автомасштабированием**

```bash
# Инициализация Swarm
docker swarm init

# Создание stack
docker stack deploy -c docker-compose.swarm.yml rscord

# Автоматическое масштабирование
docker service scale rscord_api=5
docker service scale rscord_events=3
```

#### **Kubernetes Deployment**

```yaml
# k8s-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rscord-api
spec:
  replicas: 5
  selector:
    matchLabels:
      app: rscord-api
  template:
    metadata:
      labels:
        app: rscord-api
    spec:
      containers:
      - name: rscord-api
        image: rscord/api:latest
        ports:
        - containerPort: 14702
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 14702
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 14702
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 🔒 Безопасность для продакшена

### SSL/TLS настройка

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение SSL сертификата
sudo certbot --nginx -d your-domain.com

# Автоматическое обновление
sudo crontab -e
# Добавить строку:
0 12 * * * /usr/bin/certbot renew --quiet
```

### Настройка fail2ban

```bash
# Установка fail2ban
sudo apt install fail2ban

# Создание конфигурации
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Настройка правил для RSCORD
sudo nano /etc/fail2ban/jail.local
```

### Мониторинг безопасности

```bash
# Установка ClamAV
sudo apt install clamav clamav-daemon

# Установка rkhunter
sudo apt install rkhunter

# Ежедневное сканирование
sudo crontab -e
# Добавить строки:
0 2 * * * /usr/bin/freshclam
0 3 * * * /usr/bin/rkhunter --cronjob --update --quiet
```

## 📈 Метрики производительности

### Ключевые показатели (KPI)

1. **Response Time**: < 200ms для 95% запросов
2. **Throughput**: > 1000 RPS на API сервер
3. **Uptime**: > 99.9%
4. **Error Rate**: < 0.1%
5. **Concurrent Users**: > 10,000

### Нагрузочное тестирование

```bash
# Установка wrk
sudo apt install wrk

# Тест API сервера
wrk -t12 -c400 -d30s http://your-server:14702/health

# Тест WebSocket
# Используйте специализированные инструменты для WebSocket
```

## 💰 Стоимость инфраструктуры

### Оценка для разных уровней нагрузки

#### **Стартовый уровень (до 1000 пользователей):**
- VPS: 4 CPU, 8GB RAM, 80GB SSD - ~$40-60/месяц
- Дополнительные сервисы: ~$20-30/месяц
- **Итого**: ~$60-90/месяц

#### **Средний уровень (до 10,000 пользователей):**
- VPS: 8 CPU, 16GB RAM, 160GB SSD - ~$80-120/месяц
- Балансировщик нагрузки: ~$30-50/месяц
- Мониторинг: ~$20-30/месяц
- **Итого**: ~$130-200/месяц

#### **Высокий уровень (до 100,000 пользователей):**
- Кластер VPS: ~$300-500/месяц
- CDN: ~$100-200/месяц
- Мониторинг и алерты: ~$50-100/месяц
- **Итого**: ~$450-800/месяц

## 🎯 Рекомендации по внедрению

### Поэтапное масштабирование

1. **Этап 1**: Базовая настройка на одном VPS
2. **Этап 2**: Добавление реплик базы данных
3. **Этап 3**: Горизонтальное масштабирование API
4. **Этап 4**: Внедрение кластерного хранилища
5. **Этап 5**: Добавление CDN и балансировщика

### Критерии перехода на следующий этап

- **Этап 1→2**: > 80% загрузки CPU/RAM
- **Этап 2→3**: > 70% загрузки базы данных
- **Этап 3→4**: > 60% загрузки хранилища
- **Этап 4→5**: > 50% загрузки сети

## 📚 Заключение

Данное руководство предоставляет comprehensive план развертывания RSCORD на VPS с возможностью масштабирования до коммерческого уровня. Ключевые моменты:

- **Начните с минимальной конфигурации** для тестирования
- **Планируйте архитектуру** с учетом будущего роста
- **Внедряйте мониторинг** с самого начала
- **Масштабируйтесь поэтапно** по мере роста нагрузки
- **Не забывайте о безопасности** и резервном копировании

При правильном подходе RSCORD может масштабироваться от простого тестового сервера до высоконагруженной коммерческой платформы, обслуживающей десятки тысяч пользователей.

---

*Руководство создано для проекта RSCORD. Адаптируйте под ваши конкретные требования и инфраструктуру.*
