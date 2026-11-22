import catalog from './translations.json';
export type Language = 'ko' | 'en' | 'mn';
const tags = { ko: 'ko-KR', en: 'en-US', mn: 'mn-MN' };
export type Translator = ((
  text: string | number | undefined | null,
  ...values: unknown[]
) => string) & { locale: string };
const dictionary: Record<string, [string, string]> = catalog as unknown as Record<
  string,
  [string, string]
>;
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
// Template entries translate dynamic UI messages without modifying user-supplied values.
const patterns = Object.entries(dictionary)
  .filter(([key]) => /\{\d+\}/.test(key))
  .map(([key, value]) => ({
    expression: new RegExp(
      '^' +
        key
          .split(/\{\d+\}/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('(.*?)') +
        '$',
    ),
    value,
  }));
export function translator(language: Language): Translator {
  return Object.assign(
    (input: string | number | undefined | null, ...values: unknown[]) => {
      const text = input == null ? '' : String(input);
      if (language === 'ko')
        return text.replace(/\{(\d+)\}/g, (_, n) => String(values[Number(n)] ?? ''));
      const key = normalize(text),
        index = language === 'en' ? 0 : 1;
      let result = dictionary[key]?.[index];
      if (result === undefined) {
        for (const pattern of patterns) {
          const match = pattern.expression.exec(key);
          if (match)
            return pattern.value[index].replace(/\{(\d+)\}/g, (_, n) => match[Number(n) + 1] ?? '');
        }
        return text;
      }
      result = result.replace(/\{(\d+)\}/g, (_, n) => String(values[Number(n)] ?? ''));
      return (text.match(/^\s*/)?.[0] ?? '') + result + (text.match(/\s*$/)?.[0] ?? '');
    },
    { locale: tags[language] },
  );
}
