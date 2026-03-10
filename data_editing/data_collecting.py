# 環境変数
import os
from dotenv import load_dotenv
load_dotenv()

# 認証処理
from auth import authorize
config = authorize()
client_gs = config[0]
client_bq = config[1]
client_dv = config[2]


base_sheet_key = '1-tMiiPQiB5zXqdP5PcfHWOpSnoc1fmydVlwFONJjogk'
address_sheet_key = '1rXjOAkpL6GfyO6mWxwwUR0PyFtuNHrt7X3QoHY1uN3k'




def main():




if __name__ == "__main__":
    main()