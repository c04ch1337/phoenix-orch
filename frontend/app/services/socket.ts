"use client";

import { cryptoService, EncryptedMessage } from '@/services/crypto';

interface MessageMetadata {
    encrypted: boolean;
    sensitive: boolean;
}

interface WebSocketMessage {
    type?: string;
    content?: string;
    metadata?: MessageMetadata;
    payload?: any | EncryptedMessage;
}

export class WebSocketService {
    private static instance: WebSocketService;
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 3;
    private readonly initialReconnectDelay = 1000;
    private reconnectTimeout = this.initialReconnectDelay;
    private messageHandlers: ((data: any) => void)[] = [];
    private statusHandlers: ((status: boolean) => void)[] = [];

    private constructor() {}

    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    public connect() {
        if (this.ws?.readyState === WebSocket.OPEN) return;
        
        if (typeof WebSocket === 'undefined') {
            console.warn('🔥 Phoenix WebSocket: WebSocket not supported in this environment');
            return;
        }

        try {
            // Use relative path for WebSocket - will be handled by Vite proxy
            this.ws = new WebSocket('ws://localhost:5001/ws/dad');

            this.ws.onopen = () => {
                console.log('🔥 Phoenix WebSocket: Connected');
                this.reconnectAttempts = 0;
                this.reconnectTimeout = this.initialReconnectDelay;
                this.notifyStatusHandlers(true);
            };

            this.ws.onmessage = async (event) => {
                try {
                    let data: WebSocketMessage;
                    
                    try {
                        data = JSON.parse(event.data);
                    } catch (parseError) {
                        console.error('🔥 Phoenix WebSocket: Failed to parse message', parseError);
                        return;
                    }

                    // Handle messages from mock server format
                    if (data.type && (data.content || data.type === 'typing')) {
                        this.messageHandlers.forEach(handler => handler(data));
                        return;
                    }

                    // Handle encrypted messages
                    if (data.metadata?.encrypted && data.payload) {
                        try {
                            const decrypted = await cryptoService.decrypt(data.payload as EncryptedMessage);
                            this.messageHandlers.forEach(handler => handler(decrypted));
                        } catch (decryptError) {
                            console.error('🔥 Phoenix WebSocket: Failed to decrypt message', decryptError);
                        }
                        return;
                    }

                    // Handle regular messages
                    if (data.payload) {
                        this.messageHandlers.forEach(handler => handler(data.payload));
                    } else {
                        this.messageHandlers.forEach(handler => handler(data));
                    }
                } catch (error) {
                    console.error('🔥 Phoenix WebSocket: Error processing message', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log('🔥 Phoenix WebSocket: Disconnected', event.code, event.reason);
                this.ws = null;
                this.notifyStatusHandlers(false);
                
                if (event.code !== 1000) {
                    this.attemptReconnect();
                }
            };

            this.ws.onerror = (error) => {
                console.error('🔥 Phoenix WebSocket: Error', error);
            };
        } catch (error) {
            console.error('🔥 Phoenix WebSocket: Failed to create connection', error);
            this.notifyStatusHandlers(false);
            setTimeout(() => this.attemptReconnect(), this.reconnectTimeout);
        }
    }

    private attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.warn('🔥 Phoenix WebSocket: Max reconnection attempts reached');
            return;
        }

        setTimeout(() => {
            console.log(`🔥 Phoenix WebSocket: Attempting reconnect ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);
            this.reconnectAttempts++;
            this.reconnectTimeout = Math.min(
                this.reconnectTimeout * 2,
                10000 // Max delay of 10 seconds
            );
            this.connect();
        }, this.reconnectTimeout);
    }

    public async send(data: any, sensitive: boolean = false) {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            console.error('🔥 Phoenix WebSocket: Cannot send message - connection not open');
            return;
        }

        try {
            // Format message according to mock server expectations
            if (typeof data === 'string') {
                this.ws.send(JSON.stringify({
                    type: 'chat',
                    content: data
                }));
                return;
            }

            if (data.type) {
                this.ws.send(JSON.stringify(data));
                return;
            }

            // Handle encrypted messages
            if (sensitive) {
                const encrypted = await cryptoService.encrypt(data);
                const message: WebSocketMessage = {
                    metadata: {
                        encrypted: true,
                        sensitive: true
                    },
                    payload: encrypted
                };
                this.ws.send(JSON.stringify(message));
                return;
            }

            // Handle regular messages
            this.ws.send(JSON.stringify({
                metadata: {
                    encrypted: false,
                    sensitive: false
                },
                payload: data
            }));
        } catch (error) {
            console.error('🔥 Phoenix WebSocket: Failed to send message', error);
        }
    }

    public onMessage(handler: (data: any) => void) {
        this.messageHandlers.push(handler);
        return () => {
            this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
        };
    }

    public onStatusChange(handler: (status: boolean) => void) {
        this.statusHandlers.push(handler);
        return () => {
            this.statusHandlers = this.statusHandlers.filter(h => h !== handler);
        };
    }

    private notifyStatusHandlers(status: boolean) {
        this.statusHandlers.forEach(handler => handler(status));
    }

    public disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Manual disconnect');
            this.ws = null;
            this.reconnectAttempts = 0;
            this.reconnectTimeout = this.initialReconnectDelay;
        }
    }

    public isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

export const socket = WebSocketService.getInstance();