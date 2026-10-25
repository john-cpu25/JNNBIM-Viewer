export interface CategoryStyle {
  color: number;
  opacity: number;
  roughness: number;
  metalness: number;
  /** CSS colour for the explorer swatch. */
  swatch: string;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

const make = (color: number, opacity = 1, roughness = 0.85, metalness = 0): CategoryStyle => ({
  color,
  opacity,
  roughness,
  metalness,
  swatch: hex(color),
});

const STYLES: Record<string, CategoryStyle> = {
  Walls: make(0xd6d0c4),
  Slabs: make(0xb4bac1),
  Roofs: make(0x8d8378),
  Columns: make(0x98a2ae),
  Beams: make(0xa3adba),
  Windows: make(0x8cc3e6, 0.42, 0.1, 0.1),
  Doors: make(0x6b9cc2, 0.6, 0.3, 0.2),
  Ducts: make(0xe0a83e, 1, 0.5, 0.35),
  Pipes: make(0x3f9d63, 1, 0.45, 0.35),
};

const FALLBACK = make(0xc2c6cc);

export function categoryStyle(category: string): CategoryStyle {
  return STYLES[category] ?? FALLBACK;
}
