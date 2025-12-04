/**
 * Validation Utilities
 * 
 * Provides validation functions for verifying data integrity and format,
 * including security-focused validation for common data types used in 
 * the Agentic SOC system.
 */

class ValidationUtils {
    constructor() {
        // Regular expression patterns for common validations
        this.patterns = {
            email: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
            ipv4: /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
            ipv6: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
            uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
            md5: /^[a-f0-9]{32}$/i,
            sha1: /^[a-f0-9]{40}$/i,
            sha256: /^[a-f0-9]{64}$/i,
            sha512: /^[a-f0-9]{128}$/i,
            macAddress: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
            port: /^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/,
            url: /^(https?:\/\/)(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
            domain: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/,
            base64: /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/,
            hex: /^[0-9A-Fa-f]+$/,
            cvv: /^[0-9]{3,4}$/,
            creditCard: /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/,
            alpha: /^[a-zA-Z]+$/,
            alphanumeric: /^[a-zA-Z0-9]+$/,
            phone: /^(?:\+\d{1,3}\s*)?(?:\(\d{1,4}\)\s*)?(?:[0-9][\s-]?){10,}$/
        };
    }
    
    /**
     * Validate input against a pattern
     * @param {string} input Input to validate
     * @param {RegExp|string} pattern Regular expression pattern
     * @returns {boolean} Whether input matches the pattern
     */
    matches(input, pattern) {
        if (!input || typeof input !== 'string') return false;
        
        // Use built-in pattern if a string pattern name is provided
        if (typeof pattern === 'string' && this.patterns[pattern]) {
            pattern = this.patterns[pattern];
        }
        
        return pattern.test(input);
    }
    
    /**
     * Validate that input is a valid email address
     * @param {string} email Email address to validate
     * @returns {boolean} Whether input is a valid email
     */
    isEmail(email) {
        return this.matches(email, this.patterns.email);
    }
    
    /**
     * Validate that input is a valid IP address (v4 or v6)
     * @param {string} ip IP address to validate
     * @returns {boolean} Whether input is a valid IP
     */
    isIP(ip) {
        return this.isIPv4(ip) || this.isIPv6(ip);
    }
    
    /**
     * Validate that input is a valid IPv4 address
     * @param {string} ip IPv4 address to validate
     * @returns {boolean} Whether input is a valid IPv4
     */
    isIPv4(ip) {
        return this.matches(ip, this.patterns.ipv4);
    }
    
    /**
     * Validate that input is a valid IPv6 address
     * @param {string} ip IPv6 address to validate
     * @returns {boolean} Whether input is a valid IPv6
     */
    isIPv6(ip) {
        return this.matches(ip, this.patterns.ipv6);
    }
    
    /**
     * Validate that input is a valid MAC address
     * @param {string} mac MAC address to validate
     * @returns {boolean} Whether input is a valid MAC
     */
    isMACAddress(mac) {
        return this.matches(mac, this.patterns.macAddress);
    }
    
    /**
     * Validate that input is a valid URL
     * @param {string} url URL to validate
     * @returns {boolean} Whether input is a valid URL
     */
    isURL(url) {
        return this.matches(url, this.patterns.url);
    }
    
    /**
     * Validate that input is a valid domain name
     * @param {string} domain Domain name to validate
     * @returns {boolean} Whether input is a valid domain
     */
    isDomain(domain) {
        return this.matches(domain, this.patterns.domain);
    }
    
    /**
     * Validate that input is a valid port number
     * @param {string|number} port Port number to validate
     * @returns {boolean} Whether input is a valid port
     */
    isPort(port) {
        if (typeof port === 'number') {
            return port >= 0 && port <= 65535;
        }
        return this.matches(port, this.patterns.port);
    }
    
    /**
     * Validate that input is a valid UUID
     * @param {string} uuid UUID to validate
     * @returns {boolean} Whether input is a valid UUID
     */
    isUUID(uuid) {
        return this.matches(uuid, this.patterns.uuid);
    }
    
    /**
     * Validate that input is a valid hash
     * @param {string} hash Hash to validate
     * @param {string} algorithm Hash algorithm (md5, sha1, sha256, sha512)
     * @returns {boolean} Whether input is a valid hash
     */
    isHash(hash, algorithm) {
        if (!algorithm || !this.patterns[algorithm.toLowerCase()]) {
            return false;
        }
        return this.matches(hash, this.patterns[algorithm.toLowerCase()]);
    }
    
    /**
     * Validate that input is a valid base64 string
     * @param {string} base64 Base64 string to validate
     * @returns {boolean} Whether input is valid base64
     */
    isBase64(base64) {
        return this.matches(base64, this.patterns.base64);
    }
    
    /**
     * Validate that input is a valid hex string
     * @param {string} hex Hex string to validate
     * @returns {boolean} Whether input is valid hex
     */
    isHex(hex) {
        return this.matches(hex, this.patterns.hex);
    }
    
    /**
     * Validate that input is within length bounds
     * @param {string} input Input to validate
     * @param {number} min Minimum length
     * @param {number} max Maximum length
     * @returns {boolean} Whether input is within length bounds
     */
    isLength(input, min, max = Infinity) {
        if (!input || typeof input !== 'string') return false;
        const len = input.length;
        return len >= min && len <= max;
    }
    
    /**
     * Validate that input is empty
     * @param {any} input Input to validate
     * @returns {boolean} Whether input is empty
     */
    isEmpty(input) {
        return (
            input === null ||
            input === undefined ||
            input === '' ||
            (Array.isArray(input) && input.length === 0) ||
            (typeof input === 'object' && Object.keys(input).length === 0)
        );
    }
    
    /**
     * Validate that input is a number
     * @param {any} input Input to validate
     * @returns {boolean} Whether input is a number
     */
    isNumeric(input) {
        if (typeof input === 'number') return !isNaN(input);
        if (typeof input !== 'string') return false;
        return !isNaN(input) && !isNaN(parseFloat(input));
    }
    
    /**
     * Validate that input is an integer
     * @param {any} input Input to validate
     * @returns {boolean} Whether input is an integer
     */
    isInteger(input) {
        if (typeof input === 'number') return Number.isInteger(input);
        if (typeof input !== 'string') return false;
        return Number.isInteger(Number(input));
    }
    
    /**
     * Validate that input is a positive number
     * @param {any} input Input to validate
     * @returns {boolean} Whether input is a positive number
     */
    isPositive(input) {
        if (!this.isNumeric(input)) return false;
        return Number(input) > 0;
    }
    
    /**
     * Validate that input is a negative number
     * @param {any} input Input to validate
     * @returns {boolean} Whether input is a negative number
     */
    isNegative(input) {
        if (!this.isNumeric(input)) return false;
        return Number(input) < 0;
    }
    
    /**
     * Validate that input is a boolean
     * @param {any} input Input to validate
     * @returns {boolean} Whether input is a boolean
     */
    isBoolean(input) {
        return typeof input === 'boolean' || input === 'true' || input === 'false';
    }
    
    /**
     * Validate that input is a valid date
     * @param {any} input Input to validate
     * @returns {boolean} Whether input is a valid date
     */
    isDate(input) {
        if (input instanceof Date) return !isNaN(input);
        if (typeof input !== 'string' && typeof input !== 'number') return false;
        
        const date = new Date(input);
        return !isNaN(date);
    }
    
    /**
     * Validate that input is a valid JSON string
     * @param {string} input Input to validate
     * @returns {boolean} Whether input is valid JSON
     */
    isJSON(input) {
        if (typeof input !== 'string') return false;
        
        try {
            JSON.parse(input);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Validate that input is a valid credit card number
     * @param {string} input Credit card number to validate
     * @returns {boolean} Whether input is a valid credit card
     */
    isCreditCard(input) {
        if (!this.matches(input, this.patterns.creditCard)) {
            return false;
        }
        
        // Luhn algorithm validation
        input = input.replace(/\s+/g, '');
        let sum = 0;
        let shouldDouble = false;
        
        for (let i = input.length - 1; i >= 0; i--) {
            let digit = parseInt(input.charAt(i));
            
            if (shouldDouble) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            
            sum += digit;
            shouldDouble = !shouldDouble;
        }
        
        return sum % 10 === 0;
    }
    
    /**
     * Validate object properties against a schema
     * @param {object} obj Object to validate
     * @param {object} schema Validation schema
     * @returns {object} Validation result
     */
    validateObject(obj, schema) {
        const result = {
            valid: true,
            errors: {}
        };
        
        // Check for required properties
        for (const [prop, rules] of Object.entries(schema)) {
            const value = obj[prop];
            
            // Check required rule
            if (rules.required && (value === undefined || value === null || value === '')) {
                result.valid = false;
                result.errors[prop] = `${prop} is required`;
                continue;
            }
            
            // Skip validation if value is undefined and not required
            if (value === undefined) continue;
            
            // Validate type
            if (rules.type) {
                let typeValid = false;
                
                switch (rules.type) {
                    case 'string':
                        typeValid = typeof value === 'string';
                        break;
                    case 'number':
                        typeValid = this.isNumeric(value);
                        break;
                    case 'integer':
                        typeValid = this.isInteger(value);
                        break;
                    case 'boolean':
                        typeValid = this.isBoolean(value);
                        break;
                    case 'array':
                        typeValid = Array.isArray(value);
                        break;
                    case 'object':
                        typeValid = typeof value === 'object' && !Array.isArray(value) && value !== null;
                        break;
                    case 'date':
                        typeValid = this.isDate(value);
                        break;
                    default:
                        typeValid = true; // No type validation
                }
                
                if (!typeValid) {
                    result.valid = false;
                    result.errors[prop] = `${prop} must be a valid ${rules.type}`;
                    continue;
                }
            }
            
            // Validate pattern
            if (rules.pattern && typeof value === 'string') {
                if (!this.matches(value, rules.pattern)) {
                    result.valid = false;
                    result.errors[prop] = `${prop} does not match the required pattern`;
                    continue;
                }
            }
            
            // Validate min/max for strings
            if (typeof value === 'string') {
                if (rules.minLength !== undefined && value.length < rules.minLength) {
                    result.valid = false;
                    result.errors[prop] = `${prop} must be at least ${rules.minLength} characters`;
                    continue;
                }
                
                if (rules.maxLength !== undefined && value.length > rules.maxLength) {
                    result.valid = false;
                    result.errors[prop] = `${prop} must be no more than ${rules.maxLength} characters`;
                    continue;
                }
            }
            
            // Validate min/max for numbers
            if (this.isNumeric(value)) {
                const numValue = Number(value);
                
                if (rules.min !== undefined && numValue < rules.min) {
                    result.valid = false;
                    result.errors[prop] = `${prop} must be at least ${rules.min}`;
                    continue;
                }
                
                if (rules.max !== undefined && numValue > rules.max) {
                    result.valid = false;
                    result.errors[prop] = `${prop} must be no more than ${rules.max}`;
                    continue;
                }
            }
            
            // Validate enum
            if (rules.enum && Array.isArray(rules.enum)) {
                if (!rules.enum.includes(value)) {
                    result.valid = false;
                    result.errors[prop] = `${prop} must be one of: ${rules.enum.join(', ')}`;
                    continue;
                }
            }
            
            // Validate custom 
            if (rules.custom && typeof rules.custom === 'function') {
                try {
                    const customResult = rules.custom(value, obj);
                    if (customResult !== true) {
                        result.valid = false;
                        result.errors[prop] = typeof customResult === 'string' ? 
                            customResult : 
                            `${prop} failed custom validation`;
                        continue;
                    }
                } catch (error) {
                    result.valid = false;
                    result.errors[prop] = error.message || `${prop} caused an error during validation`;
                    continue;
                }
            }
        }
        
        return result;
    }
    
    /**
     * Sanitize user input to prevent XSS attacks
     * @param {string} input User input to sanitize
     * @returns {string} Sanitized input
     */
    sanitizeHtml(input) {
        if (!input || typeof input !== 'string') return '';
        
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
}

module.exports = new ValidationUtils();