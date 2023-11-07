export class GalacticaErrorBase<TName extends string> extends Error {
  name: TName;

  message: string;

  cause: any;

  constructor({ name, message }: { name: TName; message: string }) {
    super();
    this.name = name;
    this.message = message;
  }
}

type GenericErrorName =
  | 'RejectedConfirm'
  | 'UnknownMethod'
  | 'MissingHolder'
  | 'MissingZkCert'
  | 'MerkleProofUpdateFailed'
  | 'RejectedConnect'
  | 'RejectedSignature'
  | 'RejectedSelect';

export class GenericError extends GalacticaErrorBase<GenericErrorName> {}
