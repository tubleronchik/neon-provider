import { create } from 'ipfs-http-client'
import all from 'it-all'
import Web3 from 'web3';
import { readFileSync } from "fs";
import pinataSDK from '@pinata/sdk';

let config = readFileSync(`config/config.json`)
config = JSON.parse(config)
const web3 = new Web3(config.http_node_provider)
web3.eth.accounts.wallet.add(config.provider_pk)
web3.eth.accounts.wallet.add(config.spot_pk)
// web3.eth.accounts.wallet.add(config.test_user_pk)
web3.eth.defaultAccount = config.provider_address

const ipfs = create("http://127.0.0.1:5001")
const pinata = new pinataSDK(config.pinataApiKey, config.pinataSecretApiKey);

class Provider {
    constructor() {
        this.demand = {}
        this.offer = {}
        this.liabilityAddress = ""
        this.nftSent = false
        this.onMsg = this.onMsg.bind(this); // to send context of the Provider into function
        this.checkPairMsgs = this.checkPairMsgs.bind(this);
        this.createLiability = this.createLiability.bind(this);
        this.sendPubsubMsg = this.sendPubsubMsg.bind(this);
        this.finlizeLiability = this.finlizeLiability.bind(this);
        this.minNFT = this.minNFT.bind(this);
        this.getDemandSender = this.getDemandSender.bind(this);
        this.ipfsSubscribe()

    }
    async ipfsSubscribe() {
        await ipfs.pubsub.subscribe(config.ipfs_topic, this.onMsg)
        console.log(`subscribed to ${config.ipfs_topic}`)
    }

    async onMsg(msg) {
        let stringMsg = ""
        if (msg.from == config.ipfs_id_agent) {
            stringMsg = String.fromCharCode(...Array.from(msg.data))
            const jsonMsg = JSON.parse(stringMsg)
            if (jsonMsg.result) {
                const resultHash = jsonMsg.result
                await this.minNFT(resultHash)
                await this.finlizeLiability(resultHash)
                return
            }
            else if (jsonMsg.queue) {
                console.log(jsonMsg)
                return
            }
            else {
                this.offer = jsonMsg
                await this.checkPairMsgs()
            }
        }
        else if (msg.from != config.ipfs_id_provider) {
            try {
                stringMsg = String.fromCharCode(...Array.from(msg.data))
                const m = JSON.parse(stringMsg)
                if ((m.model == config.model) && (JSON.stringify(m) != JSON.stringify(this.demand))) {
                    this.demand = m
                    console.log("demand")
                    console.log(this.demand)
                    await this.sendPubsubMsg(this.demand, config.ipfs_topic)
                    await this.sendPubsubMsg({"gotDemand": true, "demandSender": this.demand.sender, "demandObjective": this.demand.objective}, config.ipfs_topic)
                }
                else if (JSON.stringify(m) == JSON.stringify(this.demand)) {
                    await this.sendPubsubMsg({"gotDemand": true, "demandSender": this.demand.sender, "demandObjective": this.demand.objective}, config.ipfs_topic)
                }
                else if (m.gotNFT) {
                    this.nftSent = true
                    console.log(`this.nftSent: ${this.nftSent}`)
                }
            } catch (error) {
                return
            }
        }
    }

    async checkPairMsgs() {
        if (this.demand && this.offer) {
            const blockNumber = await web3.eth.getBlockNumber()
            const demandModel = this.demand.model
            const offerModel = this.offer.model
            const demandObjective = this.demand.objective
            const offerObjective = this.offer.objective

            if ((demandModel == offerModel) && (demandObjective == offerObjective) && (this.demand.deadline > blockNumber)) {
                await this.createLiability()
                await this.sendPubsubMsg({ "liability": this.liabilityAddress }, config.ipfs_topic)
            }
        }
    }

    async sendPubsubMsg(msg, topic) {
        const jsonMsg = JSON.stringify(msg)
        await ipfs.pubsub.publish(topic, jsonMsg)
        console.log(`Message ${jsonMsg} sent to ${topic}`)
    }

    downloadABI(path) {
        let abi = readFileSync(path)
        let jsonABI = JSON.parse(abi)
        return jsonABI
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
                , demand.signature
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
        console.log("creating liability...")
        const lighthouseABI = this.downloadABI("abi/Lighthouse.json")
        this.lighthouse = await new web3.eth.Contract(lighthouseABI, config.lighthouse_contract_address)

        let d_encoded = this.encodeDemand(this.demand)
        let o_encoded = this.encodeOffer(this.offer)
        this.offer = undefined

        const nonce = await web3.eth.getTransactionCount(config.provider_address, "pending")
        try {
            let tx = await this.lighthouse.methods.createLiability(d_encoded, o_encoded).send({ from: config.provider_address, gas: 300000000, nonce: nonce })
            const liability_receipt = await web3.eth.getTransactionReceipt(tx["transactionHash"])
            const liability_address_hex = liability_receipt["logs"][2]["topics"][1]
            const liability_address_dec = "0x" + liability_address_hex.slice(26)
            this.liabilityAddress = web3.utils.toChecksumAddress(liability_address_dec)
            console.log(`Liability address: ${this.liabilityAddress}`)
            return this.liabilityAddress
        } catch (error) {
            console.error("Couldn't create liability:")
            console.log(error)
        }
    }

    async finlizeLiability(resultHash) {
        console.log("finalizing liability...")
        const result = {
            address: this.liabilityAddress,
            result: resultHash,
            success: true
        }
        const hash = web3.utils.soliditySha3(
            { t: 'address', v: result.address },
            { t: 'bytes', v: web3.utils.toHex(result.result) },
            { t: 'bool', v: result.success }
        )
        const signature = await web3.eth.accounts.sign(hash, config.spot_pk)
        const nonce = await web3.eth.getTransactionCount(config.provider_address, "pending")
        try {
            let tx = await this.lighthouse.methods.finalizeLiability(result.address, web3.utils.toHex(result.result), result.success, signature.signature).send({ from: config.provider_address, gas: 300000000, nonce: nonce })
            console.log(`Liability ${this.liabilityAddress} finalized! Tx hash: ${tx.transactionHash}`)
        } catch (error) {
            console.error("Couldn't finalize liability:")
            console.log(error)
        }
        await this.sendPubsubMsg({"finalized": "true", "finalizedLiabilityAddress": result.address}, config.ipfs_topic)
    }

    async createMetadata(resultHash) {
        const output = await all(ipfs.ls(resultHash))
        const fullPath = output[0].path
        const img = `${config.pinata_endpoint}${fullPath}/AUSTIN.jpg`
        const description = `${config.pinata_endpoint}${fullPath}`
        const metadata = {"description": description, "image": img, "name": "SpotNFT"}
        return metadata
    }

    async getDemandSender() {
        const liabilityABI = this.downloadABI("abi/Liability.json")
        const liability = await new web3.eth.Contract(liabilityABI, this.liabilityAddress)
        const sender = await liability.methods.promisee().call()
        return sender
    }

    async minNFT(resultHash) {
        console.log("Minting NFT....")
        const metadata = await this.createMetadata(resultHash)
        const { IpfsHash } = await pinata.pinJSONToIPFS(metadata)
        const nftABI = this.downloadABI("abi/SpotNFT.json")
        const nft = await new web3.eth.Contract(nftABI, config.nft_contract_address)
        const tokenURI = `${config.pinata_endpoint}${IpfsHash}`
        const nonce = await web3.eth.getTransactionCount(config.provider_address, "pending")
        const demandSender = await this.getDemandSender()
        console.log(demandSender)
        try {
            const tx = await nft.methods.mintNFT(demandSender, tokenURI).send({ from: config.provider_address, gas: 300000000, nonce: nonce })
            const receipt = await web3.eth.getTransactionReceipt(tx["transactionHash"])
            const logs = receipt.logs
            const tokenId = web3.utils.hexToNumber(logs[0].topics[3])
            console.log(`NFT id: ${tokenId}`)
            const maxAttempts = 10
            let attempt = 0

            const intervalPublish = setInterval(async () => {
                if (attempt >= maxAttempts) {
                    console.log('Stop repeating publish. Max attempts reached.');
                    clearInterval(intervalPublish);
                    this.nftSent = false
                    return;
                }

                else if(this.nftSent) {
                    console.log('Stop repeating publish.');
                    clearInterval(intervalPublish);
                    this.nftSent = false
                    return; 
                }
                await this.sendPubsubMsg({ "liabilityAddress": this.liabilityAddress, "nftContract": config.nft_contract_address, "tokenId": tokenId }, config.ipfs_topic);
                console.log(`Message sent successfully (attempt ${attempt + 1})`);
                attempt++
            }, 5000);

            // await this.sendPubsubMsg({ "liabilityAddress": this.liabilityAddress, "nftContract": config.nft_contract_address, "tokenId": tokenId }, config.ipfs_topic)
            return tokenId
        } catch (error) {
            console.error("Couldn't mint NFT:")
            console.log(error)
        }
    }
}

const provider = new Provider()
