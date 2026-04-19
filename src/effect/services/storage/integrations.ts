import { Context, Layer } from "effect";
import type { IntegrationConnection } from "~/effect/services/integrations/types";
import { createStorage, type Storage } from "./index";

/**
 * Storage schema for saved integration connections.
 * Key: connectionId, Value: serialised IntegrationConnection.
 * We store the index of known connectionIds separately so we can enumerate them.
 */
export interface IntegrationConnectionStorage {
  /** JSON array of connectionIds */
  _index: string[];
  [connectionId: string]: IntegrationConnection | string[];
}

export class IntegrationConnectionStorageService extends Context.Tag(
  "IntegrationConnectionStorageService"
)<
  IntegrationConnectionStorageService,
  Storage<IntegrationConnectionStorage>
>() {}

export const IntegrationConnectionStorageServiceLayer = Layer.sync(
  IntegrationConnectionStorageService,
  () => createStorage<IntegrationConnectionStorage>("integration_")
);
