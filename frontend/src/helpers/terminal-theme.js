export const darkTheme = {
  background: '#0f0f0f',
  foreground: 'rgba(255,255,255,0.92)',
  cursor: '#d4956b',
  cursorAccent: '#0f0f0f',
  selectionBackground: 'rgba(212,149,107,0.2)',
  selectionForeground: '#ffffff',
  black: '#0f0f0f',
  red: '#ff4d4f',
  green: '#52c41a',
  yellow: '#faad14',
  blue: '#d4956b',
  magenta: '#9254de',
  cyan: '#13c2c2',
  white: 'rgba(255,255,255,0.92)',
  brightBlack: '#444',
  brightRed: '#ff7875',
  brightGreen: '#95de64',
  brightYellow: '#ffc53d',
  brightBlue: '#e0a880',
  brightMagenta: '#b37feb',
  brightCyan: '#36cfc9',
  brightWhite: '#ffffff',
}

export const lightTheme = {
  background: '#fafaf9',
  foreground: 'rgba(0,0,0,0.88)',
  cursor: '#d4956b',
  cursorAccent: '#fafaf9',
  selectionBackground: 'rgba(212,149,107,0.15)',
  black: 'rgba(0,0,0,0.88)',
  red: '#ff4d4f',
  green: '#389e0d',
  yellow: '#d48806',
  blue: '#d4956b',
  magenta: '#722ed1',
  cyan: '#08979c',
  white: '#ffffff',
  brightBlack: '#8c8c8c',
  brightRed: '#ff7875',
  brightGreen: '#73d13d',
  brightYellow: '#ffc53d',
  brightBlue: '#e0a880',
  brightMagenta: '#b37feb',
  brightCyan: '#36cfc9',
  brightWhite: '#fafafa',
}

export const terminalDefaults = {
  fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  fontSize: 13,
  lineHeight: 1.5,
  cursorBlink: true,
  convertEol: true,
}

export function getTerminalTheme(theme) {
  return theme === 'dark' ? darkTheme : lightTheme
}

export function getTerminalBg(theme) {
  return theme === 'dark' ? darkTheme.background : lightTheme.background
}
