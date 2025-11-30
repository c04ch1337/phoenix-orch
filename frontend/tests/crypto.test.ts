import { cryptoService, EncryptedMessage } from '../src/services/crypto';

describe('CryptoService', () => {
  beforeAll(async () => {
    await cryptoService.initialize();
  });

  it('encrypts and decrypts data correctly', async () => {
    const testData = {
      type: 'sensitive',
      content: 'This is sensitive information',
      timestamp: Date.now()
    };

    // Encrypt the data
    const encrypted = await cryptoService.encrypt(testData);

    // Verify encrypted message structure
    expect(encrypted).toHaveProperty('ciphertext');
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('tag');
    expect(typeof encrypted.ciphertext).toBe('string');
    expect(typeof encrypted.iv).toBe('string');
    expect(typeof encrypted.tag).toBe('string');

    // Decrypt the data
    const decrypted = await cryptoService.decrypt(encrypted);

    // Verify decrypted data matches original
    expect(decrypted).toEqual(testData);
  });

  it('exports and imports keys correctly', async () => {
    // Export the current key
    const exportedKey = await cryptoService.exportKey();
    expect(typeof exportedKey).toBe('string');

    // Create test data
    const testData = { secret: 'test secret' };

    // Encrypt with current key
    const encrypted = await cryptoService.encrypt(testData);

    // Import the exported key
    await cryptoService.importKey(exportedKey);

    // Decrypt with imported key
    const decrypted = await cryptoService.decrypt(encrypted);
    expect(decrypted).toEqual(testData);
  });

  it('handles different data types correctly', async () => {
    const testCases = [
      { type: 'string', data: 'test string' },
      { type: 'number', data: 12345 },
      { type: 'boolean', data: true },
      { type: 'array', data: [1, 2, 3, 'test'] },
      { type: 'object', data: { key: 'value', nested: { key: 'value' } } },
      { type: 'null', data: null },
    ];

    for (const testCase of testCases) {
      const encrypted = await cryptoService.encrypt(testCase.data);
      const decrypted = await cryptoService.decrypt(encrypted);
      expect(decrypted).toEqual(testCase.data);
    }
  });

  it('generates different IVs for each encryption', async () => {
    const testData = 'test data';
    const encrypted1 = await cryptoService.encrypt(testData);
    const encrypted2 = await cryptoService.encrypt(testData);

    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
  });

  it('fails gracefully with invalid encrypted data', async () => {
    const invalidMessage: EncryptedMessage = {
      ciphertext: 'invalid-ciphertext',
      iv: 'invalid-iv',
      tag: 'invalid-tag'
    };

    await expect(cryptoService.decrypt(invalidMessage)).rejects.toThrow();
  });
});