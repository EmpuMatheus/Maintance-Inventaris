import { z } from 'zod';

export const DEVICE_TYPE_VALUES = ['DVR', 'NVR', 'RECORDER'] as const;

export const createSchema = z.object({
  name: z.string().trim().min(1, 'Device name is required.').max(150),
  deviceType: z.enum(DEVICE_TYPE_VALUES).default('DVR'),
  subcategoryId: z.string().uuid('Invalid subcategory id.').optional().nullable(),
  brand: z.string().trim().max(150).optional().nullable(),
  model: z.string().trim().max(150).optional().nullable(),
  ipAddress: z.string().ip({ version: 'v4', message: 'Invalid IPv4 address.' }),
  port: z.coerce.number().int().min(1).max(65535).default(80),
  rtspPort: z.coerce.number().int().min(1).max(65535).default(554),
  username: z.string().trim().max(150).optional().nullable(),
  password: z.string().max(512).optional().nullable(),
  location: z.string().trim().max(255).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  deviceType: z.enum(DEVICE_TYPE_VALUES).optional(),
  subcategoryId: z.string().uuid('Invalid subcategory id.').optional().nullable(),
  brand: z.string().trim().max(150).optional().nullable(),
  model: z.string().trim().max(150).optional().nullable(),
  ipAddress: z.string().ip({ version: 'v4', message: 'Invalid IPv4 address.' }).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  rtspPort: z.coerce.number().int().min(1).max(65535).optional(),
  username: z.string().trim().max(150).optional().nullable(),
  password: z.string().max(512).optional().nullable(),
  location: z.string().trim().max(255).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const setStatusSchema = z.object({
  isActive: z.boolean(),
});

/**
 * Test RTSP Connection body. Both fields are optional: the default probe is
 * channel 1 sub stream. `channel` must be a positive integer when supplied.
 */
export const testRtspSchema = z.object({
  channel: z.coerce.number().int().min(1).max(1024).optional(),
  includeMain: z.boolean().optional(),
});

export const updateChannelSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  location: z.string().trim().max(255).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  // Optional Stream URI correction for a specific profile of the channel.
  streamProfileId: z.string().uuid('Invalid stream profile id.').optional(),
  streamUri: z.string().trim().max(2000).optional().nullable(),
});

/**
 * Live View session creation. `streamKind` defaults to the main stream; the
 * channel must belong to the device (validated in the service).
 */
export const createLiveSessionSchema = z.object({
  deviceId: z.string().uuid('Invalid device id.'),
  channelId: z.string().uuid('Invalid channel id.'),
  streamKind: z.enum(['MAIN', 'SUB']).default('MAIN'),
});
