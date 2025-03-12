from flask import Flask, render_template, request, jsonify
import pandas as pd
import gspread
import json
import os
from datetime import datetime
import pytz
from googleapiclient.discovery import build
from google.oauth2 import service_account

NIGHT_TIMEOFF_SHEET_KEY = "10o1RavT1RGKFccEdukG1HsEgD3FPOBOPMB6fQqTc_wI"
ABSENCE_RECORD_SHEET_KEY = "1TxClL3L0pDQAIoIidgJh7SP-BF4GaBD6KKfVKw0CLZQ"
service_account_info = json.loads(os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON'))
service_account_info['private_key'] = service_account_info[
    'private_key'].replace("\\n", "\n")
gc = gspread.service_account_from_dict(service_account_info)
taipei_timezone = pytz.timezone('Asia/Taipei')

SCOPES = ["https://www.googleapis.com/auth/drive"]

credentials = service_account.Credentials.from_service_account_info(
    service_account_info, scopes=SCOPES
)
drive_service = build("drive", "v3", credentials=credentials)
PARENT_FOLDER_ID = os.getenv("FOLDER_ID")

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'})
    if file:
        # 解析 Excel，確保欄位順序一致
        df = pd.read_excel(file, dtype=str)

        required_columns = {"梯次", "姓名", "單位", "原因", "核發與否"}
        if required_columns.issubset(df.columns):
            data = df.to_dict(orient='records')
            return jsonify({
                'message': 'File uploaded successfully',
                'data': data,
                'columns': df.columns.tolist()
            })
        else:
            return jsonify(
                {'error': 'Excel需有以下5個欄位: "梯次", "姓名", "單位", "原因", "核發與否"'})


@app.route('/import', methods=['POST'])
def import_data():
    data = request.json.get('data', [])
    if not data:
        return jsonify({'error': 'No data to import'})

    # try:
    # 連接到 Google 試算表
    sh = gc.open_by_key(NIGHT_TIMEOFF_SHEET_KEY)
    worksheet = sh.worksheet("夜假總表")  # 確保此 tab 名稱一致

    # 轉換數據為列表格式（按照指定欄位順序）
    column_order = ["梯次", "姓名", "單位", "原因", "核發與否"]
    new_rows = []
    date = datetime.now(taipei_timezone).strftime('%Y/%-m/%-d')
    for item in data:
        new_rows.append([date] + [item.get(col, "") for col in column_order])

    # Append 到試算表
    worksheet.append_rows(new_rows)

    return jsonify({'message': '已成功匯入系統', 'imported_rows': len(new_rows)})

    # except Exception as e:
    #     return jsonify({'error': str(e)})


@app.route('/get_users', methods=['GET'])
def get_users():
    try:
        sh = gc.open_by_key(NIGHT_TIMEOFF_SHEET_KEY)
        sheets = sh.worksheets()
        sheet_names = [sheet.title for sheet in sheets
                       if "T" in sheet.title]  # 只抓有 "T" 的 tab
        return jsonify({'users': sheet_names})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def create_folder(parent_folder_id, folder_name):
    """Creates a folder with the given name inside the specified parent folder."""
    file_metadata = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_folder_id]
    }
    folder = drive_service.files().create(body=file_metadata, fields="id").execute()
    print(f"✅ Folder '{folder_name}' created with ID: {folder['id']}")
    return folder["id"]

def get_folder_id(parent_folder_id, folder_name):
    """Finds the folder ID by its name inside a given parent folder."""
    query = f"'{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and trashed=false"
    results = drive_service.files().list(q=query, fields="files(id, name)").execute()
    folders = results.get("files", [])

    if not folders:
        print(f"Folder '{folder_name}' not found in the specified parent folder.")
        return None
    return folders[0]["id"]  # Assuming folder names are unique

def delete_all_files_in_folder(folder_id):
    """Deletes all files and subfolders inside a given folder."""
    query = f"'{folder_id}' in parents and trashed=false"
    results = drive_service.files().list(q=query, fields="files(id, name, mimeType)").execute()
    files = results.get("files", [])

    if not files:
        print(f"Folder is empty. Proceeding to delete it.")
    else:
        print(f"Deleting {len(files)} items in folder...")

    for file in files:
        print(f"Deleting: {file['name']} (ID: {file['id']})")
        drive_service.files().delete(fileId=file["id"]).execute()

def delete_folder_and_contents(parent_folder_id, folder_name):
    """Deletes a folder along with all its contents."""
    folder_id = get_folder_id(parent_folder_id, folder_name)
    if folder_id:
        delete_all_files_in_folder(folder_id)  # Delete all files inside first
        drive_service.files().delete(fileId=folder_id).execute()  # Then delete the folder itself
        print(f"Folder '{folder_name}' and all its contents have been deleted.")
    else:
        print(f"Folder '{folder_name}' does not exist and cannot be deleted.")


@app.route('/add_user', methods=['POST'])
def add_user():
    data = request.json
    name, batch, unit = data.get('姓名'), data.get('梯次'), data.get('單位')

    if not name or not batch or not unit:
        return jsonify({'error': '缺少必要欄位'}), 400

    tab_name = f"{batch}T_{unit}_{name}"  # 新的工作表名稱

    try:
        sh = gc.open_by_key(NIGHT_TIMEOFF_SHEET_KEY)

        # 檢查是否已存在同名工作表
        existing_sheets = [ws.title for ws in sh.worksheets()]
        if tab_name in existing_sheets:
            return jsonify({'error': f'工作表 "{tab_name}" 已存在'}), 400

        # 新增工作表（10 行 x 8 列）
        worksheet = sh.add_worksheet(title=tab_name, rows="1000", cols="4")

        # 設定標題
        headers = ["核發原因", "核發日期", "有效期限", "使用日期"]
        worksheet.insert_row(headers, 1)

        sh = gc.open_by_key(ABSENCE_RECORD_SHEET_KEY)

        existing_sheets = [ws.title for ws in sh.worksheets()]
        if tab_name in existing_sheets:
            return jsonify({'error': f'工作表 "{tab_name}" 已存在'}), 400

        worksheet = sh.add_worksheet(title=tab_name, rows="1000", cols="3")

        headers = ["請假日期", "假別", "已上傳證明"]
        worksheet.insert_row(headers, 1)

        create_folder(PARENT_FOLDER_ID, tab_name)

        return jsonify({'message': f'成功新增役男: "{tab_name}"'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/delete_user', methods=['POST'])
def delete_user():
    data = request.json
    tab_name = data.get('tab_name')

    if not tab_name:
        return jsonify({'error': '請選擇要刪除的役男'}), 400

    batch, name = tab_name.split("T")

    try:
        sh = gc.open_by_key(ABSENCE_RECORD_SHEET_KEY)

        existing_sheets = {ws.title: ws for ws in sh.worksheets()}
        if tab_name in existing_sheets:
            sh.del_worksheet(existing_sheets[tab_name])
        else:
            return jsonify({'error': f'找不到工作表 "{tab_name}"'}), 404

        sh = gc.open_by_key(NIGHT_TIMEOFF_SHEET_KEY)

        existing_sheets = {ws.title: ws for ws in sh.worksheets()}
        if tab_name in existing_sheets:
            sh.del_worksheet(existing_sheets[tab_name])
        else:
            return jsonify({'error': f'找不到工作表 "{tab_name}"'}), 404

        # 讀取 "夜假總表"
        night_leave_sheet = sh.worksheet("夜假總表")
        records = night_leave_sheet.get_all_values()

        # 找到符合 梯次 (B 欄)、姓名 (C 欄)、單位 (D 欄) 的 row
        rows_to_delete = []
        for i, row in enumerate(records[1:], start=2):  # 從第二行開始
            # if len(row) >= 4 and row[1] == batch and row[2] == name and row[3] == unit:
            if len(row) >= 4 and row[1] == batch and row[2] == name:
                rows_to_delete.append(i)

        # 反向刪除，避免索引錯誤
        for row_index in reversed(rows_to_delete):
            night_leave_sheet.delete_rows(row_index)

        delete_folder_and_contents(PARENT_FOLDER_ID, tab_name)

        return jsonify({'message': f'成功刪除役男: "{tab_name}"'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# 獲取夜假紀錄
@app.route("/get_tab_records")
def get_leave_records():
    tab_name = request.args.get("tab_name")
    sh = gc.open_by_key(NIGHT_TIMEOFF_SHEET_KEY)
    try:
        sheet = sh.worksheet(tab_name)
        all_records = sheet.get_all_values()[1:]  # 排除第一行標題
        # filtered_records = [row[:4] for row in all_records]
        return jsonify({"records": all_records})
    except gspread.exceptions.WorksheetNotFound:
        return jsonify({"error": "找不到該役男的夜假紀錄"})


# 獲取請假紀錄
@app.route("/get_absence_records")
def get_absence_records():
    tab_name = request.args.get("tab_name")
    sh = gc.open_by_key(ABSENCE_RECORD_SHEET_KEY)
    try:
        sheet = sh.worksheet(tab_name)
        all_records = sheet.get_all_values()[1:]  # 排除第一行標題
        return jsonify({"records": all_records})
    except gspread.exceptions.WorksheetNotFound:
        return jsonify({"error": "找不到該役男的請假紀錄"})

def update_absence_record(worksheet, date, reason):
    length = 0
    for record in worksheet.get_all_records():
        if len(record["請假日期"]) != 0:
            length += 1
        else:
            break

    if length == 0:
        data = []
    else:
        data = worksheet.get(f"A2:B{length+1}")
    data.append([
        date,
        reason 
    ])
    sorted_data = sorted(
        data, key=lambda row: datetime.strptime(row[0], '%Y/%m/%d'))
    worksheet.update(f"A2:B{length+2}", sorted_data)

def get_night_timeoff_amount(worksheet):
    available_night_timeoff = []
    for row in worksheet.get_all_records():
        if len(row["使用日期"]) == 0 and len(row["核發日期"]) != 0:
            available_night_timeoff.append(row["有效期限"])
    return available_night_timeoff

def update_nigth_timeoff_sheet(worksheet, date):
    length = 0
    for record in worksheet.get_all_records():
        if len(record["使用日期"]) != 0:
            length += 1
        else:
            break
    if length == 0:
        data = []
    else:
        data = worksheet.get(f"D2:D{length+1}")
    data.append([
        date
    ])
    sorted_data = []
    indexes = []
    for i, date in enumerate(data):
        if date[0] != "已過期":
            sorted_data.append(date[0])
            indexes.append(i)

    sorted_data.sort(key=lambda row: datetime.strptime(row, '%Y/%m/%d'))
    
    for i, date in enumerate(sorted_data):
        data[indexes[i]] = [date]
    worksheet.update(f"D2:D{length+2}", data)

@app.route("/add_absence_record", methods=["POST"])
def add_absence_record():
    data = request.json
    tab_name = data["tab_name"]
    date = datetime.strptime(data["issue_date"],
                                 '%Y-%m-%d').strftime('%Y/%-m/%-d')
    reason = data["reason"]
    try:
        if reason == "夜假":
            sh = gc.open_by_key(NIGHT_TIMEOFF_SHEET_KEY)
            sheet = sh.worksheet(tab_name)
            if len(get_night_timeoff_amount(sheet)) == 0:
                return jsonify({"success": False, "error": "役男無可用夜假"})
            update_nigth_timeoff_sheet(sheet, date)
            
        spreadsheet = gc.open_by_key(ABSENCE_RECORD_SHEET_KEY)
        sheet = spreadsheet.worksheet(tab_name)
        update_absence_record(sheet, date, reason)

        return jsonify({"success": True})
    except Exception as e:
        print("Error:", e)
        return jsonify({"success": False, "error": str(e)})


@app.route("/delete_absence_record", methods=["POST"])
def delete_absence_record():
    data = request.json
    tab_name = data["tab_name"]
    row_index = int(
        data["row_index"]) + 2  # Google Sheet 的 row index 是從 1 開始，且要跳過標題
    row_data = data["row_data"]
    date = row_data[0]
    reason = row_data[1]

    try:
        spreadsheet = gc.open_by_key(ABSENCE_RECORD_SHEET_KEY)
        sheet = spreadsheet.worksheet(tab_name)
        sheet.delete_rows(row_index)

        if reason == "夜假":
            length = 0
            night_timeoff_sheet = gc.open_by_key(NIGHT_TIMEOFF_SHEET_KEY)
            night_timeoff_worksheet = night_timeoff_sheet.worksheet(tab_name)
            for record in night_timeoff_worksheet.get_all_records():
                if len(record["使用日期"]) != 0:
                    length += 1
                else:
                    break

            data = night_timeoff_worksheet.get(f"D2:D{length+1}")

            previous = -1
            for i in range(len(data)):
                if previous == -1 and data[i][0] == date:
                    data[i] = [""]
                    previous = i
                elif previous != -1 and data[i][0] != "已過期":
                    data[previous] = data[i]
                    data[i] = [""]
                    previous = i
            night_timeoff_worksheet.update(f"D2:D{length+1}", data)

        return jsonify({"success": True})
    except Exception as e:
        print("Error:", e)
        return jsonify({"success": False, "error": str(e)})


@app.route("/search_drive_files", methods=["POST"])
def search_drive_files():
    data = request.json
    name = data.get("name")
    if not name:
        return jsonify({"error": "請輸入姓名"}), 400

    try:
        # 先找出與該名字相符的子資料夾
        query = f"'{PARENT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '{name}'"
        response = drive_service.files().list(q=query, fields="files(id, name)").execute()
        folders = response.get("files", [])

        if not folders:
            return jsonify({"files": []})  # 找不到資料夾

        folder_id = folders[0]["id"]  # 取得該名字對應的子資料夾 ID

        # 搜尋該資料夾內的所有檔案
        file_query = f"'{folder_id}' in parents"
        file_response = drive_service.files().list(q=file_query, fields="files(id, name)").execute()
        files = file_response.get("files", [])

        file_list = []
        for file in files:
            file_id = file["id"]
            file_name = file["name"]
            date_and_type = file_name.split(".")[0].split("_")
            view_link = f"https://drive.google.com/file/d/{file_id}/view"

            file_list.append({"name": date_and_type[0], "type": date_and_type[1], "view_link": view_link})

        file_list.sort(key=lambda x: datetime.strptime(x["name"], '%Y-%m-%d'))
        return jsonify({"files": file_list})

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
