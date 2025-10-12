import { FormValidator, ValidationRule } from '~/types';

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string = 'VALIDATION_ERROR'
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateField<T = string>(
  value: T,
  rules: ValidationRule<T>,
  fieldName: string
): string | null {
  // Required validation
  if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
    return `${fieldName} is required`;
  }

  // Skip further validation if value is empty and not required
  if (!value && !rules.required) {
    return null;
  }

  // String-specific validations
  if (typeof value === 'string') {
    // Min length validation
    if (rules.minLength && value.length < rules.minLength) {
      return `${fieldName} must be at least ${rules.minLength} characters`;
    }

    // Max length validation
    if (rules.maxLength && value.length > rules.maxLength) {
      return `${fieldName} must not exceed ${rules.maxLength} characters`;
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(value)) {
      return `${fieldName} format is invalid`;
    }
  }

  // Custom validation
  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return customError;
    }
  }

  return null;
}

export function validateForm<T extends Record<string, unknown>>(
  data: T,
  validator: FormValidator<T>
): Record<keyof T, string | null> {
  const errors = {} as Record<keyof T, string | null>;

  for (const field in validator) {
    if (Object.prototype.hasOwnProperty.call(validator, field)) {
      const value = data[field];
      const rules = validator[field];
      errors[field] = validateField(value, rules, String(field));
    }
  }

  return errors;
}

export function hasErrors<T extends Record<string, unknown>>(
  errors: Record<keyof T, string | null>
): boolean {
  return Object.values(errors).some(error => error !== null);
}

export function getFirstError<T extends Record<string, unknown>>(
  errors: Record<keyof T, string | null>
): string | null {
  for (const error of Object.values(errors)) {
    if (error) return error;
  }
  return null;
}

// Common validation rules
export const commonRules = {
  required: { required: true } as const,

  username: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_.-]+$/,
    custom: (value: string) => {
      if (!value || value.trim().length < 2) {
        return 'Username must be at least 2 characters';
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
        return 'Username can only contain letters, numbers, dots, hyphens, and underscores';
      }
      return null;
    }
  } as ValidationRule<string>,

  password: {
    // Password can be empty (some Jellyfin setups don't require it)
    custom: (value: string) => {
      // Allow empty password
      if (!value) return null;

      // If provided, basic validation
      if (value.length < 1) {
        return 'Password must be at least 1 character if provided';
      }
      return null;
    }
  } as ValidationRule<string>,

  serverUrl: {
    required: true,
    custom: (value: string) => {
      if (!value || !value.trim()) {
        return 'Server address is required';
      }

      try {
        const url = new URL(value.trim());
        if (!['http:', 'https:'].includes(url.protocol)) {
          return 'URL must start with http:// or https://';
        }
        return null;
      } catch {
        return 'Please enter a valid URL (e.g., https://jellyfin.example.com)';
      }
    }
  } as ValidationRule<string>
};

// Form field utilities
export function createFormField<T = string>(
  initialValue: T,
  validator?: ValidationRule<T>
): { value: T; error: string | null; touched: boolean; dirty: boolean } {
  return {
    value: initialValue,
    error: null,
    touched: false,
    dirty: false
  };
}

export function updateFormField<T>(
  field: { value: T; error: string | null; touched: boolean; dirty: boolean },
  newValue: T,
  validator?: ValidationRule<T>,
  fieldName?: string
): { value: T; error: string | null; touched: boolean; dirty: boolean } {
  const error = validator && fieldName ? validateField(newValue, validator, fieldName) : null;

  return {
    value: newValue,
    error,
    touched: field.touched,
    dirty: field.dirty || newValue !== field.value
  };
}

export function touchFormField<T>(
  field: { value: T; error: string | null; touched: boolean; dirty: boolean },
  validator?: ValidationRule<T>,
  fieldName?: string
): { value: T; error: string | null; touched: boolean; dirty: boolean } {
  const error = validator && fieldName ? validateField(field.value, validator, fieldName) : null;

  return {
    ...field,
    touched: true,
    error
  };
}