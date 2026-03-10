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

# ライブラリ
import os
import re
import os.path
import json
import numpy as np
import pandas as pd
from tqdm import tqdm
from pprint import pprint

import gspread
from gspread_dataframe import get_as_dataframe, set_with_dataframe


# config
keys = [{
            "sheetname":"UK List",
            "key":"1-tMiiPQiB5zXqdP5PcfHWOpSnoc1fmydVlwFONJjogk"
         },
         {
            "sheetname":"SELECT_all",
            "key":"1rXjOAkpL6GfyO6mWxwwUR0PyFtuNHrt7X3QoHY1uN3k"
         }]

def main():


    pass





def getSheetDF(keys):
    data = []
    for key in keys:
        book = client_gs.open_by_key(key["key"])
        sheet = book.worksheet(key["sheetname"])
        data = sheet.get_all_values()
        df = pd.DataFrame(data[1:], columns=data[0])
        d = {"name":key["sheetname"], "data":df}
        data.append(d)
    
    df_base = None
    df_add = None
    for d in data:
        if d["name"] == 'UK List':
            df_base = d["data"]
        else:
            df_add = d["data"]
    
    return df_base, df_add


if __name__ == "__main__":
    main()