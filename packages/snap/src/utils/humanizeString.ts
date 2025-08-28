const handlePreserveConsecutiveUppercase = (
  decamelized: string,
  separator: string,
) => {
  const dec = decamelized.replace(
    /((?<![\p{Uppercase_Letter}\d])[\p{Uppercase_Letter}\d](?![\p{Uppercase_Letter}\d]))/gu,
    ($0) => $0.toLowerCase(),
  );

  return dec.replace(
    /(?<!\p{Uppercase_Letter})(\p{Uppercase_Letter}+)(\p{Uppercase_Letter}\p{Lowercase_Letter}+)/gu,
    (_, $1, $2) => $1 + separator + $2.toLowerCase(),
  );
};

const decamelize = (
  text: string,
  { separator = '_', preserveConsecutiveUppercase = false } = {},
) => {
  if (!(typeof text === 'string' && typeof separator === 'string')) {
    throw new TypeError(
      'The `text` and `separator` arguments should be of type `string`',
    );
  }

  if (text.length < 2) {
    return preserveConsecutiveUppercase ? text : text.toLowerCase();
  }

  const replacement = `$1${separator}$2`;

  const decamelized = text.replace(
    /([\p{Lowercase_Letter}\d])(\p{Uppercase_Letter})/gu,
    replacement,
  );

  if (preserveConsecutiveUppercase) {
    return handlePreserveConsecutiveUppercase(decamelized, separator);
  }

  return decamelized
    .replace(
      /(\p{Uppercase_Letter})(\p{Uppercase_Letter}\p{Lowercase_Letter}+)/gu,
      replacement,
    )
    .toLowerCase();
};

export const humanize = (string: string) => {
  let str = string;

  str = decamelize(str);
  str = str
    .toLowerCase()
    .replace(/[_-]+/gu, ' ')
    .replace(/\s{2,}/gu, ' ')
    .trim();
  str = str.charAt(0).toUpperCase() + str.slice(1);

  return str;
};
