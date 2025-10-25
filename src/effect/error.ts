import { Data } from "effect";

// HTTP Error
export class HttpError extends Data.TaggedError("HttpError")<{
  status: number;
  message: string;
}> {}

// Auth Error
export class AuthError extends Data.TaggedError("AuthError")<{
  message: string;
}> {}

// biome-ignore lint/complexity/noBannedTypes: Tagged Error
export class NoServerFound extends Data.TaggedError("NoServerFound")<{}> {}

// biome-ignore lint/complexity/noBannedTypes: Tagged Error
export class NoUserFound extends Data.TaggedError("NoUserFound")<{}> {}

// biome-ignore lint/complexity/noBannedTypes: Tagged Error
export class NoTokenFound extends Data.TaggedError("NoTokenFound")<{}> {}

// biome-ignore lint/complexity/noBannedTypes: Tagged Error
export class NoPasswordFound extends Data.TaggedError("NoPasswordFound")<{}> {}

// biome-ignore lint/complexity/noBannedTypes: Tagged Error
export class NoFieldFound extends Data.TaggedError("NoFieldFound")<{}> {}
