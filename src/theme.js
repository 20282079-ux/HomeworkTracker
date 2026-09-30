// theme.js — the exact preset palette from the legacy app (js/settings.js),
// now applied via a style object on the app root instead of
// documentElement.style writes, so React owns the rendering.

export const PRESETS = {
  midnight: { "--bg": "#0e0f1a", "--bg2": "#13141f", "--bg3": "#1a1b2e", "--surface": "#1e2035", "--surface2": "#252740", "--border": "#2a2d4a", "--text": "#e8eaf6", "--text2": "#8b90c1", "--text3": "#7179aa", "--accent": "#7c6af7", "--accent2": "#a78bfa", "--accent-glow": "rgba(124,106,247,0.18)" },
  forest: { "--bg": "#0b1a12", "--bg2": "#0f2019", "--bg3": "#152a1e", "--surface": "#1a3226", "--surface2": "#1e3d2d", "--border": "#234d35", "--text": "#d4f0df", "--text2": "#7ab88e", "--text3": "#518f66", "--accent": "#3ecf6c", "--accent2": "#6ee89a", "--accent-glow": "rgba(62,207,108,0.18)" },
  ocean: { "--bg": "#071523", "--bg2": "#0b1e30", "--bg3": "#0f263c", "--surface": "#132e48", "--surface2": "#17375a", "--border": "#1d4468", "--text": "#cce8ff", "--text2": "#6aaddb", "--text3": "#4586a8", "--accent": "#2a8fd4", "--accent2": "#5bbaee", "--accent-glow": "rgba(42,143,212,0.18)" },
  sunset: { "--bg": "#1a0f0a", "--bg2": "#22140d", "--bg3": "#2a1a10", "--surface": "#33200e", "--surface2": "#3e280d", "--border": "#5a3a14", "--text": "#fde8cd", "--text2": "#d4935a", "--text3": "#ad6f3e", "--accent": "#f97316", "--accent2": "#fb923c", "--accent-glow": "rgba(249,115,22,0.18)" },
  rose: { "--bg": "#1a0d14", "--bg2": "#22111a", "--bg3": "#2c1520", "--surface": "#361825", "--surface2": "#40192b", "--border": "#5e2438", "--text": "#fde4ef", "--text2": "#d47a9e", "--text3": "#b05180", "--accent": "#e83a7a", "--accent2": "#f472b6", "--accent-glow": "rgba(232,58,122,0.18)" },
  // Airy light theme — soft cool-gray background, crisp white cards, and
  // ink-dark text tuned for contrast (text ≥ 14:1, text2 ≥ 7:1 on white).
  light: { "--bg": "#f1f4f9", "--bg2": "#ffffff", "--bg3": "#e6ebf3", "--surface": "#f7f9fc", "--surface2": "#eef1f7", "--border": "#d3dbe8", "--text": "#101423", "--text2": "#3f4a63", "--text3": "#6b7690", "--accent": "#2563eb", "--accent2": "#3b82f6", "--accent-glow": "rgba(37,99,235,0.14)" },
  // Bright afternoon-sky blue — feels like a clear day.
  daytime: { "--bg": "#e3edf8", "--bg2": "#ffffff", "--bg3": "#d7e3f0", "--surface": "#f3f7fc", "--surface2": "#edf3f9", "--border": "#c2cfe0", "--text": "#0e121d", "--text2": "#444e68", "--text3": "#6f7b99", "--accent": "#2563eb", "--accent2": "#3b82f6", "--accent-glow": "rgba(37,99,235,0.16)" },
  dawn: { "--bg": "#fef7ed", "--bg2": "#fdf0d5", "--bg3": "#fde4bf", "--surface": "#faecd0", "--surface2": "#f5e0b8", "--border": "#e5c98a", "--text": "#2d1a0c", "--text2": "#6b4423", "--text3": "#9a6b3e", "--accent": "#d84a00", "--accent2": "#f97316", "--accent-glow": "rgba(216,74,0,0.15)" },
  dusk: { "--bg": "#1a0f0a", "--bg2": "#22140d", "--bg3": "#2a1a10", "--surface": "#33200e", "--surface2": "#3e280d", "--border": "#5a3a14", "--text": "#fde8cd", "--text2": "#d4935a", "--text3": "#ad6f3e", "--accent": "#f97316", "--accent2": "#fb923c", "--accent-glow": "rgba(249,115,22,0.18)" },
  coffee: { "--bg": "#16100b", "--bg2": "#1e1510", "--bg3": "#261c15", "--surface": "#2e231b", "--surface2": "#382b21", "--border": "#4e3d2e", "--text": "#f5e6d0", "--text2": "#b09070", "--text3": "#8a7564", "--accent": "#c8813f", "--accent2": "#e8a460", "--accent-glow": "rgba(200,129,63,0.18)" },
};

export function themeStyle(presetName, radius) {
  const p = PRESETS[presetName] || PRESETS.midnight;
  return { ...p, "--radius": `${radius}px` };
}
