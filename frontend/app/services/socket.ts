"use client";

import { cryptoService, EncryptedMessage, CryptoData } from '@/services/crypto';

/**
 * Metadata for socket messages
 */
interface MessageMetadata {
    encrypted: boolean;
    sensitive: boolean;
}

/**
 * Base payload type for WebSocket messages
 */
export type WebSocketPayload = CryptoData;

/**
 * Socket message payload formats
 */
export type SocketMessagePayload = {
    [key: string]: CryptoData | undefined;
    type?: string;
    content?: string;
};

/**
 * Message type for WebSocket communication
 */
export type MessageData = SocketMessagePayload | WebSocketPayload;

/**
 * Standard message format for WebSocket communication
 */
interface WebSocketMessage {
    type?: string;
    content?: string;
    metadata?: MessageMetadata;
    payload?: WebSocketPayload | EncryptedMessage;
}

export class WebSocketService {
    private static instance: WebSocketService;
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 3;
    private readonly initialReconnectDelay = 1000;
    private reconnectTimeout = this.initialReconnectDelay;
    private messageHandlers: ((data: MessageData) => void)[] = [];
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
                        const chatMessage: SocketMessagePayload = {
                            type: 'chat',
                            content: data.content || ''
                        };
                        this.messageHandlers.forEach(handler => handler(chatMessage));
                        return;
                    }

                    // Handle encrypted messages
                    if (data.metadata?.encrypted && data.payload) {
                        try {
                            const decrypted = await cryptoService.decrypt<WebSocketPayload>(data.payload as EncryptedMessage);
                            this.messageHandlers.forEach(handler => handler(decrypted));
                        } catch (decryptError) {
                            console.error('🔥 Phoenix WebSocket: Failed to decrypt message', decryptError);
                        }
                        return;
                    }

                    // Handle regular messages
                    if (data.payload) {
                        // Ensure payload is a valid WebSocketPayload (CryptoData)
                        const payload = data.payload as WebSocketPayload;
                        this.messageHandlers.forEach(handler => handler(payload));
                    } else {
                        // Create a safe object from the message data
                        const safeData: SocketMessagePayload = {};
                        if (data.type) safeData.type = data.type;
                        if (data.content) safeData.content = data.content;
                        this.messageHandlers.forEach(handler => handler(safeData));
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

    /**
     * Sends a message through the WebSocket connection
     * @param data The data to send
     * @param sensitive Whether the data is sensitive and should be encrypted
     */
    public async send(data: MessageData, sensitive: boolean = false) {
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

            // Handle chat message type
            if (data !== null && typeof data === 'object' && 'type' in data && data.type === 'chat') {
                this.ws.send(JSON.stringify(data));
                return;
            }

            // Handle encrypted messages
            if (sensitive) {
                // Convert message to a compatible format for encryption
                const encryptableData: Record<string, CryptoData> = {};
                
                // If data is a plain object, convert to a safe format
                if (data !== null && typeof data === 'object') {
                    Object.entries(data).forEach(([key, value]) => {
                        // Only include defined values that are compatible with CryptoData
                        if (value !== undefined) {
                            encryptableData[key] = value as CryptoData;
                        }
                    });
                } else {
                    // For primitive types, wrap in an object
                    encryptableData.value = data as CryptoData;
                }
                
                const encrypted = await cryptoService.encrypt(encryptableData);
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

    /**
     * Registers a callback for incoming messages
     * @param handler Function to be called when a message is received
     * @returns Function to unsubscribe this handler
     */
    public onMessage(handler: (data: MessageData) => void) {
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