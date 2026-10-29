import { describe, it, expect } from '@jest/globals';
import {
  loginSchema,
  createProductSchema,
  createUserSchema,
  createCategorySchema,
  createShelfSchema,
} from '../../validations/schemas';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const validData = {
        body: {
          email: 'test@example.com',
          password: 'password123',
        },
      };
      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        body: {
          email: 'invalid-email',
          password: 'password123',
        },
      };
      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const invalidData = {
        body: {
          email: 'test@example.com',
          password: '12345',
        },
      };
      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createProductSchema', () => {
    it('should validate correct product data', () => {
      const validData = {
        body: {
          name: 'Test Product',
          categoryId: '550e8400-e29b-41d4-a716-446655440000',
          barcode: '123456789012',
          quantity: 10,
          price: 99.99,
        },
      };
      const result = createProductSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid barcode (non-numeric)', () => {
      const invalidData = {
        body: {
          name: 'Test Product',
          categoryId: '550e8400-e29b-41d4-a716-446655440000',
          barcode: 'abc123',
          quantity: 10,
          price: 99.99,
        },
      };
      const result = createProductSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative quantity', () => {
      const invalidData = {
        body: {
          name: 'Test Product',
          categoryId: '550e8400-e29b-41d4-a716-446655440000',
          barcode: '123456789012',
          quantity: -1,
          price: 99.99,
        },
      };
      const result = createProductSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createUserSchema', () => {
    it('should validate correct user data', () => {
      const validData = {
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
          role: 'USER',
          status: 'ACTIVE',
        },
      };
      const result = createUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        body: {
          name: 'John Doe',
          email: 'invalid-email',
          password: 'password123',
        },
      };
      const result = createUserSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createCategorySchema', () => {
    it('should validate correct category data', () => {
      const validData = {
        body: {
          name: 'Electronics',
          description: 'Electronic products',
        },
      };
      const result = createCategorySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const invalidData = {
        body: {
          name: '',
          description: 'Test',
        },
      };
      const result = createCategorySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createShelfSchema', () => {
    it('should validate correct shelf data', () => {
      const validData = {
        body: {
          id: 'A1',
          name: 'Shelf A1',
          description: 'Main shelf',
        },
      };
      const result = createShelfSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty shelf ID', () => {
      const invalidData = {
        body: {
          id: '',
          name: 'Shelf A1',
        },
      };
      const result = createShelfSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});


