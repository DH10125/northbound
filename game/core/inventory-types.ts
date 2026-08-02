/**
 * Shared inventory types used across core modules.
 */

import type { z } from "zod";
import type { StorageLocationSchema } from "../schemas/inventory";

export type StorageLocation = z.infer<typeof StorageLocationSchema>;
