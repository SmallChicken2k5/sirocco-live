# Sirocco Live 1.2 assets

The supplied Sirocco Team artwork is retained without changes as `app/dist/assets/sirocco-original.png` in the portable package. The header, broadcast header, tab icon and Windows executable use a symbol-only transparent variant derived from that supplied artwork with the built-in image generation tool. PNG and ICO sizes are then encoded locally for application use.

Edit prompt used:

> Edit target: the provided Sirocco Team logo. Create a production UI asset, a transparent-background symbol-only cutout. Preserve the exact existing gold/cyan sweeping bird/wind emblem geometry and flat colors, including the gold sand swoosh at bottom. Remove all dark navy background and remove the words TEAM and SIROCCO. Do NOT redesign, reinterpret, add texture, shadows, gradients or new strokes. Keep all fine curves sharp and faithful. Crop reasonably tightly around the complete symbol, with 6% transparent padding. One isolated symbol centered. Output a real transparent PNG.

The resulting variant is a generated derivative, not an editable reconstruction of the original vector artwork.

The interface uses the team palette with a darker navy desk surface, sand for the selected controls and primary action, and cyan for live connection indicators. Geist and Phosphor assets are bundled locally. The implementation uses native CSS and Web Animations, with reduced-motion support, rather than depending on an external animation runtime.

References consulted:

- https://linear.app/changelog/2026-03-12-ui-refresh
- https://emilkowal.ski/ui/you-dont-need-animations
- https://m3.material.io/styles/motion/overview/how-it-works
