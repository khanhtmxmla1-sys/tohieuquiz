export interface DisplayEntry<T> {
  value: T;
  originalIndex: number;
}

export const seededShuffle = <T,>(values: readonly T[], seedText: string): T[] => {
  const output = [...values];
  let seed = 2166136261;
  for (const char of seedText) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  const random = () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
};

export const buildDisplayEntries = <T,>(
  values: readonly T[],
  seedText: string,
  shouldShuffle: boolean,
): Array<DisplayEntry<T>> => {
  const entries = values.map((value, originalIndex) => ({ value, originalIndex }));
  return shouldShuffle ? seededShuffle(entries, seedText) : entries;
};
