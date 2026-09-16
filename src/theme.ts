// Near Miss design tokens. Keep in sync with the prototype.
export const colors = {
  bg: '#F7F2EA',
  card: '#FFFFFF',
  cardBorder: '#EFE8DD',
  inputBorder: '#E8E0D4',
  divider: '#F2ECE2',
  sand: '#F2ECE2',
  sandDeep: '#EFE8DD',
  inputBg: '#FBF8F3',
  ink: '#231F1A',
  text2: '#5E574E',
  muted: '#7A7268',
  faint: '#A39A8E',
  handle: '#E0D7C9',
  toggleOff: '#D6CCBD',

  violet: '#5B3FD0',
  violetDark: '#4630A8',
  violetTint: '#ECE7FB',
  violetInk: '#3F2A9E',

  coral: '#E8674A',
  coralText: '#C24E33',
  coralTint: '#FBE6DF',
  coralInk: '#5A2B20',

  greenTint: '#E4EEDF',
  greenText: '#3D6B45',

  danger: '#B3261E',
  white: '#FFFFFF',
} as const;

export const pastel = {
  lilac: '#D9D0F7',
  peach: '#F6C9B9',
  sage: '#CFE3C8',
  butter: '#F8E1A6',
  sky: '#BFDCEB',
} as const;

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
} as const;

export const radius = {
  card: 20,
  cardLg: 24,
  input: 14,
  pill: 999,
} as const;

export const space = {
  screenX: 20,
} as const;

export const type = {
  display: (size: number) => ({ fontFamily: fonts.display, fontSize: size, letterSpacing: -0.5, lineHeight: Math.round(size * 1.05), color: colors.ink }),
  body: (size = 16, color: string = colors.ink) => ({ fontFamily: fonts.regular, fontSize: size, color }),
  semi: (size = 16, color: string = colors.ink) => ({ fontFamily: fonts.semibold, fontSize: size, color }),
  bold: (size = 16, color: string = colors.ink) => ({ fontFamily: fonts.bold, fontSize: size, color }),
};
