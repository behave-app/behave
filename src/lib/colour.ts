export type HSL = {
  h: number
  s: number
  l: number
}

export type RGB = {
  r: number
  g: number
  b: number
}

function hslToRgb(hsl: HSL): RGB {
    const {h, s: ss, l: ll} = hsl
    const s =  ss / 100;
    const l = ll / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
        r = c; g = 0; b = x;
    }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return {r, g, b};
}

function rgbToLuminance(rgb: RGB): number {
  const {r, g, b} = rgb
  const a = [r, g, b].map(function(v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function hslToLuminance(hsl: HSL): number {
  return rgbToLuminance(hslToRgb(hsl))
}

export function hslToString(hsl: HSL): string {
  const {h, s, l} = hsl
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function hslEquals(hsl1: HSL, hsl2: HSL): boolean {
  return hsl1.h === hsl2.h && hsl1.s === hsl2.s && hsl1.l === hsl2.l
}
