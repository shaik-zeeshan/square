import type { UserDto } from "@jellyfin/sdk/lib/generated-client/models/user-dto";
import type { RecommendedServerInfo } from "@jellyfin/sdk/lib/models/recommended-server-info";
import { Context, Layer } from "effect";
import { createStorage, type Storage } from "./index";

interface AuthStorage {
  user: UserDto | null;
  accessToken: string | null;
  server: RecommendedServerInfo | null;
}

export class AuthStorageService extends Context.Tag("AuthStorageService")<
  AuthStorageService,
  Storage<AuthStorage>
>() {}

export const AuthStorageServiceLayer = Layer.sync(AuthStorageService, () =>
  createStorage<AuthStorage>("auth_")
);
