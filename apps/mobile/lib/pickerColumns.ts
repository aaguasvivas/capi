// Cards per row in the home screen's table (mesa) and tile (fichas) pickers,
// from the text size (useWindowDimensions().fontScale). The default size keeps
// 3 tables and 4 tile sets per row; larger sizes give fewer, wider cards, so
// no name breaks mid-word ("Colmad/o") or gets cut short ("Quisqu...").
//
// The arithmetic is for 375pt, the narrowest current iPhone (SE). The form
// card's inner width is 375 - 2 * 24 - 2 * 24 = 279, with 8pt gaps. A mesa
// card loses 20pt to its border and padding, so a title gets 67.7pt at 3 per
// row, 115.5 at 2 and 259 at 1. A fichas card loses 12pt: 51.8 at 4 per row,
// 123.5 at 2. The longest word is "Quisqueya": 63.6pt at 12pt bold (mesa
// title) and 54.0 at 10pt bold (fichas name), measured in SF Pro; a word grows
// at most in proportion to the scale. So 3 per row holds up to
// 67.7 / 63.6 = 1.06, 2 per row up to 115.5 / 63.6 = 1.81, and 1 per row up
// to 259 / 63.6 = 4.07, past the largest iOS size (3.571).
//
// The fichas picker switches with the mesa picker. At 4 per row its names
// already shrink at the default size and minimumFontScale 0.75 would only hold
// to 51.8 / (0.75 * 54.0) = 1.27; at 2 per row they show at full size up to
// 123.5 / 54.0 = 2.28.
//
// iOS sizes (RN fontScale): Large 1.0 keeps 3 and 4 per row; XL 1.118 through
// AX1 1.786 give 2 per row; AX2 2.143 through AX5 3.571 give 1 per row.
//
// The mode and score pairs (1v1 / 2v2, 100 / 200 points) share the mesa
// card's 12pt bold title and inset, two per row: 115.5pt for a title. Their
// longest word is "puntos" at 41.96pt, so a pair holds up to
// 115.5 / 41.96 = 2.75 (AX3 2.643) and stacks from AX4 3.143.
export interface PickerColumns {
  mesa: 1 | 2 | 3;
  fichas: 1 | 2 | 4;
  pair: 1 | 2;
}

export function pickerColumns(fontScale: number): PickerColumns {
  const pair = fontScale <= 2.75 ? 2 : 1;
  if (fontScale <= 1.06) return { mesa: 3, fichas: 4, pair };
  if (fontScale <= 1.81) return { mesa: 2, fichas: 2, pair };
  return { mesa: 1, fichas: 1, pair };
}

// A card's flexBasis for n per row: n bases and the 8pt gaps between them fit
// in the row, n + 1 do not, and flexGrow shares what is left. 30% and 22% are
// the pickers' original 3 and 4 per row.
export const ROW_BASIS = { 1: "100%", 2: "40%", 3: "30%", 4: "22%" } as const;
