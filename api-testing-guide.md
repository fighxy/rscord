# RSCORD API Testing Guide

## Base URLs
- **Production Server**: `http://5.35.83.143`
- **Gateway**: `http://5.35.83.143:14700`
- **Auth Service**: `http://5.35.83.143:14701`
- **Voice Service**: `http://5.35.83.143:14705`
- **Presence Service**: `http://5.35.83.143:14706`

## Authentication API

### Register User
```bash
curl -X POST http://5.35.83.143:14701/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

**Response:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": "user_id",
    "username": "testuser",
    "email": "test@example.com"
  }
}
```

### Login
```bash
curl -X POST http://5.35.83.143:14701/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

### Get Current User
```bash
curl -X GET http://5.35.83.143:14701/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Verify Token
```bash
curl -X POST http://5.35.83.143:14701/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_JWT_TOKEN"
  }'
```

## Voice Service API

### Join Voice Room
```bash
curl -X POST http://5.35.83.143:14705/voice/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "user_id": "user123",
    "channel_id": "voice_channel_456"
  }'
```

**Response:**
```json
{
  "room_id": "room_789",
  "ice_servers": [
    {
      "urls": ["stun:stun.l.google.com:19302"],
      "username": null,
      "credential": null
    }
  ]
}
```

### Leave Voice Room
```bash
curl -X POST http://5.35.83.143:14705/voice/leave \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "user_id": "user123",
    "room_id": "room_789"
  }'
```

### Get ICE Servers
```bash
curl -X GET http://5.35.83.143:14705/voice/ice-servers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### List Active Rooms
```bash
curl -X GET http://5.35.83.143:14705/voice/rooms \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Room Participants
```bash
curl -X GET http://5.35.83.143:14705/voice/rooms/ROOM_ID/participants \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### WebSocket Connection (Voice Signaling)
```javascript
const ws = new WebSocket('ws://5.35.83.143:14705/voice/ws');

ws.onopen = () => {
  // Send join message
  ws.send(JSON.stringify({
    type: 'join',
    room_id: 'room_789',
    user_id: 'user123'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
  
  switch(message.type) {
    case 'offer':
      // Handle WebRTC offer
      break;
    case 'answer':
      // Handle WebRTC answer
      break;
    case 'ice_candidate':
      // Handle ICE candidate
      break;
    case 'user_joined':
      // Handle new user
      break;
    case 'user_left':
      // Handle user leaving
      break;
  }
};
```

## Presence Service API

### Update User Presence
```bash
curl -X POST http://5.35.83.143:14706/presence/update/USER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "status": "Online",
    "activity": "Playing RSCORD"
  }'
```

**Status Values:**
- `Online`
- `Away`
- `DoNotDisturb`
- `Invisible`
- `Offline`

### Get User Presence
```bash
curl -X GET http://5.35.83.143:14706/presence/USER_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "user_id": "user123",
  "status": "Online",
  "activity": "Playing RSCORD",
  "last_seen": "2024-01-15T10:30:00Z"
}
```

### Get Guild Presence
```bash
curl -X GET http://5.35.83.143:14706/presence/guild/GUILD_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "guild_id": "guild123",
  "users": [
    {
      "user_id": "user1",
      "status": "Online",
      "activity": "In voice channel",
      "last_seen": "2024-01-15T10:30:00Z"
    },
    {
      "user_id": "user2",
      "status": "Away",
      "activity": null,
      "last_seen": "2024-01-15T10:25:00Z"
    }
  ]
}
```

### Bulk Presence Query
```bash
curl -X POST http://5.35.83.143:14706/presence/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "user_ids": ["user1", "user2", "user3"]
  }'
```

### WebSocket Connection (Presence Updates)
```javascript
const ws = new WebSocket('ws://5.35.83.143:14706/presence/ws');

ws.onopen = () => {
  // Send initial presence
  ws.send(JSON.stringify({
    user_id: 'user123',
    status: 'Online',
    activity: 'Testing API',
    guild_id: 'guild456'
  }));
};

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Presence update:', update);
};
```

## Gateway API (Main Entry Point)

The gateway routes requests to appropriate services:

### Health Check
```bash
curl http://5.35.83.143:14700/health
```

### Routed Requests
All service endpoints can be accessed through the gateway:

```bash
# Auth through gateway
curl -X POST http://5.35.83.143:14700/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"Pass123!"}'

# Voice through gateway
curl http://5.35.83.143:14700/voice/ice-servers

# Presence through gateway
curl http://5.35.83.143:14700/presence/user123
```

## Testing with Postman

### Collection Setup
1. Create a new collection "RSCORD API"
2. Set collection variables:
   - `base_url`: `http://5.35.83.143:14700`
   - `auth_url`: `http://5.35.83.143:14701`
   - `voice_url`: `http://5.35.83.143:14705`
   - `presence_url`: `http://5.35.83.143:14706`
   - `token`: (will be set after login)

### Authentication Flow
1. Register a new user
2. Save the token to collection variable
3. Use `{{token}}` in Authorization header for protected endpoints

### Example Postman Pre-request Script
```javascript
// For login/register endpoints - save token
if (pm.response.code === 200) {
  const response = pm.response.json();
  if (response.token) {
    pm.collectionVariables.set("token", response.token);
  }
}
```

### Example Tests
```javascript
// Test successful response
pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

// Test response structure
pm.test("Response has required fields", function () {
  const response = pm.response.json();
  pm.expect(response).to.have.property('token');
  pm.expect(response).to.have.property('user');
});
```

## WebSocket Testing with wscat

Install wscat:
```bash
npm install -g wscat
```

### Test Voice WebSocket
```bash
wscat -c ws://5.35.83.143:14705/voice/ws
> {"type":"join","room_id":"test_room","user_id":"test_user"}
```

### Test Presence WebSocket
```bash
wscat -c ws://5.35.83.143:14706/presence/ws
> {"user_id":"test_user","status":"Online","activity":"Testing"}
```

## Load Testing with Apache Bench

### Test Health Endpoint
```bash
ab -n 1000 -c 10 http://5.35.83.143:14700/health
```

### Test Auth Service
```bash
ab -n 100 -c 5 -T application/json -p login.json \
  http://5.35.83.143:14701/auth/login
```

## Monitoring

### Check Service Status
```bash
# Health endpoints
for port in 14700 14701 14705 14706; do
  echo "Port $port: $(curl -s http://5.35.83.143:$port/health)"
done
```

### View Logs (on server)
```bash
# SSH to server
ssh root@5.35.83.143

# View service logs
journalctl -u rscord@gateway -f
journalctl -u rscord@auth-service -f
journalctl -u rscord@voice-service -f
journalctl -u rscord@presence-service -f
```

## Common Issues and Solutions

### CORS Errors
The services are configured to allow all origins. If you still get CORS errors:
1. Check if the service is running
2. Verify the URL is correct
3. Try accessing through the gateway instead

### Connection Refused
1. Check if services are running: `systemctl status rscord@*`
2. Check firewall: `ufw status`
3. Verify ports are open: `netstat -tlnp | grep 147`

### WebSocket Connection Failed
1. Ensure WebSocket upgrade headers are sent
2. Check if behind a proxy that doesn't support WebSocket
3. Try direct connection to service port

### Authentication Issues
1. Verify JWT token format: `Bearer YOUR_TOKEN`
2. Check token expiration
3. Ensure token is sent in Authorization header

## Performance Benchmarks

Expected response times:
- Health endpoints: < 10ms
- Auth endpoints: < 50ms
- Presence queries: < 30ms
- WebSocket connection: < 100ms

## Security Notes

For production testing:
1. Always use HTTPS in production
2. Rotate JWT secrets regularly
3. Implement rate limiting
4. Use strong passwords
5. Monitor for suspicious activity

## Next Steps

1. Implement frontend to consume these APIs
2. Add more comprehensive error handling
3. Implement chat service
4. Add file upload capabilities
5. Enhance WebRTC signaling
6. Add metrics and monitoring