declare module '*/institution_pubkeys.json' {
  type InstitutionPubkeys = {
    institutions: {
      institution1: {
        address: string;
        pubkey: string[];
      };
      institution2: {
        address: string;
        pubkey: string[];
      };
      institution3: {
        address: string;
        pubkey: string[];
      };
    };
  };

  const value: InstitutionPubkeys;
  export default value;
}
