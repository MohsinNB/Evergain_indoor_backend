import Ground from "./ground.model";
import { IGround, ISlotView } from "./ground.interface";
import { CreateGroundInput, UpdateGroundSettingsInput } from "./ground.validation";
import CustomError from "../../helpers/CustomError";

// ── Constants ──────────────────────────────────────────────────────────────

/** 48-hour early-bird discount amount (BDT) per AGENTS.md §5 */
const EARLY_BIRD_DISCOUNT_AMOUNT = 50;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Converts "HH:mm" to total minutes since midnight.
 * Used only for arithmetic — never stored.
 */
const toMinutes = (hhMm: string): number => {
  const parts = hhMm.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
};

/**
 * Adds `minutes` to a "HH:mm" string and returns a new "HH:mm" string.
 */
const addMinutes = (hhMm: string, minutes: number): string => {
  const total = toMinutes(hhMm) + minutes;
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
};

/**
 * Returns the current Asia/Dhaka wall-clock time as "HH:mm".
 * Used only for the 48-hour discount window check.
 */
const nowDhakaHHMM = (): string => {
  return new Date()
    .toLocaleTimeString("en-BD", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .slice(0, 5);
};

/**
 * Returns the current Asia/Dhaka wall-clock date as "YYYY-MM-DD".
 */
const todayDhaka = (): string => {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }); // "en-CA" gives YYYY-MM-DD
};

/**
 * Checks whether `slotDate + slotStartTime` is within the 48-hour
 * discount window relative to now (Asia/Dhaka).
 *
 * The window opens when:  now >= slotStartDateTime - 48h
 * i.e. the slot starts within the next 48 hours from this moment.
 *
 * We compare using plain strings (YYYY-MM-DD + HH:mm) so no UTC
 * conversion corrupts the slot identity — only the *threshold* point
 * uses a real Date for arithmetic.
 */
const isWithin48HourWindow = (slotDate: string, slotStartTime: string): boolean => {
  // Build a real UTC Date for the threshold: now + 48h
  const nowMs = Date.now();
  const thresholdMs = nowMs + 48 * 60 * 60 * 1000;
  const threshold = new Date(thresholdMs);

  // Parse the slot's wall-clock date+time into a Date using Asia/Dhaka.
  // We construct an ISO-like string that toLocaleString can interpret.
  const dateParts = slotDate.split("-").map(Number);
  const timeParts = slotStartTime.split(":").map(Number);
  const year = dateParts[0] ?? 0;
  const month = dateParts[1] ?? 1;
  const day = dateParts[2] ?? 1;
  const hour = timeParts[0] ?? 0;
  const minute = timeParts[1] ?? 0;

  // Create a UTC-equivalent date by constructing it in the Dhaka offset (+0600).
  // Dhaka is UTC+6, so: wallClock - 6h = UTC
  const slotUtcMs = Date.UTC(year, month - 1, day, hour - 6, minute);

  // Discount applies if slot starts at or before threshold (i.e. starts within 48h)
  return slotUtcMs <= thresholdMs;
};

// ── Service functions ──────────────────────────────────────────────────────

/**
 * Returns the single active ground.
 * The system is designed for one ground initially (AGENTS.md §1).
 */
export const getActiveGround = async (): Promise<IGround> => {
  const ground = await Ground.findOne({ isActive: true }).lean();
  if (!ground) {
    throw new CustomError(404, "No active ground found.");
  }
  return ground as IGround;
};

/**
 * Returns the ground by ID regardless of active status.
 */
export const getGroundById = async (id: string): Promise<IGround> => {
  const ground = await Ground.findById(id).lean();
  if (!ground) {
    throw new CustomError(404, "Ground not found.");
  }
  return ground as IGround;
};

/**
 * Generates the full list of time slots for a ground on a given date,
 * each annotated with availability and price (including 48h discount if applicable).
 *
 * Availability is computed, never stored — a slot is "available" iff
 * there is no PENDING or BOOKED booking for it (AGENTS.md §3).
 *
 * @param ground  The ground document
 * @param date    "YYYY-MM-DD" — Asia/Dhaka wall-clock date
 * @param bookedStartTimes  Set of startTime strings ("HH:mm") that are PENDING or BOOKED on this date
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

    // Stop once we'd exceed the closing time
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

/**
 * Checks whether a given date is a closure date for the ground.
 */
export const isClosureDate = (ground: IGround, date: string): boolean => {
  return ground.closures.some((c) => c.date === date);
};

/**
 * Creates a new ground. Admin-only, super_admin enforced in the route.
 */
export const createGround = async (data: CreateGroundInput): Promise<IGround> => {
  const ground = await Ground.create(data);
  return ground;
};

/**
 * Updates the active ground's settings.
 * Handles addClosures / removeClosureDates merge logic.
 */
export const updateGroundSettings = async (
  id: string,
  update: UpdateGroundSettingsInput,
): Promise<IGround> => {
  const ground = await Ground.findById(id);
  if (!ground) {
    throw new CustomError(404, "Ground not found.");
  }

  // Apply plain field updates (excludes addClosures/removeClosureDates)
  const { addClosures, removeClosureDates, ...plainFields } = update;

  // Assign defined fields only
  if (plainFields.name !== undefined) ground.name = plainFields.name;
  if (plainFields.location !== undefined) ground.location = plainFields.location;
  if (plainFields.openingTime !== undefined) ground.openingTime = plainFields.openingTime;
  if (plainFields.closingTime !== undefined) ground.closingTime = plainFields.closingTime;
  if (plainFields.slotDurationMinutes !== undefined) ground.slotDurationMinutes = plainFields.slotDurationMinutes;
  if (plainFields.pricePerSlot !== undefined) ground.pricePerSlot = plainFields.pricePerSlot;
  if (plainFields.isActive !== undefined) ground.isActive = plainFields.isActive;

  // Remove specified closure dates
  if (removeClosureDates && removeClosureDates.length > 0) {
    ground.closures = ground.closures.filter(
      (c) => !removeClosureDates.includes(c.date),
    ) as IGround["closures"];
  }

  // Add new closures (skip duplicates by date)
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
