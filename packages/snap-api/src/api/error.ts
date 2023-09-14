export class GalacticaErrorBase<T extends string> extends Error {
  name: T;

  message: string;

  cause: any;

  constructor({ name, message }: { name: T; message: string }) {
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
  | 'RejectedConnect'
  | 'RejectedSignature'
  | 'RejectedSelect';

export class GenericError extends GalacticaErrorBase<GenericErrorName> { }
