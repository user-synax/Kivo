// Animated banner options for a user's profile cover.
//
// Every entry is a direct GIF URL. To add your own, grab any Giphy GIF:
//   1. Open the GIF on giphy.com
//   2. Right-click the GIF → "Copy image address" (or use the media URL
//      https://media.giphy.com/media/<id>/giphy.gif)
//   3. Add a new object below with a unique `id`, the `url`, and a `label`.
//
// The first frame is used as the static fallback; the GIF animates everywhere
// it is shown (profile editor preview, the right-side conversation details).

export const BANNER_OPTIONS = [
  {
    id: "valorant-astra",
    label: "Valorant Astra Agent banner",
    url: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXd5OWpnOXZhOTVxeG12NjEzcHh0OWNuaWE4NnY4azVsMWkzcmYwMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xvRPIAtMwKQ2SlxKtx/giphy.gif",
  },
  {
    id: "pacman-chase",
    label: "Pac-Man Chase banner",
    url: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZzltank4dThwdnVjOHgydXN0bmV2eHp6cHFncXBnNzh1dTQ3bmt4NCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/hkqefnFjn2MWVl6xvq/giphy.gif",
  }
];
