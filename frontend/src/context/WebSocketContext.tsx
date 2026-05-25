import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  connected: boolean;
  sendJson: (data: any) => void;
  subscribe: (type: string, callback: (payload: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, logout } = useAuth();
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<{ [type: string]: Array<(payload: any) => void> }>({});
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = () => {
    if (!token) return;

    // Determine WebSocket URL based on protocol and hostname
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // In local development, Vite proxies '/ws' requests, but we can also connect directly to the host
    const wsUrl = `${protocol}//${host}/ws?token=${token}`;

    console.log(`Connecting to WebSocket: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected successfully');
      setConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type } = data;
        if (type && listenersRef.current[type]) {
          listenersRef.current[type].forEach((callback) => callback(data));
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setConnected(false);
      wsRef.current = null;

      // Invalidate if token is forbidden/unauthorized (4000 series custom code or general logic)
      if (event.code === 4001 || event.code === 4003) {
        console.warn('Authentication failed, logging out.');
        logout();
        return;
      }

      // Try reconnecting in 3 seconds if token is still present
      if (token) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  };

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [token]);

  const sendJson = (data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not open. Cannot send message:', data);
    }
  };

  const subscribe = (type: string, callback: (payload: any) => void) => {
    if (!listenersRef.current[type]) {
      listenersRef.current[type] = [];
    }
    listenersRef.current[type].push(callback);

    // Return unsubscribe function
    return () => {
      if (listenersRef.current[type]) {
        listenersRef.current[type] = listenersRef.current[type].filter((cb) => cb !== callback);
      }
    };
  };

  return (
    <WebSocketContext.Provider value={{ connected, sendJson, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
