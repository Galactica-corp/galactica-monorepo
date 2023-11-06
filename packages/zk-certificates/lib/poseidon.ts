import {arrayToBigInt} from "./helpers";

type BigNumberish = string | bigint | number | Uint8Array;

export type Poseidon = {
  (arr: BigNumberish[], state?: BigNumberish, nOut?: number): Uint8Array;

  F: {
    toObject(obj: unknown): bigint
    toString(obj: unknown): string
  };
}

const spongeChunkSize = 31
const spongeInputs = 16

/**
 * Returns a sponge hash of a message split into blocks of 31 bytes.
 * @see reference implementation
 * https://github.com/iden3/go-iden3-crypto/blob/e5cf066b8be3da9a3df9544c65818df189fdbebe/poseidon/poseidon.go#L136
 */
export const hashMessage = (poseidon: Poseidon, message: string | Uint8Array, frameSize: number = spongeInputs): Uint8Array => {
  if (frameSize < 2 || frameSize > 16) {
    throw new Error('incorrect frame size')
  }

  if (typeof message === 'string') {
    message = new TextEncoder().encode(message)
  }

  // not used inputs default to zero
  const inputs: bigint[] = Array(frameSize).fill(BigInt(0))

  let dirty = false
  let hash = new Uint8Array()

  let k = 0
  for (let i = 0; i < Math.floor(message.length / spongeChunkSize); i++) {
    dirty = true
    inputs[k] = arrayToBigInt(message.slice(spongeChunkSize * i, spongeChunkSize * (i + 1)))

    if (k === frameSize - 1) {
      hash = poseidon(inputs)
      dirty = false

      inputs[0] = poseidon.F.toObject(hash)
      inputs.fill(BigInt(0), 1)

      k = 1
    } else {
      k++
    }
  }

  if (message.length % spongeChunkSize != 0) {
    // the last chunk of the message is less than 31 bytes
    // zero padding it, so that 0xdeadbeaf becomes
    // 0xdeadbeaf000000000000000000000000000000000000000000000000000000

    const buffer = new Uint8Array(spongeChunkSize)
    buffer.set(message.slice(message.length - message.length % spongeChunkSize))

    inputs[k] = arrayToBigInt(buffer)
    dirty = true
  }

  if (dirty) {
    // we haven't hashed something in the main sponge loop and need to do hash here
    hash = poseidon(inputs)
  }

  return hash
}
