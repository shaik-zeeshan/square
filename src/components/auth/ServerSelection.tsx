import { For, Show } from 'solid-js';
import { Server as ServerIcon, Edit, Trash2, ArrowLeft } from 'lucide-solid';
import { RecommendedServerInfo } from '@jellyfin/sdk';
import { Server, useServerStore } from '~/lib/store-hooks';
import { useAuthentication } from '~/hooks/useAuthentication';

interface ServerSelectionProps {
  onBack?: () => void;
  onSelectServer: (server: RecommendedServerInfo) => void;
  onEditServer: (server: RecommendedServerInfo) => void;
  onSearchNewServer: () => void;
}

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
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
          <ServerIcon class="w-8 h-8 text-orange-600 dark:text-orange-400" />
        </div>
        <h2 class="text-3xl font-bold mb-2 text-foreground">Select Server</h2>
        <p class="text-sm text-muted-foreground">Choose a server to connect to</p>
      </div>

      <div class="space-y-3">
        <For each={serverStore.servers}>
          {(server) => (
            <ServerCard
              server={server}
              onSelect={() => handleServerSelect(server)}
              onEdit={() => handleEditServer(server)}
              onDelete={() => handleDeleteServer(server.info.address)}
            />
          )}
        </For>
      </div>

      <Show when={serverStore.servers.length > 0}>
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-border" />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-background px-2 text-muted-foreground">
              Or
            </span>
          </div>
        </div>
      </Show>

      <button
        class="w-full h-10 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center justify-center"
        onClick={props.onSearchNewServer}
      >
        <ServerIcon class="w-4 h-4 mr-2" />
        Add New Server
      </button>

      <Show when={props.onBack}>
        <button
          class="w-full h-10 px-4 bg-transparent border border-orange-500 dark:border-orange-400 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center justify-center"
          onClick={props.onBack}
        >
          <ArrowLeft class="w-4 h-4 mr-2" />
          Back
        </button>
      </Show>
    </div>
  );
}

interface ServerCardProps {
  server: Server;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ServerCard(props: ServerCardProps) {
  return (
    <div
      role="button"
      tabindex={0}
      class="cursor-pointer p-4 bg-card border rounded-lg hover:bg-muted transition-colors group relative"
      onClick={props.onSelect}
      onKeyPress={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onSelect();
        }
      }}
      aria-label={`Connect to ${props.server.info.systemInfo?.ServerName}`}
    >
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center">
          <ServerIcon class="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-base truncate text-foreground">
            {props.server.info.systemInfo?.ServerName || 'Unknown Server'}
          </div>
          <div class="text-xs text-muted-foreground truncate mt-0.5">
            {props.server.info.address}
          </div>
          <Show when={props.server.info.systemInfo?.Version}>
            <div class="text-xs text-muted-foreground/60 mt-1">
              v{props.server.info.systemInfo?.Version}
            </div>
          </Show>
          <Show when={props.server.auth.username}>
            <div class="text-xs text-muted-foreground/60 mt-1">
              User: {props.server.auth.username}
            </div>
          </Show>
        </div>

        {/* Action Buttons */}
        <div
          class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={props.onEdit}
            class="p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
            aria-label="Edit server"
            title="Edit credentials"
          >
            <Edit class="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </button>
          <button
            type="button"
            onClick={props.onDelete}
            class="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            aria-label="Delete server"
            title="Delete server"
          >
            <Trash2 class="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}