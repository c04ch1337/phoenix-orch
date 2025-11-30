"use client";

import { config } from '@/config';

export interface EncryptedMessage {
    iv: string;
    data: string;
}

class CryptoService {
    private static instance: CryptoService;
    private key: CryptoKey | null = null;

    private constructor() {}

    public static getInstance(): CryptoService {
        if (!CryptoService.instance) {
            CryptoService.instance = new CryptoService();
        }
        return CryptoService.instance;
    }

    private async getKey(): Promise<CryptoKey> {
        if (!this.key) {
            // Generate a random key for this session
            const keyBytes = new Uint8Array(config.crypto.keyLength / 8);
            crypto.getRandomValues(keyBytes);
            
            this.key = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: config.crypto.algorithm },
                false,
                ['encrypt', 'decrypt']
            );
        }
        return this.key;
    }

    public async encrypt(data: any): Promise<EncryptedMessage> {
        const key = await this.getKey();
        const iv = crypto.getRandomValues(new Uint8Array(config.crypto.ivLength));
        
        const encoded = new TextEncoder().encode(JSON.stringify(data));
        const encrypted = await crypto.subtle.encrypt(
            {
                name: config.crypto.algorithm,
                iv
            },
            key,
            encoded
        );

        return {
            iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
            data: Array.from(new Uint8Array(encrypted))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
        };
    }

    public async decrypt(message: EncryptedMessage): Promise<any> {
        const key = await this.getKey();
        
        const iv = new Uint8Array(message.iv.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
        const data = new Uint8Array(message.data.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
        
        const decrypted = await crypto.subtle.decrypt(
            {
                name: config.crypto.algorithm,
                iv
            },
            key,
            data
        );

        return JSON.parse(new TextDecoder().decode(decrypted));
    }
}

export const cryptoService = CryptoService.getInstance();