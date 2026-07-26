const CLASS_PREFIX_PATTERN = /^(?:lớp|lop|class)\s*/i;
const CLASS_SEPARATOR_PATTERN = /[\s._-]+/g;

export const normalizeClassName = (value?: string | null): string => {
    return String(value || '')
        .normalize('NFKC')
        .trim()
        .replace(CLASS_PREFIX_PATTERN, '')
        .replace(CLASS_SEPARATOR_PATTERN, '')
        .toLocaleLowerCase('vi-VN');
};

export const areClassNamesEqual = (
    first?: string | null,
    second?: string | null,
): boolean => {
    const normalizedFirst = normalizeClassName(first);
    const normalizedSecond = normalizeClassName(second);
    return normalizedFirst.length > 0 && normalizedFirst === normalizedSecond;
};
