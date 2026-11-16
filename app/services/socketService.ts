import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      console.log('⚡ [App Socket] Connected:', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('⚡ [App Socket] Disconnected:', reason);
    });

    socketInstance.on('connect_error', (err) => {
      console.log('⚡ [App Socket] Connection Error:', err.message);
    });
  }
  return socketInstance;
}

export const socket = getSocket();
