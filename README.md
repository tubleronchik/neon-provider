# Provider on Neon Network

Simple Provider to listen to IPFS Pubsub messages and create and finalize Liability on Neon Network using Robonomics contracts.

---

## Configuration

Create the `config/config.json` file. An example can be found in `config/config_template.json`.

---

## Running
Tested on node v.17.0.0, v.18.16.1
```
npm install
node provider.js
```

## Simulation

If you need to test Provider and Agent together it's possible to create a random demand using a script. See `random_demand.js`.

```
node random_demand.js
```

---

> Note:
Provider on Python is still under development. Not recommended to use.

