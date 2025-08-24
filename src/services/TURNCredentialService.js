/**
 * TURN Credential Service
 * Handles generation and management of TURN server credentials
 */

import crypto from 'crypto';

export class TURNCredentialService {
  constructor(config = {}) {
    this.turnServers = config.turnServers || [];
    this.credentialCache = new Map();
    this.cacheTTL = config.cacheTTL || 3600000; // 1 hour default
    this.twilioConfig = config.twilio || null;
    
    // Start credential refresh timer
    this.startCredentialRefresh();
  }

  /**
   * Generate time-based TURN credentials using the REST API approach
   * @param {string} secret - TURN server secret
   * @param {number} ttl - Time to live in seconds (default: 24 hours)
   * @returns {Object} - { username, password }
   */
  generateTURNCredentials(secret, ttl = 86400) {
    const unixTimeStamp = Math.floor(Date.now() / 1000) + ttl;
    const username = unixTimeStamp.toString();
    
    // Create HMAC-SHA1 hash for the password
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(username);
    const password = hmac.digest('base64');
    
    return { username, password, expires: unixTimeStamp * 1000 };
  }

  /**
   * Get TURN credentials for all configured servers
   * @param {string} userId - User identifier for logging
   * @returns {Object} - TURN configuration object
   */
  async getTURNCredentials(userId = 'anonymous') {
    const cacheKey = `turn-credentials-${userId}`;
    const cached = this.credentialCache.get(cacheKey);
    
    // Return cached credentials if still valid
    if (cached && Date.now() < cached.expires - 300000) { // Refresh 5 minutes before expiry
      return cached.config;
    }

    const turnConfig = {
      servers: [],
      iceTransportPolicy: 'all',
      generated: Date.now()
    };

    try {
      // Generate credentials for configured TURN servers
      if (process.env.TURN_SERVER_URL && process.env.TURN_SECRET) {
        const credentials = this.generateTURNCredentials(process.env.TURN_SECRET);
        turnConfig.servers.push({
          urls: [
            `turn:${process.env.TURN_SERVER_URL}:3478?transport=udp`,
            `turn:${process.env.TURN_SERVER_URL}:3478?transport=tcp`,
            `turns:${process.env.TURN_SERVER_URL}:5349?transport=tcp`
          ],
          username: credentials.username,
          credential: credentials.password,
          credentialType: 'password'
        });
      }

      // Add secondary TURN server if configured
      if (process.env.TURN_SERVER_URL_2 && process.env.TURN_SECRET_2) {
        const credentials = this.generateTURNCredentials(process.env.TURN_SECRET_2);
        turnConfig.servers.push({
          urls: [
            `turn:${process.env.TURN_SERVER_URL_2}:3478?transport=udp`,
            `turn:${process.env.TURN_SERVER_URL_2}:3478?transport=tcp`,
            `turns:${process.env.TURN_SERVER_URL_2}:5349?transport=tcp`
          ],
          username: credentials.username,
          credential: credentials.password,
          credentialType: 'password'
        });
      }

      // Add Twilio TURN servers if configured
      if (this.twilioConfig) {
        const twilioTurnServers = await this.getTwilioTURNServers();
        turnConfig.servers.push(...twilioTurnServers);
      }

      // Cache the configuration
      if (turnConfig.servers.length > 0) {
        const expires = Math.min(...turnConfig.servers.map(s => s.expires || Date.now() + 86400000));
        this.credentialCache.set(cacheKey, {
          config: turnConfig,
          expires: expires
        });
      }

      return turnConfig;
    } catch (error) {
      console.error('Error generating TURN credentials:', error);
      throw new Error(`TURN credential generation failed: ${error.message}`);
    }
  }

  /**
   * Get Twilio TURN server credentials
   * @returns {Array} - Array of Twilio TURN server configurations
   */
  async getTwilioTURNServers() {
    if (!this.twilioConfig?.accountSid || !this.twilioConfig?.authToken) {
      return [];
    }

    try {
      // In a real implementation, you would call Twilio's API
      // This is a placeholder implementation
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.twilioConfig.accountSid}/Tokens.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.twilioConfig.accountSid}:${this.twilioConfig.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.status}`);
      }

      const data = await response.json();
      
      return data.ice_servers?.filter(server => 
        server.urls.some(url => url.includes('turn:'))
      ) || [];
    } catch (error) {
      console.error('Error fetching Twilio TURN servers:', error);
      return [];
    }
  }

  /**
   * Validate TURN server configuration
   * @param {Object} config - TURN configuration to validate
   * @returns {Object} - Validation result
   */
  validateTURNConfig(config) {
    if (!config || !Array.isArray(config.servers)) {
      return { isValid: false, error: 'Invalid TURN config structure' };
    }

    if (config.servers.length === 0) {
      return { isValid: false, error: 'No TURN servers configured' };
    }

    for (const server of config.servers) {
      if (!server.urls || (!Array.isArray(server.urls) && typeof server.urls !== 'string')) {
        return { isValid: false, error: 'TURN server missing URLs' };
      }
      
      if (!server.username || !server.credential) {
        return { isValid: false, error: 'TURN server missing credentials' };
      }

      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      for (const url of urls) {
        if (!this.isValidTURNUrl(url)) {
          return { isValid: false, error: `Invalid TURN URL: ${url}` };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Check if a URL is a valid TURN server URL
   * @param {string} url - URL to validate
   * @returns {boolean} - True if valid TURN URL
   */
  isValidTURNUrl(url) {
    const turnUrlRegex = /^turns?:[^:\/\s]+:\d+(\?transport=(udp|tcp))?$/;
    return turnUrlRegex.test(url);
  }

  /**
   * Start periodic credential refresh
   */
  startCredentialRefresh() {
    // Refresh credentials every 30 minutes
    setInterval(() => {
      this.refreshExpiredCredentials();
    }, 30 * 60 * 1000);
  }

  /**
   * Refresh expired credentials in cache
   */
  refreshExpiredCredentials() {
    const now = Date.now();
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [key, value] of this.credentialCache.entries()) {
      if (now >= value.expires - refreshThreshold) {
        // Remove expired credentials - they'll be regenerated on next request
        this.credentialCache.delete(key);
      }
    }
  }

  /**
   * Get service statistics
   * @returns {Object} - Service statistics
   */
  getStats() {
    const totalServers = (process.env.TURN_SERVER_URL ? 1 : 0) + 
                        (process.env.TURN_SERVER_URL_2 ? 1 : 0) +
                        (this.twilioConfig ? 1 : 0);

    return {
      configuredServers: totalServers,
      cachedCredentials: this.credentialCache.size,
      twilioEnabled: !!this.twilioConfig,
      lastGenerated: Math.max(...Array.from(this.credentialCache.values()).map(v => v.config.generated || 0))
    };
  }

  /**
   * Clear credential cache
   */
  clearCache() {
    this.credentialCache.clear();
  }
}

export default TURNCredentialService;