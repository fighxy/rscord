# RSCORD Desktop Server Configuration

This document explains how to configure and switch between different RSCORD servers in the desktop application.

## Overview

The RSCORD desktop application can connect to different servers:
- **Local Server**: Development server running on your machine (localhost:14700)
- **Production Server**: Remote production server (5.35.83.143:14700)

## Server Configuration

### Default Configuration

By default, the application connects to the local server (`http://localhost:14700`). This can be changed in several ways:

1. **Environment Variables** (Recommended for development)
2. **Server Selector UI** (Built-in component for easy switching)
3. **Configuration Files** (Direct code changes)

### Environment Variables

Create a `.env.local` file in the `apps/desktop/` directory:

```bash
# Local Development
VITE_API_URL=http://localhost:14700
VITE_WS_URL=ws://localhost:14700

# Production Server
# VITE_API_URL=http://5.35.83.143:14700
# VITE_WS_URL=ws://5.35.83.143:14700
```

### Server Selector Component

The application includes a built-in `ServerSelector` component that allows users to:

- View current server status (online/offline)
- Switch between local and production servers
- Check server connectivity
- See which server is currently active

#### Accessing the Server Selector

1. Look for the server status indicator in the sidebar (shows 🟢 Online or 🔴 Offline)
2. Click the ⚙️ button next to the status to open the server configuration modal
3. Use the interface to switch servers or check status

## Server Ports

### Local Development Server
- **Gateway**: 14700 (Main API entry point)
- **Auth Service**: 14701
- **Voice Service**: 14705
- **Presence Service**: 14706

### Production Server
- **Gateway**: 14700
- **Auth Service**: 14701
- **Voice Service**: 14705
- **Presence Service**: 14706

## Configuration Files

### Main API Configuration
`src/config/api.ts` - Contains the main API configuration and server switching utilities.

### Environment Configuration
`src/config/environment.ts` - Contains environment-specific server configurations.

## Server Switching Utilities

The application provides utility functions for server management:

```typescript
import { serverUtils } from '@/config/api';

// Switch to local server
serverUtils.switchToLocal();

// Switch to production server
serverUtils.switchToProduction();

// Get current server preference
const currentServer = serverUtils.getCurrentServer();

// Get server configuration
const config = serverUtils.getServerConfig();
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Check if another service is using the required ports
   - Use `netstat -an | findstr :14700` (Windows) or `netstat -an | grep :14700` (Linux/Mac)

2. **Server Not Reachable**
   - Verify the server is running
   - Check firewall settings
   - Ensure the correct IP address is configured

3. **CORS Issues**
   - Verify the server allows requests from the desktop app
   - Check server CORS configuration

### Server Status Check

The application automatically checks server status every 30 seconds. You can also manually check:

1. Open the Server Selector (⚙️ button)
2. Click "Check Status" to verify connectivity
3. Look for the status indicators (🟢 Online / 🔴 Offline)

## Development Workflow

### Local Development
1. Start your local RSCORD server
2. Ensure it's running on the expected ports
3. The desktop app will automatically connect to localhost

### Testing Production
1. Use the Server Selector to switch to production
2. Verify connectivity to the remote server
3. Test functionality with the production environment

### Switching Back
1. Use the Server Selector to return to local development
2. The app will reload and reconnect to localhost

## Security Considerations

- **Local Development**: No additional security measures needed
- **Production**: Ensure proper authentication and authorization
- **Environment Variables**: Don't commit sensitive configuration to version control

## Support

If you encounter issues with server configuration:

1. Check the server status indicators
2. Verify network connectivity
3. Review the browser console for error messages
4. Check the application logs for detailed error information
