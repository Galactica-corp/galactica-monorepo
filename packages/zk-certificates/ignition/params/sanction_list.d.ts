declare module '*/sanction_list.json' {
  type SanctionList = {
    sanctionedCountries: Record<string, string>;
  };

  const value: SanctionList;
  export default value;
}
