import type { RecommendedServerInfo } from '@jellyfin/sdk';
import { ArrowLeft, Loader2, Plus, Trash2, User } from 'lucide-solid';
import { createSignal, For, Show } from 'solid-js';
import { strongholdService } from '~/lib/jellyfin/stronghold';
import { useServerStore } from '~/lib/store-hooks';
import { showErrorToast, showSuccessToast } from '~/lib/toast';

interface UserSelectionProps {
  server: RecommendedServerInfo;
  users: string[];
  onSelectUser: (username: string, password: string) => void;
  onAddNewUser: () => void;
  onBack?: () => void;
  onUserDeleted?: (username: string) => void;
}

export function UserSelection(props: UserSelectionProps) {
  const [isDeleting, setIsDeleting] = createSignal<string | null>(null);
  const { store: serverStore, setStore: setServerStore } = useServerStore();

  const handleSelectUser = async (username: string) => {
    try {
      // Get password from Stronghold and auto-login
      const credential = await strongholdService.getCredentials(
        props.server,
        username
      );

      // Call the parent's onSelectUser with the retrieved credentials
      props.onSelectUser(username, credential.password);
    } catch (_error) {
      showErrorToast('Failed to retrieve saved credentials');
    }
  };

  const handleDeleteUser = async (username: string, event: Event) => {
    event.stopPropagation();

    setIsDeleting(username);

    // Optimistic update: Remove user from UI immediately
    const serverIndex = serverStore.servers.findIndex(
      (s) => s.info.address === props.server.address
    );
    let originalServer: any = null;

    if (serverIndex >= 0) {
      // Store original state for rollback
      originalServer = { ...serverStore.servers[serverIndex] };
      const updatedServers = [...serverStore.servers];
      const server = updatedServers[serverIndex];

      // Remove user from the users list optimistically
      const updatedUsers = server.users.filter((u) => u.username !== username);

      // Update currentUser if it was the deleted user
      const updatedCurrentUser =
        server.currentUser === username ? undefined : server.currentUser;

      updatedServers[serverIndex] = {
        ...server,
        users: updatedUsers,
        currentUser: updatedCurrentUser,
      };

      setServerStore({ servers: updatedServers });
      props.onUserDeleted?.(username);
    }

    try {
      await strongholdService.deleteUser(props.server, username);
      showSuccessToast(`Deleted credentials for ${username}`);
    } catch (_error) {
      // Rollback optimistic update on failure
      if (originalServer && serverIndex >= 0) {
        const updatedServers = [...serverStore.servers];
        updatedServers[serverIndex] = originalServer;
        setServerStore({ servers: updatedServers });
      }

      showErrorToast(`Failed to delete credentials for ${username}`);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div class="space-y-6">
      <div class="mb-8 text-center">
        <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full">
          <User class="h-8 w-8 text-orange-600 dark:text-orange-400" />
        </div>
        <h2 class="mb-2 font-bold text-3xl text-foreground">Select User</h2>
        <p class="mb-3 text-muted-foreground text-sm">
          Choose an account to sign in with
        </p>
        <div class="inline-block rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 dark:border-orange-800 dark:bg-orange-900/20">
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-green-500" />
            <p class="font-medium text-foreground text-sm">
              {props.server.systemInfo?.ServerName || 'Jellyfin Server'}
            </p>
          </div>
          <p class="mt-1 text-muted-foreground text-xs">
            {props.server.address}
          </p>
        </div>
      </div>

      <div class="space-y-3">
        <For each={props.users}>
          {(username) => (
            <UserCard
              isDeleting={isDeleting() === username}
              onDelete={(e) => handleDeleteUser(username, e)}
              onSelect={() => handleSelectUser(username)}
              username={username}
            />
          )}
        </For>
      </div>

      <Show when={props.users.length > 0}>
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
        onClick={props.onAddNewUser}
        type="button"
      >
        <Plus class="mr-2 h-4 w-4" />
        Add New User
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

interface UserCardProps {
  username: string;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: (event: Event) => void;
}

function UserCard(props: UserCardProps) {
  return (
    <div
      aria-label={`Sign in as ${props.username}`}
      class="group relative cursor-pointer rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
      onClick={props.onSelect}
      onKeyPress={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onSelect();
        }
      }}
      role="button"
      tabindex={0}
    >
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/20">
          <User class="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate font-semibold text-base text-foreground">
            {props.username}
          </div>
          <div class="mt-0.5 text-muted-foreground text-xs">Saved account</div>
        </div>

        {/* Action Buttons */}
        <div
          class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            aria-label="Delete user"
            class="rounded-lg p-2 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
            disabled={props.isDeleting}
            onClick={props.onDelete}
            title="Delete saved credentials"
            type="button"
          >
            <Show
              fallback={
                <Trash2 class="h-4 w-4 text-red-600 dark:text-red-400" />
              }
              when={props.isDeleting}
            >
              <Loader2 class="h-4 w-4 animate-spin text-red-600 dark:text-red-400" />
            </Show>
          </button>
        </div>
      </div>
    </div>
  );
}
