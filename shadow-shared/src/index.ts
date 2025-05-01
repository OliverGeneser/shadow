import z from "zod";

const roomDataSchema = z
  .object({
    type: z.literal("create or join"),
    roomId: z.string().optional(),
    publicKey: z.custom<CryptoKey>(),
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
    signal: z.custom<RTCSessionDescription>(),
    to: z.string(),
  })
  .strict();

const signalAnswerDataSchema = z
  .object({
    type: z.literal("signal-answer"),
    signal: z.custom<RTCSessionDescription>(),
    to: z.string(),
  })
  .strict();

const signalCandidateDataSchema = z
  .object({
    type: z.literal("signal-candidate"),
    signal: z.custom<RTCIceCandidate>(),
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

export const clientsSchema = z.array(
  z
    .object({
      clientId: z.string(),
      publicKey: z.custom<CryptoKey>(),
    })
    .strict(),
);

export const clientsResponseSchema = z
  .object({
    type: z.literal("clients"),
    clients: clientsSchema,
  })
  .strict();

export const signalOfferResponseSchema = z
  .object({
    type: z.literal("offer"),
    from: z.string(),
    offer: z.custom<RTCSessionDescriptionInit>(),
  })
  .strict();

export const signalAnswerResponseSchema = z
  .object({
    type: z.literal("answer"),
    from: z.string(),
    answer: z.custom<RTCSessionDescriptionInit>(),
  })
  .strict();

export const signalCandidateResponseSchema = z
  .object({
    type: z.literal("candidate"),
    from: z.string(),
    candidate: z.custom<RTCIceCandidate>(),
  })
  .strict();

export const WSResponse = z.discriminatedUnion("type", [
  createOrJoinResponse,
  leaveResponseSchema,
  clientsResponseSchema,
  signalOfferResponseSchema,
  signalAnswerResponseSchema,
  signalCandidateResponseSchema,
]);

export type CreateOrJoinResponse = z.infer<typeof createOrJoinResponse>;

export type LeaveResponse = z.infer<typeof leaveResponseSchema>;

export type ClientsResponse = z.infer<typeof clientsResponseSchema>;

export type Clients = z.infer<typeof clientsSchema>;

export type OfferResponse = z.infer<typeof signalOfferResponseSchema>;

export type AnswerResponse = z.infer<typeof signalAnswerResponseSchema>;

export type CandidateResponse = z.infer<typeof signalCandidateResponseSchema>;

export const ZodError = z.ZodError;

export const colorMap: { [key: string]: string } = {
  Azure: "#007FFF",
  Beige: "#A89C8C",
  Brick: "#CB4154",
  Bronze: "#CD7F32",
  Charcoal: "#36454F",
  Coral: "#FF6F61",
  Cyan: "#00AEEF",
  Emerald: "#50C878",
  Fawn: "#C89B6E",
  Indigo: "#4B0082",
  Jade: "#00A86B",
  Lavender: "#916BBF",
  Maroon: "#800000",
  Olive: "#5A6E41",
  Peach: "#E9967A",
  Rosewood: "#65000B",
  Sapphire: "#0F52BA",
  Teal: "#008080",
  Walnut: "#5D3A1A",
  Amethyst: "#9966CC",
  Mahogany: "#420D09",
  Plum: "#8E4585",
  Midnight: "#191970",
  Forest: "#228B22",
  Rust: "#B7410E",
  Burgundy: "#800020",
  Moss: "#556B2F",
  PrussianBlue: "#003153",
  Aubergine: "#580F41",
  DeepSea: "#095859",
  Cobalt: "#0047AB",
  Onyx: "#353839",
  Mulberry: "#70193D",
  Sepia: "#704214",
  Sienna: "#882D17",
  Slate: "#2F4F4F",
  Pine: "#01796F",
  Raspberry: "#872657",
  Petrol: "#005F6A",
  Eggplant: "#311432",
};
