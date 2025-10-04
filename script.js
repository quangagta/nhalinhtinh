const connectButton = document.getElementById('connect-arduino');
const statusMessage = document.getElementById('status-message');
const nhietDoSpan = document.getElementById('nhiet-do');
const doAmSpan = document.getElementById('do-am');
const controlButtons = document.querySelectorAll('.control-panel button');

let port; // Đối tượng cổng Serial
let reader; // Đối tượng đọc dữ liệu
let inputDone; // Cờ báo hiệu kết thúc đọc
let keepReading = true; // Cờ để kiểm soát vòng lặp đọc

// Hàm kết nối
async function connect() {
    try {
        // 1. Yêu cầu chọn cổng Serial
        port = await navigator.serial.requestPort();
        // 2. Mở cổng với tốc độ Baud Rate (phải khớp với Arduino)
        await port.open({ baudRate: 9600 });
        statusMessage.textContent = 'Trạng thái: Đã kết nối ✅';
        connectButton.textContent = 'Ngắt kết nối';
        connectButton.onclick = disconnect;

        // 3. Bắt đầu đọc dữ liệu
        await readLoop();
        
        // 4. Thiết lập sự kiện gửi lệnh điều khiển
        controlButtons.forEach(button => {
            button.onclick = sendCommand;
        });

    } catch (error) {
        statusMessage.textContent = `Lỗi kết nối: ${error.message} ❌`;
    }
}

// Hàm ngắt kết nối
async function disconnect() {
    if (reader) {
        keepReading = false;
        reader.cancel(); // Hủy bỏ bộ đọc
        await inputDone.catch(() => {});
        reader = null;
        inputDone = null;
    }
    if (port) {
        await port.close();
        port = null;
    }
    statusMessage.textContent = 'Trạng thái: Chưa kết nối';
    connectButton.textContent = 'Kết nối Arduino';
    connectButton.onclick = connect;

    controlButtons.forEach(button => {
        button.onclick = null; // Vô hiệu hóa nút
    });
}

// Vòng lặp đọc dữ liệu liên tục từ Arduino
async function readLoop() {
    keepReading = true;
    while (port.readable && keepReading) {
        // Sử dụng TextDecoder để đọc dữ liệu dưới dạng chuỗi
        const textDecoder = new TextDecoderStream();
        inputDone = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    reader.releaseLock();
                    break;
                }
                if (value) {
                    handleData(value.trim()); // Xử lý dữ liệu nhận được
                }
            }
        } catch (error) {
            if (keepReading) { // Chỉ báo lỗi nếu không phải do ngắt kết nối chủ động
                statusMessage.textContent = `Lỗi đọc dữ liệu: ${error.message} ⚠️`;
                console.error(error);
            }
        } finally {
            reader.releaseLock();
        }
    }
}

// Xử lý dữ liệu nhận được (ví dụ: "T25.5 H60")
function handleData(data) {
    // Giả định Arduino gửi dữ liệu dạng: "T<nhiet_do> H<do_am>\n"
    console.log("Dữ liệu nhận được:", data);
    
    // Tìm và trích xuất Nhiệt độ
    const matchT = data.match(/T([\d\.]+)/);
    if (matchT && matchT[1]) {
        nhietDoSpan.textContent = matchT[1];
    }
    
    // Tìm và trích xuất Độ ẩm
    const matchH = data.match(/H([\d\.]+)/);
    if (matchH && matchH[1]) {
        doAmSpan.textContent = matchH[1];
    }
}

// Hàm gửi lệnh điều khiển tới Arduino
async function sendCommand(event) {
    if (!port || !port.writable) {
        statusMessage.textContent = 'Chưa kết nối Arduino! Vui lòng kết nối. ❌';
        return;
    }
    
    const command = event.currentTarget.getAttribute('data-command');
    // Thêm ký tự xuống dòng ('\n') để Arduino dễ dàng đọc lệnh
    const dataToSend = command + '\n'; 

    try {
        const writer = port.writable.getWriter();
        await writer.write(new TextEncoder().encode(dataToSend));
        writer.releaseLock();
        console.log(`Đã gửi lệnh: ${command}`);
        statusMessage.textContent = `Đã gửi lệnh ${command} ✅`;
    } catch (error) {
        statusMessage.textContent = `Lỗi gửi lệnh: ${error.message} ⚠️`;
    }
}

// Thiết lập sự kiện ban đầu
connectButton.onclick = connect;
