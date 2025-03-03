from flask import Flask, render_template, request, jsonify
import pandas as pd
import gspread
import json
import os
from datetime import datetime, timedelta
import pytz

ABSENCE_SHEET_KEY = "10o1RavT1RGKFccEdukG1HsEgD3FPOBOPMB6fQqTc_wI"
service_account_info = json.loads(os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON'))
service_account_info['private_key'] = service_account_info[
    'private_key'].replace("\\n", "\n")
gc = gspread.service_account_from_dict(service_account_info)
taipei_timezone = pytz.timezone('Asia/Taipei')

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
            return jsonify({'message': 'File uploaded successfully', 'data': data, 'columns': df.columns.tolist()})
        else:
            return jsonify({'error': 'Excel需有以下5個欄位: "梯次", "姓名", "單位", "原因", "核發與否"'})

        

@app.route('/import', methods=['POST'])
def import_data():
    data = request.json.get('data', [])
    if not data:
        return jsonify({'error': 'No data to import'})

    # try:
    # 連接到 Google 試算表
    sh = gc.open_by_key(ABSENCE_SHEET_KEY)
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


@app.route('/add_user', methods=['POST'])
def add_user():
    data = request.json
    name, batch, unit = data.get('姓名'), data.get('梯次'), data.get('單位')

    if not name or not batch or not unit:
        return jsonify({'error': '缺少必要欄位'}), 400

    tab_name = f"{batch}T{name}"  # 新的工作表名稱

    try:
        sh = gc.open_by_key(ABSENCE_SHEET_KEY)

        # 檢查是否已存在同名工作表
        existing_sheets = [ws.title for ws in sh.worksheets()]
        if tab_name in existing_sheets:
            return jsonify({'error': f'工作表 "{tab_name}" 已存在'}), 400

        # 新增工作表（10 行 x 8 列）
        worksheet = sh.add_worksheet(title=tab_name, rows="1000", cols="8")

        # 設定標題
        headers = ["核發原因", "核發日期", "有效期限", "夜假日期", "", "", "請假紀錄", "日期"]
        worksheet.insert_row(headers, 1)

        return jsonify({'message': f'成功新增役男: "{tab_name}"'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/delete_user', methods=['POST'])
def delete_user():
    data = request.json
    name, batch, unit = data.get('姓名'), data.get('梯次'), data.get('單位')

    if not name or not batch or not unit:
        return jsonify({'error': '缺少必要欄位'}), 400

    tab_name = f"{batch}T{name}"  # 要刪除的工作表名稱

    try:
        sh = gc.open_by_key(ABSENCE_SHEET_KEY)

        # 刪除對應的工作表
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
            if len(row) >= 4 and row[1] == batch and row[2] == name and row[3] == unit:
                rows_to_delete.append(i)

        # 反向刪除，避免索引錯誤
        for row_index in reversed(rows_to_delete):
            night_leave_sheet.delete_rows(row_index)

        return jsonify({'message': f'成功刪除役男: "{tab_name}"'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
