import { type ComponentProps, type JSX, splitProps, Show } from 'solid-js';
import { cn } from '~/lib/utils';
import { getGlassClasses, glassAnimations } from '~/lib/glass-utils';

export interface GlassDropdownProps extends ComponentProps<'div'> {
  open?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: JSX.Element;
}

export function GlassDropdown(props: GlassDropdownProps) {
  const [local, others] = splitProps(props, [
    'class',
    'open',
    'position',
    'children',
  ]);

  const positionClasses = () => {
    switch (local.position) {
      case 'top':
        return 'bottom-full mb-2';
      case 'bottom':
        return 'top-full mt-2';
      case 'left':
        return 'right-full mr-2';
      case 'right':
        return 'left-full ml-2';
      default:
        return 'bottom-full mb-2';
    }
  };

  return (
    <Show when={local.open}>
      <div
        class={cn(
          'absolute left-0 right-0 z-50 p-2',
          getGlassClasses('dropdown'),
          glassAnimations.fadeIn,
          positionClasses(),
          local.class
        )}
        role="menu"
        {...others}
      >
        <div class="max-h-56 overflow-auto px-1 py-1">{local.children}</div>
      </div>
    </Show>
  );
}

export interface GlassDropdownItemProps extends ComponentProps<'button'> {
  selected?: boolean;
}

export function GlassDropdownItem(props: GlassDropdownItemProps) {
  const [local, others] = splitProps(props, [
    'class',
    'selected',
    'children',
  ]);

  return (
    <button
      type="button"
      role="menuitem"
      aria-selected={local.selected}
      class={cn(
        'w-full text-left px-3 py-2 rounded-md cursor-pointer text-white/90 hover:bg-[#111111d1] hover:text-white focus:outline-none focus:bg-[#111111d1] transition-all duration-[var(--glass-transition-fast)]',
        local.selected && 'bg-[#111111d1] text-white',
        local.class
      )}
      {...others}
    >
      {local.children}
    </button>
  );
}

