import { useState } from 'react';
import { MODULE_ICON_CATALOG, MODULE_ICON_SIZES, type ModuleIconName, type ModuleIconSize } from './moduleIconCatalog';

export interface ModuleIconProps { name: ModuleIconName; size?: ModuleIconSize; decorative?: boolean; alt?: string; priority?: boolean; className?: string; }

export const ModuleIcon = ({ name, size = 'md', decorative = true, alt, priority = false, className = '' }: ModuleIconProps) => {
  const [failed, setFailed] = useState(false);
  const icon = MODULE_ICON_CATALOG[name];
  const pixels = MODULE_ICON_SIZES[size];
  const accessibleLabel = decorative ? '' : (alt || icon.label);
  if (failed) return <span data-module-icon={name} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : accessibleLabel} className={`inline-grid shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500 ${className}`} style={{ width: pixels, height: pixels }}>{icon.label.slice(0, 1)}</span>;
  return <img data-module-icon={name} src={icon.src} alt={accessibleLabel} aria-hidden={decorative || undefined} width={pixels} height={pixels} loading={priority ? 'eager' : 'lazy'} decoding="async" fetchPriority={priority ? 'high' : 'auto'} onError={() => setFailed(true)} className={`shrink-0 object-contain ${className}`} />;
};
