import Ground from "./ground.model";
import { IGround, ISlotView } from "./ground.interface";
import { CreateGroundInput, UpdateGroundSettingsInput } from "./ground.validation";
import CustomError from "../../helpers/CustomError";
import { logAuditAction } from "../auditLog/auditLog.service";

const EARLY_BIRD_DISCOUNT_AMOUNT = 50;

/** Converts "HH:mm" to total minutes since midnight */
const toMinutes = (hhMm: string): number => {
  const parts = hhMm.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
};

/** Adds minutes to a "HH:mm" time string */
const addMinutes = (hhMm: string, minutes: number): string => {
  const total = toMinutes(hhMm) + minutes;
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
};

/**
 * Checks whether slot starts within the 48-hour early-bird discount window.
 */
const isWithin48HourWindow = (slotDate: string, slotStartTime: string): boolean => {
  const nowMs = Date.now();
  const thresholdMs = nowMs + 48 * 60 * 60 * 1000;

  const dateParts = slotDate.split("-").map(Number);
  const timeParts = slotStartTime.split(":").map(Number);
  const year = dateParts[0] ?? 0;
  const month = dateParts[1] ?? 1;
  const day = dateParts[2] ?? 1;
  const hour = timeParts[0] ?? 0;
  const minute = timeParts[1] ?? 0;

  const slotUtcMs = Date.UTC(year, month - 1, day, hour - 6, minute);
  return slotUtcMs <= thresholdMs;
};

/** Get all grounds (onlyActive = true for public, false for admin) */
export const getAllGrounds = async (onlyActive = false): Promise<IGround[]> => {
  const filter = onlyActive ? { isActive: true } : {};
  let grounds = await Ground.find(filter).sort({ createdAt: -1 }).lean();

  if (grounds.length === 0) {
    const created = await Ground.create({
      name: "Evergain Avenue — Main Pitch",
      location: "Block C, Bashundhara R/A, Dhaka",
      openingTime: "06:00",
      closingTime: "24:00",
      slotDurationMinutes: 60,
      pricePerSlot: 1000,
      isActive: true,
      closures: [],
    });
    grounds = [created.toObject() as any];
  }

  return grounds as IGround[];
};

/** Get ground for slot availability computation */
export const getGroundForSlots = async (groundId?: string): Promise<IGround> => {
  if (groundId) {
    const ground = await Ground.findById(groundId).lean();
    if (!ground || !ground.isActive) {
      throw new CustomError(404, "Active ground not found with the provided ID.");
    }
    return ground as IGround;
  }

  // Fallback: get the first active ground (auto-create default if DB is fresh)
  let ground = await Ground.findOne({ isActive: true }).lean();
  if (!ground) {
    const created = await Ground.create({
      name: "Evergain Avenue — Main Pitch",
      location: "Block C, Bashundhara R/A, Dhaka",
      openingTime: "06:00",
      closingTime: "24:00",
      slotDurationMinutes: 60,
      pricePerSlot: 1000,
      isActive: true,
      closures: [],
    });
    ground = created.toObject() as any;
  }
  return ground as IGround;
};

/** Get ground by ID */
export const getGroundById = async (id: string): Promise<IGround> => {
  const ground = await Ground.findById(id).lean();
  if (!ground) {
    throw new CustomError(404, "Ground not found.");
  }
  return ground as IGround;
};

const formatMinutes = (totalMinutes: number): string => {
  const normalized = totalMinutes % (24 * 60);
  const hh = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const mm = (normalized % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
};

/**
 * Generates slot array for a given date with computed availability & pricing.
 */
export const buildSlotViews = (
  ground: IGround,
  date: string,
  bookedStartTimes: Set<string>,
): ISlotView[] => {
  const slots: ISlotView[] = [];
  const { openingTime, closingTime, slotDurationMinutes, pricePerSlot } = ground;

  const startMin = toMinutes(openingTime);
  let endMin = toMinutes(closingTime);

  // If closingTime <= openingTime (e.g., 03:00 <= 06:00), closing time is early morning next day (+24h)
  if (endMin <= startMin) {
    endMin += 24 * 60;
  }

  let cursorMin = startMin;

  while (cursorMin + slotDurationMinutes <= endMin) {
    const slotStart = formatMinutes(cursorMin);
    const slotEnd = formatMinutes(cursorMin + slotDurationMinutes);

    const isUnavailable = bookedStartTimes.has(slotStart);
    const within48h = isWithin48HourWindow(date, slotStart);
    const isDiscounted = within48h && !isUnavailable;
    const finalPrice = isDiscounted ? pricePerSlot - EARLY_BIRD_DISCOUNT_AMOUNT : pricePerSlot;

    slots.push({
      startTime: slotStart,
      endTime: slotEnd,
      price: finalPrice,
      isDiscounted,
      originalPrice: pricePerSlot,
      status: isUnavailable ? "unavailable" : "available",
    });

    cursorMin += slotDurationMinutes;
  }

  return slots;
};

/** Check if date is a ground closure date */
export const isClosureDate = (ground: IGround, date: string): boolean => {
  return ground.closures.some((c) => c.date === date);
};

/** Create ground */
export const createGround = async (data: CreateGroundInput): Promise<IGround> => {
  const ground = await Ground.create(data);
  return ground;
};

/** Update ground settings and manage closure dates */
export const updateGroundSettings = async (
  id: string,
  update: UpdateGroundSettingsInput,
  adminId?: string,
): Promise<IGround> => {
  const ground = await Ground.findById(id);
  if (!ground) {
    throw new CustomError(404, "Ground not found.");
  }

  const beforeState = {
    name: ground.name,
    openingTime: ground.openingTime,
    closingTime: ground.closingTime,
    pricePerSlot: ground.pricePerSlot,
    isActive: ground.isActive,
    closuresCount: ground.closures.length,
  };

  const { addClosures, removeClosureDates, ...plainFields } = update;

  if (plainFields.name !== undefined) ground.name = plainFields.name;
  if (plainFields.location !== undefined) ground.location = plainFields.location;
  if (plainFields.openingTime !== undefined) ground.openingTime = plainFields.openingTime;
  if (plainFields.closingTime !== undefined) ground.closingTime = plainFields.closingTime;
  if (plainFields.slotDurationMinutes !== undefined) ground.slotDurationMinutes = plainFields.slotDurationMinutes;
  if (plainFields.pricePerSlot !== undefined) ground.pricePerSlot = plainFields.pricePerSlot;
  if (plainFields.isActive !== undefined) ground.isActive = plainFields.isActive;

  if (removeClosureDates && removeClosureDates.length > 0) {
    ground.closures = ground.closures.filter(
      (c) => !removeClosureDates.includes(c.date),
    ) as IGround["closures"];
  }

  if (addClosures && addClosures.length > 0) {
    const existingDates = new Set(ground.closures.map((c) => c.date));
    for (const closure of addClosures) {
      if (!existingDates.has(closure.date)) {
        ground.closures.push(closure);
        existingDates.add(closure.date);
      }
    }
  }

  await ground.save();

  // Audit Log
  await logAuditAction({
    actorId: adminId,
    actorRole: "admin",
    action: "ground.settings_update",
    targetId: String(ground._id),
    beforeState,
    afterState: {
      name: ground.name,
      pricePerSlot: ground.pricePerSlot,
      isActive: ground.isActive,
      closuresCount: ground.closures.length,
    },
  });

  return ground;
};
