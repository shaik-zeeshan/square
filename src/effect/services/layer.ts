import { Layer, Logger, type ManagedRuntime } from "effect";
import { IntegrationServiceLayer } from "~/effect/services/integrations/service";
import { IntegrationConnectionStorageServiceLayer } from "~/effect/services/storage/integrations";
import { UpdateSerivceLayer } from "~/effect/services/update/serives";
import { AuthServiceLayer } from "./auth";
import { JellyfinClientServiceLayer } from "./jellyfin/client";
import { JellyfinServiceLayer } from "./jellyfin/service";
import { AuthStorageServiceLayer } from "./storage/auth";
import { ServerStorageServiceLayer } from "./storage/server";

export const LiveLayer = Layer.mergeAll(
  AuthStorageServiceLayer,
  ServerStorageServiceLayer,
  IntegrationConnectionStorageServiceLayer,
  AuthServiceLayer,
  JellyfinClientServiceLayer,
  JellyfinServiceLayer,
  UpdateSerivceLayer,
  IntegrationServiceLayer
).pipe(Layer.provide(Logger.pretty));

export type LiveManagedError = Layer.Layer.Error<typeof LiveLayer>;
export type LiveManagedSuccess = Layer.Layer.Success<typeof LiveLayer>;

export type LiveManagedRuntime = ManagedRuntime.ManagedRuntime<
  LiveManagedSuccess,
  LiveManagedError
>;
