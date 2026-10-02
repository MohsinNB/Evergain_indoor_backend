import { Request, Response, NextFunction } from "express";
import {
  getAllGrounds,
  getGroundForSlots,
  buildSlotViews,
  isClosureDate,
  createGround,
  updateGroundSettings,
} from "./ground.service";
import {
  getSlotsQuerySchema,
  createGroundSchema,
  updateGroundSettingsSchema,
} from "./ground.validation";
import { getBookedStartTimes } from "../booking/booking.service";
import CustomError from "../../helpers/CustomError";

/**
 * GET /api/v1/grounds
 * Public endpoint: returns list of all active grounds.
 */
export const getPublicGroundsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const grounds = await getAllGrounds(true);
    res.status(200).json({
      success: true,
      message: "Active grounds fetched successfully.",
      data: grounds,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/slots?date=YYYY-MM-DD&groundId=...
 * Public endpoint: returns time slots with live availability and pricing for a specific ground.
 */
export const getSlots = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = getSlotsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const { date, groundId } = parsed.data;
    const ground = await getGroundForSlots(groundId);

    if (isClosureDate(ground, date)) {
      res.status(200).json({
        success: true,
        message: "Ground is closed on this date.",
        data: {
          groundId: ground._id,
          groundName: ground.name,
          date,
          isClosed: true,
          closureReason:
            ground.closures.find((c) => c.date === date)?.reason ?? null,
          slots: [],
        },
      });
      return;
    }

    const bookedStartTimes = await getBookedStartTimes(String(ground._id), date);
    const slots = buildSlotViews(ground, date, bookedStartTimes);

    res.status(200).json({
      success: true,
      message: "Slots fetched successfully.",
      data: {
        groundId: ground._id,
        groundName: ground.name,
        date,
        isClosed: false,
        pricePerSlot: ground.pricePerSlot,
        slotDurationMinutes: ground.slotDurationMinutes,
        slots,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ground/settings
 * Admin: get all grounds settings list.
 */
export const getGroundSettings = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const grounds = await getAllGrounds(false);
    res.status(200).json({
      success: true,
      message: "Ground settings fetched successfully.",
      data: grounds,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/ground
 * Admin: create a new ground record.
 */
export const createGroundHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = createGroundSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const ground = await createGround(parsed.data);

    res.status(201).json({
      success: true,
      message: "Ground created successfully.",
      data: ground,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/ground/settings/:id
 * Admin: update ground settings and closures.
 */
export const updateGroundSettingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = String(req.params["id"] ?? "").trim();
    if (!id) {
      return next(new CustomError(400, "Ground ID is required."));
    }

    const parsed = updateGroundSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const updated = await updateGroundSettings(id, parsed.data);

    res.status(200).json({
      success: true,
      message: "Ground settings updated successfully.",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
