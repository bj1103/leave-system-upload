function switchTab(tabId) {
    // 隱藏所有內容區塊
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 取消所有按鈕的 active 樣式
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // 顯示選擇的內容，並設定按鈕 active
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
    // if (tabId === "records") {
    //     fetchSummary();
    // }

    // if (tabId === "manual") {
    //     loadMarkdown();
    // }

    // if (tabId === "absence-summary") {
    //     initializeDatePicker()
    //     sendDateToBackend(); // 自動發送日期
    // }
}

function initializeDatePicker() {
    let datePicker = document.getElementById("datePicker");
    if (datePicker) {
        datePicker.value = getYesterdayDate();
    }
    fetchAbsenceSummary();
}

function getYesterdayDate() {
    let taiwanTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    taiwanTime.setDate(taiwanTime.getDate() - 1);
    return taiwanTime.toISOString().split('T')[0];  // 轉成 YYYY-MM-DD 格式
}

// 送出日期到後端
function fetchAbsenceSummary() {
    let selectedDate = document.getElementById("datePicker").value;
    
    fetch('/get_absence_on_date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
    })
    .then(response => response.json())
    .then(data => {
        let tableBody = document.getElementById("absenceSummaryTableBody");
        tableBody.innerHTML = "";  // 清空表格內容

        data.records.forEach(row => {
            let tr = document.createElement("tr");
            row.forEach(cell => {
                let td = document.createElement("td");
                td.textContent = cell;
                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        });
    })
    .catch(error => console.error("Error:", error));
}

// 當日期改變時，自動送出新日期
document.addEventListener("DOMContentLoaded", async function() {
    initializeDatePicker();  // 🔹 當網頁載入時，初始化 Date Picker
    document.getElementById("datePicker").addEventListener("change", fetchAbsenceSummary);

    await loadUsers();
    console.log(document.getElementById("nightTimeoffRecords").value)
    fetchNightTimeoffRecords();
    document.getElementById("nightTimeoffRecords").addEventListener("change", fetchNightTimeoffRecords);
    fetchAbsenceRecords();
    document.getElementById("absenceRecords").addEventListener("change", fetchAbsenceRecords);
    fetchSummary();
    loadMarkdown();
});

function uploadFile() {
    let file = document.getElementById('fileInput').files[0];
    if (!file) {
        alert('請選擇一個檔案！');
        return;
    }

    let formData = new FormData();
    formData.append('file', file);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            uploadedData = data.data;  // 存儲數據
            displayData(uploadedData);
        }
    })
    .catch(error => console.error('Error:', error));
}

function displayData(data) {
    let table = document.getElementById('dataTable');
    table.innerHTML = "";

    let columnOrder = ["梯次", "姓名", "單位", "原因", "核發與否"];

    if (data.length === 0) {
        table.innerHTML = "<tr><td colspan='5'>沒有數據</td></tr>";
        return;
    }

    // 創建表頭
    let thead = table.createTHead();
    let row = thead.insertRow();
    columnOrder.forEach(key => {
        let th = document.createElement("th");
        th.textContent = key;
        row.appendChild(th);
    });

    // 創建表身
    let tbody = table.createTBody();
    data.forEach(item => {
        let row = tbody.insertRow();
        columnOrder.forEach(key => {
            let cell = row.insertCell();
            cell.textContent = item[key] || "";
        });
    });

    // 顯示匯入按鈕
    document.getElementById("importButton").style.display = "block";
}

function importData() {
    if (uploadedData.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: '沒有可匯入的數據',
            text: '請先上傳 Excel 檔案！'
        });
        return;
    }

    Swal.fire({
        title: '請確認',
        text: `確定要匯入 ${uploadedData.length} 筆資料至系統嗎？`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '確定',
        cancelButtonText: '取消',
        // reverseButtons: true  // 讓「確定」在左邊
    }).then((result) => {
        if (result.isConfirmed) {
            fetch('/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: uploadedData })
            })
            .then(response => response.json())
            .then(data => {
                Swal.fire({
                    icon: data.error ? 'error' : 'success',
                    title: data.error ? '匯入失敗' : '匯入成功',
                    text: data.message
                });
            })
            .catch(error => console.error('Error:', error));
        }
    });
}

// 取得役男列表並填入下拉式選單
async function loadUsers() {
    let response = await fetch('/get_users');
    let data = await response.json();

    let selectElements = [
        document.getElementById("deleteUser"),
        document.getElementById("nightTimeoffRecords"),
        document.getElementById("absenceRecords"),
        document.getElementById("absenceProofs")
    ];

    // 清空所有 select
    selectElements.forEach(select => select.innerHTML = "");

    // 遍歷使用者並加到所有 select
    data.users.forEach(user => {
        selectElements.forEach(select => {
            let option = document.createElement("option");
            option.value = user;
            option.textContent = user;
            select.appendChild(option);
        });
    });

    // 設定所有 select 預設選擇第一個選項
    selectElements.forEach(select => {
        if (select.options.length > 0) {
            select.selectedIndex = 0;
        }
    });

    return data;
}

// 確認新增役男
function confirmAddUser() {
    let name = document.getElementById("add_name").value;
    let batch = document.getElementById("add_batch").value;
    let unit = document.getElementById("add_unit").value;

    if (!name || !batch || !unit) {
        Swal.fire({
            icon: 'warning',
            title: '請填寫完整資料'
        });
        return;
    }

    Swal.fire({
        title: '請確認',
        text: `確定要新增役男 梯次: ${batch} 姓名: ${name} 單位: ${unit}？`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '確定',
        cancelButtonText: '取消',
    }).then((result) => {
        if (result.isConfirmed) {
            fetch('/add_user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 姓名: name, 梯次: batch, 單位: unit })
            })
            .then(response => response.json())
            .then(data => {
                Swal.fire({
                    icon: data.error ? 'error' : 'success',
                    title: data.error ? '新增失敗' : '新增成功',
                    text: data.message
                });
                loadUsers();
            })
            .catch(error => console.error("Error:", error));
        }
    });
}

// 確認刪除役男
function confirmDeleteUser() {
    let selectedUser = document.getElementById("deleteUser").value;
    if (!selectedUser) {
        Swal.fire({
            icon: 'warning',
            title: '請選擇要刪除的役男'
        });
        return;
    }

    Swal.fire({
        title: '請確認',
        text: `確定要刪除 ${selectedUser} 嗎？`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '確定',
        cancelButtonText: '取消',
    }).then((result) => {
        if (result.isConfirmed) {
            fetch('/delete_user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tab_name: selectedUser })
            })
            .then(response => response.json())
            .then(data => {
                Swal.fire({
                    icon: data.error ? 'error' : 'success',
                    title: data.error ? '刪除失敗' : '刪除成功',
                    text: data.message
                });
                loadUsers();  // 重新載入下拉選單
            })
            .catch(error => console.error("Error:", error));
        }
    });
}

// fetch night timeoff summary
function fetchSummary() {
    fetch(`/get_tab_records?tab_name=夜假統計`)
        .then(response => response.json())
        .then(data => {
            let tableBody = document.getElementById("summaryTableBody");
            tableBody.innerHTML = "";  // 清空表格內容

            data.records.forEach(row => {
                let tr = document.createElement("tr");
                row.forEach(cell => {
                    let td = document.createElement("td");
                    td.textContent = cell;
                    tr.appendChild(td);
                });
                tableBody.appendChild(tr);
            });
        })
        .catch(error => console.error("Error:", error));
}

// 查詢役男夜假
function fetchNightTimeoffRecords() {
    let selectedUser = document.getElementById("nightTimeoffRecords").value;
    if (!selectedUser) return;
    let tableBody = document.getElementById("recordsTableBody");
    tableBody.innerHTML = "";  // 清空表格內容
    fetch(`/get_tab_records?tab_name=${selectedUser}`)
        .then(response => response.json())
        .then(data => {
            data.records.forEach((row, index) => {
                let tr = document.createElement("tr");
                row.forEach(cell => {
                    let td = document.createElement("td");
                    td.textContent = cell;
                    tr.appendChild(td);
                });
                // 加入刪除按鈕
                if (row[3].length === 0) {
                    let deleteTd = document.createElement("td");
                    let deleteBtn = document.createElement("button");
                    deleteBtn.textContent = "扣此筆夜假";
                    deleteBtn.onclick = function () {
                        deleteRecord(row, index, "night_timeoff");  // 把整筆資料傳過去
                    };
                    deleteTd.appendChild(deleteBtn);
                    tr.appendChild(deleteTd);
                }
                tableBody.appendChild(tr);
            });
        })
        .catch(error => console.error("Error:", error));
}


// 查詢請假紀錄，並在每行加入刪除按鈕
function fetchAbsenceRecords() {
    let selectedUser = document.getElementById("absenceRecords").value;
    if (!selectedUser) return;
    let tableBody = document.getElementById("absencesTableBody");
    tableBody.innerHTML = "";  // 清空表格內容

    fetch(`/get_absence_records?tab_name=${selectedUser}`)
        .then(response => response.json())
        .then(data => {
            data.records.forEach((row, index) => {
                let tr = document.createElement("tr");
                row.forEach(cell => {
                    let td = document.createElement("td");
                    td.textContent = cell;
                    tr.appendChild(td);
                });

                // 加入刪除按鈕
                let deleteTd = document.createElement("td");
                let deleteBtn = document.createElement("button");
                deleteBtn.textContent = "刪除";
                deleteBtn.onclick = function () {
                    deleteRecord(row, index, "absence");  // 把整筆資料傳過去
                };
                deleteTd.appendChild(deleteBtn);
                tr.appendChild(deleteTd);

                tableBody.appendChild(tr);
            });
        })
        .catch(error => console.error("Error:", error));
}


// 新增請假紀錄
function addAbsenceRecord() {
    let selectedUser = document.getElementById("absenceRecords").value;
    if (!selectedUser) {
        Swal.fire("錯誤", "請先選擇役男", "error");
        return;
    }

    let newRecord = {
        issue_date: document.getElementById("new_issue_date").value,
        reason: document.getElementById("new_reason").value,
        tab_name: selectedUser
    };

    if (!newRecord.reason || !newRecord.issue_date) {
        Swal.fire("錯誤", "請填寫完整資訊", "error");
        return;
    }
    Swal.fire({
        title: `確定要新增這筆請假紀錄嗎？`,
        text: `請假人: ${selectedUser} 日期: ${newRecord.issue_date}, 假別: ${newRecord.reason}`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "確定",
        cancelButtonText: "取消",
    }).then((result) => {
        if (result.isConfirmed) {
            fetch('/add_absence_record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRecord)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Swal.fire("成功", "請假紀錄已新增", "success");
                    fetchAbsenceRecords();  // 重新載入請假紀錄
                } else {
                    Swal.fire("錯誤", data.error, "error");
                }
            })
            .catch(error => console.error("Error:", error));
        } 
    });
}

// 刪除請假紀錄
function deleteRecord(rowData, rowIndex, type) {
    
    let selectedUser, title, text, reason;
    if (type === "absence") {
        selectedUser = document.getElementById("absenceRecords").value;
        if (!selectedUser) {
            Swal.fire("錯誤", "請選擇役男", "error");
            return;
        }
        title = "確定要刪除這筆請假紀錄嗎？";
        text = `請假人: ${selectedUser} 日期: ${rowData[0]}, 假別: ${rowData[1]}`;
    } else {
        selectedUser = document.getElementById("nightTimeoffRecords").value;
        reason = document.getElementById("deleteReason").value;
        if (!selectedUser || !reason) {
            Swal.fire("錯誤", "請選擇役男與填寫扣夜假的原因", "error");
            return;
        }
        title = "確定要扣這筆夜假嗎？";
        text = `役男: ${selectedUser} 扣夜假原因: ${reason}`
    }

    Swal.fire({
        title: title,
        text: text,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "確定",
        cancelButtonText: "取消",
    }).then((result) => {
        if (result.isConfirmed) {
            if (type === "absence") {
                fetch('/delete_absence_record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tab_name: selectedUser, row_index: rowIndex, row_data: rowData })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        Swal.fire("成功", "請假紀錄已刪除", "success");
                        fetchAbsenceRecords();  // 重新載入請假紀錄
                    } else {
                        Swal.fire("錯誤", "刪除失敗", "error");
                    }
                })
                .catch(error => console.error("Error:", error));
            } else {
                fetch('/delete_night_timeoff', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tab_name: selectedUser, row_index: rowIndex, row_data: rowData, reason: reason })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        Swal.fire("成功", "夜假已扣除", "success");
                        fetchNightTimeoffRecords();  // 重新載入請假紀錄
                    } else {
                        Swal.fire("錯誤", "刪除失敗", "error");
                    }
                })
                .catch(error => console.error("Error:", error));
            }
        } 
    });
}


// 查找 Google Drive 資料夾
function getGoogleDrive() {
    let folderName = document.getElementById("absenceProofs").value;
    if (!folderName) {
        Swal.fire("錯誤", "請輸入名字", "error");
        return;
    }

    fetch(`/get_google_drive?folder_name=${folderName}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.open(data.folder_link, "_blank"); // 🔹 在新分頁打開 Google Drive 連結
            } else {
                Swal.fire("未找到", "沒有找到對應的資料夾", "warning");
            }
        })
        .catch(error => console.error("Error:", error));
}

// 查詢 Google Drive 內的檔案
function fetchAbsenceProofs() {
    let name = document.getElementById("absenceProofs").value;
    if (!name) {
        Swal.fire("錯誤", "請輸入要查詢的姓名", "error");
        return;
    }

    fetch('/search_drive_files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
    })
    .then(response => response.json())
    .then(data => {
        let tableBody = document.getElementById("driveFilesTable");
        tableBody.innerHTML = ""; // 清空舊資料

        if (data.files.length === 0) {
            Swal.fire("查無資料", "該姓名對應的資料夾內沒有檔案", "info");
            return;
        }

        data.files.forEach(file => {
            let tr = document.createElement("tr");

            let fileDateTd = document.createElement("td");
            fileDateTd.textContent = file.name;
            tr.appendChild(fileDateTd);

            let fileTypeTd = document.createElement("td");
            fileTypeTd.textContent = file.type;
            tr.appendChild(fileTypeTd);

            let fileLinkTd = document.createElement("td");
            let link = document.createElement("a");
            link.href = file.view_link;
            link.textContent = "查看";
            link.target = "_blank";
            fileLinkTd.appendChild(link);
            tr.appendChild(fileLinkTd);

            tableBody.appendChild(tr);
        });
    })
    .catch(error => console.error("Error:", error));
}

async function loadMarkdown() {
    const response = await fetch("/static/manual.md"); // 請確保 `example.md` 在同一目錄下
    const markdownText = await response.text();
    marked.setOptions({
        breaks: true,  // 允許換行符號生效
        gfm: true      // 啟用 GitHub Flavored Markdown (GFM) ，它支援 table 語法
    });
    document.getElementById("markdown-content").innerHTML = marked.parse(markdownText);
}

// 頁面加載時載入役男列表
// window.onload = loadUsers;