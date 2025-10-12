import { Show, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { ArrowLeft, AlertCircle, CheckCircle2, Edit, Loader2 } from 'lucide-solid';
import { RecommendedServerInfo } from '@jellyfin/sdk';
import { GlassButton, GlassCard } from '~/components/ui';
import { Input } from '~/components/input';
import { useServerStore } from '~/lib/store-hooks';
import { useAuthentication } from '~/hooks/useAuthentication';
import { AuthCredentials } from '~/types';
import { commonRules, createFormField, updateFormField, touchFormField } from '~/lib/validation';

interface LoginFormProps {
  server: RecommendedServerInfo;
  onBack?: () => void;
  initialUsername?: string;
  initialPassword?: string;
  isEditing?: boolean;
}

export function LoginForm(props: LoginFormProps) {
  const { store: serverStore } = useServerStore();
  const { login, isLoading } = useAuthentication();

  // Form state
  const [formData, setFormData] = createStore({
    username: createFormField(props.initialUsername || '', commonRules.username),
    password: createFormField(props.initialPassword || '', commonRules.password),
  });

  const [showPassword, setShowPassword] = createSignal(false);

  // Form handlers
  const handleUsernameChange = (value: string) => {
    const field = updateFormField(formData.username, value, commonRules.username, 'username');
    setFormData('username', field);
  };

  const handlePasswordChange = (value: string) => {
    const field = updateFormField(formData.password, value, commonRules.password, 'password');
    setFormData('password', field);
  };

  const handleUsernameBlur = () => {
    const field = touchFormField(formData.username, commonRules.username, 'username');
    setFormData('username', field);
  };

  const handlePasswordBlur = () => {
    const field = touchFormField(formData.password, commonRules.password, 'password');
    setFormData('password', field);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    // Touch all fields to show validation errors
    const usernameField = touchFormField(formData.username, commonRules.username, 'username');
    const passwordField = touchFormField(formData.password, commonRules.password, 'password');

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
    return !formData.username.error && formData.username.value.trim().length > 0;
  };

  return (
    <div class="space-y-6">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-blue-500/20 mb-4">
          <Show
            when={props.isEditing}
            fallback={<CheckCircle2 class="w-8 h-8 text-green-400" />}
          >
            <Edit class="w-8 h-8 text-blue-400" />
          </Show>
        </div>
        <h2 class="text-3xl font-bold mb-2">
          {props.isEditing ? 'Edit Credentials' : 'Welcome Back'}
        </h2>
        <p class="text-sm opacity-60 mb-3">
          {props.isEditing
            ? 'Update your login credentials'
            : 'Sign in to continue'}
        </p>
        <GlassCard preset="card" class="inline-block px-4 py-2">
          <div class="flex items-center gap-2">
            <AlertCircle class="w-4 h-4 text-blue-400" />
            <p class="text-sm font-medium">
              {props.server.systemInfo?.ServerName || 'Jellyfin Server'}
            </p>
          </div>
          <p class="text-xs opacity-50 mt-1">{props.server.address}</p>
        </GlassCard>
      </div>

      <GlassCard preset="card" class="p-6">
        <form class="space-y-5" onSubmit={handleSubmit}>
          <div class="space-y-2">
            <label for="username" class="text-sm font-medium opacity-80">
              Username <span class="text-red-400">*</span>
            </label>
            <Input
              id="username"
              placeholder="Enter your username"
              name="username"
              value={formData.username.value}
              onInput={(e) => handleUsernameChange(e.currentTarget.value)}
              onBlur={handleUsernameBlur}
              disabled={isLoading()}
              autocomplete="username"
              aria-invalid={!!formData.username.error && formData.username.touched}
              aria-describedby={
                formData.username.error && formData.username.touched
                  ? 'username-error'
                  : undefined
              }
              class={formData.username.error && formData.username.touched ? 'border-red-400' : ''}
            />
            <Show when={formData.username.error && formData.username.touched}>
              <p
                id="username-error"
                class="text-xs text-red-400 flex items-center gap-1"
              >
                <AlertCircle class="w-3 h-3" />
                {formData.username.error}
              </p>
            </Show>
          </div>

          <div class="space-y-2">
            <label for="password" class="text-sm font-medium opacity-80">
              Password
            </label>
            <div class="relative">
              <Input
                id="password"
                type={showPassword() ? "text" : "password"}
                placeholder="Enter your password"
                name="password"
                value={formData.password.value}
                onInput={(e) => handlePasswordChange(e.currentTarget.value)}
                onBlur={handlePasswordBlur}
                disabled={isLoading()}
                autocomplete="current-password"
                aria-invalid={!!formData.password.error && formData.password.touched}
                aria-describedby={
                  formData.password.error && formData.password.touched
                    ? 'password-error'
                    : undefined
                }
                class={formData.password.error && formData.password.touched ? 'border-red-400 pr-10' : 'pr-10'}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                aria-label={showPassword() ? "Hide password" : "Show password"}
              >
                {showPassword() ? (
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <Show when={formData.password.error && formData.password.touched}>
              <p
                id="password-error"
                class="text-xs text-red-400 flex items-center gap-1"
              >
                <AlertCircle class="w-3 h-3" />
                {formData.password.error}
              </p>
            </Show>
            <p class="text-xs opacity-50">Leave empty if no password is set</p>
          </div>

          <GlassButton
            type="submit"
            variant="glass"
            class="w-full"
            disabled={isLoading() || !isFormValid()}
          >
            <Show
              when={isLoading()}
              fallback={props.isEditing ? 'Update & Sign In' : 'Sign In'}
            >
              <Loader2 class="w-4 h-4 mr-2 animate-spin" />
              {props.isEditing ? 'Updating...' : 'Signing In...'}
            </Show>
          </GlassButton>
        </form>
      </GlassCard>

      <Show when={props.onBack}>
        <GlassButton
          variant="ghost"
          class="w-full"
          onClick={props.onBack}
          disabled={isLoading()}
        >
          <ArrowLeft class="w-4 h-4 mr-2" />
          Back
        </GlassButton>
      </Show>
    </div>
  );
}