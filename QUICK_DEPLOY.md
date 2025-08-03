# Quick Deployment Guide 🚀

## Overview
Deploy your decentralized video app in under 10 minutes using free hosting services.

## Prerequisites
- GitHub account
- Vercel account (free)
- Railway account (free) or Render account

## Step 1: Deploy Frontend to Vercel (2 minutes)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Vercel will auto-detect the build settings
   - Click "Deploy"
   - Your frontend will be live at `https://your-project.vercel.app`

## Step 2: Deploy Signaling Server to Railway (3 minutes)

1. **Go to Railway**
   - Visit [railway.app](https://railway.app)
   - Click "Start a New Project"
   - Choose "Deploy from GitHub repo"
   - Select your repository

2. **Configure Environment**
   - Railway will auto-detect Node.js
   - Set environment variables:
     ```
     NODE_ENV=production
     PORT=5001
     CORS_ORIGIN=https://your-project.vercel.app
     ```

3. **Deploy**
   - Railway will automatically deploy
   - Note your Railway URL (e.g., `https://your-app.railway.app`)

## Step 3: Update Frontend Configuration (2 minutes)

1. **Update Socket.io Connection**
   - Edit `/src/components/Room.jsx`
   - Change line 17 from:
     ```javascript
     const socket = io('http://localhost:5001', {
     ```
   - To:
     ```javascript
     const socket = io('https://your-app.railway.app', {
     ```

2. **Redeploy Frontend**
   ```bash
   git add .
   git commit -m "Update signaling server URL for production"
   git push origin main
   ```
   - Vercel will automatically redeploy

## Step 4: Test Your Deployment (2 minutes)

1. **Visit Your App**
   - Go to `https://your-project.vercel.app`
   - Create a test room
   - Test with multiple browser tabs/devices

2. **Verify Features**
   - ✅ Video/audio working
   - ✅ Chat functionality
   - ✅ Share button with correct URLs
   - ✅ Feedback modal after leaving calls

## Alternative: Deploy to Render (Backend)

If you prefer Render over Railway:

1. **Go to Render**
   - Visit [render.com](https://render.com)
   - Click "New Web Service"
   - Connect your GitHub repository

2. **Configure**
   - Build Command: `npm install`
   - Start Command: `node signaling-server.js`
   - Environment Variables:
     ```
     NODE_ENV=production
     CORS_ORIGIN=https://your-project.vercel.app
     ```

## Custom Domain (Optional)

### For Vercel:
1. Go to your project settings
2. Add your custom domain
3. Update CORS_ORIGIN in Railway/Render

### For Railway:
1. Go to your service settings
2. Add custom domain in the "Networking" tab

## Environment Variables Reference

### Frontend (.env)
```
VITE_APP_URL=https://your-domain.com
VITE_SIGNALING_SERVER=https://your-app.railway.app
```

### Backend
```
NODE_ENV=production
PORT=5001
CORS_ORIGIN=https://your-domain.vercel.app
```

## Monitoring Your App

### Basic Health Checks
- Frontend: Visit your Vercel URL
- Backend: Visit `https://your-app.railway.app/health` (if you add a health endpoint)

### User Feedback
- Check browser localStorage for feedback data
- Monitor Vercel Analytics for traffic patterns
- Use Railway/Render logs for server issues

## Scaling Considerations

### Free Tier Limits
- **Vercel**: Unlimited static deployments, 100GB bandwidth/month
- **Railway**: 500 hours/month, $5 credit
- **Render**: 750 hours/month for web services

### When to Upgrade
- More than 10 concurrent users regularly
- Need custom domain with SSL
- Want advanced analytics
- Require 24/7 uptime guarantees

## Security Checklist

- ✅ HTTPS enforced (automatic with Vercel/Railway)
- ✅ CORS properly configured
- ✅ No sensitive data in frontend code
- ✅ Environment variables used for configuration
- ✅ Security headers configured (via vercel.json)

## Troubleshooting

### Common Issues
1. **"Connection failed"**: Check signaling server URL in Room.jsx
2. **CORS errors**: Verify CORS_ORIGIN matches your frontend domain
3. **Build failures**: Ensure all dependencies in package.json
4. **WebRTC not working**: Usually works once deployed (vs localhost issues)

### Debug Steps
1. Check browser console for errors
2. Verify both services are running (green status)
3. Test with different browsers/devices
4. Check Railway/Render logs for server errors

## Success! 🎉

Your decentralized video app is now live and ready for users. Share your URL and start collecting feedback!

**Next Steps:**
1. Share with beta testers
2. Monitor user feedback in localStorage
3. Track usage patterns
4. Iterate based on user needs

**Your Live URLs:**
- Frontend: `https://your-project.vercel.app`
- Backend: `https://your-app.railway.app`
- Demo Room: `https://your-project.vercel.app/room/demo-room-123`