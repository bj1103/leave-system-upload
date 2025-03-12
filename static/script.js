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
    if (tabId === "records") {
        fetchSummary();
    }
}

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
function loadUsers() {
    fetch('/get_users')
        .then(response => response.json())
        .then(data => {
            let deleteSelect = document.getElementById("deleteUser");
            let leaveSelect = document.getElementById("leaveRecords");
            let absenceSelect = document.getElementById("absenceRecords");
            let proofSelect = document.getElementById("leaveProofs")

            deleteSelect.innerHTML = "";
            leaveSelect.innerHTML = "";
            absenceSelect.innerHTML = ""
            proofSelect.innerHTML = ""

            data.users.forEach(user => {
                let option1 = document.createElement("option");
                option1.value = user;
                option1.textContent = user;
                deleteSelect.appendChild(option1);

                let option2 = document.createElement("option");
                option2.value = user;
                option2.textContent = user;
                leaveSelect.appendChild(option2);

                let option3 = document.createElement("option");
                option3.value = user;
                option3.textContent = user;
                absenceSelect.appendChild(option3);

                let option4 = document.createElement("option");
                option4.value = user;
                option4.textContent = user;
                proofSelect.appendChild(option4);
            });
        })
        .catch(error => console.error("Error:", error));
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

// 查詢請假紀錄
function fetchLeaveRecords() {
    let selectedUser = document.getElementById("leaveRecords").value;
    if (!selectedUser) return;

    fetch(`/get_tab_records?tab_name=${selectedUser}`)
        .then(response => response.json())
        .then(data => {
            let tableBody = document.getElementById("recordsTableBody");
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

// function fetchAbsenceRecords() {
//     let selectedUser = document.getElementById("absenceRecords").value;
//     if (!selectedUser) return;

//     fetch(`/get_absence_records?tab_name=${selectedUser}`)
//         .then(response => response.json())
//         .then(data => {
//             let tableBody = document.getElementById("absencesTableBody");
//             tableBody.innerHTML = "";  // 清空表格內容

//             data.records.forEach(row => {
//                 let tr = document.createElement("tr");
//                 row.forEach(cell => {
//                     let td = document.createElement("td");
//                     td.textContent = cell;
//                     tr.appendChild(td);
//                 });
//                 tableBody.appendChild(tr);
//             });
//         })
//         .catch(error => console.error("Error:", error));
// }

// 查詢請假紀錄，並在每行加入刪除按鈕
function fetchAbsenceRecords() {
    let selectedUser = document.getElementById("absenceRecords").value;
    if (!selectedUser) return;

    fetch(`/get_absence_records?tab_name=${selectedUser}`)
        .then(response => response.json())
        .then(data => {
            let tableBody = document.getElementById("absencesTableBody");
            tableBody.innerHTML = "";  // 清空表格內容

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
                    deleteAbsenceRecord(row, index);  // 把整筆資料傳過去
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

// 刪除請假紀錄
function deleteAbsenceRecord(rowData, rowIndex) {
    let selectedUser = document.getElementById("absenceRecords").value;
    if (!selectedUser) return;

    Swal.fire({
        title: "確定要刪除這筆請假紀錄嗎？",
        text: `請假人: ${selectedUser} 日期: ${rowData[0]}, 假別: ${rowData[1]}`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "確定",
        cancelButtonText: "取消",
    }).then((result) => {
        if (result.isConfirmed) {
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
        }
    });
}

// 查詢 Google Drive 內的檔案
function fetchLeaveProofs() {
    let name = document.getElementById("leaveProofs").value;
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


// 頁面加載時載入役男列表
window.onload = loadUsers;