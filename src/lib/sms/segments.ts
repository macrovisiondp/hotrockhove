/** SMS length: GSM-7 messages fit 160 characters (153 per part when split); others 70 (67). */
export function smsSegments(text: string): { chars: number; segments: number; unicode: boolean } {
  const gsm = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\[~\]|€]*$/.test(text);
  const chars = [...text].length;
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  return { chars, unicode: !gsm, segments: chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi) };
}
