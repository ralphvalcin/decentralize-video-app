# TURN Server Configuration Guide

This guide explains how to configure TURN (Traversal Using Relays around NAT) servers with authentication for secure WebRTC connections in production environments.

## Overview

TURN servers are essential for WebRTC applications in production as they provide a relay mechanism when direct peer-to-peer connections are blocked by firewalls or NAT devices. This implementation uses time-based authentication tokens for enhanced security.

## Features

- ✅ Time-based credential generation (HMAC-SHA1)
- ✅ Multiple TURN server support with failover
- ✅ Twilio TURN integration (optional)
- ✅ Automatic credential refresh
- ✅ Rate limiting for credential requests
- ✅ Security event logging
- ✅ Configuration validation
- ✅ Comprehensive test suite

## Environment Configuration

### Required Environment Variables

```bash
# Basic Configuration
NODE_ENV=production
JWT_SECRET=your-jwt-secret-key-minimum-32-chars

# TURN Server Configuration
TURN_SERVER_URL=turn-server.yourdomain.com
TURN_SECRET=your-turn-server-secret-key-minimum-32-chars
```

### Optional Environment Variables

```bash
# Secondary TURN Server (for redundancy)
TURN_SERVER_URL_2=turn-backup.yourdomain.com
TURN_SECRET_2=your-backup-turn-server-secret-key

# Twilio TURN Configuration (alternative to self-hosted)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
```

## Self-Hosted TURN Server Setup

### Option 1: Using Coturn (Recommended)

1. **Install Coturn**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install coturn
   
   # CentOS/RHEL
   sudo yum install coturn
   
   # macOS
   brew install coturn
   ```

2. **Configure Coturn** (`/etc/turnserver.conf`)
   ```bash
   # Basic configuration
   listening-port=3478
   tls-listening-port=5349
   listening-ip=0.0.0.0
   
   # Authentication
   use-auth-secret
   static-auth-secret=your-turn-server-secret-key-minimum-32-chars
   
   # SSL/TLS (recommended for production)
   cert=/path/to/your/certificate.pem
   pkey=/path/to/your/private-key.pem
   
   # Relay configuration
   min-port=49152
   max-port=65535
   
   # Security settings
   no-multicast-peers
   no-cli
   no-loopback-peers
   no-tcp-relay
   
   # Logging
   log-file=/var/log/turnserver.log
   verbose
   ```

3. **Enable and Start Coturn**
   ```bash
   sudo systemctl enable coturn
   sudo systemctl start coturn
   sudo systemctl status coturn
   ```

4. **Firewall Configuration**
   ```bash
   # Allow TURN ports
   sudo ufw allow 3478/tcp
   sudo ufw allow 3478/udp
   sudo ufw allow 5349/tcp
   sudo ufw allow 49152:65535/udp
   ```

### Option 2: Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  coturn:
    image: coturn/coturn:latest
    ports:
      - "3478:3478/tcp"
      - "3478:3478/udp"
      - "5349:5349/tcp"
      - "49152-65535:49152-65535/udp"
    volumes:
      - ./coturn.conf:/etc/coturn/turnserver.conf
      - ./certs:/etc/coturn/certs
    restart: unless-stopped
    command: ["-c", "/etc/coturn/turnserver.conf"]
```

## Twilio TURN Configuration

### Setup Steps

1. **Create Twilio Account**
   - Sign up at [Twilio Console](https://console.twilio.com/)
   - Get your Account SID and Auth Token

2. **Environment Variables**
   ```bash
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   ```

3. **API Integration**
   The application will automatically fetch TURN credentials from Twilio's API when configured.

## Testing Configuration

### Run Test Suite

```bash
# Test TURN configuration
npm run test:turn
```

### Manual Testing

```javascript
// Test TURN connectivity
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:your-server.com:3478',
      username: 'generated-username',
      credential: 'generated-password'
    }
  ]
});

// Check connection state
pc.onconnectionstatechange = () => {
  console.log('Connection state:', pc.connectionState);
};
```

## Security Considerations

### Authentication

- **Time-based credentials**: Automatically expire after 24 hours
- **HMAC-SHA1 signing**: Prevents credential forgery
- **Rate limiting**: Prevents credential request abuse
- **Unique usernames**: Timestamp-based to prevent replay attacks

### Network Security

- **TLS encryption**: Use TURNS (TURN over TLS) for encrypted relay
- **Firewall rules**: Restrict access to known client IPs when possible
- **Port management**: Use specific port ranges for media relay

### Monitoring

```javascript
// Security event logging
SecurityLogger.logSecurityEvent('TURN_CREDENTIALS_REQUESTED', userId, {
  userAgent: request.userAgent,
  ip: request.ip,
  timestamp: Date.now()
});
```

## Production Deployment

### High Availability Setup

1. **Multiple TURN Servers**
   ```bash
   TURN_SERVER_URL=turn1.yourdomain.com
   TURN_SECRET=secret1
   TURN_SERVER_URL_2=turn2.yourdomain.com
   TURN_SECRET_2=secret2
   ```

2. **Load Balancing**
   - Use DNS round-robin for TURN server distribution
   - Configure health checks for TURN server availability
   - Implement automatic failover logic

3. **Monitoring & Alerts**
   - Monitor TURN server CPU/memory usage
   - Track connection success rates
   - Set up alerts for server failures
   - Log authentication request patterns

### Performance Tuning

```bash
# Coturn performance settings
total-quota=100
user-quota=50
max-bps=1000000
bps-capacity=0
```

## Troubleshooting

### Common Issues

1. **Connection Failures**
   ```bash
   # Check TURN server logs
   sudo tail -f /var/log/turnserver.log
   
   # Test server connectivity
   turnutils_uclient -t -u username -w password your-server.com
   ```

2. **Authentication Errors**
   - Verify secret key matches between app and TURN server
   - Check credential expiration time
   - Validate HMAC generation

3. **Firewall Issues**
   - Ensure UDP ports 49152-65535 are open
   - Check for symmetric NAT traversal issues
   - Verify STUN/TURN server accessibility

### Debug Commands

```bash
# Test TURN server
turnutils_uclient -v -t -u username -w password turn-server.com

# Check port connectivity
telnet turn-server.com 3478

# Verify SSL certificate
openssl s_client -connect turn-server.com:5349
```

## API Reference

### TURN Credential Service

```javascript
import { TURNCredentialService } from './src/services/TURNCredentialService.js';

const turnService = new TURNCredentialService({
  twilio: {
    accountSid: 'ACxxxx',
    authToken: 'token'
  }
});

// Get credentials
const config = await turnService.getTURNCredentials('user-id');
```

### Security Utils

```javascript
import { 
  getSecureWebRTCConfig, 
  generateTURNCredentials,
  validateTURNConfig 
} from './src/utils/security.js';

// Generate credentials
const creds = generateTURNCredentials('secret', 86400);

// Create WebRTC config
const config = getSecureWebRTCConfig(turnConfig);

// Validate configuration
const validation = validateTURNConfig(config);
```

## Cost Considerations

### Self-Hosted vs. Twilio

**Self-Hosted TURN Server:**
- ✅ Lower cost for high volume
- ✅ Full control over configuration
- ❌ Requires infrastructure management
- ❌ Need to handle scaling

**Twilio TURN:**
- ✅ No infrastructure management
- ✅ Global availability
- ✅ Automatic scaling
- ❌ Higher cost per GB
- ❌ Less configuration control

### Cost Optimization

1. **Prefer STUN when possible**: TURN is only needed when STUN fails
2. **Set appropriate relay timeouts**: Prevent indefinite connections
3. **Monitor data usage**: Track relay traffic costs
4. **Use UDP over TCP**: More efficient for media streaming

## Support

For issues or questions:
1. Check the test results: `npm run test:turn`
2. Review server logs for authentication errors
3. Verify network connectivity and firewall rules
4. Consult Twilio documentation for API-related issues

---

**Note**: Always use secure credentials in production and rotate them regularly for enhanced security.