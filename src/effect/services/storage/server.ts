import type { RecommendedServerInfo } from "@jellyfin/sdk/lib/models/recommended-server-info";
import { Context, Layer } from "effect";
import { createStorage, type Storage } from "./index";

interface ServerStorage {
  list: RecommendedServerInfo[];
  users: Record<string, string[]>;
}

export class ServerStorageService extends Context.Tag("ServerStorageService")<
  ServerStorageService,
  Storage<ServerStorage>
>() {}

export const ServerStorageServiceLayer = Layer.sync(ServerStorageService, () =>
  createStorage<ServerStorage>("server_")
);
