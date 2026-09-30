import { Request, Response, NextFunction } from "express";
import {
  getActiveGround,
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
import CustomError from "../../helpers/CustomError";

// ── Public ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/slots?date=YYYY-MM-DD
 *
 * Returns all generated time slots for the active ground on the given date,
 * each with current availability (computed) and effective price (with 48h
 * discount if applicable).
 *
 * Bookings are injected by the booking module once it exists. For now the
 * controller fetches the ground and delegates slot-building to the service.
 * The booking service will expose getBookedStartTimes() which is imported here.
 */
export const getSlots = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Validate query params
    const parsed = getSlotsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "unknown"),
        message: i.message,
      }));
      return next(new CustomError(400, "Validation failed", errors));
    }

    const { date } = parsed.data;

    const ground = await getActiveGround();

    // If this date is a closure, return no slots
    if (isClosureDate(ground, date)) {
      res.status(200).json({
        success: true,
        message: "Ground is closed on this date.",
        data: {
          groundId: ground._id,
          date,
          isClosed: true,
          closureReason:
            ground.closures.find((c) => c.date === date)?.reason ?? null,
          slots: [],
        },
      });
      return;
    }

    // ── Booking integration point ──────────────────────────────────────────
    // Once the booking module is built, replace the empty Set below with:
    //   import { getBookedStartTimes } from "../booking/booking.service";
    //   const bookedStartTimes = await getBookedStartTimes(String(ground._id), date);
    // For now no bookings exist so every slot is available.
    const bookedStartTimes: Set<string> = new Set();

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

// ── Admin ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/ground/settings
 * Admin: get the active ground's full settings document.
 */
export const getGroundSettings = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ground = await getActiveGround();
    res.status(200).json({
      success: true,
      message: "Ground settings fetched successfully.",
      data: ground,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/ground
 * Admin (super_admin only): create the ground record.
 * Should only be called once during initial setup.
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
 * Admin (super_admin only): update ground settings, add/remove closures.
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
