import Ground from "./ground.model";
import { IGround, ISlotView } from "./ground.interface";
import { CreateGroundInput, UpdateGroundSettingsInput } from "./ground.validation";
import CustomError from "../../helpers/CustomError";

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
  return Ground.find(filter).sort({ createdAt: -1 }).lean() as Promise<IGround[]>;
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

  // Fallback: get the first active ground
  const ground = await Ground.findOne({ isActive: true }).lean();
  if (!ground) {
    throw new CustomError(404, "No active ground found in the system.");
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

  let cursor = openingTime;

  while (true) {
    const slotStart = cursor;
    const slotEnd = addMinutes(slotStart, slotDurationMinutes);

    if (toMinutes(slotEnd) > toMinutes(closingTime)) break;

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

    cursor = slotEnd;
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
): Promise<IGround> => {
  const ground = await Ground.findById(id);
  if (!ground) {
    throw new CustomError(404, "Ground not found.");
  }

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
  return ground;
};
