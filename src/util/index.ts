export const transformByte = (size: number): string => {
  if (!size) {
    return '0B';
  }
  const num = 1024;
  if (size < num) {
    return `${size}B`;
  }
  if (size < num ** 2) {
    return `${(size / num).toFixed(2)}K`;
  }
  if (size < num ** 3) {
    return `${(size / num ** 2).toFixed(2)}M`;
  }
  if (size < num ** 4) {
    return `${(size / num ** 3).toFixed(2)}G`;
  }
  return `${(size / num ** 4).toFixed(2)}T`;
};
