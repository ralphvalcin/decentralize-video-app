# 🚂 Railway Backend Deployment Guide

## Quick Setup (5 minutes)

### Step 1: Create Railway Account & Deploy
1. Visit [railway.app](https://railway.app) 
2. Click "Start a new project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account
5. Select this repository: `decentralized-video-app`

### Step 2: Configure Deployment
In Railway dashboard:
1. **Service Name**: `signaling-server`
2. **Root Directory**: Leave empty (uses project root)
3. **Start Command**: `node signaling-server.js`
4. **Port**: Railway will auto-assign (uses `$PORT`)

### Step 3: Set Environment Variables
Add these in Railway → Settings → Variables:
```
NODE_ENV=production
PORT=$PORT
FRONTEND_URL=https://decentralized-video-nvf0257p1-ralph-s-projects-676f1f6e.vercel.app
JWT_SECRET=your-secure-jwt-secret-here
```

### Step 4: Deploy
1. Click "Deploy" 
2. Wait for build to complete (~2-3 minutes)
3. Railway will provide your WebSocket URL

## Alternative: CLI Method (if you can login manually)

```bash
# Open browser login
railway login

# Initialize project
railway init

# Deploy
railway up

# Set environment variables
railway variables set NODE_ENV=production
railway variables set FRONTEND_URL=https://decentralized-video-nvf0257p1-ralph-s-projects-676f1f6e.vercel.app
railway variables set JWT_SECRET=$(openssl rand -hex 32)
```

## Expected Results

After deployment, you'll get:
- **Backend URL**: `https://your-project-name.railway.app`
- **WebSocket URL**: `wss://your-project-name.railway.app`
- **Health Check**: `https://your-project-name.railway.app/health`

## Next Step: Update Frontend

Once Railway gives you the WebSocket URL, update the frontend:
```bash
# Update environment variable
VITE_SIGNALING_SERVER_URL=wss://your-project-name.railway.app
```

## Testing
Your signaling server should respond:
- `/health` → `{"status":"ok","uptime":123}`
- WebSocket connections for room functionality

---
**Railway deployment typically takes 3-5 minutes total! 🚂**