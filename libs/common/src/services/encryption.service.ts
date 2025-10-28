import { Injectable } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey: string;

  constructor() {
    // Get encryption key from environment variable
    this.encryptionKey =
      process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';

    if (!process.env.ENCRYPTION_KEY) {
      console.warn(
        '⚠️  ENCRYPTION_KEY not set in environment variables. Using default key (NOT SECURE for production)'
      );
    }
  }

  /**
   * Encrypt a plain text string
   * @param plainText The text to encrypt
   * @returns Encrypted string
   */
  encrypt(plainText: string): string {
    if (!plainText) {
      return '';
    }

    try {
      const encrypted = CryptoJS.AES.encrypt(plainText, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt an encrypted string
   * @param encryptedText The encrypted text
   * @returns Decrypted plain text string
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) {
      return '';
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
      const plainText = decrypted.toString(CryptoJS.enc.Utf8);

      if (!plainText) {
        throw new Error('Decryption resulted in empty string - possibly wrong key');
      }

      return plainText;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Check if a string is encrypted (basic check)
   * @param text The text to check
   * @returns true if text appears to be encrypted
   */
  isEncrypted(text: string): boolean {
    if (!text) {
      return false;
    }

    // AES encrypted text from crypto-js is base64-like
    // This is a simple heuristic check
    try {
      // Try to decrypt - if it fails, it might not be encrypted with our key
      this.decrypt(text);
      return true;
    } catch {
      return false;
    }
  }
}
