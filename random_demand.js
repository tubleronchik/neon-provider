import { create } from 'ipfs-http-client'
import Web3 from 'web3';
import { readFileSync } from "fs";
import BigNumber from "bignumber.js";

let config = readFileSync(`config/config.json`)
config = JSON.parse(config)
const web3 = new Web3(config.http_node_provider)
web3.eth.accounts.wallet.add(config.provider_pk)
web3.eth.accounts.wallet.add(config.spot_pk)
web3.eth.accounts.wallet.add(config.test_user_pk)


async function randomDemand(factory) {
    let demand =
    {
        model: config.model
        , objective: web3.utils.toHex(config.test_objective)
        , token: config.xrt_contract_address
        , cost: 1
        , lighthouse: config.lighthouse_contract_address
        , validator: config.validator_address
        , validatorFee: 0
        , deadline: await web3.eth.getBlockNumber() + 100000
        , nonce: BigNumber(await factory.methods.nonceOf(config.test_user_address).call()).toNumber()
        , sender: config.test_user_address
    };

    const hash = web3.utils.soliditySha3(
        { t: 'bytes', v: demand.model },
        { t: 'bytes', v: demand.objective },
        { t: 'address', v: demand.token },
        { t: 'uint256', v: demand.cost },
        { t: 'address', v: demand.lighthouse },
        { t: 'address', v: demand.validator },
        { t: 'uint256', v: demand.validatorFee },
        { t: 'uint256', v: demand.deadline },
        { t: 'uint256', v: demand.nonce },
        { t: 'address', v: demand.sender }
    );
    demand.signature = await web3.eth.accounts.sign(hash, config.test_user_pk).signature;

    return demand;
}
async function pairOffer(demand, factory) {
    let offer =
    {
        model: demand.model
        , objective: demand.objective
        , token: demand.token
        , cost: demand.cost
        , validator: demand.validator
        , lighthouse: demand.lighthouse
        , lighthouseFee: 1
        , deadline: await web3.eth.getBlockNumber() + 100000
        , nonce: BigNumber(await factory.methods.nonceOf(config.spot_address).call()).toNumber()
        , sender: config.spot_address
    };

    const hash = web3.utils.soliditySha3(
        { t: 'bytes', v: offer.model },
        { t: 'bytes', v: offer.objective },
        { t: 'address', v: offer.token },
        { t: 'uint256', v: offer.cost },
        { t: 'address', v: offer.validator },
        { t: 'address', v: offer.lighthouse },
        { t: 'uint256', v: offer.lighthouseFee },
        { t: 'uint256', v: offer.deadline },
        { t: 'uint256', v: offer.nonce },
        { t: 'address', v: offer.sender }
    );
    offer.signature = await web3.eth.accounts.sign(hash, config.spot_pk);

    return offer;
}

const ipfs = create("http://127.0.0.1:5001")

let abi = readFileSync(`abi/Factory.json`)
let factoryABI = JSON.parse(abi)
let factory = await new web3.eth.Contract(factoryABI, config.factory_contract_address)

const demand = await randomDemand(factory)
// const offer = await pairOffer(demand, factory)

const demandMsg = JSON.stringify(demand)
await ipfs.pubsub.publish(config.ipfs_topic, demandMsg)

// await new Promise(r => setTimeout(r, 2000));

// const offerMsg = JSON.stringify(offer)
// await ipfs.pubsub.publish(config.ipfs_topic, offerMsg)

console.log(`published to ${config.ipfs_topic}`)