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
import sys
import json
import numpy as np
import pandas as pd
from tqdm import tqdm
from pprint import pprint

# 一個上の階層を読み込めるようにする
target_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))
# sys.path.append(target_dir)

# Google API
import gspread
from gspread_dataframe import get_as_dataframe, set_with_dataframe


# config --------------------------
keys = [{
            "sheetname":"UK List",
            "key":"1-tMiiPQiB5zXqdP5PcfHWOpSnoc1fmydVlwFONJjogk"
         },
         {
            "sheetname":"SELECT_all",
            "key":"1rXjOAkpL6GfyO6mWxwwUR0PyFtuNHrt7X3QoHY1uN3k"
         }]

# init_data = os.path.join(target_dir, 'data', 'init.json')
# main_data = os.path.join(target_dir, 'data', 'main.json')
init_data = '/Users/horibld303/Documents/guidebook_prj_test/js/public/data/init.json'
main_data = '/Users/horibld303/Documents/guidebook_prj_test/js/public/data/main.json'

# process --------------------------
def main():

    df_base, df_add = getSheetDF(keys)
    
    inits = []
    mains = []
    
    for i, row in tqdm(df_base.iterrows(), leave=False):
        title = row["title_EN"]
        architect = row["author_EN"]
        link = row["link"]
        c_year = row["Year"]
        bldguse = row["bldguse"]
        memo = row["現地memo"]
        region = row["Region"]
        location = row["latlon"]
        
        tags = row["tags"].split(',')
        tags = [re.sub(r'^\s|\s$|#|＃', '', i) for i in tags]
    
        init_d = {
                    "title":title,
                    "architect":architect,
                    "location":[i.strip() for i in location.split(', ')]
                 }
        inits.append(init_d)
    
        for _, a_row in df_add.iterrows():
            a_title = a_row["title_EN"]
            a_architect = a_row["author_EN"]
            a_location = a_row["latlon"]
            address = a_row["address_by_ai"]
            
            if title == a_title and architect == a_architect and location == a_location:                
                main_d = {
                            "title":title,
                            "architect":architect,
                            "region":region,
                            "address":address,
                            "completion":c_year,
                            "builduse":bldguse,
                            "memo":memo,
                            "link":link,
                            "tags":tags
                         }
                mains.append(main_d)
                break
    
    with open(init_data, mode='w', encoding='utf_8') as f:
        json.dump(inits, f, indent=2, ensure_ascii=False)

    with open(main_data, mode='w', encoding='utf_8') as f:
        json.dump(mains, f, indent=2, ensure_ascii=False)

def getSheetDF(keys):
    df_base = None
    df_add = None
    
    for key in keys:
        print(f'> retrieving... {key["sheetname"]}')
        book = client_gs.open_by_key(key["key"])
        sheet = book.worksheet(key["sheetname"])
        data = sheet.get_all_values()
        if key["sheetname"] == 'UK List':
            df_base = pd.DataFrame(data[1:], columns=data[0])
        else:
            df_add = pd.DataFrame(data[1:], columns=data[0])
    
    return df_base, df_add


if __name__ == "__main__":
    main()