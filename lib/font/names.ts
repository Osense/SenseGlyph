export function isEnglishFontName(name: string) {
  return /^[\x20-\x7e]+$/.test(name) && /[a-zA-Z0-9]/.test(name);
}

export function defaultEnglishFontName(familyName: string) {
  const name = familyName.trim();
  return isEnglishFontName(name) ? name : "My Handwriting";
}
