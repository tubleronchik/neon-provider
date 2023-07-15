import * as IPFS from 'ipfs-core'
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
web3.eth.defaultAccount = config.provider_address

// connect to the default API address http://localhost:5001
const ipfs = create()

class Provider {
    constructor() {
        this.demand = {}
        this.offer = {}
        this.onMsg = this.onMsg.bind(this); // to send context of the Provider into function
        this.checkPairMsgs = this.checkPairMsgs.bind(this);
        this.createLiability = this.createLiability.bind(this);
        this.encodeDemand = this.encodeDemand.bind(this);
        this.encodeOffer = this.encodeOffer.bind(this);
        this.ipfsSubscribe()
        
    }
    async ipfsSubscribe() {
        await ipfs.pubsub.subscribe(config.ipfs_topic, this.onMsg)
        console.log(`subscribed to ${config.ipfs_topic}`)
    }

    async onMsg(msg) {
        console.log(`from: ${msg.from}`)
        let stringMsg = ""
        stringMsg = String.fromCharCode(...Array.from(msg.data))
        let m = JSON.parse(stringMsg) 
        // if (msg.from == config.ipfs_id_dapp) {
        if (m.sender == config.test_user_address) {
            stringMsg = String.fromCharCode(...Array.from(msg.data))
            this.demand = JSON.parse(stringMsg) 
            console.log("demand") 
            console.log(this.demand) 
        }   

        // else if (msg.from == config.ipfs_id_agent) {
        else {
            stringMsg = String.fromCharCode(...Array.from(msg.data))
            this.offer = JSON.parse(stringMsg)  
            console.log(this.offer)   
        }
        await this.checkPairMsgs()
    }

    async checkPairMsgs() {
        if (this.demand && this.offer) {
            const blockNumber = await web3.eth.getBlockNumber()
            const demandModel = this.demand.model
            const offerModel = this.offer.model
            const demandObjective = this.demand.objective
            const offerObjective = this.offer.objective

            if ((demandModel == offerModel) && (demandObjective == offerObjective) &&  (this.demand.deadline > blockNumber)) {
                await this.createLiability()
            }
        }
    }

    downloadABI() {
        let abi = readFileSync(`abi/Lighthouse.json`)
        let lighthouseABI = JSON.parse(abi)

        abi = readFileSync(`abi/Factory.json`)
        let factoryABI = JSON.parse(abi)

        return {lighthouseABI, factoryABI}
    }

    encodeDemand(demand) {
        return web3.eth.abi.encodeParameters(
            ['bytes'
                , 'bytes'
                , 'address'
                , 'uint256'
                , 'address'
                , 'address'
                , 'uint256'
                , 'uint256'
                , 'address'
                , 'bytes'
            ],
            [demand.model
                , demand.objective
                , demand.token
                , demand.cost
                , demand.lighthouse
                , demand.validator
                , demand.validatorFee
                , demand.deadline
                , demand.sender
                , demand.signature.signature
            ]
        );
    }

    encodeOffer(offer) {
        return web3.eth.abi.encodeParameters(
            ['bytes'
                , 'bytes'
                , 'address'
                , 'uint256'
                , 'address'
                , 'address'
                , 'uint256'
                , 'uint256'
                , 'address'
                , 'bytes'
            ],
            [offer.model
                , offer.objective
                , offer.token
                , offer.cost
                , offer.validator
                , offer.lighthouse
                , offer.lighthouseFee
                , offer.deadline
                , offer.sender
                , offer.signature.signature
            ]
        );
    }

    async createLiability() {
        const { lighthouseABI, factoryABI } = this.downloadABI()
        let lighthouse = await new web3.eth.Contract(lighthouseABI, config.lighthouse_contract_address)
        let factory = await new web3.eth.Contract(factoryABI, config.factory_contract_address)

        let d_encoded = this.encodeDemand(this.demand)
        let o_encoded = this.encodeOffer(this.offer) 

        const nonce = await web3.eth.getTransactionCount(config.provider_address, "pending")
        let tx = await lighthouse.methods.createLiability(d_encoded, o_encoded).send({ from: config.provider_address, gas: 1000000000, nonce: nonce })
        // console.log(tx)
        const liability_receipt = await web3.eth.getTransactionReceipt(tx["transactionHash"])
        const liability_address_hex = liability_receipt["logs"][2]["topics"][1]
        const liability_address_dec = "0x" + liability_address_hex.slice(26)
        const liability_address = web3.utils.toChecksumAddress(liability_address_dec)
        console.log(liability_address)
        return tx

    }

}

const provider = new Provider()


  

