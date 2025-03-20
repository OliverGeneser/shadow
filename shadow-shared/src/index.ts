import z from "zod";

const roomDataSchema = z
  .object({
    type: z.literal("create or join"),
    roomId: z.string().optional(),
  })
  .strict();

const leaveDataSchema = z
  .object({
    type: z.literal("leave"),
  })
  .strict();

const clientsDataSchema = z
  .object({
    type: z.literal("clients"),
  })
  .strict();

const signalOfferDataSchema = z
  .object({
    type: z.literal("signal-offer"),
    signal: z.unknown(),
    to: z.string(),
  })
  .strict();

const signalAnswerDataSchema = z
  .object({
    type: z.literal("signal-answer"),
    signal: z.unknown(),
    to: z.string(),
  })
  .strict();

const signalCandidateDataSchema = z
  .object({
    type: z.literal("signal-candidate"),
    signal: z.unknown(),
    to: z.string(),
  })
  .strict();

export const WSRequest = z.discriminatedUnion("type", [
  roomDataSchema,
  leaveDataSchema,
  clientsDataSchema,
  signalOfferDataSchema,
  signalAnswerDataSchema,
  signalCandidateDataSchema,
]);

export type SocketData = z.infer<typeof WSRequest>;

export type RoomData = z.infer<typeof roomDataSchema>;

export type LeaveData = z.infer<typeof leaveDataSchema>;

export type ClientsData = z.infer<typeof clientsDataSchema>;

export type SignalOfferData = z.infer<typeof signalOfferDataSchema>;

export type SignalAnswerData = z.infer<typeof signalAnswerDataSchema>;

export type SignalCandidateData = z.infer<typeof signalCandidateDataSchema>;

export const createOrJoinResponse = z
  .object({
    type: z.literal("ready"),
    metadata: z
      .object({
        clientId: z.string(),
        roomId: z.string(),
      })
      .strict(),
  })
  .strict();

export const leaveResponseSchema = z
  .object({
    type: z.literal("leave"),
    client: z.string(),
  })
  .strict();

export const clientsResponseSchema = z
  .object({
    type: z.literal("clients"),
    clients: z.array(
      z
        .object({
          clientId: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

export const signalOfferResponseSchema = z
  .object({
    type: z.literal("offer"),
    from: z.string(),
    offer: z.unknown(),
  })
  .strict();

export const signalAnswerResponseSchema = z
  .object({
    type: z.literal("answer"),
    from: z.string(),
    answer: z.unknown(),
  })
  .strict();

export const signalCandidateResponseSchema = z
  .object({
    type: z.literal("candidate"),
    from: z.string(),
    candidate: z.unknown(),
  })
  .strict();

export type CreateOrJoinResponse = z.infer<typeof createOrJoinResponse>;

export type LeaveResponse = z.infer<typeof leaveResponseSchema>;

export type ClientsResponse = z.infer<typeof clientsResponseSchema>;

export type OfferResponse = z.infer<typeof signalOfferResponseSchema>;

export type AnswerResponse = z.infer<typeof signalAnswerResponseSchema>;

export type CandidateResponse = z.infer<typeof signalCandidateResponseSchema>;

export const ZodError = z.ZodError;
