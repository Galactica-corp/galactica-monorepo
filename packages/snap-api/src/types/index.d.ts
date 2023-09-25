export {};

/*
 * Window type extension to support ethereum
 */
declare global {
  type Window = typeof window & {
    ethereum: any;
  };
}
