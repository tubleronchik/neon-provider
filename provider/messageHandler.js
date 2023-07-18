class MessageHandler {
    constructor(config, ipfsHelper, web3Helper, pinataHelper, liabilityManager) {
      this.config = config
      this.ipfsHelper = ipfsHelper
      this.web3Helper = web3Helper
      this.pinataHelper = pinataHelper
      this.liabilityManager = liabilityManager
      this.demand = {}
      this.offer = {}
      this.onMsg = this.onMsg.bind(this)
      this.checkPairMsgs = this.checkPairMsgs.bind(this)
      // this.sendPubsubMsg = this.sendPubsubMsg.bind(this)
      this.ipfsHelper.subscribe(this.config.ipfs_topic, this.onMsg.bind(this))
    }
  
    async onMsg(msg) {
      let stringMsg = "" 

      if (msg.from === this.config.ipfs_id_agent) {
        stringMsg = String.fromCharCode(...Array.from(msg.data))
        const jsonMsg = JSON.parse(stringMsg)
        if (jsonMsg.result) {
          const resultHash = jsonMsg.result
          await this.liabilityManager.minNFT(resultHash)
          await this.liabilityManager.finalizeLiability(resultHash)
          return
        } else {
          this.offer = jsonMsg
          await this.checkPairMsgs()
        }
      }

      else {
        try {
            stringMsg = String.fromCharCode(...Array.from(msg.data))
            const m = JSON.parse(stringMsg)
            if (m.model == config.model) {
                this.demand = m
                await this.checkPairMsgs()
            }  
        } catch(error) {
            return
        }
      }
    }
  
    async checkPairMsgs() {
      if (this.demand && this.offer) {
        const blockNumber = await this.web3Helper.getBlockNumber()
        const demandModel = this.demand.model
        const offerModel = this.offer.model
        const demandObjective = this.demand.objective
        const offerObjective = this.offer.objective
  
        if (demandModel === offerModel && demandObjective === offerObjective && this.demand.deadline > blockNumber) {
          const current_offer = this.offer
          this.offer = undefined
          await this.liabilityManager.createLiability(this.demand, current_offer)
          await this.ipfsHelper.publish({ liability: this.liabilityManager.liabilityAddress }, this.config.ipfs_topic)
        }
      }
    }
  
}

export default MessageHandler;