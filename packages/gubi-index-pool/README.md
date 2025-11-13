# gUBI Index Pool

This package contains the gUBI (Galactica Index Token) index pool contracts for the Galactica Network UBI rewards system.

## Overview

The gUBI index pool manages the underlying assets (GNET and ecosystem tokens) that back the gUBI token. Users can burn gUBI tokens to receive their proportional share of the underlying assets in the index pool.

## Key Features

- **Index Token (gUBI)**: ERC20 token representing shares in the index pool
- **Index Pool**: Manages underlying assets (GNET and others)
- **Burning Mechanics**: Users can burn gUBI to receive proportional underlying assets
- **Upgradeable Contracts**: Uses OpenZeppelin upgradeable pattern for future improvements

## Usage

### Building

```shell
yarn build
```

### Testing

```shell
yarn test
```

### Deployment

```shell
yarn deploy
```

## Contract Architecture

- **GUBI.sol**: The index token contract
- **IndexPool.sol**: The pool contract managing underlying assets (upgradeable)
