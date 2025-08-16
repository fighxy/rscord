# RSCORD Microservices Architecture

## Overview

RSCORD теперь использует микросервисную архитектуру для лучшей масштабируемости, надежности и модульности. Каждый сервис отвечает за определенную область функциональности и может быть разработан, развернут и масштабирован независимо.

## Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway    │    │  Load Balancer  │
│  (Tauri/React)  │◄──►│   (Port 14700)   │◄──►│   (Optional)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │    Service Mesh       │
                    └───────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Auth Service │    │  Chat Service    │    │ Voice Service    │
│ (Port 14701) │    │  (Port 14703)    │    │ (Port 14705)     │
└──────────────┘    └──────────────────┘    └──────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                                ▼
                    ┌──────────────────┐
                    │ Presence Service │
                    │  (Port 14706)    │
                    └──────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   MongoDB    │    │    RabbitMQ      │    │     Redis        │
│ (Port 27017) │    │  (Port 5672)     │    │  (Port 6379)     │
└──────────────┘    └──────────────────┘    └──────────────────┘
```

## Services Overview

### 1. API Gateway (Port 14700)
**Responsibilities:**
- Request routing to appropriate microservices
- Authentication validation
- Rate limiting
- CORS handling
- Load balancing
- Request/response transformation

**Key Features:**
- Centralized entry point for all client requests
- JWT token validation
- Service discovery and routing
- Error handling and circuit breaker pattern

### 2. Auth Service (Port 14701)
**Responsibilities:**
- User authentication and authorization
- JWT token generation and validation
- Password hashing and verification
- User registration and login

**Endpoints:**
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user
- `POST /auth/verify` - Verify JWT token

### 3. Chat Service (Port 14703)
**Responsibilities:**
- Text messaging
- Guild and channel management
- Message history
- File attachments
- Typing indicators

**Endpoints:**
- **Guilds:** `/guilds/*` - Guild management
- **Channels:** `/channels/*` - Channel management
- **Messages:** `/messages/*` - Message operations

### 4. Voice Service (Port 14705)
**Responsibilities:**
- Voice room management
- WebRTC signaling
- Audio stream coordination
- Voice channel state management

**Endpoints:**
- `POST /voice/join` - Join voice room
- `POST /voice/leave` - Leave voice room
- `GET /voice/ws` - WebSocket for signaling
- `GET /voice/ice-servers` - Get ICE servers

### 5. Presence Service (Port 14706)
**Responsibilities:**
- User online/offline status
- Activity tracking
- Real-time presence updates
- Status broadcasting

**Endpoints:**
- `POST /presence/update` - Update user presence
- `GET /presence/:user_id` - Get user presence
- `GET /presence/guild/:guild_id` - Get guild presence
- `GET /presence/ws` - WebSocket for real-time updates

## Data Layer

### MongoDB (Primary Database)
- **Users Collection:** User accounts and profiles
- **Guilds Collection:** Server/guild information
- **Channels Collection:** Text and voice channels
- **Messages Collection:** Chat messages
- **Guild_Members Collection:** Guild membership data

### Redis (Caching & Sessions)
- User presence cache
- Session storage
- Real-time data caching
- WebSocket connection tracking

### RabbitMQ (Event Bus)
- Inter-service communication
- Event-driven architecture
- Message queuing
- Asynchronous processing

## Event-Driven Architecture

Services communicate through events published to RabbitMQ:

### Chat Events
- `message.created`
- `message.updated`
- `message.deleted`
- `user.joined`
- `user.left`
- `typing.started`

### Voice Events
- `voice.user.joined`
- `voice.user.left`
- `voice.stream.started`
- `voice.stream.ended`

### Presence Events
- `presence.status.changed`
- `presence.activity.changed`
- `presence.user.online`
- `presence.user.offline`

## Security

### Authentication Flow
1. Client sends credentials to Gateway
2. Gateway forwards to Auth Service
3. Auth Service validates and returns JWT
4. Gateway returns JWT to client
5. All subsequent requests include JWT in header
6. Gateway validates JWT before routing

### Authorization
- JWT tokens contain user ID and permissions
- Each service validates tokens independently
- Microservices can request additional auth info from Auth Service

## Development & Deployment

### Local Development
```bash
# Start infrastructure
docker-compose up -d

# Start all microservices
./scripts/start-services.sh    # Linux/Mac
./scripts/start-services.bat   # Windows

# Or start individual services
cd servers/gateway && cargo run
cd servers/auth-service && cargo run
# etc...
```

### Configuration
All services read from `servers/rscord.toml`:
- Database connections
- Service endpoints
- Security settings
- Performance tuning

### Health Checks
Each service provides health endpoints:
- Gateway: `http://localhost:14700/health`
- Auth: `http://localhost:14701/health`
- Chat: `http://localhost:14703/health`
- Voice: `http://localhost:14705/health`
- Presence: `http://localhost:14706/health`

## Monitoring & Observability

### Logging
- Structured logging with tracing
- Centralized log aggregation
- Request ID tracking across services

### Metrics
- Service performance metrics
- Request/response times
- Error rates
- Resource utilization

### Distributed Tracing
- Request flow tracking
- Service dependency mapping
- Performance bottleneck identification

## Scaling Strategies

### Horizontal Scaling
- Multiple instances of each service
- Load balancing through Gateway
- Database connection pooling

### Vertical Scaling
- Resource allocation per service
- Memory and CPU optimization
- Database query optimization

### Caching Strategy
- Redis for hot data
- MongoDB for persistent storage
- Application-level caching

## API Documentation

### Gateway Routing
```
/auth/*     → Auth Service
/guilds/*   → Chat Service
/channels/* → Chat Service
/messages/* → Chat Service
/voice/*    → Voice Service
/presence/* → Presence Service
```

### Error Handling
Standardized error responses across all services:
```json
{
  "error": "error_code",
  "message": "Human readable message",
  "details": {},
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Future Enhancements

### Planned Features
1. **Service Discovery:** Automatic service registration and discovery
2. **Circuit Breaker:** Fault tolerance patterns
3. **API Versioning:** Support for multiple API versions
4. **Metrics Dashboard:** Real-time monitoring
5. **Auto-scaling:** Dynamic resource allocation

### Performance Optimizations
1. **Database Sharding:** Horizontal database scaling
2. **CDN Integration:** Static asset delivery
3. **Compression:** Request/response compression
4. **Connection Pooling:** Optimized database connections

This microservices architecture provides a solid foundation for scaling RSCORD while maintaining code quality and development velocity.
