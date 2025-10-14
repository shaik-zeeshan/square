import type { RecommendedServerInfo } from "@jellyfin/sdk";
import { appDataDir } from "@tauri-apps/api/path";
import { type Client, Stronghold } from "@tauri-apps/plugin-stronghold";

export interface UserCredential {
  password: string;
  saved_at: number;
}

export interface StrongholdService {
  saveCredentials: (
    server: RecommendedServerInfo,
    username: string,
    password: string
  ) => Promise<void>;
  getCredentials: (
    server: RecommendedServerInfo,
    username: string
  ) => Promise<UserCredential>;
  deleteUser: (
    server: RecommendedServerInfo,
    username: string
  ) => Promise<void>;
  hasCredentials: (
    server: RecommendedServerInfo,
    username: string
  ) => Promise<boolean>;
  preInitialize: () => Promise<void>;
}

let strongholdInstance: Stronghold | null = null;

export const getStrongholdService = async (
  vaultPath: string,
  vaultPassword: string
): Promise<Stronghold> => {
  if (!strongholdInstance) {
    strongholdInstance = await Stronghold.load(vaultPath, vaultPassword);
  }
  return strongholdInstance;
};

class StrongholdServiceImpl implements StrongholdService {
  private stronghold: Stronghold | null = null;
  private client: Client | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      const vaultPath = `${await appDataDir()}/vault.hold`;
      const vaultPassword = "sreal-vault-password"; // This should come from OS keyring in production

      this.stronghold = await getStrongholdService(vaultPath, vaultPassword);
      try {
        this.client = await this.stronghold.loadClient("sreal_credentials");
      } catch {
        this.client = await this.stronghold.createClient("sreal_credentials");
      }
      this.initialized = true;
    } catch (error) {
      this.initializationPromise = null; // Reset so we can retry
      throw new Error(`Failed to initialize Stronghold: ${error}`);
    }
  }

  private createKey(serverAddress: string, username: string): string {
    return `${serverAddress}:${username}`;
  }

  async preInitialize(): Promise<void> {
    await this.initialize();
  }

  async saveCredentials(
    server: RecommendedServerInfo,
    username: string,
    password: string
  ): Promise<void> {
    try {
      await this.initialize();
      if (!this.client) {
        throw new Error("Client not initialized");
      }

      const store = this.client.getStore();
      const key = this.createKey(server.address, username);

      const credential: UserCredential = {
        password,
        saved_at: Date.now(),
      };

      const data = Array.from(
        new TextEncoder().encode(JSON.stringify(credential))
      );
      await store.insert(key, data);

      await this.stronghold?.save();
    } catch (error) {
      throw new Error(`Failed to save credentials: ${error}`);
    }
  }

  async getCredentials(
    server: RecommendedServerInfo,
    username: string
  ): Promise<UserCredential> {
    try {
      await this.initialize();
      if (!this.client) {
        throw new Error("Client not initialized");
      }

      const store = this.client.getStore();
      const key = this.createKey(server.address, username);

      const data = await store.get(key);
      if (!data) {
        throw new Error("Credential not found");
      }
      const credential = JSON.parse(
        new TextDecoder().decode(new Uint8Array(data))
      ) as UserCredential;
      return credential;
    } catch (error) {
      throw new Error(`Failed to get credentials: ${error}`);
    }
  }

  async deleteUser(
    server: RecommendedServerInfo,
    username: string
  ): Promise<void> {
    try {
      await this.initialize();
      if (!this.client) {
        throw new Error("Client not initialized");
      }

      const store = this.client.getStore();
      const key = this.createKey(server.address, username);

      await store.remove(key);

      await this.stronghold?.save();
    } catch (error) {
      throw new Error(`Failed to delete user: ${error}`);
    }
  }

  async hasCredentials(
    server: RecommendedServerInfo,
    username: string
  ): Promise<boolean> {
    try {
      await this.initialize();
      if (!this.client) {
        return false;
      }

      const store = this.client.getStore();
      const key = this.createKey(server.address, username);

      try {
        await store.get(key);
        return true;
      } catch {
        return false;
      }
    } catch (_error) {
      return false;
    }
  }
}

export const strongholdService: StrongholdService = new StrongholdServiceImpl();
