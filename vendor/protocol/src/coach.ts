import { z } from 'zod';
import type { JsonValue } from './json';

export const MCP_PATH = '/mcp';

export const coachContextInput = {
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  utcOffsetMinutes: z.number().int().min(-720).max(840),
};

export const coachContextSchema = z.object(coachContextInput).partial();

export type CoachContext = z.infer<typeof coachContextSchema>;

export function isHiddenInput(key: string): key is keyof CoachContext {
  return Object.hasOwn(coachContextInput, key);
}

export interface ParameterSchema {
  type: 'number' | 'integer' | 'string' | 'boolean';
  description?: string;
  minimum?: number;
  maximum?: number;
  default?: number | string | boolean;
  enum?: string[];
}

export interface ParametersSchema {
  type: 'object';
  properties: Record<string, ParameterSchema>;
  required: string[];
}

export interface CoachToolDeclaration {
  name: string;
  description: string;
  parametersJsonSchema: ParametersSchema;
}

export type ToolArgs = Record<string, number | string | boolean>;

export const coachToolsRequestSchema = z.object({
  context: coachContextSchema.optional(),
  call: z
    .object({
      name: z.string().min(1).max(64),
      arguments: z
        .record(z.string(), z.union([z.number(), z.string(), z.boolean()]))
        .default({}),
    })
    .optional(),
});

export interface CoachToolsListResponse {
  tools: CoachToolDeclaration[];
}

export interface CoachToolsCallResponse {
  result: JsonValue;
}

export interface ToolTextResult {
  content: { type: string; text?: string }[];
  isError?: boolean;
}

export function toolResult<Output>(value: Output) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  } satisfies ToolTextResult;
}

export function toolResultValue(result: ToolTextResult): JsonValue {
  const text = result.content
    .flatMap(part => (part.type === 'text' && part.text ? [part.text] : []))
    .join('');
  if (result.isError) {
    return { error: text || 'tool failed' };
  }

  // SAFETY: toolResult is the only writer and it serializes JSON.
  return JSON.parse(text) as JsonValue;
}
