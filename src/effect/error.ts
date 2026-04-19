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

// biome-ignore lint/complexity/noBannedTypes: Tagged Error
export class NoEpisodeFound extends Data.TaggedError("NoEpisodeFound")<{}> {}

export class MutationError extends Data.TaggedError("MutationError")<{
  mutation: string;
  message: string;
}> {}

// biome-ignore lint/complexity/noBannedTypes: Tagged Error
export class NoUpdateFound extends Data.TaggedError("NoUpdateFound")<{}> {}

// ---------------------------------------------------------------------------
// Integration errors
// ---------------------------------------------------------------------------

// biome-ignore lint/complexity/noBannedTypes: Tagged Error
export class NoPluginFound extends Data.TaggedError("NoPluginFound")<{}> {}

// biome-ignore lint/complexity/noBannedTypes: Tagged Error
export class NoConnectionFound extends Data.TaggedError("NoConnectionFound")<{}> {}

export class IntegrationSecretError extends Data.TaggedError(
  "IntegrationSecretError"
)<{ message: string; kind?: "not-found" | "storage-failure" }> {}

// biome-ignore lint/complexity/noBannedTypes: Tagged Error
export class NoAdapterFound extends Data.TaggedError("NoAdapterFound")<{}> {}

// biome-ignore lint/complexity/noBannedTypes: Tagged Error
export class CapabilityNotSupported extends Data.TaggedError("CapabilityNotSupported")<{}> {}

export class IntegrationOperationError extends Data.TaggedError(
  "IntegrationOperationError"
)<{ message: string }> {}
