import { useWindowDimensions } from "react-native";

/** Content column caps, so screens read well on iPad. Phones are narrower than both, so nothing changes there. */
export const widths = { form: 560, page: 760 };

/** A full-width-up-to-`max` column, centred. Use on scroll content, never on the screen itself, so backgrounds still fill the display. */
export const column = (max: number) => ({ width: "100%" as const, maxWidth: max, alignSelf: "center" as const });

export function useLayout() {
  const { width, height } = useWindowDimensions();
  return {
    width, height,
    wide: width >= 700,                                  // iPad (any orientation, incl. most Split View sizes)
    landscape: width > height,
    columns: width >= 1180 ? 3 : width >= 700 ? 2 : 1,  // card grid columns
  };
}

/** Splits a list into rows of `n`, for card grids. */
export function rows<T>(list: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}
