import { Data } from "effect";

export class HttpError extends Data.TaggedError("HttpError")<{
  status: number;
  message: string;
}> {}
