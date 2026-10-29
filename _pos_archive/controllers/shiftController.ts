import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { generateNextShiftNumber } from '../services/shiftNumberService';
import { ShiftStatus } from '@prisma/client';

/**
 * Open a new shift for a counter
 */
export const openShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { counterId, openingBalance } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (!counterId) {
      res.status(400).json({
        success: false,
        message: 'Counter ID is required',
      });
      return;
    }

    // Validate counter exists
    const counter = await prisma.counter.findUnique({
      where: { id: counterId },
      include: { store: true },
    });

    if (!counter) {
      res.status(404).json({
        success: false,
        message: 'Counter not found',
      });
      return;
    }

    // Check if there's already an open shift for this counter
    const existingOpenShift = await prisma.shift.findFirst({
      where: {
        counterId,
        status: 'OPEN',
      },
    });

    if (existingOpenShift) {
      res.status(400).json({
        success: false,
        message: 'There is already an open shift for this counter. Please close it first.',
        data: existingOpenShift,
      });
      return;
    }

    // Generate shift number
    const shiftNumber = await generateNextShiftNumber();

    // Create shift
    const shift = await prisma.shift.create({
      data: {
        shiftNumber,
        counterId,
        openedById: userId,
        openingBalance: openingBalance || 0,
        status: 'OPEN',
      },
      include: {
        counter: {
          include: {
            store: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        openedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: shift,
      message: 'Shift opened successfully',
    });
  } catch (error) {
    console.error('Error opening shift:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to open shift',
    });
  }
};

/**
 * Close a shift
 */
export const closeShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { actualBalance, notes } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    // Get shift
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        counter: {
          include: {
            store: true,
          },
        },
        sales: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!shift) {
      res.status(404).json({
        success: false,
        message: 'Shift not found',
      });
      return;
    }

    if (shift.status === 'CLOSED') {
      res.status(400).json({
        success: false,
        message: 'Shift is already closed',
      });
      return;
    }

    // Calculate expected balance
    // Expected = opening balance + cash sales - cash returns
    // For now, we'll assume all sales are cash (we'll enhance this when payment methods are added)
    const cashSales = shift.sales.reduce((sum, sale) => {
      // TODO: Filter by payment method when payment system is implemented
      // For now, sum all sales
      return sum + Number(sale.product.price || 0) * sale.quantitySold;
    }, 0);

    const expectedBalance = Number(shift.openingBalance) + cashSales;
    const actual = actualBalance !== undefined ? Number(actualBalance) : null;
    const difference = actual !== null ? actual - expectedBalance : null;

    // Update shift
    const updatedShift = await prisma.shift.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedById: userId,
        closingBalance: actual,
        expectedBalance,
        actualBalance: actual,
        difference,
        notes,
        closedAt: new Date(),
      },
      include: {
        counter: {
          include: {
            store: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        openedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        closedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sales: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: updatedShift,
      message: 'Shift closed successfully',
    });
  } catch (error) {
    console.error('Error closing shift:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to close shift',
    });
  }
};

/**
 * Get current active shift for a counter
 */
export const getCurrentShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { counterId } = req.query;

    if (!counterId) {
      res.status(400).json({
        success: false,
        message: 'Counter ID is required',
      });
      return;
    }

    const shift = await prisma.shift.findFirst({
      where: {
        counterId: counterId as string,
        status: 'OPEN',
      },
      include: {
        counter: {
          include: {
            store: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        openedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sales: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
      orderBy: {
        openedAt: 'desc',
      },
    });

    if (!shift) {
      res.status(404).json({
        success: false,
        message: 'No active shift found for this counter',
      });
      return;
    }

    // Calculate summary
    const totalSales = shift.sales.reduce((sum, sale) => {
      return sum + Number(sale.product.price || 0) * sale.quantitySold;
    }, 0);

    const summary = {
      shiftNumber: shift.shiftNumber,
      openingBalance: Number(shift.openingBalance),
      totalSales,
      expectedBalance: Number(shift.openingBalance) + totalSales,
      transactionCount: shift.sales.length,
      openedAt: shift.openedAt,
    };

    res.json({
      success: true,
      data: {
        ...shift,
        summary,
      },
    });
  } catch (error) {
    console.error('Error getting current shift:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get current shift',
    });
  }
};

/**
 * Get all shifts with filters
 */
export const getAllShifts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      storeId,
      counterId,
      status,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (counterId) {
      where.counterId = counterId as string;
    }

    if (status) {
      where.status = status as ShiftStatus;
    }

    if (startDate || endDate) {
      where.openedAt = {};
      if (startDate) {
        where.openedAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.openedAt.lte = new Date(endDate as string);
      }
    }

    // If storeId is provided, filter by counter's store
    if (storeId) {
      const counters = await prisma.counter.findMany({
        where: { storeId: storeId as string },
        select: { id: true },
      });
      where.counterId = {
        in: counters.map((c) => c.id),
      };
    }

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        include: {
          counter: {
            include: {
              store: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          openedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          closedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              sales: true,
            },
          },
        },
        orderBy: {
          openedAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.shift.count({ where }),
    ]);

    res.json({
      success: true,
      data: shifts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error getting shifts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get shifts',
    });
  }
};

/**
 * Get shift by ID with details
 */
export const getShiftById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        counter: {
          include: {
            store: {
              select: {
                id: true,
                name: true,
                address: true,
                contact: true,
              },
            },
          },
        },
        openedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        closedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sales: {
          include: {
            product: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!shift) {
      res.status(404).json({
        success: false,
        message: 'Shift not found',
      });
      return;
    }

    // Calculate summary
    const totalSales = shift.sales.reduce((sum, sale) => {
      return sum + Number(sale.product.price || 0) * sale.quantitySold;
    }, 0);

    const summary = {
      shiftNumber: shift.shiftNumber,
      openingBalance: Number(shift.openingBalance),
      totalSales,
      expectedBalance: Number(shift.openingBalance) + totalSales,
      actualBalance: shift.actualBalance ? Number(shift.actualBalance) : null,
      difference: shift.difference ? Number(shift.difference) : null,
      transactionCount: shift.sales.length,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
    };

    res.json({
      success: true,
      data: {
        ...shift,
        summary,
      },
    });
  } catch (error) {
    console.error('Error getting shift:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get shift',
    });
  }
};

