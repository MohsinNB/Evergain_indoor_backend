// scripts/makeModule.ts
// Usage: npm run makemodule <moduleName>
// Example: npm run makemodule ground

import fs from "fs";
import path from "path";

const moduleName = process.argv[2];

if (!moduleName) {
  console.error(
    "❌ Please provide a module name. Example: npm run makemodule ground",
  );
  process.exit(1);
}

const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);
const Module = capitalize(moduleName);
const lowerModule = moduleName.toLowerCase();

// Base path
const basePath = path.join(process.cwd(), "src", "modules", lowerModule);
if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });

// ===== Interface =====
fs.writeFileSync(
  path.join(basePath, `${lowerModule}.interface.ts`),
  `// TODO: Define the ${Module} interface

export interface I${Module} {
  _id: string;
  createdAt?: Date;
  updatedAt?: Date;
}
`,
);

// ===== Validation =====
fs.writeFileSync(
  path.join(basePath, `${lowerModule}.validation.ts`),
  `import { z } from "zod";

// TODO: Define Zod schemas for ${Module} requests

export const create${Module}Schema = z.object({
  // example: name: z.string().min(1).max(100).trim(),
});

export type Create${Module}Input = z.infer<typeof create${Module}Schema>;
`,
);

// ===== Model =====
fs.writeFileSync(
  path.join(basePath, `${lowerModule}.model.ts`),
  `import mongoose, { Schema } from "mongoose";
import { I${Module} } from "./${lowerModule}.interface";

// TODO: Define the ${Module} schema

const ${lowerModule}Schema = new Schema<I${Module}>(
  {
    // fields here
  },
  { timestamps: true },
);

export const ${Module}Model = mongoose.model<I${Module}>("${Module}", ${lowerModule}Schema);
`,
);

// ===== Service =====
fs.writeFileSync(
  path.join(basePath, `${lowerModule}.service.ts`),
  `import { ${Module}Model } from "./${lowerModule}.model";
import CustomError from "../../helpers/CustomError";

// TODO: Implement ${Module} service functions

export const ${lowerModule}Service = {
  // example:
  // getAll: async () => {
  //   return ${Module}Model.find().lean();
  // },
};
`,
);

// ===== Controller =====
fs.writeFileSync(
  path.join(basePath, `${lowerModule}.controller.ts`),
  `import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import ApiResponse from "../../utils/apiResponse";
import { ${lowerModule}Service } from "./${lowerModule}.service";

// TODO: Implement ${Module} controllers

export const getAll${Module}s = asyncHandler(async (req: Request, res: Response) => {
  // const result = await ${lowerModule}Service.getAll();
  ApiResponse.sendSuccess(res, 200, "${Module}s fetched successfully");
});
`,
);

// ===== Routes =====
fs.writeFileSync(
  path.join(basePath, `${lowerModule}.route.ts`),
  `import express from "express";
import { getAll${Module}s } from "./${lowerModule}.controller";
import { validateRequest } from "../../middleware/validateRequest.middleware";
import { create${Module}Schema } from "./${lowerModule}.validation";

const router = express.Router();

// TODO: Define ${Module} routes
// router.get("/", getAll${Module}s);

export default router;
`,
);

console.log(`✅ Module "${lowerModule}" created at src/modules/${lowerModule}/`);
console.log(`   Files created:`);
console.log(`   - ${lowerModule}.interface.ts`);
console.log(`   - ${lowerModule}.validation.ts`);
console.log(`   - ${lowerModule}.model.ts`);
console.log(`   - ${lowerModule}.service.ts`);
console.log(`   - ${lowerModule}.controller.ts`);
console.log(`   - ${lowerModule}.route.ts`);
