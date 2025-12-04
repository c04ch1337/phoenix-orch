/**
 * Encryption Utilities
 * 
 * Provides encryption and decryption capabilities for securing sensitive data
 * within the Agentic SOC system. Supports symmetric and asymmetric encryption,
 * key management, and secure hashing functions.
 */

const crypto = require('crypto');

class EncryptionUtils {
    constructor() {
        this.config = {
            algorithms: {
                symmetric: 'aes-256-gcm',
                asymmetric: 'rsa',
                hash: 'sha256',
                hmac: 'sha256'
            },
            keyLengths: {
                aes: 32, // 256 bits
                iv: 16,  // 128 bits
                rsa: 2048
            }
        };
    }
    
    /**
     * Encrypt data using symmetric encryption (AES-GCM)
     * @param {string|Buffer} data Data to encrypt
     * @param {Buffer|string} key Encryption key
     * @param {object} options Encryption options
     * @returns {object} Encrypted data with IV and auth tag
     */
    encryptSymmetric(data, key, options = {}) {
        // Ensure key is buffer of correct length
        const keyBuffer = this._ensureBuffer(key, this.config.keyLengths.aes);
        
        // Generate random IV
        const iv = options.iv || crypto.randomBytes(this.config.keyLengths.iv);
        
        // Create cipher
        const cipher = crypto.createCipheriv(
            this.config.algorithms.symmetric, 
            keyBuffer, 
            iv
        );
        
        // Encrypt data
        let encrypted = cipher.update(data, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        // Get authentication tag
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted: encrypted,
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64')
        };
    }
    
    /**
     * Decrypt data using symmetric encryption (AES-GCM)
     * @param {string} encryptedData Encrypted data (base64)
     * @param {Buffer|string} key Encryption key
     * @param {string} iv Initialization vector (base64)
     * @param {string} authTag Authentication tag (base64)
     * @param {object} options Decryption options
     * @returns {string} Decrypted data
     */
    decryptSymmetric(encryptedData, key, iv, authTag, options = {}) {
        // Ensure key is buffer of correct length
        const keyBuffer = this._ensureBuffer(key, this.config.keyLengths.aes);
        
        // Convert IV and auth tag from base64
        const ivBuffer = Buffer.from(iv, 'base64');
        const authTagBuffer = Buffer.from(authTag, 'base64');
        
        // Create decipher
        const decipher = crypto.createDecipheriv(
            this.config.algorithms.symmetric, 
            keyBuffer, 
            ivBuffer
        );
        
        // Set auth tag
        decipher.setAuthTag(authTagBuffer);
        
        // Decrypt data
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
    
    /**
     * Generate a random encryption key
     * @param {number} length Key length in bytes
     * @returns {Buffer} Random key
     */
    generateKey(length = this.config.keyLengths.aes) {
        return crypto.randomBytes(length);
    }
    
    /**
     * Generate an RSA key pair
     * @param {number} modulusLength Key length in bits
     * @returns {object} RSA key pair
     */
    generateKeyPair(modulusLength = this.config.keyLengths.rsa) {
        return crypto.generateKeyPairSync('rsa', {
            modulusLength,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
    }
    
    /**
     * Encrypt data using asymmetric encryption (RSA)
     * @param {string|Buffer} data Data to encrypt
     * @param {string} publicKey RSA public key (PEM format)
     * @returns {string} Encrypted data (base64)
     */
    encryptAsymmetric(data, publicKey) {
        // RSA can only encrypt limited data size, so typically used for keys
        const encryptedBuffer = crypto.publicEncrypt(
            {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
            },
            Buffer.isBuffer(data) ? data : Buffer.from(data)
        );
        
        return encryptedBuffer.toString('base64');
    }
    
    /**
     * Decrypt data using asymmetric encryption (RSA)
     * @param {string} encryptedData Encrypted data (base64)
     * @param {string} privateKey RSA private key (PEM format)
     * @returns {Buffer} Decrypted data
     */
    decryptAsymmetric(encryptedData, privateKey) {
        const encryptedBuffer = Buffer.from(encryptedData, 'base64');
        
        const decryptedBuffer = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
            },
            encryptedBuffer
        );
        
        return decryptedBuffer;
    }
    
    /**
     * Calculate a hash of data
     * @param {string|Buffer} data Data to hash
     * @param {string} algorithm Hash algorithm
     * @param {string} encoding Output encoding
     * @returns {string} Hash digest
     */
    hash(data, algorithm = this.config.algorithms.hash, encoding = 'hex') {
        return crypto
            .createHash(algorithm)
            .update(data)
            .digest(encoding);
    }
    
    /**
     * Calculate an HMAC of data
     * @param {string|Buffer} data Data to authenticate
     * @param {string|Buffer} key HMAC key
     * @param {string} algorithm HMAC algorithm
     * @param {string} encoding Output encoding
     * @returns {string} HMAC digest
     */
    hmac(data, key, algorithm = this.config.algorithms.hmac, encoding = 'hex') {
        return crypto
            .createHmac(algorithm, key)
            .update(data)
            .digest(encoding);
    }
    
    /**
     * Generate a random secure token
     * @param {number} byteLength Length in bytes
     * @returns {string} Random token (base64url)
     */
    generateToken(byteLength = 32) {
        return crypto
            .randomBytes(byteLength)
            .toString('base64url');
    }
    
    /**
     * Derive a key from a password
     * @param {string} password Password
     * @param {string} salt Salt (hex)
     * @param {number} iterations Number of iterations
     * @param {number} keyLength Key length in bytes
     * @returns {Promise<string>} Derived key (hex)
     */
    async deriveKeyFromPassword(password, salt, iterations = 100000, keyLength = 32) {
        return new Promise((resolve, reject) => {
            const saltBuffer = Buffer.from(salt, 'hex');
            
            crypto.pbkdf2(password, saltBuffer, iterations, keyLength, 'sha512', (err, derivedKey) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(derivedKey.toString('hex'));
                }
            });
        });
    }
    
    /**
     * Generate a random salt
     * @param {number} length Salt length in bytes
     * @returns {string} Salt (hex)
     */
    generateSalt(length = 16) {
        return crypto.randomBytes(length).toString('hex');
    }
    
    /**
     * Create a secure password hash
     * @param {string} password Password
     * @returns {Promise<object>} Password hash info
     */
    async hashPassword(password) {
        const salt = this.generateSalt();
        const hash = await this.deriveKeyFromPassword(password, salt);
        
        return {
            hash,
            salt,
            iterations: 100000,
            algorithm: 'pbkdf2-sha512'
        };
    }
    
    /**
     * Verify a password against a hash
     * @param {string} password Password to verify
     * @param {object} hashInfo Hash info from hashPassword()
     * @returns {Promise<boolean>} Whether password is valid
     */
    async verifyPassword(password, hashInfo) {
        const { hash, salt, iterations } = hashInfo;
        
        const derivedKey = await this.deriveKeyFromPassword(password, salt, iterations);
        return derivedKey === hash;
    }
    
    /**
     * Ensure input is a buffer of the correct length
     * @param {string|Buffer} input Input data
     * @param {number} length Required length
     * @returns {Buffer} Buffer of correct length
     * @private
     */
    _ensureBuffer(input, length) {
        if (!Buffer.isBuffer(input)) {
            // If input is a string, convert to buffer
            input = Buffer.from(input);
        }
        
        // Ensure key is the right length
        if (input.length !== length) {
            // If not the right length, hash it to get correct length
            input = crypto.createHash('sha256').update(input).digest();
        }
        
        return input;
    }
}

module.exports = new EncryptionUtils();