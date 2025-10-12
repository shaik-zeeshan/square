import { For, Show } from 'solid-js';
import { Server as ServerIcon, Edit, Trash2, ArrowLeft } from 'lucide-solid';
import { RecommendedServerInfo } from '@jellyfin/sdk';
import { Server, useServerStore } from '~/lib/store-hooks';
import { GlassButton, GlassCard } from '~/components/ui';
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
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 mb-4">
          <ServerIcon class="w-8 h-8 text-blue-400" />
        </div>
        <h2 class="text-3xl font-bold mb-2">Select Server</h2>
        <p class="text-sm opacity-60">Choose a server to connect to</p>
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
            <div class="w-full border-t border-white/10" />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-background px-2 text-muted-foreground">
              Or
            </span>
          </div>
        </div>
      </Show>

      <GlassButton
        variant="glass-subtle"
        class="w-full"
        onClick={props.onSearchNewServer}
      >
        <ServerIcon class="w-4 h-4 mr-2" />
        Add New Server
      </GlassButton>

      <Show when={props.onBack}>
        <GlassButton
          variant="glass-subtle"
          class="w-full"
          onClick={props.onBack}
        >
          <ArrowLeft class="w-4 h-4 mr-2" />
          Back
        </GlassButton>
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
    <GlassCard
      role="button"
      tabindex={0}
      class="cursor-pointer p-4 hover:bg-[var(--glass-bg-medium)] transition-all group relative"
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
        <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
          <ServerIcon class="w-5 h-5 text-blue-400" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-base truncate">
            {props.server.info.systemInfo?.ServerName || 'Unknown Server'}
          </div>
          <div class="text-xs opacity-60 truncate mt-0.5">
            {props.server.info.address}
          </div>
          <Show when={props.server.info.systemInfo?.Version}>
            <div class="text-xs opacity-40 mt-1">
              v{props.server.info.systemInfo?.Version}
            </div>
          </Show>
          <Show when={props.server.auth.username}>
            <div class="text-xs opacity-50 mt-1">
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
            class="p-2 rounded-lg hover:bg-blue-500/20 transition-colors"
            aria-label="Edit server"
            title="Edit credentials"
          >
            <Edit class="w-4 h-4 text-blue-400" />
          </button>
          <button
            type="button"
            onClick={props.onDelete}
            class="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
            aria-label="Delete server"
            title="Delete server"
          >
            <Trash2 class="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
    </GlassCard>
  );
}