/**
 * TURNCredentialService — Time-based TURN credential generation.
 *
 * Generates HMAC-SHA1 credentials for coturn-style TURN servers.
 * Supports optional Twilio Network Traversal Service as a managed alternative.
 */

import crypto from 'crypto';

export class TURNCredentialService {
  constructor({ twilio = null } = {}) {
    this.twilio = twilio;
    this.cache = new Map();
    this.CACHE_TTL = 23 * 60 * 60 * 1000; // 23 hours (credentials valid for 24h)
  }

  /**
   * Generate time-limited TURN credentials for a given user.
   * Returns an object with a `servers` array conforming to the WebRTC RTCConfiguration format.
   */
  async getTURNCredentials(userId) {
    const primaryUrl = process.env.TURN_SERVER_URL;
    const primarySecret = process.env.TURN_SECRET;
    const secondaryUrl = process.env.TURN_SERVER_URL_2;
    const secondarySecret = process.env.TURN_SECRET_2;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;

    // If Twilio is configured, prefer managed TURN
    if (twilioSid && twilioToken) {
      return this._getTwilioCredentials(twilioSid, twilioToken);
    }

    // Self-hosted coturn servers
    const servers = [];

    if (primaryUrl && primarySecret) {
      servers.push(this._buildServerConfig(primaryUrl, primarySecret, userId));
    }

    if (secondaryUrl && secondarySecret) {
      servers.push(this._buildServerConfig(secondaryUrl, secondarySecret, userId));
    }

    if (servers.length === 0) {
      return null;
    }

    return { servers };
  }

  _buildServerConfig(url, secret, userId) {
    // coturn shared-secret format: username = timestamp + 86400 (1 day TTL)
    // credential = HMAC-SHA1(secret, username)
    const ttl = 86400;
    const timestamp = Math.floor(Date.now() / 1000) + ttl;
    const username = `${timestamp}`;
    const credential = crypto
      .createHmac('sha1', secret)
      .update(username)
      .digest('base64');

    return {
      urls: url,
      username,
      credential,
    };
  }

  async _getTwilioCredentials(accountSid, authToken) {
    const cacheKey = `twilio-${accountSid}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL) {
      return { servers: cached.servers };
    }

    try {
      const response = await fetch(
        `https://nls.twilio.com/v1/Tokens`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.status}`);
      }

      const data = await response.json();
      const iceServers = data.ice_servers || [];
      const servers = iceServers.map(s => ({
        urls: s.url,
        username: s.username || undefined,
        credential: s.credential || undefined,
      })).filter(s => s.urls);

      this.cache.set(cacheKey, { servers, fetchedAt: Date.now() });
      return { servers };
    } catch (err) {
      console.warn('[TURN] Twilio credential fetch failed, falling back to STUN only:', err.message);
      return null;
    }
  }
}
