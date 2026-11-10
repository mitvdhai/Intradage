/** Huidige tijd in ms. Eén plek, zodat we de klok in tests en demo's kunnen vastzetten. */
export const nuMs = () => Date.now();
export const dagenVanaf = (n: number) => new Date(nuMs() + n * 86400000);
