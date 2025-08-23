// Vercel API Function for Analytics Collection
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, events, metadata } = req.body;

    // Validate request
    if (!sessionId || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Invalid request format' });
    }

    // Process events
    const processedEvents = events.map(event => ({
      ...event,
      serverTimestamp: new Date().toISOString(),
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer
    }));

    // Here you would typically:
    // 1. Store events in a database (MongoDB, PostgreSQL, etc.)
    // 2. Send to analytics service (Google Analytics, Mixpanel, etc.)
    // 3. Process for real-time dashboards

    // Example: Log to console (replace with actual analytics service)
    console.log(`[Analytics] Received ${processedEvents.length} events from session ${sessionId}`);
    
    // Example: Send to external analytics service
    await Promise.all([
      // sendToMixpanel(processedEvents),
      // sendToGoogleAnalytics(processedEvents),
      storeInDatabase(processedEvents)
    ]);

    res.status(200).json({ 
      success: true, 
      processed: processedEvents.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Analytics] Error processing events:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Example database storage function
async function storeInDatabase(events) {
  // This is a placeholder - implement with your preferred database
  // Examples:
  // - Supabase
  // - PlanetScale
  // - MongoDB Atlas
  // - PostgreSQL
  
  if (process.env.ANALYTICS_DB_URL) {
    // Example with a hypothetical database client
    try {
      // await db.collection('analytics_events').insertMany(events);
      console.log(`[Analytics] Stored ${events.length} events in database`);
    } catch (error) {
      console.error('[Analytics] Database storage failed:', error);
    }
  }
}

// Example: Send to Mixpanel
async function sendToMixpanel(events) {
  if (!process.env.MIXPANEL_TOKEN) return;

  try {
    const mixpanelEvents = events.map(event => ({
      event: event.eventName,
      properties: {
        ...event.properties,
        time: Math.floor(new Date(event.properties.timestamp).getTime() / 1000),
        distinct_id: event.sessionId,
        $insert_id: event.id
      }
    }));

    const response = await fetch('https://api.mixpanel.com/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: process.env.MIXPANEL_TOKEN,
        data: Buffer.from(JSON.stringify(mixpanelEvents)).toString('base64')
      })
    });

    if (response.ok) {
      console.log(`[Analytics] Sent ${events.length} events to Mixpanel`);
    }
  } catch (error) {
    console.error('[Analytics] Mixpanel integration failed:', error);
  }
}

// Example: Send to Google Analytics 4
async function sendToGoogleAnalytics(events) {
  if (!process.env.GA4_MEASUREMENT_ID || !process.env.GA4_API_SECRET) return;

  try {
    const gaEvents = events.map(event => ({
      name: event.eventName.replace(/[^a-zA-Z0-9_]/g, '_'),
      params: {
        ...event.properties,
        session_id: event.sessionId,
        timestamp_micros: event.properties.timestamp * 1000
      }
    }));

    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA4_MEASUREMENT_ID}&api_secret=${process.env.GA4_API_SECRET}`,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: events[0]?.sessionId,
          events: gaEvents
        })
      }
    );

    if (response.ok) {
      console.log(`[Analytics] Sent ${events.length} events to Google Analytics`);
    }
  } catch (error) {
    console.error('[Analytics] Google Analytics integration failed:', error);
  }
}