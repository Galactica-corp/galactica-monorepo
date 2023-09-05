type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | {
      [prop: string]: Json;
    };

export class GalacticaBaseError<
  Name extends string,
  Cause extends Json | undefined = undefined,
> extends Error {
  name: Name;

  message: string;

  cause?: Cause;

  constructor({
    name,
    message,
    cause,
  }: {
    name: Name;
    message: string;
    cause?: Cause;
  }) {
    super();
    this.name = name;
    this.message = message;
    this.cause = cause;
  }

  toJSON(): string {
    const serializableObject = {
      name: this.name,
      message: this.message,
      cause: this.cause ?? null,
    };

    return JSON.stringify(serializableObject);
  }
}

export type GalacticaBaseResponse<T> = {
  data: T;
};

export const createError = (errorData: Json) => {
  throw new Error(JSON.stringify(errorData));
};
