import type { RecommendedServerInfo } from "@jellyfin/sdk";
import { ArrowLeft, Edit, Server as ServerIcon, Trash2 } from "lucide-solid";
import { For, Show } from "solid-js";
import { useAuthentication } from "~/hooks/useAuthentication";
import type { Server } from "~/lib/persist-store";
import { useServerStore } from "~/lib/store-hooks";

type ServerSelectionProps = {
  onBack?: () => void;
  onSelectServer: (server: RecommendedServerInfo) => void;
  onEditServer: (server: RecommendedServerInfo) => void;
  onSearchNewServer: () => void;
};

export function ServerSelection(props: ServerSelectionProps) {
  const { store: serverStore } = useServerStore();
  const { removeServer } = useAuthentication();

  const handleServerSelect = (server: Server) => {
    props.onSelectServer(server.info);
  };

  const handleEditServer = (server: Server) => {
    props.onEditServer(server.info);
  };

  const handleDeleteServer = (serverAddress: string) => {
    removeServer(serverAddress);
  };

  return (
    <div class="space-y-4">
      <div class="mb-8 text-center">
        <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full">
          <ServerIcon class="h-8 w-8 text-orange-600 dark:text-orange-400" />
        </div>
        <h2 class="mb-2 font-bold text-3xl text-foreground">Select Server</h2>
        <p class="text-muted-foreground text-sm">
          Choose a server to connect to
        </p>
      </div>

      <div class="space-y-3">
        <For each={serverStore.servers}>
          {(server) => (
            <ServerCard
              onDelete={() => handleDeleteServer(server.info.address)}
              onEdit={() => handleEditServer(server)}
              onSelect={() => handleServerSelect(server)}
              server={server}
            />
          )}
        </For>
      </div>

      <Show when={serverStore.servers.length > 0}>
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-border border-t" />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>
      </Show>

      <button
        class="flex h-10 w-full items-center justify-center rounded-lg bg-orange-600 px-4 text-white transition-colors hover:bg-orange-700"
        onClick={props.onSearchNewServer}
        type="button"
      >
        <ServerIcon class="mr-2 h-4 w-4" />
        Add New Server
      </button>

      <Show when={props.onBack}>
        <button
          class="flex h-10 w-full items-center justify-center rounded-lg border border-orange-500 bg-transparent px-4 text-orange-600 transition-colors hover:bg-orange-50 dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-900/20"
          onClick={props.onBack}
          type="button"
        >
          <ArrowLeft class="mr-2 h-4 w-4" />
          Back
        </button>
      </Show>
    </div>
  );
}

type ServerCardProps = {
  server: Server;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function ServerCard(props: ServerCardProps) {
  return (
    <div
      aria-label={`Connect to ${props.server.info.systemInfo?.ServerName}`}
      class="group relative cursor-pointer rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
      onClick={props.onSelect}
      onKeyPress={(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onSelect();
        }
      }}
      role="button"
      tabindex={0}
    >
      <div class="flex items-start gap-3">
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
          <ServerIcon class="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate font-semibold text-base text-foreground">
            {props.server.info.systemInfo?.ServerName || "Unknown Server"}
          </div>
          <div class="mt-0.5 truncate text-muted-foreground text-xs">
            {props.server.info.address}
          </div>
          <Show when={props.server.info.systemInfo?.Version}>
            <div class="mt-1 text-muted-foreground/60 text-xs">
              v{props.server.info.systemInfo?.Version}
            </div>
          </Show>
          <Show when={props.server.users && props.server.users.length > 0}>
            <div class="mt-1 text-muted-foreground/60 text-xs">
              {props.server.users.length} saved user
              {props.server.users.length !== 1 ? "s" : ""}
            </div>
          </Show>
          <Show when={props.server.currentUser}>
            <div class="mt-1 text-muted-foreground/60 text-xs">
              Current: {props.server.currentUser}
            </div>
          </Show>
        </div>

        {/* Action Buttons */}
        <div
          class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          role="button"
        >
          <button
            aria-label="Edit server"
            class="rounded-lg p-2 transition-colors hover:bg-orange-50 dark:hover:bg-orange-900/20"
            onClick={props.onEdit}
            title="Edit credentials"
            type="button"
          >
            <Edit class="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </button>
          <button
            aria-label="Delete server"
            class="rounded-lg p-2 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={props.onDelete}
            title="Delete server"
            type="button"
          >
            <Trash2 class="h-4 w-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
