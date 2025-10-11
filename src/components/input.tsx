import { GlassInput, type GlassInputProps } from './ui/glass-input';

export interface InputProps extends GlassInputProps {}

export const Input = (props: InputProps) => {
  return <GlassInput variant="solid" {...props} />;
};
