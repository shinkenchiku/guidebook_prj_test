import os
from dotenv import load_dotenv
load_dotenv()

#認証関係
import gspread
from google.cloud import bigquery
from googleapiclient.discovery import build
from oauth2client.service_account import ServiceAccountCredentials

#使用するサービスの範囲を指定
scope = [
        'https://www.googleapis.com/auth/bigquery',
        'https://www.googleapis.com/auth/drive'
        ]


def authorize():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.getenv("SURVICE_ACCOUNT_PATH")
    survice_account_path = os.getenv("SURVICE_ACCOUNT_PATH")
    credentials = ServiceAccountCredentials.from_json_keyfile_name(survice_account_path, scope)

    client_gs = gspread.authorize(credentials)
    client_bq = bigquery.Client(project=os.getenv("GCP_PROJECT_ID"))
    client_dv = build('drive', 'v3', credentials=credentials)

    return client_gs, client_bq, client_dv