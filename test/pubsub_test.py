"""Pubsub message sender to check the msg handler. Not working due to the problem with secrets.token_hex(34)"""
import web3
import argparse
import secrets
import json
import ipfs_api
from eth_account.messages import encode_defunct
import time

class RandomDemand():
    def __init__(self, config_path) -> None:
        self.config: dict = self._read_configuration(config_path)
        self.w3 = web3.Web3(web3.Web3.HTTPProvider(self.config["http_node_provider"]))
        demand = self.create_demand()
        ipfs_api.pubsub_publish(self.config["ipfs_topic"], json.dumps(demand))
        time.sleep(3)
        offer = self.create_offer(demand)
        ipfs_api.pubsub_publish(self.config["ipfs_topic"], json.dumps(offer))

    def create_demand(self):
        demand = {
            "model": secrets.token_hex(34),
            "objective": secrets.token_hex(34),
            "token": self.config["xrt_contract_address"],
            "cost": "1",
            "lighthouse": self.config["lighthouse_contract_address"],
            "validator": "0x0000000000000000000000000000000000000000",
            "validatorFee": "2",
            "deadline": self.w3.eth.get_block_number() + 1000,
            "nonce": self.w3.eth.get_transaction_count(self.config["test_user_address"]),
            "sender": self.config["test_user_address"]
        }
        types = ['bytes',
                 'bytes',
                 'address',
                 'uint256',
                 'address',
                 'address',
                 'uint256',
                 'uint256',
                 'uint256',
                 'address']

        hash = web3.Web3.soliditySha3(types, [
            str.encode(demand["model"]),
            str.encode(demand["objective"]),
            demand["token"],
            self.w3.toInt(hexstr=demand["cost"]),
            demand["lighthouse"],
            demand["validator"],
            self.w3.toInt(hexstr=demand["validatorFee"]),
            demand["deadline"],
            demand["nonce"],
            demand["sender"]
        ])
        msg = encode_defunct(hash)
        demand_signed = web3.eth.Account.sign_message(msg, private_key=self.config["test_user_pk"])
        demand["signature"] = str(demand_signed.signature.hex())
        return demand
    
    def create_offer(self, demand: dict) -> dict:
        offer = {
            "model": demand["model"],
            "objective": demand["objective"],
            "token": demand["token"],
            "cost": demand["cost"],
            "validator": demand["validator"],
            "lighthouse": demand["lighthouse"],
            "lighthouseFee": "1",
            "deadline": self.w3.eth.get_block_number() + 1000,
            "nonce": self.w3.eth.get_transaction_count(self.config["spot_address"]),
            "sender": self.config["spot_address"],
        }
        types = [
            "bytes",
            "bytes",
            "address",
            "uint256",
            "address",
            "address",
            "uint256",
            "uint256",
            "uint256",
            "address",
        ]

        hash = web3.Web3.soliditySha3(
            types,
            [
                str.encode(offer["model"]),
                str.encode(offer["objective"]),
                offer["token"],
                self.w3.toInt(hexstr=offer["cost"]),
                offer["validator"],
                offer["lighthouse"],
                self.w3.toInt(hexstr=offer["lighthouseFee"]),
                offer["deadline"],
                offer["nonce"],
                offer["sender"],
            ],
        )
        msg = encode_defunct(hash)
        offer["signature"] = str(web3.eth.Account.sign_message(msg, private_key=self.config["spot_pk"]).signature.hex())  
        return offer

    def _read_configuration(self, path: str) -> dict:
        """Internal method. Loads the configuration.
        :param config_path: Path to the configuration file.
        :return: Python dict with the config
        """

        try:
            with open(path) as f:
                content = f.read()
                config = json.loads(content)
                return config
        except Exception as e:
            print(f"Couldn't load the configuration file: {e}")



def run() -> None:
    """Main function of the script. Read the config path as the argument from the command line."""

    parser = argparse.ArgumentParser(description="Add config path.")
    parser.add_argument("config_path", type=str, help="config path")
    args = parser.parse_args()
    RandomDemand(args.config_path)


if __name__ == "__main__":
    run()



