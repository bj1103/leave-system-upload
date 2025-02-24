from flask import Flask, render_template, request, jsonify
import pandas as pd

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
        df = pd.read_excel(file)
        data = df.to_dict(orient='records')
        return jsonify({'message': 'File uploaded successfully', 'data': data})

if __name__ == '__main__':
    app.run(debug=True)