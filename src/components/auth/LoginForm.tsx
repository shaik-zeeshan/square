import type { RecommendedServerInfo } from '@jellyfin/sdk';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Edit,
  Loader2,
} from 'lucide-solid';
import { createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Input } from '~/components/input';
import { useAuthentication } from '~/hooks/useAuthentication';
import { useServerStore } from '~/lib/store-hooks';
import {
  commonRules,
  createFormField,
  touchFormField,
  updateFormField,
} from '~/lib/validation';
import type { AuthCredentials } from '~/types';

interface LoginFormProps {
  server: RecommendedServerInfo;
  onBack?: () => void;
  initialUsername?: string;
  initialPassword?: string;
  isEditing?: boolean;
}

export function LoginForm(props: LoginFormProps) {
  const { store: _serverStore } = useServerStore();
  const { login, isLoading } = useAuthentication();

  // Form state
  const [formData, setFormData] = createStore({
    username: createFormField(
      props.initialUsername || '',
      commonRules.username
    ),
    password: createFormField(
      props.initialPassword || '',
      commonRules.password
    ),
  });

  const [showPassword, setShowPassword] = createSignal(false);

  // Form handlers
  const handleUsernameChange = (value: string) => {
    const field = updateFormField(
      formData.username,
      value,
      commonRules.username,
      'username'
    );
    setFormData('username', field);
  };

  const handlePasswordChange = (value: string) => {
    const field = updateFormField(
      formData.password,
      value,
      commonRules.password,
      'password'
    );
    setFormData('password', field);
  };

  const handleUsernameBlur = () => {
    const field = touchFormField(
      formData.username,
      commonRules.username,
      'username'
    );
    setFormData('username', field);
  };

  const handlePasswordBlur = () => {
    const field = touchFormField(
      formData.password,
      commonRules.password,
      'password'
    );
    setFormData('password', field);
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();

    // Touch all fields to show validation errors
    const usernameField = touchFormField(
      formData.username,
      commonRules.username,
      'username'
    );
    const passwordField = touchFormField(
      formData.password,
      commonRules.password,
      'password'
    );

    setFormData('username', usernameField);
    setFormData('password', passwordField);

    // Check for errors
    if (usernameField.error) {
      return;
    }

    // Create credentials
    const credentials: AuthCredentials = {
      username: usernameField.value.trim(),
      password: passwordField.value,
      server: props.server,
    };

    login(credentials);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword());
  };

  // Check if form is valid
  const isFormValid = () => {
    return (
      !formData.username.error && formData.username.value.trim().length > 0
    );
  };

  return (
    <div class="space-y-6">
      <div class="mb-8 text-center">
        <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full">
          <Show
            fallback={
              <CheckCircle2 class="h-8 w-8 text-orange-600 dark:text-orange-400" />
            }
            when={props.isEditing}
          >
            <Edit class="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </Show>
        </div>
        <h2 class="mb-2 font-bold text-3xl text-foreground">
          {props.isEditing ? 'Edit Credentials' : 'Welcome Back'}
        </h2>
        <p class="mb-3 text-muted-foreground text-sm">
          {props.isEditing
            ? 'Update your login credentials'
            : 'Sign in to continue'}
        </p>
        <div class="inline-block rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 dark:border-orange-800 dark:bg-orange-900/20">
          <div class="flex items-center gap-2">
            <AlertCircle class="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <p class="font-medium text-foreground text-sm">
              {props.server.systemInfo?.ServerName || 'Jellyfin Server'}
            </p>
          </div>
          <p class="mt-1 text-muted-foreground text-xs">
            {props.server.address}
          </p>
        </div>
      </div>

      <div class="rounded-lg border bg-card p-6">
        <form class="space-y-5" onSubmit={handleSubmit}>
          <div class="space-y-2">
            <label class="font-medium text-foreground text-sm" for="username">
              Username <span class="text-destructive">*</span>
            </label>
            <Input
              aria-describedby={
                formData.username.error && formData.username.touched
                  ? 'username-error'
                  : undefined
              }
              aria-invalid={
                !!formData.username.error && formData.username.touched
              }
              autocomplete="username"
              class={
                formData.username.error && formData.username.touched
                  ? 'border-destructive'
                  : ''
              }
              disabled={isLoading()}
              id="username"
              name="username"
              onBlur={handleUsernameBlur}
              onInput={(e) => handleUsernameChange(e.currentTarget.value)}
              placeholder="Enter your username"
              value={formData.username.value}
            />
            <Show when={formData.username.error && formData.username.touched}>
              <p
                class="flex items-center gap-1 text-destructive text-xs"
                id="username-error"
              >
                <AlertCircle class="h-3 w-3" />
                {formData.username.error}
              </p>
            </Show>
          </div>

          <div class="space-y-2">
            <label class="font-medium text-foreground text-sm" for="password">
              Password
            </label>
            <div class="relative">
              <Input
                aria-describedby={
                  formData.password.error && formData.password.touched
                    ? 'password-error'
                    : undefined
                }
                aria-invalid={
                  !!formData.password.error && formData.password.touched
                }
                autocomplete="current-password"
                class={
                  formData.password.error && formData.password.touched
                    ? 'border-destructive pr-10'
                    : 'pr-10'
                }
                disabled={isLoading()}
                id="password"
                name="password"
                onBlur={handlePasswordBlur}
                onInput={(e) => handlePasswordChange(e.currentTarget.value)}
                placeholder="Enter your password"
                type={showPassword() ? 'text' : 'password'}
                value={formData.password.value}
              />
              <button
                aria-label={showPassword() ? 'Hide password' : 'Show password'}
                class="-translate-y-1/2 absolute top-1/2 right-3 transform text-muted-foreground transition-colors hover:text-foreground"
                onClick={togglePasswordVisibility}
                type="button"
              >
                {showPassword() ? (
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                ) : (
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                    <path
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                )}
              </button>
            </div>
            <Show when={formData.password.error && formData.password.touched}>
              <p
                class="flex items-center gap-1 text-destructive text-xs"
                id="password-error"
              >
                <AlertCircle class="h-3 w-3" />
                {formData.password.error}
              </p>
            </Show>
            <p class="text-muted-foreground text-xs">
              Leave empty if no password is set
            </p>
          </div>

          <button
            class="flex h-10 w-full items-center justify-center rounded-lg bg-orange-600 px-4 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading() || !isFormValid()}
            type="submit"
          >
            <Show
              fallback={props.isEditing ? 'Update & Sign In' : 'Sign In'}
              when={isLoading()}
            >
              <Loader2 class="mr-2 h-4 w-4 animate-spin" />
              {props.isEditing ? 'Updating...' : 'Signing In...'}
            </Show>
          </button>
        </form>
      </div>

      <Show when={props.onBack}>
        <button
          class="flex h-10 w-full items-center justify-center rounded-lg border border-orange-500 bg-transparent px-4 text-orange-600 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-900/20"
          disabled={isLoading()}
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
