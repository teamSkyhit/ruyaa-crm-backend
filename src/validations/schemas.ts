// src/validations/schemas.ts
import { z } from 'zod';

// UUID validation helper
const uuidSchema = z.string().uuid('Invalid UUID format');

// Login validation
export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
    password: z.string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters'),
    role: z.enum(['admin', 'user']).optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email format').toLowerCase().trim(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password is too long'),
  }),
});

// Register validation
export const registerSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters')
      .trim(),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password is too long'),
    role: z.enum(['ADMIN', 'USER']).optional().default('USER'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(100, 'New password is too long'),
  }),
});

// Product validation
export const createProductSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Product name is required')
      .max(200, 'Product name must be less than 200 characters')
      .trim(),
    categoryId: uuidSchema,
    subcategoryId: uuidSchema.optional(),
    barcode: z
      .string()
      .max(50, 'Barcode must be less than 50 characters')
      .regex(/^[0-9]+$/, 'Barcode must contain only numbers')
      .optional(), // Optional for parent products
    parentProductId: uuidSchema.optional(), // For variants
    // Pricing
    mrp: z
      .number()
      .min(0, 'MRP cannot be negative')
      .max(999999.99, 'MRP is too large')
      .multipleOf(0.01, 'MRP must have at most 2 decimal places')
      .optional()
      .nullable(),
    salePrice: z
      .number()
      .min(0, 'Sale price cannot be negative')
      .max(999999.99, 'Sale price is too large')
      .multipleOf(0.01, 'Sale price must have at most 2 decimal places')
      .optional()
      .nullable(),
    // Attributes
    modelType: z.string().max(500, 'Model type must be less than 500 characters').optional().nullable(),
    packType: z.string().max(500, 'Pack type must be less than 500 characters').optional().nullable(),
    size: z.string().max(500, 'Size must be less than 500 characters').optional().nullable(),
    weight: z.string().max(500, 'Weight must be less than 500 characters').optional().nullable(),
    // Inventory
    quantity: z.number().int('Quantity must be an integer').min(0, 'Quantity cannot be negative').optional().default(0),
    minStockLevel: z.number().int('Minimum stock level must be an integer').min(0, 'Minimum stock level cannot be negative').optional().nullable(),
    allowNegativeStock: z.boolean().optional().default(true),
    // Other
    shelfId: z.string().max(50, 'Shelf ID must be less than 50 characters').optional().nullable(),
    description: z.string().max(5000, 'Description must be less than 5000 characters').optional().nullable(),
    image: z.string().optional().nullable(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: z
      .string()
      .min(1, 'Product name is required')
      .max(200, 'Product name must be less than 200 characters')
      .trim()
      .optional(),
    categoryId: uuidSchema.optional(),
    subcategoryId: uuidSchema.optional(),
    barcode: z
      .string()
      .min(1, 'Barcode is required')
      .max(50, 'Barcode must be less than 50 characters')
      .regex(/^[0-9]+$/, 'Barcode must contain only numbers')
      .optional(),
    // Pricing
    mrp: z
      .number()
      .min(0, 'MRP cannot be negative')
      .max(999999.99, 'MRP is too large')
      .multipleOf(0.01, 'MRP must have at most 2 decimal places')
      .optional()
      .nullable(),
    salePrice: z
      .number()
      .min(0, 'Sale price cannot be negative')
      .max(999999.99, 'Sale price is too large')
      .multipleOf(0.01, 'Sale price must have at most 2 decimal places')
      .optional()
      .nullable(),
    // Attributes
    modelType: z.string().max(500, 'Model type must be less than 500 characters').optional().nullable(),
    packType: z.string().max(500, 'Pack type must be less than 500 characters').optional().nullable(),
    size: z.string().max(500, 'Size must be less than 500 characters').optional().nullable(),
    weight: z.string().max(500, 'Weight must be less than 500 characters').optional().nullable(),
    // Inventory
    quantity: z
      .number()
      .int('Quantity must be an integer')
      .min(0, 'Quantity cannot be negative')
      .optional(),
    minStockLevel: z.number().int('Minimum stock level must be an integer').min(0, 'Minimum stock level cannot be negative').optional().nullable(),
    allowNegativeStock: z.boolean().optional(),
    // Other
    shelfId: z.string().max(50, 'Shelf ID must be less than 50 characters').optional().nullable(),
    description: z.string().max(5000, 'Description must be less than 5000 characters').optional().nullable(),
    image: z.string().optional().nullable(),
  }),
});

// Parent product schema (for multiple products - no barcode/pricing/quantity)
export const createParentProductSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Product name is required')
      .max(200, 'Product name must be less than 200 characters')
      .trim(),
    categoryId: uuidSchema,
    subcategoryId: uuidSchema.optional(),
    // No barcode required for parent
    // No pricing for parent
    // Attributes (optional on parent, actual values on variants)
    modelType: z.string().max(500, 'Model type must be less than 500 characters').optional().nullable(),
    packType: z.string().max(500, 'Pack type must be less than 500 characters').optional().nullable(),
    size: z.string().max(500, 'Size must be less than 500 characters').optional().nullable(),
    weight: z.string().max(500, 'Weight must be less than 500 characters').optional().nullable(),
    // No quantity for parent
    minStockLevel: z.number().int('Minimum stock level must be an integer').min(0, 'Minimum stock level cannot be negative').optional().nullable(),
    allowNegativeStock: z.boolean().optional().default(true),
    // Other
    shelfId: z.string().max(50, 'Shelf ID must be less than 50 characters').optional().nullable(),
    description: z.string().max(5000, 'Description must be less than 5000 characters').optional().nullable(),
    image: z.string().optional().nullable(), // Featured image
  }),
});

// Variant validation schema (name and categoryId are inherited from parent)
export const createVariantSchema = z.object({
  body: z.object({
    barcode: z
      .string()
      .min(1, 'Barcode is required')
      .max(50, 'Barcode must be less than 50 characters')
      .regex(/^[0-9]+$/, 'Barcode must contain only numbers'),
    // Pricing
    mrp: z
      .number()
      .min(0, 'MRP cannot be negative')
      .max(999999.99, 'MRP is too large')
      .multipleOf(0.01, 'MRP must have at most 2 decimal places')
      .optional()
      .nullable(),
    salePrice: z
      .number()
      .min(0, 'Sale price cannot be negative')
      .max(999999.99, 'Sale price is too large')
      .multipleOf(0.01, 'Sale price must have at most 2 decimal places')
      .optional()
      .nullable(),
    // Attributes (variant-specific) - accept string, null, undefined, or array and convert to string|null
    modelType: z
      .union([z.string(), z.array(z.any()), z.null(), z.undefined()])
      .transform((val) => {
        if (val === undefined) return null;
        if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
        if (typeof val === 'string' && val.trim() === '') return null;
        return val || null;
      })
      .pipe(z.string().max(500).nullable().optional()),
    packType: z
      .union([z.string(), z.array(z.any()), z.null(), z.undefined()])
      .transform((val) => {
        if (val === undefined) return null;
        if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
        if (typeof val === 'string' && val.trim() === '') return null;
        return val || null;
      })
      .pipe(z.string().max(500).nullable().optional()),
    size: z
      .union([z.string(), z.array(z.any()), z.null(), z.undefined()])
      .transform((val) => {
        if (val === undefined) return null;
        if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
        if (typeof val === 'string' && val.trim() === '') return null;
        return val || null;
      })
      .pipe(z.string().max(500).nullable().optional()), // Size is optional for variants
    weight: z
      .union([z.string(), z.array(z.any()), z.null(), z.undefined()])
      .transform((val) => {
        if (val === undefined) return null;
        if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
        if (typeof val === 'string' && val.trim() === '') return null;
        return val || null;
      })
      .pipe(z.string().max(500).nullable().optional()),
    // Inventory
    quantity: z.number().int('Quantity must be an integer').min(0, 'Quantity cannot be negative').optional().default(0),
    minStockLevel: z.number().int('Minimum stock level must be an integer').min(0, 'Minimum stock level cannot be negative').optional().nullable(),
    allowNegativeStock: z.boolean().optional().default(true),
    // Other
    shelfId: z.string().max(50, 'Shelf ID must be less than 50 characters').optional().nullable(),
    description: z.string().max(5000, 'Description must be less than 5000 characters').optional().nullable(),
    image: z.string().optional().nullable(),
  }),
});

// Create product with variants schema (parent + array of variants)
export const createProductWithVariantsSchema = z.object({
  body: z.object({
    parent: z.object({
      name: z
        .string()
        .min(1, 'Product name is required')
        .max(200, 'Product name must be less than 200 characters')
        .trim(),
      categoryId: uuidSchema,
      subcategoryId: uuidSchema.optional(),
      modelType: z.string().max(500).optional().nullable(),
      packType: z.string().max(500).optional().nullable(),
      size: z.string().max(500).optional().nullable(),
      weight: z.string().max(500).optional().nullable(),
      minStockLevel: z.number().int().min(0).optional().nullable(),
      allowNegativeStock: z.boolean().optional().default(true),
      shelfId: z.string().max(50).optional().nullable(),
      description: z.string().max(5000).optional().nullable(),
      image: z.string().optional().nullable(),
    }),
    variants: z.array(
      z.object({
        barcode: z
          .string()
          .min(1, 'Barcode is required')
          .max(50, 'Barcode must be less than 50 characters')
          .regex(/^[0-9]+$/, 'Barcode must contain only numbers'),
        mrp: z
          .number()
          .min(0)
          .max(999999.99)
          .multipleOf(0.01)
          .optional()
          .nullable(),
        salePrice: z
          .number()
          .min(0)
          .max(999999.99)
          .multipleOf(0.01)
          .optional()
          .nullable(),
        modelType: z
          .union([z.string(), z.array(z.any()), z.null(), z.undefined()])
          .transform((val) => {
            if (val === undefined) return null;
            if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
            if (typeof val === 'string' && val.trim() === '') return null;
            return val || null;
          })
          .pipe(z.string().max(500).nullable())
          .optional(),
        packType: z
          .union([z.string(), z.array(z.any()), z.null(), z.undefined()])
          .transform((val) => {
            if (val === undefined) return null;
            if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
            if (typeof val === 'string' && val.trim() === '') return null;
            return val || null;
          })
          .pipe(z.string().max(500).nullable())
          .optional(),
        size: z
          .union([z.string(), z.array(z.any()), z.null(), z.undefined()])
          .transform((val) => {
            if (val === undefined) return null;
            if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
            if (typeof val === 'string' && val.trim() === '') return null;
            return val || null;
          })
          .pipe(z.string().max(500).nullable())
          .optional(),
        weight: z
          .union([z.string(), z.array(z.any()), z.null(), z.undefined()])
          .transform((val) => {
            if (val === undefined) return null;
            if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
            if (typeof val === 'string' && val.trim() === '') return null;
            return val || null;
          })
          .pipe(z.string().max(500).nullable())
          .optional(),
        quantity: z.number().int().min(0).optional().default(0),
        minStockLevel: z.number().int().min(0).optional().nullable(),
        allowNegativeStock: z.boolean().optional().default(true),
        shelfId: z.string().max(50).optional().nullable(),
        description: z.string().max(5000).optional().nullable(),
        image: z.string().optional().nullable(),
      })
    ).min(1, 'At least one variant is required'),
  }),
});

export const deleteProductSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Category validation
export const createCategorySchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Category name is required')
      .max(100, 'Category name must be less than 100 characters')
      .trim(),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    hsnCode: z
      .string()
      .max(20, 'HSN code must be less than 20 characters')
      .trim()
      .optional(),
    gstRate: z
      .number()
      .min(0, 'GST rate cannot be negative')
      .max(18, 'GST rate cannot exceed 18%')
      .refine((val) => [0, 3, 5, 12, 18].includes(val), {
        message: 'GST rate must be 0%, 3%, 5%, 12%, or 18%',
      })
      .optional()
      .default(0),
    gstInclusive: z.boolean().optional().default(true),
    minStockLevel: z.number().int('Minimum stock level must be an integer').min(0, 'Minimum stock level cannot be negative').optional().default(5),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: z
      .string()
      .min(1, 'Category name is required')
      .max(100, 'Category name must be less than 100 characters')
      .trim()
      .optional(),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    hsnCode: z
      .string()
      .max(20, 'HSN code must be less than 20 characters')
      .trim()
      .optional()
      .or(z.literal('')),
    gstRate: z
      .number()
      .min(0, 'GST rate cannot be negative')
      .max(18, 'GST rate cannot exceed 18%')
      .refine((val) => [0, 3, 5, 12, 18].includes(val), {
        message: 'GST rate must be 0%, 3%, 5%, 12%, or 18%',
      })
      .optional(),
    gstInclusive: z.boolean().optional(),
    minStockLevel: z.number().int('Minimum stock level must be an integer').min(0, 'Minimum stock level cannot be negative').optional(),
  }),
});

export const deleteCategorySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Subcategory validation
export const createSubcategorySchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Subcategory name is required')
      .max(100, 'Subcategory name must be less than 100 characters')
      .trim(),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    categoryId: uuidSchema,
  }),
});

export const updateSubcategorySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: z
      .string()
      .min(1, 'Subcategory name is required')
      .max(100, 'Subcategory name must be less than 100 characters')
      .trim()
      .optional(),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    categoryId: uuidSchema.optional(),
  }),
});

export const deleteSubcategorySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Product Attribute validation
export const createProductAttributeSchema = z.object({
  params: z.object({
    productId: uuidSchema,
  }),
  body: z.object({
    size: z.string().max(100, 'Size must be less than 100 characters').optional(),
    weight: z
      .number()
      .min(0, 'Weight cannot be negative')
      .max(999999.999, 'Weight is too large')
      .multipleOf(0.001, 'Weight must have at most 3 decimal places')
      .optional(),
    price: z
      .number()
      .min(0, 'Price cannot be negative')
      .max(999999.99, 'Price is too large')
      .multipleOf(0.01, 'Price must have at most 2 decimal places')
      .optional(),
  }),
});

export const updateProductAttributeSchema = z.object({
  params: z.object({
    productId: uuidSchema,
    id: uuidSchema,
  }),
  body: z.object({
    size: z.string().max(100, 'Size must be less than 100 characters').optional(),
    weight: z
      .number()
      .min(0, 'Weight cannot be negative')
      .max(999999.999, 'Weight is too large')
      .multipleOf(0.001, 'Weight must have at most 3 decimal places')
      .optional(),
    price: z
      .number()
      .min(0, 'Price cannot be negative')
      .max(999999.99, 'Price is too large')
      .multipleOf(0.01, 'Price must have at most 2 decimal places')
      .optional(),
  }),
});

export const deleteProductAttributeSchema = z.object({
  params: z.object({
    productId: uuidSchema,
    id: uuidSchema,
  }),
});

// User validation
export const createUserSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters')
      .trim(),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password is too long'),
    role: z.enum(['ADMIN', 'USER']).optional().default('USER'),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE'),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters')
      .trim()
      .optional(),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .toLowerCase()
      .trim()
      .optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password is too long')
      .optional(),
    role: z.enum(['ADMIN', 'USER']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  }),
});

// Shelf validation
export const createShelfSchema = z.object({
  body: z.object({
    id: z
      .string()
      .min(1, 'Shelf ID is required')
      .max(50, 'Shelf ID must be less than 50 characters')
      .trim(),
    name: z
      .string()
      .min(1, 'Shelf name is required')
      .max(100, 'Shelf name must be less than 100 characters')
      .trim(),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  }),
});

export const updateShelfSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Shelf ID is required'),
  }),
  body: z.object({
    name: z
      .string()
      .min(1, 'Shelf name is required')
      .max(100, 'Shelf name must be less than 100 characters')
      .trim()
      .optional(),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  }),
});

// Sale validation
export const createSaleSchema = z.object({
  body: z.object({
    productId: uuidSchema,
    quantitySold: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1'),
    storeId: uuidSchema.optional(),
    counterId: uuidSchema.optional(),
  }),
});

// Store validation
export const createStoreSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Store name is required')
      .max(100, 'Store name must be less than 100 characters')
      .trim(),
    code: z
      .string()
      .max(50, 'Store code must be less than 50 characters')
      .trim()
      .nullable()
      .optional(),
    gstin: z
      .string()
      .max(15, 'GSTIN must be less than 15 characters')
      .trim()
      .nullable()
      .optional(),
    address: z.string().max(500, 'Address must be less than 500 characters').nullable().optional(),
    city: z.string().max(100, 'City must be less than 100 characters').nullable().optional(),
    state: z.string().max(100, 'State must be less than 100 characters').nullable().optional(),
    pincode: z.string().max(10, 'Pincode must be less than 10 characters').nullable().optional(),
    contact: z.string().max(50, 'Contact must be less than 50 characters').nullable().optional(),
    email: z
      .string()
      .email('Invalid email format')
      .max(255, 'Email must be less than 255 characters')
      .toLowerCase()
      .trim()
      .nullable()
      .optional(),
    website: z.string().max(255, 'Website must be less than 255 characters').url('Invalid website URL').nullable().optional(),
    logoUrl: z.string().nullable().optional(),
    isActive: z.boolean().optional().default(true),
  }),
});

export const updateStoreSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: z
      .string()
      .min(1, 'Store name is required')
      .max(100, 'Store name must be less than 100 characters')
      .trim()
      .optional(),
    code: z
      .string()
      .max(50, 'Store code must be less than 50 characters')
      .trim()
      .nullable()
      .optional(),
    gstin: z
      .string()
      .max(15, 'GSTIN must be less than 15 characters')
      .trim()
      .nullable()
      .optional(),
    address: z.string().max(500, 'Address must be less than 500 characters').nullable().optional(),
    city: z.string().max(100, 'City must be less than 100 characters').nullable().optional(),
    state: z.string().max(100, 'State must be less than 100 characters').nullable().optional(),
    pincode: z.string().max(10, 'Pincode must be less than 10 characters').nullable().optional(),
    contact: z.string().max(50, 'Contact must be less than 50 characters').nullable().optional(),
    email: z
      .string()
      .email('Invalid email format')
      .max(255, 'Email must be less than 255 characters')
      .toLowerCase()
      .trim()
      .nullable()
      .optional(),
    website: z.string().max(255, 'Website must be less than 255 characters').url('Invalid website URL').nullable().optional(),
    logoUrl: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const deleteStoreSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Counter validation
export const createCounterSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Counter name is required')
      .max(100, 'Counter name must be less than 100 characters')
      .trim(),
    storeId: uuidSchema,
    counterType: z.enum(['BILLING', 'FLOOR']).optional(),
  }),
});

export const updateCounterSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: z
      .string()
      .min(1, 'Counter name is required')
      .max(100, 'Counter name must be less than 100 characters')
      .trim()
      .optional(),
    storeId: uuidSchema.optional(),
    counterType: z.enum(['BILLING', 'FLOOR']).optional(),
  }),
});

export const deleteCounterSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Stock Transfer validation
export const requestStockTransferSchema = z.object({
  body: z.object({
    fromStoreId: uuidSchema,
    toStoreId: uuidSchema,
    productId: uuidSchema,
    quantity: z
      .number()
      .int('Quantity must be an integer')
      .min(1, 'Quantity must be at least 1'),
    notes: z.string().max(1000, 'Notes must be less than 1000 characters').nullable().optional(),
  }),
  // Validate that fromStoreId and toStoreId are different
}).refine((data) => data.body.fromStoreId !== data.body.toStoreId, {
  message: 'Source and destination stores must be different',
  path: ['body', 'toStoreId'],
});

export const approveStockTransferSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const shipStockTransferSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const receiveStockTransferSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const cancelStockTransferSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Store Inventory validation
export const updateStoreInventorySchema = z.object({
  params: z.object({
    storeId: uuidSchema,
    productId: uuidSchema,
  }),
  body: z.object({
    quantity: z
      .number()
      .int('Quantity must be an integer')
      .min(0, 'Quantity cannot be negative')
      .optional(),
    minStockLevel: z
      .number()
      .int('Minimum stock level must be an integer')
      .min(0, 'Minimum stock level cannot be negative')
      .optional(),
  }),
});

