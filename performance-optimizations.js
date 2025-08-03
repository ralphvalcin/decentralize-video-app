// PRIORITY 1: React Rendering Optimizations for Room.jsx

import { useCallback, useMemo, useRef } from 'react';

// 1. Memoized peer filtering and stream management
const usePeerOptimization = (peers, stream) => {
  const peersMapRef = useRef(new Map());
  
  const memoizedPeers = useMemo(() => {
    return peers.filter(peer => peer && peer.stream);
  }, [peers]);
  
  const updatePeerStream = useCallback((peerId, peerStream) => {
    peersMapRef.current.set(peerId, peerStream);
    // Batch peer updates to prevent cascade re-renders
    return new Promise(resolve => {
      setTimeout(() => {
        setPeers(prevPeers => {
          const peerIndex = prevPeers.findIndex(p => p.peerID === peerId);
          if (peerIndex >= 0) {
            const updatedPeers = [...prevPeers];
            updatedPeers[peerIndex] = {
              ...updatedPeers[peerIndex],
              stream: peerStream
            };
            return updatedPeers;
          }
          return prevPeers;
        });
        resolve();
      }, 0);
    });
  }, []);
  
  return { memoizedPeers, updatePeerStream };
};

// 2. Optimized connection monitoring with debouncing
const useConnectionMonitoring = (stream, peers) => {
  const monitoringRef = useRef(null);
  const lastCheckRef = useRef(Date.now());
  
  useEffect(() => {
    if (!stream) return;
    
    const monitor = () => {
      const now = Date.now();
      // Debounce monitoring to every 10 seconds instead of 5
      if (now - lastCheckRef.current < 10000) return;
      
      lastCheckRef.current = now;
      
      // Batch stats collection
      const statsPromises = Array.from(peersRef.current.values()).map(async ({ peer }) => {
        try {
          const stats = await peer.getStats();
          return { peer, stats };
        } catch (err) {
          return { peer, stats: null };
        }
      });
      
      Promise.allSettled(statsPromises).then(results => {
        const poorConnections = results
          .filter(result => result.status === 'fulfilled' && result.value.stats)
          .filter(({ stats }) => stats.bandwidth < 100000);
          
        if (poorConnections.length > 0) {
          toast.warning(`Poor connection detected for ${poorConnections.length} participant(s)`);
        }
      });
    };
    
    monitoringRef.current = setInterval(monitor, 10000);
    
    return () => {
      if (monitoringRef.current) {
        clearInterval(monitoringRef.current);
        monitoringRef.current = null;
      }
    };
  }, [stream, peers.length]); // Only re-run when essential deps change
};

// 3. Memoized socket event handlers
const useSocketHandlers = (socket, mediaStream, userInfo, roomId) => {
  const handleAllUsers = useCallback((users) => {
    console.log('Received all-users:', users);
    const peers = [];
    
    // Batch peer creation
    const peerCreationPromises = users.map(async (user) => {
      if (!peersRef.current.has(user.id)) {
        try {
          const peer = await createPeerOptimized(user.id, socket.id, mediaStream);
          return {
            peerID: user.id,
            peer,
            name: user.name,
            role: user.role,
            signaled: false
          };
        } catch (err) {
          console.error('Error creating peer:', err);
          return null;
        }
      }
      return null;
    });
    
    Promise.allSettled(peerCreationPromises).then(results => {
      const validPeers = results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);
        
      validPeers.forEach(peerData => {
        peersRef.current.set(peerData.peerID, peerData);
        peers.push(peerData);
      });
      
      // Single state update
      setPeers(Array.from(peersRef.current.values()));
      setConnectionStatus('connected');
      
      if (peers.length > 0) {
        toast.success(`Connected to ${peers.length} participant(s)`);
      }
    });
  }, [socket.id, mediaStream, roomId]);
  
  return { handleAllUsers };
};

// 4. Optimized peer creation with connection pooling
async function createPeerOptimized(userToSignal, callerID, stream) {
  const peer = new Peer({
    initiator: true,
    trickle: false,
    stream: stream,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        // Add more STUN servers for better connectivity
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      // Enable better connectivity
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    }
  });

  // Optimize stream handling with debouncing
  let streamUpdateTimeout;
  peer.on('stream', peerStream => {
    clearTimeout(streamUpdateTimeout);
    streamUpdateTimeout = setTimeout(() => {
      updatePeerStream(callerID, peerStream);
    }, 100); // Debounce stream updates
  });

  return peer;
}

export { usePeerOptimization, useConnectionMonitoring, useSocketHandlers, createPeerOptimized };