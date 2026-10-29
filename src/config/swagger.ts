// src/config/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Boutique Inventory Management API',
    version: '1.0.0',
    description:
      'A comprehensive inventory management system API with user authentication, product management, sales tracking, and shelf organization. Note: shift management endpoints are internal and not exposed via this API.',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url:
        process.env.NODE_ENV === 'production'
          ? (process.env.API_URL || 'https://api.example.com')
          : `http://localhost:${process.env.PORT || 8001}`,
      description:
        process.env.NODE_ENV === 'production'
          ? 'Production server'
          : 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        required: ['id', 'name', 'email', 'role', 'status'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the user',
          },
          name: {
            type: 'string',
            maxLength: 100,
            description: 'Full name of the user',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Email address of the user',
          },
          role: {
            type: 'string',
            enum: ['admin', 'user'],
            description: 'Role of the user in the system',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive'],
            description: 'Current status of the user account',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the user was created',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the user was last updated',
          },
        },
      },
      Product: {
        type: 'object',
        required: ['id', 'name', 'categoryId', 'barcode', 'quantity', 'price'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the product',
          },
          name: {
            type: 'string',
            maxLength: 200,
            description: 'Name of the product',
          },
          categoryId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the product category',
          },
          subcategoryId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'ID of the product subcategory',
          },
          category: {
            $ref: '#/components/schemas/Category',
            description: 'Category details (populated when included)',
          },
          subcategory: {
            $ref: '#/components/schemas/SubCategory',
            description: 'Subcategory details (populated when included)',
          },
          barcode: {
            type: 'string',
            pattern: '^[0-9]+$',
            description: 'Barcode of the product (numbers only)',
          },
          quantity: {
            type: 'integer',
            minimum: 0,
            description: 'Current stock quantity',
          },
          price: {
            type: 'number',
            minimum: 0,
            description: 'Price of the product',
          },
          shelfId: {
            type: 'string',
            nullable: true,
            description: 'ID of the shelf where the product is stored',
          },
          description: {
            type: 'string',
            maxLength: 500,
            nullable: true,
            description: 'Detailed description of the product',
          },
          image: {
            type: 'string',
            format: 'uri',
            nullable: true,
            description: 'URL of the product image',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the product was created',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the product was last updated',
          },
        },
      },
      Category: {
        type: 'object',
        required: ['id', 'name', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the category',
          },
          name: {
            type: 'string',
            maxLength: 100,
            description: 'Name of the category',
            example: 'Electronics',
          },
          description: {
            type: 'string',
            nullable: true,
            description: 'Description of the category',
            example: 'Electronic devices and accessories',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the category was created',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the category was last updated',
          },
          subcategories: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/SubCategory',
            },
            description: 'List of subcategories in this category',
          },
          _count: {
            type: 'object',
            properties: {
              products: {
                type: 'integer',
                description: 'Number of products in this category',
                example: 5,
              },
            },
          },
        },
      },
      SubCategory: {
        type: 'object',
        required: ['id', 'name', 'categoryId', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the subcategory',
          },
          name: {
            type: 'string',
            maxLength: 100,
            description: 'Name of the subcategory',
            example: 'Smartphones',
          },
          description: {
            type: 'string',
            nullable: true,
            description: 'Description of the subcategory',
            example: 'Mobile phones and accessories',
          },
          categoryId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the parent category',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the subcategory was created',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the subcategory was last updated',
          },
          category: {
            $ref: '#/components/schemas/Category',
            description: 'Parent category details (populated when included)',
          },
          _count: {
            type: 'object',
            properties: {
              products: {
                type: 'integer',
                description: 'Number of products in this subcategory',
                example: 3,
              },
            },
          },
        },
      },
      Sale: {
        type: 'object',
        required: ['id', 'productId', 'quantitySold', 'saleDate'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the sale',
          },
          productId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the sold product',
          },
          quantitySold: {
            type: 'integer',
            minimum: 1,
            description: 'Quantity of products sold',
          },
          saleDate: {
            type: 'string',
            format: 'date-time',
            description: 'Date and time of the sale',
          },
          createdById: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'ID of the user who created the sale record',
          },
        },
      },
      Shelf: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: {
            type: 'string',
            description: 'Unique identifier for the shelf',
          },
          name: {
            type: 'string',
            maxLength: 100,
            description: 'Name of the shelf',
          },
          description: {
            type: 'string',
            maxLength: 500,
            nullable: true,
            description: 'Description of the shelf',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the shelf was created',
          },
        },
      },
      ApiResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: {
            type: 'boolean',
            description: 'Indicates if the request was successful',
          },
          data: {
            description: 'Response data (varies by endpoint)',
          },
          error: {
            type: 'string',
            description: 'Error message if request failed',
          },
          message: {
            type: 'string',
            description: 'Additional message',
          },
          meta: {
            $ref: '#/components/schemas/PaginationMeta',
            description: 'Pagination metadata (for paginated responses)',
          },
        },
      },
      PaginationMeta: {
        type: 'object',
        required: ['total', 'page', 'limit', 'totalPages'],
        properties: {
          total: {
            type: 'integer',
            minimum: 0,
            description: 'Total number of items',
            example: 25,
          },
          page: {
            type: 'integer',
            minimum: 1,
            description: 'Current page number',
            example: 1,
          },
          limit: {
            type: 'integer',
            minimum: 1,
            description: 'Number of items per page',
            example: 10,
          },
          totalPages: {
            type: 'integer',
            minimum: 1,
            description: 'Total number of pages',
            example: 3,
          },
        },
      },
      PaginatedProductResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: {
            type: 'boolean',
            example: true,
            description: 'Indicates if the request was successful',
          },
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Product',
            },
            description: 'Array of products',
          },
          meta: {
            $ref: '#/components/schemas/PaginationMeta',
            description: 'Pagination metadata',
          },
          message: {
            type: 'string',
            description: 'Additional message',
            example: 'page 1 of 3',
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'message'],
        properties: {
          success: {
            type: 'boolean',
            example: false,
            description: 'Always false for error responses',
          },
          message: {
            type: 'string',
            description: 'Error message describing what went wrong',
            example: 'Resource not found',
          },
          error: {
            type: 'string',
            description: 'Additional error details (optional)',
            example: 'The requested resource could not be found',
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
          },
          password: {
            type: 'string',
            minLength: 6,
            description: 'User password',
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: {
            type: 'string',
            maxLength: 100,
            description: 'Full name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Email address',
          },
          password: {
            type: 'string',
            minLength: 6,
            description: 'Password',
          },
          role: {
            type: 'string',
            enum: ['admin', 'user'],
            default: 'user',
            description: 'User role',
          },
        },
      },
      CreateCategoryRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            maxLength: 100,
            description: 'Category name',
            example: 'Electronics',
          },
          description: {
            type: 'string',
            description: 'Category description',
            example: 'Electronic devices and accessories',
          },
        },
      },
      CreateSubCategoryRequest: {
        type: 'object',
        required: ['name', 'categoryId'],
        properties: {
          name: {
            type: 'string',
            maxLength: 100,
            description: 'Subcategory name',
            example: 'Smartphones',
          },
          description: {
            type: 'string',
            description: 'Subcategory description',
            example: 'Mobile phones and accessories',
          },
          categoryId: {
            type: 'string',
            format: 'uuid',
            description: 'Parent category ID',
            example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          },
        },
      },
      CreateProductRequest: {
        type: 'object',
        required: ['name', 'categoryId', 'barcode', 'quantity', 'price'],
        properties: {
          name: {
            type: 'string',
            maxLength: 200,
            description: 'Product name',
            example: 'iPhone 15 Pro',
          },
          categoryId: {
            type: 'string',
            format: 'uuid',
            description: 'Category ID',
            example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          },
          subcategoryId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'Subcategory ID (optional)',
            example: 'b2c3d4e5-f6g7-8901-bcde-f12345678901',
          },
          barcode: {
            type: 'string',
            pattern: '^[0-9]+$',
            description: 'Product barcode (numbers only)',
            example: '1234567890123',
          },
          quantity: {
            type: 'integer',
            minimum: 0,
            description: 'Initial stock quantity',
            example: 25,
          },
          price: {
            type: 'number',
            minimum: 0,
            description: 'Product price',
            example: 999.99,
          },
          shelfId: {
            type: 'string',
            nullable: true,
            description: 'Shelf ID where product is stored',
            example: 'A1',
          },
          description: {
            type: 'string',
            maxLength: 500,
            nullable: true,
            description: 'Product description',
            example: 'Latest iPhone with advanced camera system',
          },
          image: {
            type: 'string',
            format: 'uri',
            nullable: true,
            description: 'Product image URL',
            example: 'https://example.com/product-image.jpg',
          },
        },
      },
      Store: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the store',
          },
          name: {
            type: 'string',
            maxLength: 100,
            description: 'Store name',
          },
          code: {
            type: 'string',
            nullable: true,
            description: 'Store code (e.g., STORE-001)',
          },
          gstin: {
            type: 'string',
            nullable: true,
            description: 'GSTIN number',
          },
          address: {
            type: 'string',
            nullable: true,
            description: 'Store address',
          },
          city: {
            type: 'string',
            nullable: true,
            description: 'City',
          },
          state: {
            type: 'string',
            nullable: true,
            description: 'State',
          },
          pincode: {
            type: 'string',
            nullable: true,
            description: 'Pincode',
          },
          contact: {
            type: 'string',
            nullable: true,
            description: 'Contact number',
          },
          email: {
            type: 'string',
            format: 'email',
            nullable: true,
            description: 'Email address',
          },
          website: {
            type: 'string',
            nullable: true,
            description: 'Website URL',
          },
          logoUrl: {
            type: 'string',
            nullable: true,
            description: 'Logo URL',
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the store is active',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
      Counter: {
        type: 'object',
        required: ['id', 'name', 'storeId'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the counter',
          },
          name: {
            type: 'string',
            maxLength: 100,
            description: 'Counter name',
          },
          storeId: {
            type: 'string',
            format: 'uuid',
            description: 'Store ID this counter belongs to',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
      StockTransfer: {
        type: 'object',
        required: ['id', 'transferNumber', 'fromStoreId', 'toStoreId', 'productId', 'quantity', 'status'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the transfer',
          },
          transferNumber: {
            type: 'string',
            description: 'Auto-generated transfer number (e.g., TRF-000001)',
          },
          fromStoreId: {
            type: 'string',
            format: 'uuid',
            description: 'Source store ID',
          },
          toStoreId: {
            type: 'string',
            format: 'uuid',
            description: 'Destination store ID',
          },
          productId: {
            type: 'string',
            format: 'uuid',
            description: 'Product ID being transferred',
          },
          quantity: {
            type: 'integer',
            minimum: 1,
            description: 'Quantity to transfer',
          },
          status: {
            type: 'string',
            enum: ['PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'],
            description: 'Transfer status',
          },
          notes: {
            type: 'string',
            nullable: true,
            description: 'Optional notes',
          },
          requestedById: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'User ID who requested the transfer',
          },
          approvedById: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'User ID who approved the transfer',
          },
          shippedById: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'User ID who shipped the transfer',
          },
          receivedById: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'User ID who received the transfer',
          },
          requestedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Request timestamp',
          },
          approvedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Approval timestamp',
          },
          shippedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Shipment timestamp',
          },
          receivedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Receipt timestamp',
          },
        },
      },
      StoreProductInventory: {
        type: 'object',
        required: ['id', 'storeId', 'productId', 'quantity'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier',
          },
          storeId: {
            type: 'string',
            format: 'uuid',
            description: 'Store ID',
          },
          productId: {
            type: 'string',
            format: 'uuid',
            description: 'Product ID',
          },
          quantity: {
            type: 'integer',
            minimum: 0,
            description: 'Current stock quantity',
          },
          minStockLevel: {
            type: 'integer',
            nullable: true,
            description: 'Minimum stock level override for this store',
          },
          reservedQty: {
            type: 'integer',
            minimum: 0,
            description: 'Reserved quantity for pending transfers',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
    },
    Payment: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: 'Payment ID',
        },
        saleId: {
          type: 'string',
          format: 'uuid',
          description: 'Sale ID this payment belongs to',
        },
        method: {
          type: 'string',
          enum: ['CASH', 'UPI', 'CARD', 'WALLET'],
          description: 'Payment method',
        },
        amount: {
          type: 'number',
          format: 'decimal',
          description: 'Payment amount',
        },
        transactionId: {
          type: 'string',
          nullable: true,
          description: 'Transaction ID for UPI/Card payments',
        },
        notes: {
          type: 'string',
          nullable: true,
          description: 'Optional payment notes',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Payment timestamp',
        },
      },
    },
    Return: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: 'Return ID',
        },
        returnNumber: {
          type: 'string',
          description: 'Auto-generated return number (RET-000001)',
          example: 'RET-000001',
        },
        originalSaleId: {
          type: 'string',
          format: 'uuid',
          description: 'Original sale receipt ID',
        },
        saleId: {
          type: 'string',
          format: 'uuid',
          description: 'Sale item ID being returned',
        },
        productId: {
          type: 'string',
          format: 'uuid',
          description: 'Product ID being returned',
        },
        quantity: {
          type: 'integer',
          description: 'Quantity being returned',
        },
        reason: {
          type: 'string',
          enum: ['DEFECTIVE', 'WRONG_ITEM', 'CUSTOMER_REQUEST', 'OTHER'],
          description: 'Return reason',
        },
        reasonDetails: {
          type: 'string',
          nullable: true,
          description: 'Additional details about return reason',
        },
        status: {
          type: 'string',
          enum: ['PENDING', 'PROCESSED', 'CANCELLED'],
          description: 'Return status',
        },
        isExchange: {
          type: 'boolean',
          description: 'Whether this is an exchange',
        },
        exchangeProductId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          description: 'Product ID exchanged for',
        },
        exchangeQuantity: {
          type: 'integer',
          nullable: true,
          description: 'Quantity of exchange product',
        },
        differenceAmount: {
          type: 'number',
          format: 'decimal',
          nullable: true,
          description: 'Difference amount if exchange value differs',
        },
        originalAmount: {
          type: 'number',
          format: 'decimal',
          description: 'Original sale amount',
        },
        returnAmount: {
          type: 'number',
          format: 'decimal',
          description: 'Amount to be returned/refunded',
        },
        processedById: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          description: 'User ID who processed the return',
        },
        processedAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description: 'Processing timestamp',
        },
        notes: {
          type: 'string',
          nullable: true,
          description: 'Optional notes',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Creation timestamp',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Last update timestamp',
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // Path to the API docs
};

export const specs = swaggerJsdoc(options);
