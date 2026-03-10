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
import os.path
import re
import io
import ast
import glob
import json
import time
import shutil
import numpy as np
import pandas as pd
import itertools
import webbrowser
from io import BytesIO, FileIO
from tqdm import tqdm
from pprint import pprint
from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_EVEN
from itertools import combinations, dropwhile
from collections import Counter, OrderedDict


def getDataFromBQ(query):
    query_job = client_bq.query(query, location="asia-northeast1")
    df = query_job.to_dataframe()
    return df