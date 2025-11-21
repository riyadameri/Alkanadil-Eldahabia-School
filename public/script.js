    let currentClassId = null;
    let currentStudentId = null;
    let scheduleCounter = 1;
    const socket = io(window.location.origin); // Connects to current host

    
    // Initialize printer variables
    let port, writer;

    // Connect to the thermal printer
    async function connectToThermalPrinter() {
        try {
            // التحقق من دعم واجهة Web Serial API
            if (!('serial' in navigator)) {
                throw new Error('واجهة الطابعة غير مدعومة في هذا المتصفح');
            }
            
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            writer = port.writable.getWriter();
            
            // اختبار الاتصال بإرسال أمر تهيئة
            const encoder = new TextEncoder();
            await writer.write(encoder.encode('\x1B\x40')); // أمر تهيئة الطابعة
            
            alert("✅ تم التوصيل بالطابعة بنجاح");
            return true;
        } catch (err) {
            console.error("Error connecting to printer:", err);
            
            let errorMessage = "❌ خطأ في الاتصال بالطابعة: ";
            if (err.message.includes('permission')) {
                errorMessage += "يجب منح الإذن للوصول إلى الطابعة";
            } else if (err.message.includes('supported')) {
                errorMessage += "هذه الميزة غير مدعومة في متصفحك. يرجى استخدام Chrome أو Edge";
            } else {
                errorMessage += err.message;
            }
            
            alert(errorMessage);
            return false;
        }
    }


// Enhanced caching with better management
const dataCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function apiCall(url, options = {}, useCache = true) {
    const cacheKey = `${url}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (useCache && dataCache.has(cacheKey)) {
        const cached = dataCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
    }
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        
        // Cache the response
        if (useCache) {
            dataCache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
        }
        
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Clear cache when needed
function clearCache() {
    dataCache.clear();
}

function invalidateCache(patterns = []) {
    if (patterns.length === 0) {
        dataCache.clear();
        return;
    }
    
    for (const key of dataCache.keys()) {
        if (patterns.some(pattern => key.includes(pattern))) {
            dataCache.delete(key);
        }
    }
}

    // Print text to the thermal printer
    async function printTextToPrinter(text) {
        if (!writer) {
            alert("⚠️ يرجى الاتصال بالطابعة أولاً");
            return false;
        }
        
        try {
            const encoder = new TextEncoder();
            await writer.write(encoder.encode(text));
            return true;
        } catch (err) {
            console.error("Error printing text:", err);
            alert("❌ خطأ في الطباعة: " + err.message);
            return false;
        }
    }

    // Draw a payment receipt on canvas
    function drawPaymentReceipt(paymentData) {
        return new Promise((resolve, reject) => {
            try {
                const canvas = document.createElement("canvas");
                
                // Dimensions for 80mm paper (580px width)
                canvas.width = 580;
                
                // Calculate dynamic height based on content
                const baseHeight = 800;
                const additionalHeight = paymentData.additionalInfo ? 100 : 0;
                canvas.height = baseHeight + additionalHeight;
                
                const ctx = canvas.getContext("2d");
                
                // Clear background with white color
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Load images
                const logoImg = new Image();
                const redoxLogo = new Image();
                
                let imagesLoaded = 0;
                const totalImages = 2;
                
                function checkAllImagesLoaded() {
                    imagesLoaded++;
                    if (imagesLoaded === totalImages) {
                        drawReceiptContent();
                    }
                }
                
                logoImg.onload = checkAllImagesLoaded;
                logoImg.onerror = checkAllImagesLoaded;
                
                redoxLogo.onload = checkAllImagesLoaded;
                redoxLogo.onerror = checkAllImagesLoaded;
                
                // Set image sources
                logoImg.src = 'assets/9anadil.jpg';
                redoxLogo.src = 'assets/redox-icon.png';
                
                // If images take too long, start drawing anyway
                setTimeout(() => {
                    if (imagesLoaded < totalImages) {
                        drawReceiptContent();
                    }
                }, 1000);
                
                function drawReceiptContent() {
                    try {
                        // Clear again to ensure white background
                        ctx.fillStyle = "#FFFFFF";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        
                        // Draw school logo (larger size)
                        if (logoImg.complete && logoImg.naturalHeight !== 0) {
                            try {
                                ctx.drawImage(logoImg, canvas.width/2 - 45, 15, 90, 90);
                            } catch (e) {
                                // Fallback if image drawing fails
                                drawFallbackHeader();
                            }
                        } else {
                            drawFallbackHeader();
                        }
                        
                        function drawFallbackHeader() {
                            ctx.fillStyle = "#000000";
                            ctx.textAlign = "center";
                            ctx.font = "bold 28px Arial";
                            ctx.fillText("القناديل سكول", canvas.width/2, 50);
                            ctx.font = "bold 22px Arial";
                            ctx.fillText("للتعليم والمعارف", canvas.width/2, 80);
                        }
                        
                        // Main title
                        ctx.fillStyle = "#000000";
                        ctx.textAlign = "center";
                        ctx.font = "bold 32px Arial";
                        ctx.fillText("إيصال دفع شهري", canvas.width/2, 120);
                        
                        // Decorative line
                        ctx.beginPath();
                        ctx.moveTo(30, 140);
                        ctx.lineTo(canvas.width - 30, 140);
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = "#3498db";
                        ctx.stroke();
                        
                        // Payment details - right aligned
                        ctx.textAlign = "right";
                        ctx.font = "bold 22px Arial";
                        let yPosition = 180;
                        
                        // Student information section
                        ctx.fillStyle = "#2c3e50";
                        ctx.fillText("معلومات الطالب:", canvas.width - 30, yPosition);
                        yPosition += 35;
                        
                        ctx.font = "20px Arial";
                        ctx.fillText(`الاسم: ${paymentData.studentName || 'غير معروف'}`, canvas.width - 30, yPosition);
                        yPosition += 30;
                        ctx.fillText(`رقم الطالب: ${paymentData.studentId || 'غير معروف'}`, canvas.width - 30, yPosition);
                        yPosition += 40;
                        
                        // Payment information section
                        ctx.font = "bold 22px Arial";
                        ctx.fillText("معلومات الدفع:", canvas.width - 30, yPosition);
                        yPosition += 35;
                        
                        ctx.font = "20px Arial";
                        ctx.fillText(`الحصة: ${paymentData.className || 'غير معروف'}`, canvas.width - 30, yPosition);
                        yPosition += 30;
                        ctx.fillText(`الشهر: ${paymentData.month || 'غير محدد'}`, canvas.width - 30, yPosition);
                        yPosition += 30;
                        ctx.fillText(`المبلغ: ${paymentData.amount || 0} د.ج`, canvas.width - 30, yPosition);
                        yPosition += 30;
                        ctx.fillText(`طريقة الدفع: ${getPaymentMethodName(paymentData.paymentMethod)}`, canvas.width - 30, yPosition);
                        yPosition += 30;
                        ctx.fillText(`تاريخ الدفع: ${paymentData.paymentDate || 'غير محدد'}`, canvas.width - 30, yPosition);
                        yPosition += 40;
                        
                        // Additional information if available
                        if (paymentData.additionalInfo) {
                            ctx.font = "bold 22px Arial";
                            ctx.fillText("معلومات إضافية:", canvas.width - 30, yPosition);
                            yPosition += 35;
                            
                            ctx.font = "18px Arial";
                            const lines = paymentData.additionalInfo.split('\n');
                            lines.forEach(line => {
                                ctx.fillText(line, canvas.width - 30, yPosition);
                                yPosition += 25;
                            });
                            yPosition += 20;
                        }
                        
                        // Decorative line
                        ctx.beginPath();
                        ctx.moveTo(30, yPosition);
                        ctx.lineTo(canvas.width - 30, yPosition);
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = "#7f8c8d";
                        ctx.stroke();
                        yPosition += 30;
                        
                        // QR Code section
                        const qrImg = new Image();
                        qrImg.onload = function() {
                            ctx.drawImage(qrImg, canvas.width/2 - 60, yPosition, 120, 120);
                            
                            // Footer with redox logo
                            yPosition += 150;
                            
                            // Thank you message
                            ctx.textAlign = "center";
                            ctx.font = "bold 24px Arial";
                            ctx.fillText("شكراً لثقتكم بنا", canvas.width / 2, yPosition);
                            yPosition += 30;
                            
                            // Contact information
                            ctx.font = "20px Arial";
                            ctx.fillText(paymentData.schoolContact || "الهاتف: 0559581957 | البريد: info@redox.com", canvas.width / 2, yPosition);
                            yPosition += 40;
                            
                            // Redox logo at the bottom
                            if (redoxLogo.complete && redoxLogo.naturalHeight !== 0) {
                                try {
                                    ctx.drawImage(redoxLogo, canvas.width/2 - 40, yPosition, 80, 40);
                                } catch (e) {
                                    // Fallback text
                                    ctx.font = "16px Arial";
                                    ctx.fillText("Redox System", canvas.width / 2, yPosition + 20);
                                }
                            } else {
                                ctx.font = "16px Arial";
                                ctx.fillText("Redox System", canvas.width / 2, yPosition + 20);
                            }
                            
                            // Resolve the promise when drawing is complete
                            resolve(canvas);
                        };
                        
                        qrImg.onerror = function() {
                            // If QR code fails to load, continue without it
                            yPosition += 50;
                            
                            // Thank you message
                            ctx.textAlign = "center";
                            ctx.font = "bold 24px Arial";
                            ctx.fillText("شكراً لثقتكم بنا", canvas.width / 2, yPosition);
                            yPosition += 30;
                            
                            // Contact information
                            ctx.font = "20px Arial";
                            ctx.fillText(paymentData.schoolContact || "الهاتف: 0559581957 | البريد: info@redox.com", canvas.width / 2, yPosition);
                            
                            resolve(canvas);
                        };
                        
                        qrImg.src = 'assets/redox-qr.svg';
                        
                    } catch (error) {
                        reject(error);
                    }
                }
            } catch (error) {
                reject(error);
            }
        });
    }






    // Draw a signature receipt on canvas
    function drawSignatureReceipt(studentData, className, month) {
        const canvas = document.createElement("canvas");
        canvas.width = 580; // Width for 80mm paper
        canvas.height = 400; // Height for signature receipt
        
        const ctx = canvas.getContext("2d");
        
        // Clear background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Set text properties
        ctx.fillStyle = "#000000";
        ctx.textAlign = "right";
        
        // Draw header
        ctx.font = "bold 24px Arial";
        ctx.fillText("إقرار استلام", canvas.width - 20, 40);
        
        ctx.font = "20px Arial";
        ctx.fillText("شهري - توقيع ولي الأمر", canvas.width - 20, 80);
        
        // Draw separator
        ctx.beginPath();
        ctx.moveTo(20, 110);
        ctx.lineTo(canvas.width - 20, 110);
        ctx.stroke();
        
        // Draw details
        ctx.font = "18px Arial";
        let yPosition = 160;
        
        ctx.fillText(`أقر أنا ولي أمر الطالب: ${studentData.name}`, canvas.width - 20, yPosition);
        yPosition += 35;
        
        ctx.fillText(`باستلام المبلغ الشهري لحصة: ${className}`, canvas.width - 20, yPosition);
        yPosition += 35;
        
        ctx.fillText(`لشهر: ${month}`, canvas.width - 20, yPosition);
        yPosition += 60;
        
        // Draw signature line
        ctx.beginPath();
        ctx.moveTo(canvas.width - 200, yPosition);
        ctx.lineTo(canvas.width - 20, yPosition);
        ctx.stroke();
        
        ctx.font = "16px Arial";
        ctx.fillText("التوقيع:", canvas.width - 220, yPosition + 5);
        yPosition += 40;
        
        ctx.fillText("الاسم:", canvas.width - 220, yPosition);
        
        return canvas;
    }

    // Convert canvas to ESC/POS format for thermal printing
    function canvasToEscPos(canvas) {
        // التحقق من أن canvas صالح وله دالة getContext
        if (!canvas || typeof canvas.getContext !== 'function') {
            console.error('Invalid canvas element:', canvas);
            throw new Error('Canvas element is not valid');
        }
        
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const width = canvas.width;
        const height = canvas.height;
        
        // Calculate bytes per line (each byte represents 8 pixels)
        const bytesPerLine = Math.ceil(width / 8);
        
        // Create ESC/POS command array
        let escpos = [];
        
        // Initialize printer
        escpos.push(0x1B, 0x40); // Initialize printer
        
        // Set alignment to center for text
        escpos.push(0x1B, 0x61, 0x01); // Center alignment
        
        // Reset to left alignment for image
        escpos.push(0x1B, 0x61, 0x00); // Left alignment
        
        // GS v 0 command for raster bit image
        escpos.push(0x1D, 0x76, 0x30, 0x00); 
        
        // Add width and height (little endian)
        escpos.push(bytesPerLine & 0xFF, (bytesPerLine >> 8) & 0xFF);
        escpos.push(height & 0xFF, (height >> 8) & 0xFF);
        
        // Convert image data to monochrome bitmap with better threshold
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x += 8) {
                let byte = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const px = (y * width + (x + bit)) * 4;
                    if (x + bit < width) {
                        // Convert to grayscale and check if pixel is dark enough
                        const r = imageData.data[px];
                        const g = imageData.data[px + 1];
                        const b = imageData.data[px + 2];
                        const alpha = imageData.data[px + 3];
                        
                        // Consider alpha channel and use better threshold
                        const gray = (0.299 * r + 0.587 * g + 0.114 * b) * (alpha / 255);
                        
                        // Use higher threshold to ensure text is printed
                        if (gray < 200) { // Changed from 128 to 200 for better visibility
                            byte |= (0x80 >> bit);
                        }
                    }
                }
                escpos.push(byte);
            }
        }
        
        // Add line feeds and cut command
        escpos.push(0x0A, 0x0A, 0x0A); // Line feeds
        escpos.push(0x1D, 0x56, 0x01); // Partial cut
        
        return new Uint8Array(escpos);
    }

    async function printSimplePaymentReceipt(paymentData) {
        if (!writer) {
            const connected = await connectToThermalPrinter();
            if (!connected) return false;
        }
        
        try {
            const encoder = new TextEncoder();
            let receipt = '';
            
            // Initialize printer and set alignment
            receipt += '\x1B\x40'; // Initialize
            receipt += '\x1B\x61\x01'; // Center alignment
            
            // Header
            receipt += "القناديل الدهبية سكول\n";
            receipt += "إيصال دفع شهري\n";
            receipt += "─────────────────────\n";
            
            // Student information
            receipt += '\x1B\x61\x00'; // Left alignment
            receipt += "معلومات الطالب:\n";
            receipt += `الاسم: ${paymentData.studentName}\n`;
            receipt += `رقم الطالب: ${paymentData.studentId}\n`;
            receipt += "─────────────────────\n";
            
            // Payment information
            receipt += "معلومات الدفع:\n";
            receipt += `الحصة: ${paymentData.className}\n`;
            receipt += `الشهر: ${paymentData.month}\n`;
            receipt += `المبلغ: ${paymentData.amount} د.ج\n`;
            receipt += `طريقة الدفع: ${getPaymentMethodName(paymentData.paymentMethod)}\n`;
            receipt += `تاريخ الدفع: ${paymentData.paymentDate}\n`;
            receipt += "─────────────────────\n";
            
            // Footer
            receipt += '\x1B\x61\x01'; // Center alignment
            receipt += "شكراً لثقتكم بنا\n";
            receipt += "الهاتف: 0559581957\n\n\n";
            
            // Cut paper
            receipt += '\x1D\x56\x01';
            
            await writer.write(encoder.encode(receipt));
            return true;
        } catch (err) {
            console.error("Error printing simple receipt:", err);
            return false;
        }
    }

    // Print a payment receipt to the thermal printer
    async function printPaymentReceipt(paymentData) {
        if (!writer) {
            const connected = await connectToThermalPrinter();
            if (!connected) {
                Swal.fire({
                    icon: 'error',
                    title: 'خطأ في الطباعة',
                    text: 'تعذر الاتصال بالطابعة. يرجى التأكد من توصيلها والمحاولة مرة أخرى',
                    confirmButtonText: 'حسناً'
                });
                return false;
            }
        }
        
        try {
            // إظهار رسالة تحميل
            Swal.fire({
                title: 'جاري الطباعة',
                text: 'يرجى الانتظار أثناء تحضير الإيصال',
                icon: 'info',
                showConfirmButton: false,
                allowOutsideClick: false
            });

            // Draw receipt on canvas with enhanced design
            const canvas = await drawPaymentReceipt(paymentData);
            
            // تحويل Canvas إلى تنسيق ESC/POS
            const rasterData = canvasToEscPos(canvas);
            
            // Send to printer
            await writer.write(rasterData);
            
            // إغلاق رسالة التحميل
            Swal.close();
            
            // إظهار رسالة النجاح
            Swal.fire({
                icon: 'success',
                title: 'تمت الطباعة بنجاح',
                text: 'تم طباعة إيصال الدفع بنجاح',
                confirmButtonText: 'حسناً',
                timer: 2000
            });
            
            return true;
        } catch (err) {
            console.error("Error printing receipt:", err);
            
            // إغلاق رسالة التحميل
            Swal.close();
            
            Swal.fire({
                icon: 'error',
                title: 'خطأ في الطباعة',
                text: 'حدث خطأ أثناء الطباعة: ' + err.message,
                confirmButtonText: 'حسناً'
            });
            return false;
        }
    }



    // Print a signature receipt to the thermal printer
    async function printSignatureReceipt(studentData, className, month) {
        if (!writer) {
            const connected = await connectToThermalPrinter();
            if (!connected) return false;
        }
        
        try {
            // Draw signature receipt on canvas
            const canvas = drawSignatureReceipt(studentData, className, month);
            
            // Convert canvas to ESC/POS format
            const rasterData = canvasToEscPos(canvas);
            
            // Send to printer
            await writer.write(rasterData);
            
            return true;
        } catch (err) {
            console.error("Error printing signature receipt:", err);
            alert("❌ خطأ في طباعة إقرار الاستلام: " + err.message);
            return false;
        }
    }

    // Get payment method name in Arabic
    function getPaymentMethodName(method) {
        const methods = {
            'cash': 'نقدي',
            'bank': 'حوالة بنكية',
            'online': 'دفع إلكتروني',
            'card': 'بطاقة ائتمان'
        };
        
        return methods[method] || method;
    }

    async function reprintPaymentReceipt(paymentId) {
        try {
            // عرض رسالة تحميل
            Swal.fire({
                title: 'جاري الطباعة',
                text: 'يرجى الانتظار أثناء تحضير الإيصال',
                icon: 'info',
                showConfirmButton: false,
                allowOutsideClick: false
            });

            // جلب بيانات الدفعة من الخادم
            const response = await fetch(`/api/payments/${paymentId}`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('فشل في جلب بيانات الدفعة');
            }

            const payment = await response.json();

            // التحقق من اتصال الطابعة
            if (!writer) {
                const connected = await connectToThermalPrinter();
                if (!connected) {
                    Swal.fire({
                        icon: 'error',
                        title: 'خطأ في الاتصال',
                        text: 'يرجى التأكد من توصيل الطابعة والمحاولة مرة أخرى',
                        confirmButtonText: 'حسناً'
                    });
                    return false;
                }
            }

            // إعداد بيانات الإيصال
            const paymentData = {
                studentName: payment.student?.name || 'غير معروف',
                studentId: payment.student?.studentId || 'غير معروف',
                className: payment.class?.name || 'غير معروف',
                month: payment.month || 'غير محدد',
                amount: payment.amount || 0,
                paymentMethod: payment.paymentMethod || 'cash',
                paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('ar-EG') : 'غير محدد',
                schoolContact: "الهاتف: 0550123456 | البريد: info@example.com"
            };

            // استخدام الدالة المحسنة لرسم الإيصال
            const canvas = await drawPaymentReceipt(paymentData);
            
            // التحقق من أن canvas صالح قبل التحويل
            if (!canvas || !canvas.getContext) {
                throw new Error('فشل في إنشاء صورة الإيصال');
            }
            
            // تحويل Canvas إلى تنسيق ESC/POS
            const rasterData = canvasToEscPos(canvas);
            
            // إرسال البيانات إلى الطابعة
            await writer.write(rasterData);
            
            // إضافة أمر قطع الورق
            await writer.write(new Uint8Array([0x1D, 0x56, 0x00]));
            
            // إظهار رسالة النجاح
            Swal.fire({
                icon: 'success',
                title: 'تمت الطباعة بنجاح',
                text: 'تمت إعادة طباعة إيصال الدفع بنجاح',
                confirmButtonText: 'حسناً'
            });
            
            return true;
            
        } catch (err) {
            console.error('Error reprinting receipt:', err);
            
            // إظهار رسالة الخطأ
            Swal.fire({
                icon: 'error',
                title: 'خطأ في الطباعة',
                text: 'حدث خطأ أثناء محاولة إعادة طباعة الإيصال: ' + err.message,
                confirmButtonText: 'حسناً'
            });
            
            return false;
        }
    }

    function addReprintButtonToPaymentsTable() {
        const paymentsTable = document.getElementById('paymentsTable');
        if (paymentsTable) {
            paymentsTable.addEventListener('click', function(e) {
                if (e.target.closest('.btn-reprint')) {
                    const paymentId = e.target.closest('.btn-reprint').dataset.paymentId;
                    reprintPaymentReceipt(paymentId);
                }
            });
        }
    }


    function modifyPaymentsTable() {
        const tableBody = document.getElementById('paymentsTable');
        if (tableBody) {
            // تحديث الصفوف لإضافة زر إعادة الطباعة
            const rows = tableBody.querySelectorAll('tr');
            rows.forEach(row => {
                const paymentId = row.dataset.paymentId;
                if (paymentId && !row.querySelector('.btn-reprint')) {
                    const actionCell = row.querySelector('td:last-child');
                    if (actionCell) {
                        const reprintBtn = document.createElement('button');
                        reprintBtn.className = 'btn btn-sm btn-info btn-reprint me-1';
                        reprintBtn.dataset.paymentId = paymentId;
                        reprintBtn.innerHTML = '<i class="bi bi-printer"></i>';
                        reprintBtn.title = 'إعادة طباعة الإيصال';
                        actionCell.prepend(reprintBtn);
                    }
                }
            });
        }
    }


    // Disconnect from the thermal printer
    async function disconnectFromPrinter() {
        if (writer) {
            try {
                await writer.releaseLock();
                await port.close();
                writer = null;
                port = null;
            } catch (err) {
                console.error("Error disconnecting printer:", err);
            }
        }
    }

    // Example usage:
    // const paymentData = {
    //     studentName: "محمد أحمد",
    //     studentId: "STU2023001",
    //     className: "الرياضيات - الثالثة ثانوي",
    //     month: "يناير 2024",
    //     amount: "6000",
    //     paymentMethod: "cash",
    //     paymentDate: "2024-01-15",08
    //     schoolContact: "الهاتف: 0550123456 | البريد: info@example.com"
    // };
    // 
    // printPaymentReceipt(paymentData);
    // 
    // const studentData = {
    //     name: "محمد أحمد",
    //     studentId: "STU2023001"
    // };
    // 
    // printSignatureReceipt(studentData, "الرياضيات - الثالثة ثانوي", "يناير 2024");




    document.getElementById("connect").addEventListener("click", async () => {
        try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });
        writer = port.writable.getWriter();
        alert("✅ تم التوصيل بالطابعة");
        } catch (err) {
        alert("❌ خطأ: " + err);
        }
    });


    document.getElementById("print-text").addEventListener("click", async () => {
        if (!writer) return alert("⚠️ وصل الطابعة أولاً");
        const encoder = new TextEncoder();
        let text = '\x1B\x40'; // init
        text += '\x1B\x61\x01'; // center
        text += "القناديل سكول\n";
        text += "إيصال دفع شهري\n";
        text += "-------------------------\n";
        text += '\x1B\x61\x00'; // left align
        text += "الطالب: محمد أحمد\n";
        text += "المبلغ: 1000 د.ج\n";
        text += "طريقة الدفع: نقدي\n";
        text += "-------------------------\n";
        text += '\x1B\x61\x01'; // center
        text += "شكراً لكم\n\n\n";
        await writer.write(encoder.encode(text));
        await writer.write(new Uint8Array([0x1D, 0x56, 0x00])); // قص
    });

    function drawInvoice() {
        const canvas = document.getElementById("billCanvas");
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.font = "28px Arial";
        ctx.fillText("🛒 متجر البرمجة", canvas.width/2, 50);
        ctx.font = "20px Arial";
        ctx.fillText("فاتورة مبيعات", canvas.width/2, 90);

        ctx.textAlign = "right";
        ctx.font = "18px Arial";
        let y = 140;
        ctx.fillText("الصنف          الكمية   السعر", canvas.width - 20, y);

        const items = [
        {name: "قهوة", qty: 2, price: 10},
        {name: "شاي", qty: 1, price: 5},
        {name: "سكر", qty: 3, price: 9}
        ];
        y += 40; let total = 0;
        items.forEach(it => {
        ctx.fillText(`${it.name}    ${it.qty}   ${it.price}`, canvas.width - 20, y);
        total += it.price; y += 35;
        });

        ctx.fillText("---------------------------------", canvas.width - 20, y+10);
        ctx.fillText("الإجمالي: " + total + " د.ج", canvas.width - 20, y+50);
        ctx.textAlign = "center";
        ctx.font = "16px Arial";
        ctx.fillText("شكرًا لتسوقكم معنا ❤️", canvas.width/2, y+120);
        return canvas;
    }

    // ----------- تحويل Canvas إلى ESC/POS ----------
    function canvasToEscPosGSv0(canvas) {
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const width = canvas.width;
        const height = canvas.height;
        const bytesPerLine = Math.ceil(width / 8);
        let escpos = [];
        escpos.push(0x1D, 0x76, 0x30, 0x00,
                    bytesPerLine & 0xFF, (bytesPerLine >> 8) & 0xFF,
                    height & 0xFF, (height >> 8) & 0xFF);
        for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x += 8) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
            const px = (y * width + (x + bit)) * 4;
            if (x + bit < width) {
                const gray = 0.299 * imageData.data[px] +
                            0.587 * imageData.data[px+1] +
                            0.114 * imageData.data[px+2];
                if (gray < 128) byte |= (0x80 >> bit);
            }
            }
            escpos.push(byte);
        }
        }
        return new Uint8Array(escpos);
    }

    // ----------- طباعة Canvas ----------
    document.getElementById("print-canvas").addEventListener("click", async () => {
        if (!writer) return alert("⚠️ وصل الطابعة أولاً");
        const canvas = drawInvoice();
        const rasterData = canvasToEscPosGSv0(canvas);
        await writer.write(rasterData);
        await writer.write(new Uint8Array([0x1D, 0x56, 0x00])); // قص
        alert("🖨️ تمت الطباعة (Canvas)");
    });



    // Authentication functions
    async function login(username, password) {
        try {
        // التحقق من الحقول الفارغة
        if (!username || !password) {
            Swal.fire('خطأ', 'يرجى إدخال اسم المستخدم وكلمة المرور', 'error');
            return;
        }

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Set current user
            currentUser = data.user;
            
            // Update UI
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('main-app').style.display = 'block';
            document.getElementById('user-name').textContent = currentUser.fullName || currentUser.username;
            document.getElementById('user-role').textContent = getRoleName(currentUser.role);
            
            // Initialize the app
            initApp();
        } else {
            Swal.fire('خطأ', data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة', 'error');
        }
        } catch (err) {
        console.error('Login error:', err);
        Swal.fire('خطأ', 'حدث خطأ أثناء محاولة تسجيل الدخول', 'error');
        }
    }



    async function register(userData) {
    try {
        const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
        Swal.fire('نجاح', 'تم إنشاء الحساب بنجاح', 'success');
        showLoginForm();
        } else {
        Swal.fire('خطأ', data.error || 'حدث خطأ أثناء إنشاء الحساب', 'error');
        }
    } catch (err) {
        console.error('Registration error:', err);
        Swal.fire('خطأ', 'حدث خطأ أثناء محاولة إنشاء الحساب', 'error');
    }
    }

    function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('loginForm').reset();
    }

    function getRoleName(role) {
    const roles = {
        'admin': 'مدير النظام',
        'secretary': 'سكرتير',
        'accountant': 'محاسب',
        'teacher': 'أستاذ'
    };
    return roles[role] || role;
    }

    function showLoginForm() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('register-section').style.display = 'none';
    }

    function showRegisterForm() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('register-section').style.display = 'block';
    }

    function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    }

    // Check authentication on page load
    function checkAuth() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));
        
        if (token && user) {
            currentUser = user;
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('main-app').style.display = 'block';
            document.getElementById('user-name').textContent = currentUser.fullName || currentUser.username;
            document.getElementById('user-role').textContent = getRoleName(currentUser.role);
            
            // إظهار زر البطاقة العائم
            document.getElementById('rfid-scanner-btn').style.display = 'block';
            
            initApp();
        } else {
            document.getElementById('login-section').style.display = 'block';
            document.getElementById('main-app').style.display = 'none';
            
            // إخفاء زر البطاقة العائم
            document.getElementById('rfid-scanner-btn').style.display = 'none';
        }
    }
    // Initialize the application

    // معالجة خاصة للدااشبورد (للقارئ القديم)
    function setupDashboardRFID() {
        const dashboardInput = document.getElementById('cardInput');
        
        if (dashboardInput) {
            let dashboardBuffer = '';
            let dashboardLastKeyTime = Date.now();
            
            // استمع للإدخال المباشر في الدااشبورد
            document.addEventListener('keydown', function(event) {
                // فقط في الدااشبورد
                if (!document.getElementById('dashboard').classList.contains('active')) {
                    return;
                }
                
                const currentTime = Date.now();
                const key = event.key;
                
                // إعادة تعيين المخزن المؤقت إذا مر وقت طويل
                if (currentTime - dashboardLastKeyTime > 100) {
                    dashboardBuffer = '';
                }
                
                dashboardLastKeyTime = currentTime;
                
                // إذا تم الضغط على Enter، معالجة البطاقة
                if (key === 'Enter') {
                    event.preventDefault();
                    
                    if (dashboardBuffer.length > 0) {
                        const normalizedCardId = normalizeCardNumber(dashboardBuffer);
                        dashboardInput.value = normalizedCardId;
                        
                        // معالجة البطاقة (يمكنك استدعاء الدالة المناسبة)
                        fetchStudentData(normalizedCardId);
                        
                        dashboardBuffer = '';
                    }
                } 
                // إذا كان رقم، إضافته للمخزن المؤقت
                else if (key >= '0' && key <= '9') {
                    dashboardBuffer += key;
                    dashboardInput.value = dashboardBuffer;
                }
            });
        }
    }

    // إضافة هذه الدالة لتهيئة نظام ا



    function initApp() {


        initAccountingEventListeners();

        // بدء خدمات الخلفية
    if (currentUser) {
        startAttendanceBackgroundService();
    }
    // Load initial data
    document.getElementById('cardSearchInput').addEventListener('input', searchCards);
    createGateInterface();
    setupRFIDInputHandling();
    initGlobalRFIDScanner();
        
    // تهيئة معالجة البطاقات في قسم إدارة البطاقات
    setupCardsManagementRFID();
    updateDashboardCounters();


    loadStudents();
    loadTeachers();
    loadClasses();
    loadClassrooms();
    loadStudentsForPayments();
    loadClassesForPayments();
    loadMonthsForPayments();
    loadStudentsForCards();
    loadCards();
    loadClassroomsForClassModal();
    loadTeachersForClassModal();


    loadLiveClasses();
    loadDataForLiveClassModal();




    // في دالة initApp() أو في مستمع الأحداث للتنقل
    document.getElementById('gate-interface-link').addEventListener('click', function() {
        initGateInterface();
        });
        document.getElementById('accountStatusFilter').addEventListener('change', loadStudentAccounts);
        document.getElementById('accountSearchInput').addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                loadStudentAccounts();
            }
        });
        
        loadStudentAccounts();
        
        // Search functionality
        document.getElementById('studentSearchInput').addEventListener('input', searchStudents);
        document.getElementById('paymentSearchInput').addEventListener('input', searchPayments);
        
        // Set today's date as default registration date
        document.getElementById('registrationDate').value = new Date().toISOString().split('T')[0];
        
        // Initialize modals
        const modalElements = document.querySelectorAll('.modal');
        modalElements.forEach(modalEl => {
            new bootstrap.Modal(modalEl);
        });
        
        // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(tooltipTriggerEl => {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize live class modal
    const liveClassModal = new bootstrap.Modal(document.getElementById('addLiveClassModal'));
    document.getElementById('live-classes-link').addEventListener('click', function() {
        loadDataForLiveClassModal();
    });

    // Initialize RFID input handling
    setupRFIDInputHandling();



    }
    function initAccountingEventListeners() {
        // Budget form
        const saveBudgetBtn = document.getElementById('saveBudgetBtn');
        if (saveBudgetBtn) {
        saveBudgetBtn.addEventListener('click', addBudget);
        }
        
        // Expense form
        const saveExpenseBtn = document.getElementById('saveExpenseBtn');
        if (saveExpenseBtn) {
        saveExpenseBtn.addEventListener('click', addExpense);
        }
        
        // Refresh accounting data
        const accountingLink = document.getElementById('accounting-link');
        if (accountingLink) {
        accountingLink.addEventListener('click', loadAccountingData);
        }
    }

    // Navigation between sections
    document.querySelectorAll('[data-section]').forEach(link => {
        
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            // Remove active from all links
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', function(e) {
                e.preventDefault();
                const sectionId = this.getAttribute('data-section');
                
                // Remove active class from all links and sections
                document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
                
                // Add active class to clicked link and corresponding section
                this.classList.add('active');
                document.getElementById(sectionId).classList.add('active');
                
                // Load data for the section
                loadSectionData(sectionId);
                });
            });
            
            // Activate current link
            this.classList.add('active');
            
            // Show requested section
            const sectionId = this.getAttribute('data-section');
            document.getElementById(sectionId).classList.add('active');
            
            // Load data when needed
            if (sectionId === 'students') loadStudents();
            else if (sectionId === 'teachers') loadTeachers();
            else if (sectionId === 'classes') loadClasses();
            else if (sectionId === 'classrooms') loadClassrooms();
            else if (sectionId === 'payments') {
                loadStudentsForPayments();
                loadPayments();
            }
            else if (sectionId === 'cards') {
                loadStudentsForCards();
                loadCards();
            }
        });
    });

    // Event listeners
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        login(username, password);
    });

    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        Swal.fire({
        title: 'تم التسجيل بنجاح',
        text: 'تم إنشاء حسابك بنجاح، يمكنك الآن تسجيل الدخول',
        icon: 'success'
        }).then(() => {
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('login-section').style.display = 'block';
        });
    });



    document.getElementById('current-year').textContent = new Date().getFullYear();
            
    // RFID Reader Simulation
    let rfidInputBuffer = '';
    let lastKeyTime = Date.now();



    // Listen for keyboard input to simulate RFID reader
    // Listen for keyboard input to simulate RFID reader
    document.addEventListener('keydown', function(event) {
        // If we're on the login page, don't capture RFID input
        const loginSection = document.getElementById('login-section');
        if (loginSection && loginSection.style.display !== 'none') {
            return;
        }
        
        // If RFID status element doesn't exist yet, don't process
        const rfidStatus = document.getElementById('rfidStatus');
        if (!rfidStatus) {
            return;
        }
        
        const currentTime = Date.now();
        const key = event.key;
        
        // Reset buffer if too much time has passed since last key
        if (currentTime - lastKeyTime > 100) {
            rfidInputBuffer = '';
        }
        
        lastKeyTime = currentTime;
        
        // If Enter is pressed, process the RFID input
        if (key === 'Enter') {
            event.preventDefault();
            
            if (rfidInputBuffer.length > 0) {
                processRFIDInput(rfidInputBuffer);
                rfidInputBuffer = '';
            }
        } 
        // If it's a number, add to buffer
        else if (key >= '0' && key <= '9') {
            rfidInputBuffer += key;
            
            // Update the card input field if we're on the dashboard
            const cardInput = document.getElementById('cardInput');
            if (cardInput) {
                cardInput.value = rfidInputBuffer;
            }
        }
    });
    async function searchStudentByCard(cardUid) {
        try {
            const response = await fetch(`/api/cards/uid/${cardUid}`, {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            if (response.status === 404) {
                // Unknown card
                const rfidResult = document.getElementById('rfid-result');
                rfidResult.innerHTML = `
                    <div class="alert alert-warning text-center">
                        <h4>بطاقة غير معروفة</h4>
                        <p>UID: ${cardUid}</p>
                        <button class="btn btn-primary" onclick="showAssignCardModal('${cardUid}')">
                            تعيين البطاقة لطالب
                        </button>
                    </div>
                `;
                return;
            }
            
            const cardData = await response.json();
            
            if (cardData.student) {
                // Show student info
                const studentResponse = await fetch(`/api/students/${cardData.student._id}`, {
                    headers: getAuthHeaders()
                });
                
                if (studentResponse.status === 401) {
                    logout();
                    return;
                }
                
                const student = await studentResponse.json();
                
                const rfidResult = document.getElementById('rfid-result');
                rfidResult.innerHTML = `
                    <div class="alert alert-success text-center">
                        <h4>تم التعرف على الطالب</h4>
                        <p>${student.name} (${student.studentId})</p>
                        <p>البطاقة: ${cardUid}</p>
                        <div class="mt-3">
                            <button class="btn btn-info me-2" onclick="showStudentDetails('${student._id}')">
                                <i class="bi bi-person-circle me-1"></i>عرض المعلومات
                            </button>
                            <button class="btn btn-success" onclick="handleGateAttendance('${cardUid}')">
                                <i class="bi bi-check-circle me-1"></i>تسجيل الحضور
                            </button>
                        </div>
                    </div>
                `;
                
                // Auto-process attendance if we're in gate mode
                if (document.getElementById('gate-interface').classList.contains('active')) {
                    setTimeout(() => handleGateAttendance(cardUid), 1500);
                }
            }
        } catch (err) {
            console.error('Error processing RFID:', err);
            const rfidResult = document.getElementById('rfid-result');
            rfidResult.innerHTML = `
                <div class="alert alert-danger text-center">
                    <h4>خطأ في المعالجة</h4>
                    <p>حدث خطأ أثناء معالجة البطاقة</p>
                </div>
            `;
        }
    }


    // Function to process RFID input
    // Function to process RFID input
    async function processRFIDInput(rfidCode) {
        
        // Show connection status
        const rfidStatus = document.getElementById('rfidStatus');
        if (rfidStatus) {
            rfidStatus.classList.add('connected');
        }
        
        // Display student information
        await displayStudentInfo(rfidCode);
        
        // Reset connection status after a delay
        setTimeout(() => {
            if (rfidStatus) {
                rfidStatus.classList.remove('connected');
            }
        }, 2000);
    }




    document.getElementById('show-register').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('register-section').style.display = 'block';
    });
    document.getElementById('show-login').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('login-section').style.display = 'block';
    });


    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        Swal.fire({
        title: 'تسجيل الخروج',
        text: 'هل أنت متأكد أنك تريد تسجيل الخروج؟',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'نعم',
        cancelButtonText: 'إلغاء'
        }).then((result) => {
        if (result.isConfirmed) {
            document.getElementById('main-app').style.display = 'none';
            document.getElementById('login-section').style.display = 'block';
        }
        });
    });

    function showStudentModal(student) {
        document.getElementById('modalStudentName').textContent = student.name;
        document.getElementById('modalStudentId').textContent = student.studentId;
        
        document.getElementById('modalParentName').textContent = student.parentName || '-';
        document.getElementById('modalAcademicYear').textContent = getAcademicYearName(student.academicYear) || '-';
        document.getElementById('modalClassesCount').textContent = student.classes?.length || 0;

        // تعيين أحداث الأزرار داخل المودال
        document.getElementById('modalEditBtn').onclick = () => editStudent(student._id);
        document.getElementById('modalDeleteBtn').onclick = () => deleteStudent(student._id);
        // document.getElementById('modalEnrollBtn').onclick = () => showEnrollModal(student._id);
        document.getElementById('modalAttendanceBtn').onclick = () => showAttendanceModal(student._id);
        document.getElementById('modalPrintBtn').onclick = () => printRegistrationReceipt(`${student._id},600`);

        const multiEnrollBtn = document.getElementById('modalMultiEnrollBtn');
        if (multiEnrollBtn) {
            multiEnrollBtn.onclick = () => {
                window.currentStudentId = student._id;
                showMultiEnrollModal(student._id);
            };
        }

        // عرض المودال
        const modal = new bootstrap.Modal(document.getElementById('studentModal'));
        modal.show();

    }

    // Data loading functions (students, teachers, classes, etc.)
    // في قسم loadStudents()، تحديث الصفوف لتشمل زر عرض التفاصيل
    async function loadStudents() {
        try {
            const response = await fetch('/api/students', {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const students = await response.json();
            
            const tableBody = document.getElementById('studentsTable');
            tableBody.innerHTML = '';
            
            students.forEach((student, index) => {
                const row = document.createElement('tr');
                row.dataset.studentId = student._id;

                if (!student.hasPaidRegistration) {
                    row.classList.add('table-warning');
                    row.title = 'لم يدفع حقوق التسجيل';
                } else {
                    row.classList.add('table-success');
                }

                row.style.cursor = 'pointer';
                row.addEventListener('click', () => {
                    showStudentModal(student);
                });
                
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${student.name}</td>
                    <td>${student.studentId}</td>
                    <td>${student.parentName || '-'}</td>
                    <td>${getAcademicYearName(student.academicYear) || '-'}</td>
                    <td>${student.classes?.length || 0}</td>
                    <td>
                        ${!student.hasPaidRegistration ? 
                            '<span class="badge bg-warning">لم يدفع التسجيل</span>' : 
                            '<span class="badge bg-success">مسدد</span>'
                        }
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary btn-action" onclick="showStudentDetails('${student._id}', event)">
                            <i class="bi bi-eye"></i> تفاصيل
                        </button>
                        ${!student.hasPaidRegistration ? 
                            `<button class="btn btn-sm btn-success btn-action ms-1" onclick="payRegistrationFee('${student._id}')">
                                <i class="bi bi-cash"></i> دفع التسجيل
                            </button>` : 
                            ''
                        }
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            document.getElementById('studentsCount').textContent = students.length;
            document.getElementById('stNum').textContent = students.length;
                        updateDashboardCounters();

        } catch (err) {
            console.error('Error loading students:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل بيانات الطلاب', 'error');
        }
    }
    async function payRegistrationFee(studentId) {
        try {
            const { isConfirmed } = await Swal.fire({
                title: 'دفع حقوق التسجيل',
                text: 'هل تريد دفع حقوق التسجيل بقيمة 600 دج؟',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'نعم، دفع',
                cancelButtonText: 'إلغاء'
            });

            if (!isConfirmed) return;

            const response = await fetch(`/api/students/${studentId}/pay-registration`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    amount: 600,
                    paymentDate: new Date().toISOString(),
                    paymentMethod: 'cash'
                })
            });

            if (response.ok) {
                const result = await response.json();
                
                // تسجيل رسوم التسجيل كمعاملة مالية
                await recordRegistrationTransaction(studentId, result.student.name, 600);
                
                // طباعة الإيصال
                await printRegistrationReceipt(result.student, 600, result.receiptNumber);
                
                Swal.fire('نجاح', 'تم دفع حقوق التسجيل بنجاح', 'success');
                
                // تحديث قائمة الطلاب
                await loadStudents();
                
                // تحديث الإحصائيات المالية
                await calculateDailyIncome();
                
                // تحديث صف الطالب في الواجهة
                updateStudentRowInUI(studentId, true);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'فشل في عملية الدفع');
            }
        } catch (err) {
            console.error('Error paying registration fee:', err);
            Swal.fire('خطأ', err.message, 'error');
        }
    }


    // دالة للتحميل المتقطع للبيانات
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}


    


    async function loadStudentsLazy(reset = false) {
        if (reset) {
            studentsPage = 1;
            document.getElementById('studentsTable').innerHTML = '';
        }
        
        try {
            const students = await apiCall(`/api/students?page=${studentsPage}&limit=${studentsPerPage}`);
            
            if (students.length > 0) {
                updateStudentsTable(students, reset);
                studentsPage++;
            }
            
            return students.length === studentsPerPage; // Return true if more data exists
        } catch (err) {
            console.error('Error loading students:', err);
            return false;
        }
    }
    
    // Infinite scroll implementation
    function setupInfiniteScroll() {
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.addEventListener('scroll', debounce(async function() {
                if (this.scrollTop + this.clientHeight >= this.scrollHeight - 100) {
                    const hasMore = await loadStudentsLazy();
                    if (!hasMore) {
                        // Remove scroll listener or show "no more data" message
                    }
                }
            }, 200));
        }
    }

    // تحسين تحميل الطلاب
    const optimizedLoadStudents = debounce(async function() {
        try {
            const response = await fetch('/api/students', {
                headers: getAuthHeaders()
            });
            
            if (response.ok) {
                const students = await response.json();
                updateStudentsTable(students);
            }
        } catch (err) {
            console.error('Error loading students:', err);
        }
    }, 300);

    // تحديث الجدول فقط بدون إعادة تحميل كامل
    function updateStudentsTable(students) {
        const tableBody = document.getElementById('studentsTable');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        students.forEach((student, index) => {
            const row = document.createElement('tr');
            // ... كود إنشاء الصفوف كما هو
            tableBody.appendChild(row);
        });
        
        document.getElementById('studentsCount').textContent = students.length;
        document.getElementById('stNum').textContent = students.length;
    }

    // تنظيف الـ event listeners عند إغلاق المودال
    document.getElementById('addStudentModal').addEventListener('hidden.bs.modal', function() {
        // إعادة تعيين النموذج
        document.getElementById('addStudentForm').reset();
        
        // إعادة حالة الزر
        const saveBtn = document.getElementById('saveStudentBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save me-1"></i>حفظ الطالب';
    });
    function updateStudentRowInUI(studentId, hasPaid) {
        const rows = document.querySelectorAll('#studentsTable tr');
        rows.forEach(row => {
        if (row.dataset.studentId === studentId) {
            if (hasPaid) {
            row.classList.remove('table-warning');
            row.classList.add('table-success');
            
            // تحديث badge
            const badge = row.querySelector('.badge');
            if (badge) {
                badge.className = 'badge bg-success';
                badge.textContent = 'مسدد';
            }
            
            // إزالة زر الدفع
            const payButton = row.querySelector('.btn-success');
            if (payButton) {
                payButton.remove();
            }
            }
        }
        });
    }
    
    async function loadTeachers() {
        try {
            const response = await fetch('/api/teachers', {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const teachers = await response.json();
            
            const tableBody = document.getElementById('teachersTable');
            tableBody.innerHTML = '';
            
            teachers.forEach((teacher, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${teacher.name}</td>
                    <td>${teacher.subjects?.join('، ') || '-'}</td>
                    <td>${teacher.phone || '-'}</td>
                    <td>${new Date(teacher.hireDate).toLocaleDateString('ar-EG')}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary btn-action" onclick="editTeacher('${teacher._id}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-action" onclick="deleteTeacher('${teacher._id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            document.getElementById('teachersCount').textContent = teachers.length;
            document.getElementById('tNum').textContent = teachers.length;
            
        } catch (err) {
            console.error('Error loading teachers:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل بيانات الأساتذة', 'error');
        }
    }
    async function loadClasses() {
        try {
            const response = await fetch('/api/classes', {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const classes = await response.json();
            updateClassesTable(classes);
            
        } catch (err) {
            console.error('Error loading classes:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل بيانات الحصص', 'error');
        }
    }


    async function loadClassrooms() {
        try {
            const response = await fetch('/api/classrooms', {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const classrooms = await response.json();
            
            const tableBody = document.getElementById('classroomsTable');
            tableBody.innerHTML = '';
            
            classrooms.forEach((classroom, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${classroom.name}</td>
                    <td>${classroom.capacity || '-'}</td>
                    <td>${classroom.location || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary btn-action" onclick="editClassroom('${classroom._id}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-action" onclick="deleteClassroom('${classroom._id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (err) {
            console.error('Error loading classrooms:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل بيانات القاعات', 'error');
        }
    }

    // ...existing code...

    window.showStudentDetails = async function(studentId, event = null) {
        if (event) event.stopPropagation();

        try {
            // جلب بيانات الطالب
            const studentResponse = await fetch(`/api/students/${studentId}`, {
                headers: getAuthHeaders()
            });

            if (studentResponse.status === 401) {
                logout();
                return;
            }

            const student = await studentResponse.json();

            // جلب جميع الحصص
            const classesResponse = await fetch('/api/classes', {
                headers: getAuthHeaders()
            });
            const allClasses = await classesResponse.json();

            // جلب جميع المدفوعات للطالب
            const paymentsResponse = await fetch(`/api/payments?student=${studentId}`, {
                headers: getAuthHeaders()
            });
            let payments = [];
            if (paymentsResponse.ok) {
                payments = await paymentsResponse.json();
            }

            // تجميع المدفوعات حسب الحصة
            const paymentsByClass = {};
            payments.forEach(payment => {
                if (!paymentsByClass[payment.class._id]) {
                    paymentsByClass[payment.class._id] = {
                        class: payment.class,
                        payments: []
                    };
                }
                paymentsByClass[payment.class._id].payments.push(payment);
            });

            // إنشاء HTML لعرض الحصص والمدفوعات مع خيارات التحديد
            let classesHtml = '';
            Object.values(paymentsByClass).forEach(({ class: cls, payments }) => {
                classesHtml += `
                    <div class="card mb-3">
                        <div class="card-header bg-light d-flex justify-content-between align-items-center">
                            <strong>${cls.name}</strong> (${cls.subject}) - ${getAcademicYearName(cls.academicYear)}
                            <div>
                                <input type="checkbox" class="form-check-input select-all-class" 
                                    data-class-id="${cls._id}" onchange="toggleSelectAllPayments('${cls._id}', this.checked)">
                                <label class="form-check-label ms-1">تحديد الكل</label>
                            </div>
                        </div>
                        <div class="card-body p-2">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>تحديد</th>
                                        <th>الشهر</th>
                                        <th>المبلغ</th>
                                        <th>الحالة</th>
                                        <th>تاريخ الدفع</th>
                                        <th>إجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${payments.map(payment => `
                                        <tr>
                                            <td>
                                                ${payment.status !== 'paid' ? `
                                                    <input type="checkbox" class="multi-pay-checkbox form-check-input" 
                                                        data-payment='${JSON.stringify(payment)}'
                                                        data-class-id="${cls._id}" 
                                                        onchange="updateSelectAllState('${cls._id}')">
                                                ` : ''}
                                            </td>
                                            <td>${payment.month}</td>
                                            <td>
                                                ${payment.status !== 'paid' ? `
                                                    <span class="editable-amount" data-payment-id="${payment._id}" 
                                                        onclick="editPaymentAmount('${payment._id}', ${payment.amount})">
                                                        ${payment.amount} د.ج
                                                    </span>
                                                ` : `${payment.amount} د.ج`}
                                            </td>
                                            <td>
                                                <span class="badge ${payment.status === 'paid' ? 'bg-success' : 'bg-warning'}">
                                                    ${payment.status === 'paid' ? 'مسدد' : 'قيد الانتظار'}
                                                </span>
                                            </td>
                                            <td>${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('ar-EG') : '-'}</td>
                                            <td>
                                                ${payment.status !== 'paid' ? `
                                                    <button class="btn btn-sm btn-success" onclick="showPaymentModal('${payment._id}')">
                                                        دفع
                                                    </button>
                                                ` : `
                                                    <button class="btn btn-sm btn-info" onclick="reprintPaymentReceipt('${payment._id}')">
                                                        <i class="bi bi-printer"></i>
                                                    </button>
                                                `}
                                                                    ${payment.status === 'paid' ? `

                            <button class="btn btn-sm btn-outline-danger btn-action" onclick="deletePayment('${payment._id}')">
            <i class="bi bi-trash"></i>
        </button>

            <button class="btn btn-sm btn-warning btn-action" onclick="cancelPayment('${payment._id}')" title="إلغاء الدفع">
        <i class="bi bi-x-circle"></i>
    </button>


                        ` : ''}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            });

            // زر دفع وطباعة المحدد
            const multiPayBtn = `
                <div class="mt-3 text-center">
                    <button class="btn btn-primary" onclick="payAndPrintSelectedPayments('${studentId}')">
                        <i class="bi bi-cash-coin me-2"></i> دفع وطباعة المحدد
                    </button>
                </div>
            `;

            // عرض النتائج في modal
            Swal.fire({
                title: `تفاصيل الطالب: ${student.name}`,
                html: `
                    <div>
                        <div class="mb-3">
                            <strong>الاسم:</strong> ${student.name}<br>
                            <strong>رقم الطالب:</strong> ${student.studentId}<br>
                            <strong>ولي الأمر:</strong> ${student.parentName || '-'}<br>
                            <strong>هاتف ولي الأمر:</strong> ${student.parentPhone || '-'}<br>
                            <strong>السنة الدراسية:</strong> ${getAcademicYearName(student.academicYear) || '-'}
                        </div>
                        <h5>الحصص والمدفوعات</h5>
                        ${classesHtml}
                        ${multiPayBtn}
                    </div>
                `,
                width: '900px',
                showConfirmButton: false,
                showCloseButton: true
            });

        } catch (err) {
            console.error('Error loading student details:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل تفاصيل الطالب', 'error');
        }
    }

    // دالة لتعديل مبلغ الدفعة
    window.editPaymentAmount = async function(paymentId, currentAmount) {
        try {
            const { value: newAmount } = await Swal.fire({
                title: 'تعديل مبلغ الدفعة',
                input: 'number',
                inputLabel: 'المبلغ الجديد',
                inputValue: currentAmount,
                inputAttributes: {
                    min: '0',
                    step: '100'
                },
                showCancelButton: true,
                confirmButtonText: 'حفظ التعديل',
                cancelButtonText: 'إلغاء',
                inputValidator: (value) => {
                    if (!value || value <= 0) {
                        return 'يرجى إدخال مبلغ صحيح أكبر من الصفر';
                    }
                }
            });

            if (newAmount) {
                // تحديث المبلغ في الخادم
                const response = await fetch(`/api/payments/${paymentId}/amount`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({ amount: parseFloat(newAmount) })
                });

                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'تم التعديل بنجاح',
                        text: `تم تحديث مبلغ الدفعة إلى ${newAmount} د.ج`,
                        timer: 2000,
                        showConfirmButton: false
                    });
                    
                    // إعادة تحميل تفاصيل الطالب بعد ثانيتين
                    setTimeout(() => {
                        const studentId = document.querySelector('.student-details')?.dataset.studentId;
                        if (studentId) {
                            showStudentDetails(studentId);
                        }
                    }, 2000);
                } else {
                    // معالجة الردود غير الناجحة
                    if (response.status === 404) {
                        throw new Error('نقطة النهاية غير موجودة. يرجى التحقق من الخادم.');
                    } else {
                        const errorText = await response.text();
                        let errorMessage = `فشل في تحديث المبلغ: ${response.status}`;
                        try {
                            const errorJson = JSON.parse(errorText);
                            errorMessage = errorJson.error || errorMessage;
                        } catch (e) {
                            errorMessage = errorText || errorMessage;
                        }
                        throw new Error(errorMessage);
                    }
                }
            }
        } catch (err) {
            console.error('Error editing payment amount:', err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: err.message || 'حدث خطأ أثناء تعديل المبلغ',
                confirmButtonText: 'حسناً'
            });
        }
    };

    // دفع دفعة واحدة

    // دفع وطباعة دفعات متعددة

    // ...existing code...

    function toggleAllPayments(checked) {
        const checkboxes = document.querySelectorAll('.payment-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
    }

    async function printSelectedPayments() {
        const selectedCheckboxes = document.querySelectorAll('.payment-checkbox:checked');
        
        if (selectedCheckboxes.length === 0) {
            Swal.fire('تحذير', 'يرجى تحديد مدفوعات للطباعة', 'warning');
            return;
        }
        
        const payments = Array.from(selectedCheckboxes).map(checkbox => 
            JSON.parse(checkbox.dataset.payment)
        );
        
        try {
            // إظهار نافذة تحميل
            Swal.fire({
                title: 'جاري الطباعة',
                text: 'يرجى الانتظار أثناء تحضير الإيصالات',
                icon: 'info',
                showConfirmButton: false,
                allowOutsideClick: false
            });
            
            // طباعة كل إيصال
            for (const payment of payments) {
                await printPaymentReceiptToThermalPrinter(payment);
                
                // إضافة فاصل بين الإيصالات
                if (writer) {
                    await writer.write(new TextEncoder().encode('\n\n\n\n\n'));
                }
            }
            
            Swal.fire({
                icon: 'success',
                title: 'تمت الطباعة',
                text: `تم طباعة ${payments.length} إيصال بنجاح`,
                confirmButtonText: 'حسناً'
            });
            
        } catch (err) {
            console.error('Error printing payments:', err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: 'حدث خطأ أثناء الطباعة: ' + err.message,
                confirmButtonText: 'حسناً'
            });
        }
    }

    async function printPaymentReceiptToThermalPrinter(payment) {
        if (!writer) {
            const connected = await connectToThermalPrinter();
            if (!connected) return false;
        }
        
        try {
            // إعداد بيانات الإيصال
            const receiptData = {
                studentName: payment.student?.name || 'غير معروف',
                studentId: payment.student?.studentId || 'غير معروف',
                className: payment.class?.name || 'غير معروف',
                month: payment.month || 'غير محدد',
                amount: payment.amount || 0,
                paymentMethod: payment.paymentMethod || 'cash',
                paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('ar-EG') : 'غير محدد',
                schoolContact: "الهاتف: 0559581957 | البريد: info@redox.com"
            };

            // رسم الإيصال على Canvas
            const canvas = drawPaymentReceipt(receiptData);
            
            // تحويل Canvas إلى تنسيق ESC/POS
            const rasterData = canvasToEscPos(canvas);
            
            // إرسال البيانات إلى الطابعة
            await writer.write(rasterData);
            
            return true;
            
        } catch (err) {
            console.error('Error printing receipt:', err);
            throw err;
        }
    }







    async function loadStudentsForPayments() {
        try {
            const response = await fetch('/api/students', {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const students = await response.json();
            
            const select = document.getElementById('paymentStudentSelect');
            select.innerHTML = '<option value="" selected disabled>اختر طالب</option>';
            
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student._id;
                option.textContent = `${student.name} (${student.studentId})`;
                select.appendChild(option);
            });
        } catch (err) {
            console.error('Error loading students for payments:', err);
        }
    }

    async function loadClassesForPayments() {
        try {
            const response = await fetch('/api/classes', {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const classes = await response.json();
            
            const select = document.getElementById('paymentClassSelect');
            select.innerHTML = '<option value="" selected disabled>اختر حصة</option>';
            
            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls._id;
                option.textContent = `${cls.name} (${cls.subject}) - ${getAcademicYearName(cls.academicYear)} - ${cls.price} د.ك`;
                select.appendChild(option);
            });
        } catch (err) {
            console.error('Error loading classes for payments:', err);
        }
    }

    async function loadMonthsForPayments() {
        const select = document.getElementById('paymentMonthSelect');
        select.innerHTML = '<option value="" selected disabled>اختر شهر</option>';
        
        const currentDate = new Date();
        for (let i = 0; i < 12; i++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const monthStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const monthName = date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
            
            const option = document.createElement('option');
            option.value = monthStr;
            option.textContent = monthName;
            select.appendChild(option);
        }
    }


    // دالة إلغاء الدفع
window.cancelPayment = async function(paymentId) {
    try {
        // تأكيد عملية الإلغاء
        const { isConfirmed } = await Swal.fire({
            title: 'إلغاء الدفع',
            text: 'هل أنت متأكد من أنك تريد إلغاء هذه الدفعة؟ سيتم إعادة حالة الدفعة إلى "قيد الانتظار" وإزالة تاريخ الدفع.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'نعم، إلغاء الدفع',
            cancelButtonText: 'تراجع',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6'
        });

        if (!isConfirmed) {
            return;
        }

        // إظهار نافذة التحميل
        Swal.fire({
            title: 'جاري الإلغاء...',
            text: 'يرجى الانتظار أثناء معالجة طلب الإلغاء',
            icon: 'info',
            showConfirmButton: false,
            allowOutsideClick: false
        });

        // إرسال طلب الإلغاء إلى الخادم
        const response = await fetch(`/api/payments/${paymentId}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            }
        });

        if (response.ok) {
            const result = await response.json();
            
            // إغلاق نافذة التحميل
            Swal.close();
            
            // إظهار رسالة النجاح
            Swal.fire({
                icon: 'success',
                title: 'تم الإلغاء بنجاح',
                text: result.message || 'تم إلغاء الدفعة بنجاح',
                confirmButtonText: 'حسناً'
            });

            // تحديث الجداول والبيانات
            await refreshDataAfterCancellation(paymentId);
            
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'فشل في إلغاء الدفعة');
        }

    } catch (err) {
        console.error('Error canceling payment:', err);
        
        // إغلاق نافذة التحميل
        Swal.close();
        
        // إظهار رسالة الخطأ
        Swal.fire({
            icon: 'error',
            title: 'خطأ في الإلغاء',
            text: err.message || 'حدث خطأ أثناء محاولة إلغاء الدفعة',
            confirmButtonText: 'حسناً'
        });
    }
};

// دالة مساعدة لتحديث البيانات بعد الإلغاء
async function refreshDataAfterCancellation(paymentId) {
    try {
        // تحديث جدول المدفوعات الرئيسي
        const currentStudentSelect = document.getElementById('paymentStudentSelect');
        const currentClassSelect = document.getElementById('paymentClassSelect');
        const currentMonthSelect = document.getElementById('paymentMonthSelect');
        
        if (currentStudentSelect && currentClassSelect && currentMonthSelect) {
            await loadPayments(
                currentStudentSelect.value,
                currentClassSelect.value,
                currentMonthSelect.value
            );
        } else {
            await loadPayments();
        }

        // إذا كان modal تفاصيل الطالب مفتوحاً، قم بتحديثه
        const studentDetailsModal = document.querySelector('.swal2-container');
        if (studentDetailsModal && window.currentStudentId) {
            // إعادة تحميل تفاصيل الطالب بعد ثانيتين
            setTimeout(() => {
                if (window.currentStudentId) {
                    showStudentDetails(window.currentStudentId);
                }
            }, 2000);
        }

        // تحديث الإحصائيات المالية
        await calculateDailyIncome();
        
        // تحديث الداشبورد
        updateDashboardCounters();

    } catch (error) {
        console.error('Error refreshing data after cancellation:', error);
    }
}

    // Payment functions
    async function loadPayments(studentId = null, classId = null, month = null) {
        try {
            let url = '/api/payments';
            const params = [];
    
            if (studentId) params.push(`student=${studentId}`);
            if (classId) params.push(`class=${classId}`);
            if (month) params.push(`month=${month}`);
    
            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }
    
            const response = await fetch(url, {
                headers: getAuthHeaders()
            });
    
            if (response.status === 401) {
                logout();
                return;
            }
    
            const payments = await response.json();
    
            const tableBody = document.getElementById('paymentsTable');
            tableBody.innerHTML = '';
    
            payments.forEach((payment, index) => {
                const row = document.createElement('tr');
                row.classList.add(`payment-${payment.status}`);
    
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${payment.student.name} (${payment.student.studentId})</td>
                    <td>${payment.class.name}</td>
                    <td>${payment.month}</td>
                    <td>${payment.amount} د.ك</td>
                    <td>
                        <span class="badge ${payment.status === 'paid' ? 'bg-success' :
                        payment.status === 'pending' ? 'bg-warning' : 'bg-danger'}">
                            ${payment.status === 'paid' ? 'مسدد' :
                            payment.status === 'pending' ? 'قيد الانتظار' : 'متأخر'}
                        </span>
                    </td>
                    <td>${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('ar-EG') : '-'}</td>
                    <td>
                        <button class="btn btn-sm ${payment.status !== 'paid' ? 'btn-success' : 'btn-secondary'} btn-action" 
                            onclick="showPaymentModal('${payment._id}')" 
                            ${payment.status === 'paid' ? 'disabled' : ''}>
                            <i class="bi bi-cash"></i>
                        </button>
                        ${payment.status === 'paid' ? `
                        <button class="btn btn-sm btn-info btn-action" onclick="reprintPaymentReceipt('${payment._id}')">
                            <i class="bi bi-printer"></i>
                        </button>
                        <button class="btn btn-sm btn-warning btn-action" onclick="cancelPayment('${payment._id}')" title="إلغاء الدفع">
                            <i class="bi bi-x-circle"></i>
                        </button>
                        ` : ''}
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (err) {
            console.error('Error loading payments:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل بيانات المدفوعات', 'error');
        }
    }
    // Show payment modal
    window.showPaymentModal = async function (paymentId) {
        try {
            const paymentResponse = await fetch(`/api/payments/${paymentId}`, {
                headers: getAuthHeaders()
            });

            if (paymentResponse.status === 401) {
                logout();
                return;
            }

            const payment = await paymentResponse.json();

            const { value: formValues } = await Swal.fire({
                title: 'تسديد الدفعة',
                html: `
                    <div class="payment-modal-container p-3">
                        <div class="mb-3">
                            <label class="form-label">الطالب:</label>
                            <input type="text" class="form-control" value="${payment.student?.name || 'غير معروف'}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">الحصة:</label>
                            <input type="text" class="form-control" value="${payment.class?.name || 'غير معروف'}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">الشهر:</label>
                            <input type="text" class="form-control" value="${payment.month || 'غير محدد'}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">المبلغ:</label>
                            <input type="text" class="form-control" value="${payment.amount || 0} د.ك" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">تاريخ الدفع:</label>
                            <input type="date" id="payment-date" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">طريقة الدفع:</label>
                            <select id="payment-method" class="form-select" required>
                                <option value="cash">نقدي</option>
                                <option value="bank">حوالة بنكية</option>
                                <option value="online">دفع إلكتروني</option>
                            </select>
                        </div>
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" id="print-receipt" checked>
                            <label class="form-check-label" for="print-receipt">
                                طباعة الإيصال تلقائياً
                            </label>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'تأكيد الدفع',
                cancelButtonText: 'إلغاء',
                preConfirm: () => {
                    return {
                        paymentDate: document.getElementById('payment-date').value,
                        paymentMethod: document.getElementById('payment-method').value,
                        printReceipt: document.getElementById('print-receipt').checked
                    };
                }
            });

            if (formValues) {
                // Set default payment date to today if not provided
                if (!formValues.paymentDate) {
                    formValues.paymentDate = new Date().toISOString().split('T')[0];
                }

                const response = await fetch(`/api/payments/${paymentId}/pay`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        paymentDate: formValues.paymentDate,
                        paymentMethod: formValues.paymentMethod
                    })
                });

                if (response.ok) {
                    const updatedPayment = await response.json();

                    // Print payment receipt automatically if requested
                    if (formValues.printReceipt) {
                        await printPaymentReceiptToThermalPrinter(updatedPayment);
                    }

                    Swal.fire({
                        icon: 'success',
                        title: 'تم التسديد بنجاح',
                        text: formValues.printReceipt ? 'تم تسجيل الدفعة وطباعة الإيصال' : 'تم تسجيل الدفعة بنجاح',
                        confirmButtonText: 'حسناً'
                    });

                    // Refresh the students view
                    if (payment.class?._id) {
                        showClassStudents(payment.class._id);
                    }
                    
                    // Refresh payments table
                    loadPayments();
                } else {
                    throw new Error('فشل في تسجيل الدفعة');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: 'حدث خطأ أثناء محاولة تسجيل الدفعة',
                confirmButtonText: 'حسناً'
            });
        }
    };




    window.showPaymentModal = async function(paymentId) {
        try {
            const paymentResponse = await fetch(`/api/payments/${paymentId}`, {
                headers: getAuthHeaders()
            });

            if (paymentResponse.status === 401) {
                logout();
                return;
            }

            const payment = await paymentResponse.json();

            const { value: formValues } = await Swal.fire({
                title: 'تسديد الدفعة',
                html: `
                    <div class="payment-modal-container p-3">
                        <div class="mb-3">
                            <label class="form-label">الطالب:</label>
                            <input type="text" class="form-control" value="${payment.student?.name || 'غير معروف'}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">الحصة:</label>
                            <input type="text" class="form-control" value="${payment.class?.name || 'غير معروف'}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">الشهر:</label>
                            <input type="text" class="form-control" value="${payment.month || 'غير محدد'}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">المبلغ:</label>
                            <input type="text" class="form-control" value="${payment.amount || 0} د.ك" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">تاريخ الدفع:</label>
                            <input type="date" id="payment-date" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">طريقة الدفع:</label>
                            <select id="payment-method" class="form-select" required>
                                <option value="cash">نقدي</option>
                                <option value="bank">حوالة بنكية</option>
                                <option value="online">دفع إلكتروني</option>
                            </select>
                        </div>
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" id="print-receipt" checked>
                            <label class="form-check-label" for="print-receipt">
                                طباعة الإيصال تلقائياً
                            </label>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'تأكيد الدفع',
                cancelButtonText: 'إلغاء',
                preConfirm: () => {
                    return {
                        paymentDate: document.getElementById('payment-date').value,
                        paymentMethod: document.getElementById('payment-method').value,
                        printReceipt: document.getElementById('print-receipt').checked
                    };
                }
            });

            if (formValues) {
                if (!formValues.paymentDate) {
                    formValues.paymentDate = new Date().toISOString().split('T')[0];
                }

                const response = await fetch(`/api/payments/${paymentId}/pay`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        paymentDate: formValues.paymentDate,
                        paymentMethod: formValues.paymentMethod
                    })
                });

                if (response.ok) {
                    const updatedPayment = await response.json();

                    // استخدام نظام الطباعة الجديد
                    if (formValues.printReceipt) {
                        await printPaymentReceiptToThermalPrinter(updatedPayment);
                    }

                    Swal.fire({
                        icon: 'success',
                        title: 'تم التسديد بنجاح',
                        text: formValues.printReceipt ? 'تم تسجيل الدفعة وطباعة الإيصال' : 'تم تسجيل الدفعة بنجاح',
                        confirmButtonText: 'حسناً'
                    });

                    loadPayments();
                } else {
                    throw new Error('فشل في تسجيل الدفعة');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: 'حدث خطأ أثناء محاولة تسجيل الدفعة',
                confirmButtonText: 'حسناً'
            });
        }
    };







    // دالة مساعدة للحصول على اسم طريقة الدفع بالعربية
    function getPaymentMethodName(method) {
        const methods = {
            'cash': 'نقدي',
            'bank': 'حوالة بنكية',
            'online': 'دفع إلكتروني'
        };
        
        return methods[method] || method;
    }
    // Send content to thermal printer


    // Original print payment receipt function (fallback)

    // When student selection changes in payments section
    document.getElementById('paymentStudentSelect').addEventListener('change', function () {
        loadPayments(this.value,
            document.getElementById('paymentClassSelect').value,
            document.getElementById('paymentMonthSelect').value);
    });

    // When class selection changes in payments section
    document.getElementById('paymentClassSelect').addEventListener('change', function () {
        loadPayments(document.getElementById('paymentStudentSelect').value,
            this.value,
            document.getElementById('paymentMonthSelect').value);
    });

    // When month selection changes in payments section
    document.getElementById('paymentMonthSelect').addEventListener('change', function () {
        loadPayments(document.getElementById('paymentStudentSelect').value,
            document.getElementById('paymentClassSelect').value,
            this.value);
    });



    async function loadStudentsForCards() {
        try {
            const response = await fetch('/api/students', {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const students = await response.json();
            
            const select = document.getElementById('cardStudentSelect');
            select.innerHTML = '<option value="" selected disabled>اختر طالب</option>';
            
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student._id;
                option.textContent = `${student.name} (${student.studentId || 'بدون رقم'})`;
                select.appendChild(option);
            });
        } catch (err) {
            console.error('Error loading students for cards:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل قائمة الطلاب', 'error');
        }
    }
    async function loadCards() {
        try {
            const response = await fetch('/api/cards', {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const cards = await response.json();
            
            const tableBody = document.getElementById('cardsTable');
            tableBody.innerHTML = '';
            
            cards.forEach((card, index) => {
                const row = document.createElement('tr');
                
                // إضافة تحقق لمعالجة الحالات التي يكون فيها student فارغًا
                const studentName = card.student ? card.student.name : 'غير معين';
                const studentId = card.student ? card.student.studentId : 'غير معين';
                
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${card.uid}</td>
                    <td>${studentName} (${studentId})</td>
                    <td>${card.issueDate ? new Date(card.issueDate).toLocaleDateString('ar-EG') : 'غير معروف'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger btn-action" onclick="deleteCard('${card._id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                        ${!card.student ? `
                        <button class="btn btn-sm btn-outline-warning btn-action ms-1" onclick="assignCardToStudent('${card._id}')">
                            <i class="bi bi-link"></i>
                        </button>
                        ` : ''}
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (err) {
            console.error('Error loading cards:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل بيانات البطاقات', 'error');
        }
    }

    // Function to delete a payment
    async function deletePayment(paymentId) {
        try {
        // Confirm deletion
        const result = await Swal.fire({
            title: 'هل أنت متأكد؟',
            text: "سيتم حذف هذه الدفعة بشكل دائم!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'نعم، احذف',
            cancelButtonText: 'إلغاء'
        });
    
        if (result.isConfirmed) {
            const response = await fetch(`/api/payments/${paymentId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
            });
    
            if (response.ok) {
            Swal.fire('تم الحذف!', 'تم حذف الدفعة بنجاح.', 'success');
            // Refresh the payments table or student details
            loadPayments(); // Or reload the current view
            } else {
            const error = await response.json();
            throw new Error(error.error);
            }
        }
        } catch (err) {
        console.error('Error deleting payment:', err);
        Swal.fire('خطأ!', err.message || 'فشل في حذف الدفعة', 'error');
        }
    }

    async function assignCardToStudent(cardId) {
        try {
            // تحميل الطلاب المتاحين
            const studentsResponse = await fetch('/api/students', {
                headers: getAuthHeaders()
            });
            
            if (studentsResponse.status === 401) {
                logout();
                return;
            }
            
            const students = await studentsResponse.json();
            
            const { value: studentId } = await Swal.fire({
                title: 'تعيين البطاقة لطالب',
                input: 'select',
                inputOptions: students.reduce((options, student) => {
                    options[student._id] = `${student.name} (${student.studentId})`;
                    return options;
                }, {}),
                inputPlaceholder: 'اختر الطالب',
                showCancelButton: true,
                confirmButtonText: 'تعيين',
                cancelButtonText: 'إلغاء'
            });
            
            if (studentId) {
                const response = await fetch(`/api/cards/${cardId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({ student: studentId })
                });
                
                if (response.ok) {
                    Swal.fire('نجاح', 'تم تعيين البطاقة للطالب بنجاح', 'success');
                    loadCards();
                } else {
                    throw new Error('فشل في تعيين البطاقة');
                }
            }
        } catch (err) {
            console.error('Error assigning card:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تعيين البطاقة', 'error');
        }
    }


    async function loadClassroomsForClassModal() {
        try {
            const response = await fetch('/api/classrooms', {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const classrooms = await response.json();
            
            const selects = document.querySelectorAll('select[id^="classClassroom"]');
            selects.forEach(select => {
                select.innerHTML = '<option value="" selected disabled>اختر قاعة</option>';
                
                classrooms.forEach(classroom => {
                    const option = document.createElement('option');
                    option.value = classroom._id;
                    option.textContent = `${classroom.name} (${classroom.location || 'غير محدد'})`;
                    select.appendChild(option);
                });
            });
        } catch (err) {
            console.error('Error loading classrooms for class modal:', err);
        }
    }

    async function loadTeachersForClassModal() {
        try {
            const response = await fetch('/api/teachers', {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const teachers = await response.json();
            
            const teacherSelect = document.getElementById('classTeacherSelect');
            teacherSelect.innerHTML = '<option value="" selected disabled>اختر أستاذ</option>';
            
            teachers.forEach(teacher => {
                const option = document.createElement('option');
                option.value = teacher._id;
                option.textContent = `${teacher.name} (${teacher.subjects?.join('، ') || 'بدون تخصص'})`;
                teacherSelect.appendChild(option);
            });
        } catch (err) {
            console.error('Error loading teachers for class modal:', err);
        }
    }

    // Helper functions
    function getAcademicYearName(code) {
        if (!code || code === 'NS' || code === 'غير محدد') return 'غير محدد';
        
        const years = {
            // Secondary (AS)
            '1AS': 'الأولى ثانوي',
            '2AS': 'الثانية ثانوي',
            '3AS': 'الثالثة ثانوي',
            // Middle (MS)
            '1MS': 'الأولى متوسط',
            '2MS': 'الثانية متوسط',
            '3MS': 'الثالثة متوسط',
            '4MS': 'الرابعة متوسط',
            // Primary (AP)
            '1AP': 'الأولى ابتدائي',
            '2AP': 'الثانية ابتدائي',
            '3AP': 'الثالثة ابتدائي',
            '4AP': 'الرابعة ابتدائي',
            '5AP': 'الخامسة ابتدائي',
            // Other possible values
            'اولى ابتدائي': 'الأولى ابتدائي',
            'ثانية ابتدائي': 'الثانية ابتدائي',
            'ثالثة ابتدائي': 'الثالثة ابتدائي',
            'رابعة ابتدائي': 'الرابعة ابتدائي',
            'خامسة ابتدائي': 'الخامسة ابتدائي'
        };
        
        return years[code] || code; // Fallback to original code if not found
    }
    // Form submission handlers
    document.getElementById('saveStudentBtn').addEventListener('click', async () => {
        const saveBtn = document.getElementById('saveStudentBtn');
        const originalText = saveBtn.innerHTML;
        
        try {
            // تعطيل الزر وإظهار حالة التحميل
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>جاري الحفظ...';
            
            const studentData = {
                name: document.getElementById('studentName').value,
                studentId: 'STU-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                birthDate: document.getElementById('birthDate').value,
                parentName: document.getElementById('parentName').value,
                parentPhone: document.getElementById('parentPhone').value,
                academicYear: document.getElementById('academicYear').value,
                registrationDate: document.getElementById('registrationDate').value || new Date(),
                active: 'true',
                status: 'active',
                hasPaidRegistration: false
            };

            // التحقق من الحقول المطلوبة
            if (!studentData.name || !studentData.parentName) {
                throw new Error('الاسم واسم ولي الأمر حقلان مطلوبان');
            }

            const response = await fetch('/api/students', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(studentData),
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'حدث خطأ أثناء إضافة الطالب');
            }

            const newStudent = await response.json();
            
            // إغلاق المودال أولاً
            const studentModal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
            if (studentModal) {
                studentModal.hide();
            }

            // رسالة نجاح سريعة
            await Swal.fire({
                title: 'نجاح',
                text: 'تم إضافة الطالب بنجاح',
                icon: 'success',
                timer: 1000,
                showConfirmButton: false
            });

            // إعادة تعيين النموذج
            document.getElementById('addStudentForm').reset();
            


            // تحديث البيانات الأساسية فقط
            setTimeout(() => {
                loadStudents();
                if (document.getElementById('students').classList.contains('active')) {
                    loadStudentsForPayments();
                    loadStudentsForCards();
                }
            }, 500);

        } catch (err) {
            console.error('Error:', err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: err.message || 'حدث خطأ أثناء الاتصال بالخادم',
                confirmButtonText: 'حسناً'
            });
        } finally {
            // إعادة تمكين الزر بغض النظر عن النتيجة
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    });
    document.getElementById('saveTeacherBtn').addEventListener('click', async () => {
        const teacherData = {
            name: document.getElementById('teacherName').value,
            subjects: Array.from(document.getElementById('teacherSubjects').selectedOptions).map(opt => opt.value),
            phone: document.getElementById('teacherPhone').value,
            email: document.getElementById('teacherEmail').value
        };
        
        try {
            const response = await fetch('/api/teachers', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(teacherData)
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            if (response.ok) {
                Swal.fire('نجاح', 'تم إضافة الأستاذ بنجاح', 'success');
                document.getElementById('addTeacherForm').reset();
                bootstrap.Modal.getInstance(document.getElementById('addTeacherModal')).hide();
                loadTeachers();
            } else {
                const error = await response.json();
                Swal.fire('خطأ', error.error || 'حدث خطأ أثناء إضافة الأستاذ', 'error');
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
        }
    });

    document.getElementById('saveClassroomBtn').addEventListener('click', async () => {
        const classroomData = {
            name: document.getElementById('classroomName').value,
            capacity: document.getElementById('classroomCapacity').value,
            location: document.getElementById('classroomLocation').value
        };
        
        try {
            const response = await fetch('/api/classrooms', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(classroomData)
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            if (response.ok) {
                Swal.fire('نجاح', 'تم إضافة القاعة بنجاح', 'success');
                document.getElementById('addClassroomForm').reset();
                bootstrap.Modal.getInstance(document.getElementById('addClassroomModal')).hide();
                loadClassrooms();
            } else {
                const error = await response.json();
                Swal.fire('خطأ', error.error || 'حدث خطأ أثناء إضافة القاعة', 'error');
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
        }
    });

    document.getElementById('saveClassBtn').addEventListener('click', async () => {
        // Collect schedule data
        const schedules = [];
        const scheduleItems = document.querySelectorAll('.schedule-item');
        
        scheduleItems.forEach(item => {
            const day = item.querySelector('select').value;
            const time = item.querySelector('input[type="time"]').value;
            const classroom = item.querySelectorAll('select')[1].value;
            
            if (day && time && classroom) {
                schedules.push({
                    day,
                    time,
                    classroom
                });
            }
        });
        
        if (schedules.length === 0) {
            Swal.fire('خطأ', 'يجب إضافة جدول حصص واحد على الأقل', 'error');
            return;
        }
        
        const classData = {
            name: document.getElementById('className').value,
            subject: document.getElementById('classSubject').value,
            academicYear: document.getElementById('classAcademicYear').value,
            description: document.getElementById('classDescription').value,
            schedule: schedules,
            price: document.getElementById('classPrice').value,
            teacher: document.getElementById('classTeacherSelect').value
        };
        
        try {
            
            const response = await fetch('/api/classes', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(classData)
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            if (response.ok) {
                Swal.fire('نجاح', 'تم إضافة الحصة بنجاح', 'success');
                document.getElementById('addClassForm').reset();
                bootstrap.Modal.getInstance(document.getElementById('addClassModal')).hide();
                loadClasses();
                loadClassesForPayments();
            } else {
                const error = await response.json();
                Swal.fire('خطأ', error.error || 'حدث خطأ أثناء إضافة الحصة', 'error');
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
        }
    });

    document.getElementById('addScheduleBtn').addEventListener('click', async () => {
        scheduleCounter++;
        const schedulesContainer = document.getElementById('classSchedules');
        
        const scheduleItem = document.createElement('div');
        scheduleItem.className = 'schedule-item';
        scheduleItem.innerHTML = `
            <div class="schedule-item-header">
                <h6>الحصة ${scheduleCounter}</h6>
                <button type="button" class="btn btn-sm btn-danger" onclick="removeSchedule(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
            <div class="row">
                <div class="col-md-4 mb-3">
                    <label for="classDay${scheduleCounter}" class="form-label">اليوم</label>
                    <select class="form-select" id="classDay${scheduleCounter}">
                        <option value="السبت">السبت</option>
                        <option value="الأحد">الأحد</option>
                        <option value="الإثنين">الإثنين</option>
                        <option value="الثلاثاء">الثلاثاء</option>
                        <option value="الأربعاء">الأربعاء</option>
                        <option value="الخميس">الخميس</option>
                        <option value="الجمعة">الجمعة</option>
                    </select>
                </div>
                <div class="col-md-4 mb-3">
                    <label for="classTime${scheduleCounter}" class="form-label">الوقت</label>
                    <input type="time" class="form-control" id="classTime${scheduleCounter}">
                </div>
                <div class="col-md-4 mb-3">
                    <label for="classClassroom${scheduleCounter}" class="form-label">القاعة</label>
                    <select class="form-select" id="classClassroom${scheduleCounter}"></select>
                </div>
            </div>
        `;
        
        schedulesContainer.appendChild(scheduleItem);
        
        // Load classrooms for the new select
        await loadClassroomsForClassModal();
    });

    document.getElementById('assignCardBtn').addEventListener('click', async () => {
        const studentId = document.getElementById('cardStudentSelect').value;
        const cardUid = document.getElementById('cardUid').value;
        
        if (!studentId || !cardUid) {
            Swal.fire('خطأ', 'يجب اختيار طالب ومسح البطاقة', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/cards', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    uid: cardUid,
                    student: studentId
                })
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            if (response.ok) {
                Swal.fire('نجاح', 'تم تعيين البطاقة للطالب بنجاح', 'success');
                document.getElementById('cardUid').value = '';
                loadCards();
            } else {
                const error = await response.json();
                Swal.fire('خطأ', error.error || 'حدث خطأ أثناء تعيين البطاقة', 'error');
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
        }
    });

    document.getElementById('savePaymentBtn').addEventListener('click', async () => {
        if (!currentPayment) return;
        
        const paymentData = {
            amount: document.getElementById('paymentAmount').value,
            paymentDate: document.getElementById('paymentDate').value,
            paymentMethod: document.getElementById('paymentMethod').value,
            status: 'paid'
        };
        
        try {
            const response = await fetch(`/api/payments/${currentPayment._id}/pay`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(paymentData)
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            if (response.ok) {
                const result = await response.json();
                Swal.fire('نجاح', result.message, 'success');
                bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
                loadPayments();
            } else {
                const error = await response.json();
                Swal.fire('خطأ', error.error || 'حدث خطأ أثناء تسجيل الدفعة', 'error');
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
        }
    });

    document.getElementById('enrollStudentBtn').addEventListener('click', async () => {
        const classId = document.getElementById('enrollClassSelect').value;
        const studentId = document.getElementById('enrollStudentSelect').value;
        
        if (!classId || !studentId) {
            Swal.fire('خطأ', 'يجب اختيار حصة وطالب', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/classes/${classId}/enroll/${studentId}`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            if (response.ok) {
                const result = await response.json();
                
                // Show generated payments
                const paymentsHtml = result.payments.map(payment => `
                    <tr class="${payment.status === 'paid' ? 'table-success' : 
                                payment.status === 'pending' ? 'table-warning' : 'table-danger'}">
                        <td>${payment.month}</td>
                        <td>${payment.amount} د.ك</td>
                        <td>
                            <span class="badge ${payment.status === 'paid' ? 'bg-success' : 
                                            payment.status === 'pending' ? 'bg-warning' : 'bg-danger'}">
                                ${payment.status === 'paid' ? 'مسدد' : 
                                payment.status === 'pending' ? 'قيد الانتظار' : 'متأخر'}
                            </span>
                        </td>
                    </tr>
                `).join('');
                
                Swal.fire({
                    title: 'تمت العملية بنجاح',
                    html: `
                        <p>${result.message}</p>
                        <h5 class="mt-3">الدفعات الشهرية:</h5>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>الشهر</th>
                                        <th>المبلغ</th>
                                        <th>الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>${paymentsHtml}</tbody>
                            </table>
                        </div>
                    `,
                    icon: 'success'
                });
                
                bootstrap.Modal.getInstance(document.getElementById('enrollStudentModal')).hide();
                loadClasses();
                loadStudents();
            } else {
                const error = await response.json();
                Swal.fire('خطأ', error.error || 'حدث خطأ أثناء إضافة الطالب للحصة', 'error');
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
        }
    });

    // When student selection changes in payments section
    document.getElementById('paymentStudentSelect').addEventListener('change', function() {
        loadPayments(this.value, 
                    document.getElementById('paymentClassSelect').value,
                    document.getElementById('paymentMonthSelect').value);
    });

    // When class selection changes in payments section
    document.getElementById('paymentClassSelect').addEventListener('change', function() {
        loadPayments(document.getElementById('paymentStudentSelect').value,
                    this.value,
                    document.getElementById('paymentMonthSelect').value);
    });

    // When month selection changes in payments section
    document.getElementById('paymentMonthSelect').addEventListener('change', function() {
        loadPayments(document.getElementById('paymentStudentSelect').value,
                    document.getElementById('paymentClassSelect').value,
                    this.value);
    });

    // Global functions
    window.removeSchedule = function(button) {
        const scheduleItem = button.closest('.schedule-item');
        scheduleItem.remove();
        scheduleCounter--;
        
        // Renumber remaining schedule items
        const remainingItems = document.querySelectorAll('.schedule-item');
        remainingItems.forEach((item, index) => {
            item.querySelector('h6').textContent = `الحصة ${index + 1}`;
        });
    };
    window.showPaymentModal = async function(paymentId) {
        try {
            const paymentResponse = await fetch(`/api/payments/${paymentId}`, {
                headers: getAuthHeaders()
            });

            if (paymentResponse.status === 401) {
                logout();
                return;
            }

            const payment = await paymentResponse.json();

            const { value: formValues } = await Swal.fire({
                title: 'تسديد الدفعة',
                html: `
                    <div class="payment-modal-container p-3">
                        <div class="mb-3">
                            <label class="form-label">الطالب:</label>
                            <input type="text" class="form-control" value="${payment.student?.name || 'غير معروف'}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">الحصة:</label>
                            <input type="text" class="form-control" value="${payment.class?.name || 'غير معروف'}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">الشهر:</label>
                            <input type="text" class="form-control" value="${payment.month || 'غير محدد'}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">المبلغ:</label>
                            <input type="text" class="form-control" value="${payment.amount || 0} د.ك" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">تاريخ الدفع:</label>
                            <input type="date" id="payment-date" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">طريقة الدفع:</label>
                            <select id="payment-method" class="form-select" required>
                                <option value="cash">نقدي</option>
                                <option value="bank">حوالة بنكية</option>
                                <option value="online">دفع إلكتروني</option>
                            </select>
                        </div>
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" id="print-receipt" checked>
                            <label class="form-check-label" for="print-receipt">
                                طباعة الإيصال تلقائياً
                            </label>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'تأكيد الدفع',
                cancelButtonText: 'إلغاء',
                preConfirm: () => {
                    return {
                        paymentDate: document.getElementById('payment-date').value,
                        paymentMethod: document.getElementById('payment-method').value,
                        printReceipt: document.getElementById('print-receipt').checked
                    };
                }
            });

            if (formValues) {
                if (!formValues.paymentDate) {
                    formValues.paymentDate = new Date().toISOString().split('T')[0];
                }

                const response = await fetch(`/api/payments/${paymentId}/pay`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        paymentDate: formValues.paymentDate,
                        paymentMethod: formValues.paymentMethod
                    })
                });

                if (response.ok) {
                    const updatedPayment = await response.json();

                    // استخدام نظام الطباعة الجديد
                    if (formValues.printReceipt) {
                        await printPaymentReceiptToThermalPrinter(updatedPayment);
                    }

                    Swal.fire({
                        icon: 'success',
                        title: 'تم التسديد بنجاح',
                        text: formValues.printReceipt ? 'تم تسجيل الدفعة وطباعة الإيصال' : 'تم تسجيل الدفعة بنجاح',
                        confirmButtonText: 'حسناً'
                    });

                    loadPayments();
                } else {
                    throw new Error('فشل في تسجيل الدفعة');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: 'حدث خطأ أثناء محاولة تسجيل الدفعة',
                confirmButtonText: 'حسناً'
            });
        }
    };
    window.showPaymentModal = async function(paymentId) {
        try {
            const response = await fetch(`/api/payments/${paymentId}`, {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const payment = await response.json();
            
            const { value: formValues } = await Swal.fire({
                title: 'تسديد الدفعة',
                html: `
                    <div class="payment-modal-container">
                        <!-- Your payment form HTML here -->
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'تأكيد الدفع وطباعة الإيصال',
                cancelButtonText: 'إلغاء',
                preConfirm: () => {
                    return {
                        paymentDate: document.getElementById('payment-date').value,
                        paymentMethod: document.getElementById('payment-method').value
                    };
                }
            });
            
            if (formValues) {
                // Set default payment date to today if not provided
                if (!formValues.paymentDate) {
                    formValues.paymentDate = new Date().toISOString().split('T')[0];
                }
                
                const updateResponse = await fetch(`/api/payments/${paymentId}/pay`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify(formValues)
                });
                
                if (updateResponse.ok) {
                    const updatedPayment = await updateResponse.json();
                    
                    // Print payment receipt automatically
                    await printPaymentReceipt(updatedPayment);
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'تم التسديد بنجاح',
                        text: 'تم تسجيل الدفعة وطباعة الإيصال',
                        confirmButtonText: 'حسناً'
                    });
                    
                    // Refresh the students view
                    if (payment.class?._id) {
                        showClassStudents(payment.class._id);
                    }
                } else {
                    throw new Error('فشل في تسجيل الدفعة');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: 'حدث خطأ أثناء محاولة تسجيل الدفعة',
                confirmButtonText: 'حسناً'
            });
        }
    };

    // async function printPaymentReceipt(payment) {
    //     return await printPaymentReceiptToThermalPrinter(payment);
    // }

    // Helper function to convert numbers to Arabic words
    function convertNumberToArabicWords(number) {
        const arabicNumbers = {
            0: 'صفر',
            1: 'واحد',
            2: 'اثنان',
            3: 'ثلاثة',
            4: 'أربعة',
            5: 'خمسة',
            6: 'ستة',
            7: 'سبعة',
            8: 'ثمانية',
            9: 'تسعة',
            10: 'عشرة',
            20: 'عشرون',
            30: 'ثلاثون',
            40: 'أربعون',
            50: 'خمسون',
            60: 'ستون',
            70: 'سبعون',
            80: 'ثمانون',
            90: 'تسعون',
            100: 'مائة',
            200: 'مائتان',
            300: 'ثلاثمائة',
            400: 'أربعمائة',
            500: 'خمسمائة',
            600: 'ستمائة',
            700: 'سبعمائة',
            800: 'ثمانمائة',
            900: 'تسعمائة'
        };
        
        if (number === 600) return 'ستمائة';
        if (arabicNumbers[number]) return arabicNumbers[number];
        
        // Simple implementation for numbers up to 999
        if (number < 100) {
            const units = number % 10;
            const tens = Math.floor(number / 10) * 10;
            if (units === 0) return arabicNumbers[tens];
            return `${arabicNumbers[units]} و ${arabicNumbers[tens]}`;
        }
        
        const hundreds = Math.floor(number / 100) * 100;
        const remainder = number % 100;
        if (remainder === 0) return arabicNumbers[hundreds];
        return `${arabicNumbers[hundreds]} و ${convertNumberToArabicWords(remainder)}`;
    }
    window.showEnrollModal = async function(studentId) {
        try {
            // Load student data
            const studentResponse = await fetch(`/api/students/${studentId}`, {
                headers: getAuthHeaders()
                            });
            
            if (studentResponse.status === 401) {
                logout();
                return;
            }
            
            const student = await studentResponse.json();
            currentStudentId = student._id;
        

            // Load all classes
            const classesResponse = await fetch('/api/classes', {
                headers: getAuthHeaders()
            });
        
            const allClasses = await classesResponse.json();

            // Load classes the student is already enrolled in
            const enrolledClasses = student.classes || [];

            // Filter available classes
            const availableClasses = allClasses.filter(cls => {
                // Check if student is already enrolled
                const isEnrolled = enrolledClasses.some(enrolledClass => 
                enrolledClass._id === cls._id || enrolledClass === cls._id
                );
                
                if (isEnrolled) return false;
        
                // For classes with undefined/NS/غير محدد academic year, allow all students
                if (!cls.academicYear || cls.academicYear === 'NS' || cls.academicYear === 'غير محدد') {
                return true;
                }
        
                // Otherwise, only allow students with matching academic year
                return cls.academicYear === student.academicYear;
            });
        

            // Populate class select dropdown
            const select = document.getElementById('enrollClassSelect');
            select.innerHTML = '<option value="" selected disabled>اختر حصة</option>';
            
            if (availableClasses.length === 0) {
            select.innerHTML = '<option value="" disabled>لا توجد حصص متاحة</option>';
            } else {
            availableClasses.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls._id;
                option.textContent = `${cls.name} (${cls.subject}) - ${getAcademicYearName(cls.academicYear)}`;
                select.appendChild(option);
            });
            }
        
                    
            // Set current student in the select
    // Set current student in the select
    document.getElementById('enrollStudentSelect').innerHTML = `
    <option value="${student._id}" selected>${student.name} (${student.studentId})</option>
    `;

            // Show the modal
            const enrollModal = new bootstrap.Modal(document.getElementById('enrollStudentModal'));
            enrollModal.show();
        

        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل بيانات الحصص', 'error');
        }
    };


    window.showClassStudents = async function(classId, selectedMonth = null, viewMode = 'all') {
        try {
            // Show loading animation
            Swal.fire({
                title: 'جاري التحميل...',
                html: '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>',
                allowOutsideClick: false,
                showConfirmButton: false
            });

            // Ensure classId is a string
            classId = typeof classId === 'object' ? classId._id : classId;
            
            // Fetch class data
            const classResponse = await fetch(`/api/classes/${classId}`, {
                headers: getAuthHeaders()
            });
            
            const classObj = await classResponse.json();
            
            // Fetch students data
            const students = await Promise.all(
                classObj.students.map(studentId => {
                    const id = typeof studentId === 'object' ? studentId._id : studentId;
                    return fetch(`/api/students/${id}`, {
                        headers: getAuthHeaders()
                    }).then(res => res.json())
                })
            );
            
            // Filter out students with status 'rejected'
            const activeStudents = students.filter(student => 
                student.status !== 'rejected' && student.status !== 'pending'
            );

            // Fetch payments data with optional month filter
            let paymentsUrl = `/api/payments?class=${classId}`;
            if (selectedMonth) {
                paymentsUrl += `&month=${selectedMonth}`;
            }
            
            const paymentsResponse = await fetch(paymentsUrl, {
                headers: getAuthHeaders()
            });
            
            const payments = await paymentsResponse.json();

            // Create month selector
            const currentDate = new Date();
            const months = [];
            for (let i = 0; i < 12; i++) {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
                const monthStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                const monthName = date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
                months.push({ value: monthStr, name: monthName });
            }

            // View mode selector
            const viewModeSelectorHtml = `
                <div class="row mb-4">
                    <div class="col-md-4">
                        <label for="monthFilter" class="form-label">تصفية حسب الشهر:</label>
                        <select id="monthFilter" class="form-select" onchange="filterPaymentsByMonth('${classId}', this.value, '${viewMode}')">
                            <option value="">جميع الأشهر</option>
                            ${months.map(month => `
                                <option value="${month.value}" ${selectedMonth === month.value ? 'selected' : ''}>
                                    ${month.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="col-md-4">
                        <label for="viewMode" class="form-label">طريقة العرض:</label>
                        <select id="viewMode" class="form-select" onchange="changeViewMode('${classId}', '${selectedMonth}', this.value)">
                            <option value="all" ${viewMode === 'all' ? 'selected' : ''}>عرض الكل (مع المدفوعات)</option>
                            <option value="studentsOnly" ${viewMode === 'studentsOnly' ? 'selected' : ''}>عرض الطلاب فقط</option>
                            <option value="paymentsOnly" ${viewMode === 'paymentsOnly' ? 'selected' : ''}>عرض المدفوعات فقط</option>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <div class="d-flex align-items-end h-100">
                            <button class="btn btn-outline-primary me-2" onclick="exportPaymentsToExcel('${classId}', '${selectedMonth}')">
                                <i class="bi bi-file-earmark-excel me-1"></i> تصدير للإكسل
                            </button>
                            <button class="btn btn-outline-secondary" onclick="printStudentsList('${classId}')">
                                <i class="bi bi-printer me-1"></i> طباعة القائمة
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Render based on view mode
            let contentHtml = '';
            
            if (viewMode === 'studentsOnly') {
                // عرض الطلاب فقط
                contentHtml = `
                    <div class="students-only-view">
                        <div class="card">
                            <div class="card-header bg-primary text-white">
                                <h5 class="mb-0">قائمة الطلاب - ${classObj.name}</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-striped">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>رقم الطالب</th>
                                                <th>اسم الطالب</th>
                                                <th>ولي الأمر</th>
                                                <th>هاتف ولي الأمر</th>
                                                <th>الصف الدراسي</th>
                                                
                                                <th>الإجراءات</th>
                                                
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${activeStudents.map((student, index) => `
                                                <tr>
                                                    <td>${index + 1}</td>
                                                    <td>${student.studentId || 'غير محدد'}</td>
                                                    <td>${student.name}</td>
                                                    <td>${student.parentName || 'غير مسجل'}</td>
                                                    <td>${student.parentPhone || 'غير مسجل'}</td>
                                                    <td>${getAcademicYearName(student.academicYear) || 'غير محدد'}</td>
                                                    <td>
                                                        <button class="btn btn-sm btn-info me-1" onclick="showStudentDetails('${student._id}')">
                                                            <i class="bi bi-eye"></i>
                                                        </button>
                                                        <button class="btn btn-sm btn-danger" onclick="unenrollStudent('${classId}', '${student._id}')">
                                                            <i class="bi bi-trash"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                
                                <div class="mt-3 text-center">
                                    <p class="text-muted">إجمالي عدد الطلاب: <strong>${activeStudents.length}</strong></p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else if (viewMode === 'paymentsOnly') {
                // عرض المدفوعات فقط
                const paidPayments = payments.filter(p => p.status === 'paid');
                const pendingPayments = payments.filter(p => p.status === 'pending');
                
                contentHtml = `
                    <div class="payments-only-view">
                        <div class="card">
                            <div class="card-header bg-info text-white">
                                <h5 class="mb-0">إدارة المدفوعات - ${classObj.name}</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-striped">
                                        <thead>
                                            <tr>
                                                <th>اسم الطالب</th>
                                                <th>رقم الطالب</th>
                                                <th>الشهر</th>
                                                <th>المبلغ</th>
                                                <th>الحالة</th>
                                                <th>تاريخ الدفع</th>
                                                <th>الإجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${payments.map(payment => `
                                                <tr>
                                                    <td>${payment.student?.name || 'غير معروف'}</td>
                                                    <td>${payment.student?.studentId || 'غير معروف'}</td>
                                                    <td>${payment.month}</td>
                                                    <td>${payment.amount} د.ك</td>
                                                    <td>
                                                        <span class="badge ${payment.status === 'paid' ? 'bg-success' : 
                                                                        payment.status === 'pending' ? 'bg-warning' : 'bg-danger'}">
                                                            ${payment.status === 'paid' ? 'مسدد' : 
                                                            payment.status === 'pending' ? 'قيد الانتظار' : 'متأخر'}
                                                        </span>
                                                    </td>
                                                    <td>${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('ar-EG') : '-'}</td>
                                                    <td>
                                                        <button class="btn btn-sm ${payment.status !== 'paid' ? 'btn-success' : 'btn-secondary'}" 
                                                            onclick="showPaymentModal('${payment._id}')" 
                                                            ${payment.status === 'paid' ? 'disabled' : ''}>
                                                            <i class="bi ${payment.status !== 'paid' ? 'bi-cash' : 'bi-check2'}"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                
                                <div class="row mt-4">
                                    <div class="col-md-4 text-center">
                                        <div class="card bg-success text-white">
                                            <div class="card-body">
                                                <h6>المسدد</h6>
                                                <h4>${paidPayments.reduce((sum, p) => sum + p.amount, 0)} د.ك</h4>
                                                <small>${paidPayments.length} عملية</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-4 text-center">
                                        <div class="card bg-warning text-dark">
                                            <div class="card-body">
                                                <h6>المعلق</h6>
                                                <h4>${pendingPayments.reduce((sum, p) => sum + p.amount, 0)} د.ك</h4>
                                                <small>${pendingPayments.length} عملية</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-4 text-center">
                                        <div class="card bg-primary text-white">
                                            <div class="card-body">
                                                <h6>الإجمالي</h6>
                                                <h4>${payments.reduce((sum, p) => sum + p.amount, 0)} د.ك</h4>
                                                <small>${payments.length} عملية</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // العرض الافتراضي (الكل)
                contentHtml = `
                    ${activeStudents.length > 0 ? activeStudents.map((student, index) => {
                        const studentPayments = payments.filter(p => p.student && p.student._id === student._id);
                        const totalPaid = studentPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
                        const totalPending = studentPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
                        
                        return `
                        <div class="student-item card mb-4 shadow-sm" style="animation-delay: ${index * 0.1}s">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">${student.name} <small class="text-muted">(${student.studentId})</small></h5>
                                <div>
                                    <span class="badge ${totalPending === 0 ? 'bg-success' : 'bg-warning'} me-2">
                                        ${totalPending === 0 ? 'مسدد بالكامل' : `متأخر: ${totalPending} د.ك`}
                                    </span>
                                    <button class="btn btn-sm btn-info me-2" onclick="printRegistrationReceipt(${JSON.stringify(student)}, 600)">
                                        <i class="bi bi-printer me-1"></i> طباعة
                                    </button>
                                    <button class="btn btn-sm btn-danger" onclick="unenrollStudent('${classId}', '${student._id}')">
                                        <i class="bi bi-trash me-1"></i> إزالة
                                    </button>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="student-info mb-3">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <p><strong>ولي الأمر:</strong> ${student.parentName || 'غير مسجل'}</p>
                                            <p><strong>هاتف ولي الأمر:</strong> ${student.parentPhone || 'غير مسجل'}</p>
                                        </div>
                                        <div class="col-md-6">
                                            <p><strong>الصف الدراسي:</strong> ${getAcademicYearName(student.academicYear) || 'غير محدد'}</p>
                                            <p><strong>تاريخ التسجيل:</strong> ${new Date(student.registrationDate).toLocaleDateString('ar-EG')}</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <h6 class="text-muted mb-3">حالة المدفوعات:</h6>
                                
                                ${studentPayments.length > 0 ? `
                                    <div class="table-responsive">
                                        <table class="table table-sm">
                                            <thead class="table-dark">
                                                <tr>
                                                    <th>الشهر</th>
                                                    <th>المبلغ</th>
                                                    <th>الحالة</th>
                                                    <th>تاريخ الدفع</th>
                                                    <th>إجراء</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${studentPayments.map(payment => `
                                                    <tr>
                                                        <td>${payment.month}</td>
                                                        <td>${payment.amount} د.ك</td>
                                                        <td>
                                                            <span class="badge ${payment.status === 'paid' ? 'bg-success' : 
                                                                            payment.status === 'pending' ? 'bg-warning' : 'bg-danger'}">
                                                                ${payment.status === 'paid' ? 'مسدد' : 
                                                                payment.status === 'pending' ? 'قيد الانتظار' : 'متأخر'}
                                                            </span>
                                                        </td>
                                                        <td>${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('ar-EG') : '-'}</td>
                                                        <td>
                                                            <button class="btn btn-sm ${payment.status !== 'paid' ? 'btn-success' : 'btn-secondary'}" 
                                                                onclick="showPaymentModal('${payment._id}')" 
                                                                ${payment.status === 'paid' ? 'disabled' : ''}>
                                                                <i class="bi ${payment.status !== 'paid' ? 'bi-cash' : 'bi-check2'}"></i>
                                                            </button>

                                                                        ${payment.status === 'paid' ? `
                        <button class="btn btn-sm btn-info btn-action" onclick="reprintPaymentReceipt('${payment._id}')">
                            <i class="bi bi-printer"></i>
                        </button>
                            <button class="btn btn-sm btn-outline-danger btn-action" onclick="deletePayment('${payment._id}')">
            <i class="bi bi-trash"></i>
        </button>

            <button class="btn btn-sm btn-warning btn-action" onclick="cancelPayment('${payment._id}')" title="إلغاء الدفع">
        <i class="bi bi-x-circle"></i>
    </button>


                        ` : ''}
        


                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : `
                                    <div class="alert alert-info text-center">
                                        <i class="bi bi-info-circle me-2"></i>
                                        لا توجد مدفوعات مسجلة لهذا الطالب
                                    </div>
                                `}
                            </div>
                        </div>
                        `;
                    }).join('') : `
                    <div class="alert alert-warning text-center">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        لا يوجد طلاب مسجلين في هذه الحصة
                    </div>
                    `}

                    ${activeStudents.length > 0 ? `
                        <div class="card mt-4">
                            <div class="card-header bg-info text-white">
                                <h5 class="mb-0">ملخص المدفوعات</h5>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-md-3 text-center">
                                        <h6>عدد الطلاب</h6>
                                        <h3 class="text-primary">${activeStudents.length}</h3>
                                    </div>
                                    <div class="col-md-3 text-center">
                                        <h6>المسدد</h6>
                                        <h3 class="text-success">${payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)} د.ك</h3>
                                    </div>
                                    <div class="col-md-3 text-center">
                                        <h6>المعلق</h6>
                                        <h3 class="text-warning">${payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0)} د.ك</h3>
                                    </div>
                                    <div class="col-md-3 text-center">
                                        <h6>الإجمالي</h6>
                                        <h3 class="text-dark">${payments.reduce((sum, p) => sum + p.amount, 0)} د.ك</h3>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                `;
            }

            // Create HTML template
            const studentsHtml = `
            <div class="student-management-container">
                <div class="class-header bg-primary text-white p-4 rounded mb-4">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h3 class="mb-1">${classObj.name}</h3>
                            <p class="mb-0">${classObj.subject} - ${getAcademicYearName(classObj.academicYear)}</p>
                            ${selectedMonth ? `<p class="mb-0">شهر: ${months.find(m => m.value === selectedMonth)?.name || selectedMonth}</p>` : ''}
                            ${viewMode === 'studentsOnly' ? `<p class="mb-0"><i class="bi bi-people"></i> عرض الطلاب فقط</p>` : ''}
                            ${viewMode === 'paymentsOnly' ? `<p class="mb-0"><i class="bi bi-cash"></i> عرض المدفوعات فقط</p>` : ''}
                        </div>
                        <button class="btn btn-success" onclick="showEnrollStudentModal('${classId}')">
                            <i class="bi bi-plus-lg me-1"></i> تسجيل طالب جديد
                        </button>
                    </div>
                </div>
                
                ${viewModeSelectorHtml}
                
                ${contentHtml}
            </div>
            `;
            
            // Show the modal with all student data
            Swal.fire({
                title: `إدارة طلاب الحصة`,
                html: studentsHtml,
                width: '1200px',
                showConfirmButton: false,
                showCloseButton: true,
                customClass: {
                    popup: 'animate__animated animate__fadeInUp'
                }
            });

        } catch (err) {
            console.error('Error:', err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: 'حدث خطأ أثناء جلب بيانات الطلاب',
                confirmButtonText: 'حسناً'
            });
        }
    };

    // دالة لتغيير طريقة العرض
    window.changeViewMode = function(classId, month, viewMode) {
        showClassStudents(classId, month || null, viewMode);
    };

    // دالة لتصفية المدفوعات حسب الشهر
    window.filterPaymentsByMonth = function(classId, month, viewMode) {
        showClassStudents(classId, month || null, viewMode || 'all');
    };

    // دالة لطباعة قائمة الطلاب
    // دالة لطباعة قائمة الطلاب أو المدفوعات
    window.printStudentsList = async function(classId, selectedMonth = null, viewMode = 'studentsOnly') {
        try {
            // جلب بيانات الحصة والطلاب
            const classResponse = await fetch(`/api/classes/${classId}`, {
                headers: getAuthHeaders()
            });
            
            if (!classResponse.ok) {
                throw new Error('فشل في تحميل بيانات الحصة');
            }

            const classObj = await classResponse.json();
            
            // جلب بيانات الطلاب
            const students = await Promise.all(
                classObj.students.map(studentId => {
                    const id = typeof studentId === 'object' ? studentId._id : studentId;
                    return fetch(`/api/students/${id}`, {
                        headers: getAuthHeaders()
                    }).then(res => res.json());
                })
            );

            const activeStudents = students.filter(s => s.status !== 'rejected' && s.status !== 'pending');

            // إنشاء نافذة الطباعة
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                Swal.fire('خطأ', 'فشل في فتح نافذة الطباعة. الرجاء السماح بالنوافذ المنبثقة.', 'error');
                return;
            }

            // SVG للكود QR (يمكن استبداله برابط الصورة الفعلي)
            const qrCodeSvg = `
                <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
                    <rect width="80" height="80" fill="#f8f9fa"/>
                    <path d="M20 20h10v10H20z M50 20h10v10H50z M20 50h10v10H20z M35 35h10v10H35z" fill="#000"/>
                    <text x="40" y="75" text-anchor="middle" font-size="8" fill="#666">كود الفصل</text>
                </svg>
            `;

            // إنشاء محتوى HTML للطباعة
            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>قائمة الطلاب - ${classObj.name}</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap" rel="stylesheet">
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        
                        body {
                            font-family: 'Cairo', 'Arial', sans-serif;
                            background: #ffffff;
                            color: #333;
                            line-height: 1.6;
                            padding: 20px;
                        }
                        
                        .container {
                            max-width: 1000px;
                            margin: 0 auto;
                            background: #fff;
                        }
                        
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            border-bottom: 3px solid #2c5aa0;
                            padding-bottom: 20px;
                            margin-bottom: 30px;
                        }
                        
                        .school-info {
                            flex: 1;
                        }
                        
                        .school-name {
                            font-size: 28px;
                            font-weight: 700;
                            color: #2c5aa0;
                            margin-bottom: 5px;
                        }
                        
                        .school-subtitle {
                            font-size: 18px;
                            color: #666;
                            margin-bottom: 10px;
                        }
                        
                        .document-title {
                            font-size: 24px;
                            font-weight: 600;
                            color: #333;
                            background: #f8f9fa;
                            padding: 10px 20px;
                            border-radius: 5px;
                            text-align: center;
                            margin: 15px 0;
                        }
                        
                        .logo-container {
                            width: 120px;
                            height: 120px;
                            border: 2px solid #2c5aa0;
                            border-radius: 10px;
                            padding: 5px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        
                        .school-logo {
                            max-width: 100%;
                            max-height: 100%;
                            object-fit: contain;
                        }
                        
                        .class-info {
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            padding: 20px;
                            border-radius: 10px;
                            margin-bottom: 25px;
                            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                        }
                        
                        .class-info-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                            gap: 15px;
                        }
                        
                        .info-item {
                            display: flex;
                            flex-direction: column;
                        }
                        
                        .info-label {
                            font-size: 12px;
                            opacity: 0.9;
                            margin-bottom: 5px;
                        }
                        
                        .info-value {
                            font-size: 16px;
                            font-weight: 600;
                        }
                        
                        .students-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 25px 0;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        }
                        
                        .students-table th {
                            background: linear-gradient(135deg, #2c5aa0 0%, #1e3a8a 100%);
                            color: white;
                            padding: 15px;
                            text-align: center;
                            font-weight: 600;
                            font-size: 14px;
                        }
                        
                        .students-table td {
                            padding: 12px 15px;
                            border-bottom: 1px solid #e0e0e0;
                            text-align: center;
                        }
                        
                        .students-table tr:nth-child(even) {
                            background-color: #f8f9fa;
                        }
                        
                        .students-table tr:hover {
                            background-color: #e3f2fd;
                        }
                        
                        .student-name {
                            font-weight: 600;
                            color: #2c5aa0;
                        }
                        
                        .student-id {
                            font-family: 'Courier New', monospace;
                            background: #f1f3f4;
                            padding: 2px 6px;
                            border-radius: 3px;
                            font-size: 12px;
                        }
                        
                        .academic-year {
                            background: #e8f5e8;
                            color: #2e7d32;
                            padding: 4px 8px;
                            border-radius: 15px;
                            font-size: 12px;
                            font-weight: 600;
                        }
                        
                        .footer {
                            margin-top: 40px;
                            padding: 20px;
                            border-top: 2px solid #e0e0e0;
                            text-align: center;
                            color: #666;
                        }
                        
                        .footer-info {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-top: 15px;
                        }
                        
                        .qr-code {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 5px;
                        }
                        
                        .qr-text {
                            font-size: 10px;
                            color: #999;
                        }
                        
                        .print-date {
                            font-size: 12px;
                            color: #999;
                        }
                        
                        .summary {
                            background: #f8f9fa;
                            padding: 15px;
                            border-radius: 8px;
                            margin: 20px 0;
                            border-left: 4px solid #2c5aa0;
                        }
                        
                        .summary-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                            gap: 15px;
                            text-align: center;
                        }
                        
                        .summary-item {
                            padding: 10px;
                        }
                        
                        .summary-value {
                            font-size: 24px;
                            font-weight: 700;
                            color: #2c5aa0;
                        }
                        
                        .summary-label {
                            font-size: 12px;
                            color: #666;
                            margin-top: 5px;
                        }
                        
                        @media print {
                            body {
                                padding: 15px;
                            }
                            
                            .container {
                                max-width: none;
                            }
                            
                            .students-table {
                                box-shadow: none;
                            }
                            
                            .class-info {
                                box-shadow: none;
                            }
                        }
                        
                        .watermark {
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%) rotate(-45deg);
                            font-size: 120px;
                            color: rgba(0,0,0,0.03);
                            font-weight: 700;
                            z-index: -1;
                            pointer-events: none;
                        }
                    </style>
                </head>
                <body>
                    <div class="watermark">${classObj.school?.name || 'القناديل سكول'}</div>
                    
                    <div class="container">
                        <div class="header">
                            <div class="school-info">
                                <div class="school-name">${classObj.school?.name || 'القناديل الدهبية سكول'}</div>
                                <div class="school-subtitle">مؤسسة تعليمية متخصصة في تقديم أفضل البرامج التعليمية</div>
                                <div class="document-title">القائمة الاسمية للطلاب</div>
                            </div>
                            
                            <div class="logo-container">
                                <img src="assets/9anadil.jpg" alt="شعار المدرسة" class="school-logo" 
                                    onerror="this.style.display='none'; this.parentNode.innerHTML='<div style=\\'text-align:center; padding:20px;\\'><strong>شعار المدرسة</strong></div>';">
                            </div>
                        </div>
                        
                        <div class="class-info">
                            <div class="class-info-grid">
                                <div class="info-item">
                                    <span class="info-label">اسم الحصة</span>
                                    <span class="info-value">${classObj.name}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">المادة الدراسية</span>
                                    <span class="info-value">${classObj.subject || 'غير محدد'}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">السنة الدراسية</span>
                                    <span class="info-value">${getAcademicYearName(classObj.academicYear) || 'غير محدد'}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">الأستاذ</span>
                                    <span class="info-value">${classObj.teacher?.name || 'غير محدد'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="summary">
                            <div class="summary-grid">
                                <div class="summary-item">
                                    <div class="summary-value">${activeStudents.length}</div>
                                    <div class="summary-label">إجمالي عدد الطلاب</div>
                                </div>
                                <div class="summary-item">
                                    <div class="summary-value">${classObj.price || 0} د.ج</div>
                                    <div class="summary-label">رسوم الحصة الشهرية</div>
                                </div>
                                <div class="summary-item">
                                    <div class="summary-value">${selectedMonth || 'جميع الأشهر'}</div>
                                    <div class="summary-label">الفترة</div>
                                </div>
                            </div>
                        </div>
                        
                        <table class="students-table">
                            <thead>
                                <tr>
                                    <th width="5%">م</th>
                                    <th width="15%">رقم الطالب</th>
                                    <th width="25%">اسم الطالب</th>
                                    <th width="15%">ولي الأمر</th>
                                    <th width="10%">الصف</th>
                                    <th width="15%">هاتف ولي الأمر</th>
                                    <th width="15%">ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${activeStudents.map((student, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>
                                            <span class="student-id">${student.studentId || 'غير محدد'}</span>
                                        </td>
                                        <td>
                                            <span class="student-name">${student.name}</span>
                                        </td>
                                        <td>${student.parentName || 'غير مسجل'}</td>
                                        <td>
                                            <span class="academic-year">${getAcademicYearName(student.academicYear) || 'غير محدد'}</span>
                                        </td>
                                        <td>${student.parentPhone || 'غير مسجل'}</td>
                                        <td>
                                            ${student.hasPaidRegistration ? 
                                                '<span style="color: #28a745;">✓ مسدد</span>' : 
                                                '<span style="color: #dc3545;">✗ غير مسدد</span>'
                                            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <div class="footer">
                            <div class="footer-info">
                                <div class="qr-code">
                                    ${qrCodeSvg}
                                    <div class="qr-text">كود الفصل: ${classObj._id.slice(-8).toUpperCase()}</div>
                                </div>
                                
                                <div style="text-align: center;">
                                    <div style="margin-bottom: 10px;">
                                        <strong>إدارة القناديل سكول</strong>
                                    </div>
                                    <div style="font-size: 12px; color: #666;">
                                        الهاتف: 0559581957 | البريد: info@redox.com
                                    </div>
                                </div>
                                
                                <div class="print-date">
                                    تم الطباعة في: ${new Date().toLocaleString('ar-EG', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <script>
                        // طباعة تلقائية بعد تحميل الصفحة
                        window.onload = function() {
                            setTimeout(() => {
                                window.print();
                            }, 500);
                        };
                        
                        // إغلاق النافذة بعد الطباعة
                        window.onafterprint = function() {
                            setTimeout(() => {
                                window.close();
                            }, 1000);
                        };
                    </script>
                </body>
                </html>
            `);

            printWindow.document.close();

        } catch (err) {
            console.error('Error printing students list:', err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ في الطباعة',
                text: err.message || 'حدث خطأ أثناء تحضير قائمة الطلاب للطباعة',
                confirmButtonText: 'حسناً'
            });
        }
    };


    // Helper function to show payment modal
    window.showPaymentModal = async function(paymentId) {
    try {
    const paymentResponse = await fetch(`/api/payments/${paymentId}`, {
        headers: getAuthHeaders()
    });

    if (paymentResponse.status === 401) {
        logout();
        return;
    }

    const payment = await paymentResponse.json();

    const { value: formValues } = await Swal.fire({
        title: 'تسديد الدفعة',
        html: `
    <div class="payment-modal-container p-3">
    <div class="mb-3">
    <label class="form-label">الطالب:</label>
    <input type="text" class="form-control" value="${payment.student.name}" readonly>
    </div>
    <div class="mb-3">
    <label class="form-label">الحصة:</label>
    <input type="text" class="form-control" value="${payment.class.name}" readonly>
    </div>
    <div class="mb-3">
    <label class="form-label">الشهر:</label>
    <input type="text" class="form-control" value="${payment.month}" readonly>
    </div>
    <div class="mb-3">
    <label class="form-label">المبلغ:</label>
    <input type="text" class="form-control" value="${payment.amount} د.ك" readonly>
    </div>
    <div class="mb-3">
    <label class="form-label">تاريخ الدفع:</label>
    <input type="date" id="payment-date" class="form-control" required>
    </div>
    <div class="mb-3">
    <label class="form-label">طريقة الدفع:</label>
    <select id="payment-method" class="form-select" required>
        <option value="cash">نقدي</option>
        <option value="bank">حوالة بنكية</option>
        <option value="online">دفع إلكتروني</option>
    </select>
    </div>
    </div>
    `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'تأكيد الدفع',
        cancelButtonText: 'إلغاء',
        preConfirm: () => {
            return {
                paymentDate: document.getElementById('payment-date').value,
                paymentMethod: document.getElementById('payment-method').value
            };
        }
    });

    if (formValues) {
        // Set default payment date to today if not provided
        if (!formValues.paymentDate) {
            formValues.paymentDate = new Date().toISOString().split('T')[0];
        }
        
        const response = await fetch(`/api/payments/${paymentId}/pay`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(formValues)
        });
        
        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'تم التسديد بنجاح',
                text: 'تم تسجيل الدفعة بنجاح',
                confirmButtonText: 'حسناً'
            });
            
            // Refresh the students view
            showClassStudents(payment.class._id);
        } else {
            throw new Error('فشل في تسجيل الدفعة');
        }
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire({
        icon: 'error',
        title: 'خطأ',
        text: 'حدث خطأ أثناء محاولة تسجيل الدفعة',
        confirmButtonText: 'حسناً'
    });
    }
    };

    // دالة لتصفية المدفوعات حسب الشهر
    window.filterPaymentsByMonth = function(classId, month) {
        showClassStudents(classId, month || null);
    };

    // دالة لتصدير البيانات إلى Excel
    window.exportPaymentsToExcel = async function(classId, month = null) {
        try {
            // جلب البيانات من الخادم
            let url = `/api/payments/export?class=${classId}`;
            if (month) {
                url += `&month=${month}`;
            }

            const response = await fetch(url, {
                headers: getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                
                // إنشاء ملف Excel
                const worksheet = XLSX.utils.json_to_sheet(data);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "المدفوعات");
                
                // حفظ الملف
                const fileName = `مدفوعات_الحصة_${classId}_${month || 'جميع_الأشهر'}.xlsx`;
                XLSX.writeFile(workbook, fileName);
                
                Swal.fire('نجاح', 'تم تصدير البيانات بنجاح', 'success');
            } else {
                throw new Error('فشل في تصدير البيانات');
            }
        } catch (err) {
            console.error('Error exporting to Excel:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تصدير البيانات', 'error');
        }
    };



    // Helper function to show student enrollment modal
    window.showEnrollStudentModal = async function(classId) {
    try {
    const response = await fetch(`/api/students`, {
        headers: getAuthHeaders()
    });

    if (response.status === 401) {
        logout();
        return;
    }

    const allStudents = await response.json();

    // Get current class to filter students by academic year
    const classResponse = await fetch(`/api/classes/${classId}`, {
        headers: getAuthHeaders()
    });

    if (classResponse.status === 401) {
        logout();
        return;
    }

    const classObj = await classResponse.json();

    // Filter students - allow all students if class has no academic year
    const availableStudents = allStudents.filter(student => {
        // If class has no academic year or it's "NS" or "غير محدد", allow all students
        if (!classObj.academicYear || 
            classObj.academicYear === 'NS' || 
            classObj.academicYear === 'غير محدد') {
            return !classObj.students.includes(student._id);
        }
        
        // Otherwise, only allow students with matching academic year
        return student.academicYear === classObj.academicYear && 
            !classObj.students.includes(student._id);
    });

    if (availableStudents.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'لا يوجد طلاب متاحين',
            text: 'لا يوجد طلاب غير مسجلين في هذه الحصة',
            confirmButtonText: 'حسناً'
        });
        return;

    }

    const { value: studentId } = await Swal.fire({
        title: 'تسجيل طالب جديد',
        input: 'select',
        inputOptions: availableStudents.reduce((options, student) => {
            options[student._id] = `${student.name} (${student.studentId})`;
            return options;
        }, {}),
        inputPlaceholder: 'اختر الطالب',
        showCancelButton: true,
        confirmButtonText: 'تسجيل',
        cancelButtonText: 'إلغاء',
        inputValidator: (value) => {
            if (!value) {
                return 'يجب اختيار طالب';
            }
        }
    });

    if (studentId) {
        // Enroll the student
        const enrollResponse = await fetch(`/api/classes/${classId}/enroll/${studentId}`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        if (enrollResponse.ok) {
            Swal.fire({
                icon: 'success',
                title: 'تم التسجيل بنجاح',
                text: 'تم تسجيل الطالب في الحصة بنجاح',
                confirmButtonText: 'حسناً'
            });
            
            // Refresh the students view
            showClassStudents(classId);
        } else {
            throw new Error('فشل في تسجيل الطالب');
        }
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire({
        icon: 'error',
        title: 'خطأ',
        text: 'حدث خطأ أثناء محاولة تسجيل الطالب',
        confirmButtonText: 'حسناً'
    });
    }
    };

    // Helper function to unenroll student
    window.unenrollStudent = async function(classId, studentId) {
    try {
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "سيتم إزالة الطالب من هذه الحصة وجميع المدفوعات المرتبطة بها",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، إزالة',
        cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
        const response = await fetch(`/api/classes/${classId}/unenroll/${studentId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'تمت الإزالة',
                text: 'تم إزالة الطالب من الحصة بنجاح',
                confirmButtonText: 'حسناً'
            });
            
            // Refresh the students view
            showClassStudents(classId);
        } else {
            throw new Error('فشل في إزالة الطالب');
        }
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire({
        icon: 'error',
        title: 'خطأ',
        text: 'حدث خطأ أثناء محاولة إزالة الطالب',
        confirmButtonText: 'حسناً'
    });
    }
    };
    window.unenrollStudent = async function(classId, studentId) {
        try {
            const { isConfirmed } = await Swal.fire({
                title: 'هل أنت متأكد؟',
                text: 'سيتم إزالة الطالب من الحصة وحذف مدفوعاته',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، إزالة',
                cancelButtonText: 'إلغاء'
            });
            
            if (isConfirmed) {
                const response = await fetch(`/api/classes/${classId}/unenroll/${studentId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                if (response.status === 401) {
                    logout();
                    return;
                }
                
                if (response.ok) {
                    Swal.fire('نجاح', 'تم إزالة الطالب من الحصة بنجاح', 'success');
                    showClassStudents(classId);
                    loadClasses();
                    loadStudents();
                } else {
                    const error = await response.json();
                    Swal.fire('خطأ', error.error, 'error');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء إزالة الطالب', 'error');
        }
    };

    window.editStudent = async function(studentId) {
        try {
            const response = await fetch(`/api/students/${studentId}`, {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const student = await response.json();
            
            // Fill the form with student data
            document.getElementById('studentName').value = student.name;
            document.getElementById('studentId').value = student.studentId;
            document.getElementById('birthDate').value = student.birthDate ? student.birthDate.split('T')[0] : '';
            document.getElementById('parentName').value = student.parentName || '';
            document.getElementById('parentPhone').value = student.parentPhone || '';
            document.getElementById('academicYear').value = student.academicYear || '';
            document.getElementById('registrationDate').value = student.registrationDate ? student.registrationDate.split('T')[0] : '';
            
            // Change the save button to update
            const saveBtn = document.getElementById('saveStudentBtn');
            saveBtn.innerHTML = '<i class="bi bi-save me-1"></i>تحديث الطالب';
            saveBtn.onclick = async function() {
                const studentData = {
                    name: document.getElementById('studentName').value,
                    studentId: document.getElementById('studentId').value,
                    birthDate: document.getElementById('birthDate').value,
                    parentName: document.getElementById('parentName').value,
                    parentPhone: document.getElementById('parentPhone').value,
                    academicYear: document.getElementById('academicYear').value,
                    registrationDate: document.getElementById('registrationDate').value || new Date()
                };
                
                try {
                    const updateResponse = await fetch(`/api/students/${studentId}`, {
                        method: 'PUT',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(studentData)
                    });
                    
                    if (updateResponse.status === 401) {
                        logout();
                        return;
                    }
                    
                    if (updateResponse.ok) {
                        Swal.fire('نجاح', 'تم تحديث الطالب بنجاح', 'success');
                        bootstrap.Modal.getInstance(document.getElementById('addStudentModal')).hide();
                        loadStudents();
                        loadStudentsForPayments();
                        loadStudentsForCards();
                    } else {
                        const error = await updateResponse.json();
                        Swal.fire('خطأ', error.error || 'حدث خطأ أثناء تحديث الطالب', 'error');
                    }
                } catch (err) {
                    console.error('Error:', err);
                    Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
                }
            };
            
            // Show the modal
            const studentModal = new bootstrap.Modal(document.getElementById('addStudentModal'));
            studentModal.show();
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء جلب بيانات الطالب', 'error');
        }
    };

    window.deleteStudent = async function(studentId) {
        try {
            const { isConfirmed } = await Swal.fire({
                title: 'هل أنت متأكد؟',
                text: 'سيتم حذف الطالب وكل بياناته المرتبطة',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، احذف',
                cancelButtonText: 'إلغاء'
            });
            
            if (isConfirmed) {
                const response = await fetch(`/api/students/${studentId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                if (response.status === 401) {
                    logout();
                    return;
                }
                
                if (response.ok) {
                    Swal.fire('نجاح', 'تم حذف الطالب بنجاح', 'success');
                    loadStudents();
                    loadStudentsForPayments();
                    loadStudentsForCards();
                } else {
                    const error = await response.json();
                    Swal.fire('خطأ', error.error, 'error');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء حذف الطالب', 'error');
        }
    };

    window.editTeacher = async function(teacherId) {
        try {
            const response = await fetch(`/api/teachers/${teacherId}`, {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const teacher = await response.json();
            
            // Fill the form with teacher data
            document.getElementById('teacherName').value = teacher.name;
            
            // Select subjects
            const subjectSelect = document.getElementById('teacherSubjects');
            Array.from(subjectSelect.options).forEach(option => {
                option.selected = teacher.subjects?.includes(option.value) || false;
            });
            
            document.getElementById('teacherPhone').value = teacher.phone || '';
            document.getElementById('teacherEmail').value = teacher.email || '';
            
            // Change the save button to update
            const saveBtn = document.getElementById('saveTeacherBtn');
            saveBtn.innerHTML = '<i class="bi bi-save me-1"></i>تحديث الأستاذ';
            saveBtn.onclick = async function() {
                const teacherData = {
                    name: document.getElementById('teacherName').value,
                    subjects: Array.from(document.getElementById('teacherSubjects').selectedOptions).map(opt => opt.value),
                    phone: document.getElementById('teacherPhone').value,
                    email: document.getElementById('teacherEmail').value
                };
                
                try {
                    const updateResponse = await fetch(`/api/teachers/${teacherId}`, {
                        method: 'PUT',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(teacherData)
                    });
                    
                    if (updateResponse.status === 401) {
                        logout();
                        return;
                    }
                    
                    if (updateResponse.ok) {
                        Swal.fire('نجاح', 'تم تحديث الأستاذ بنجاح', 'success');
                        bootstrap.Modal.getInstance(document.getElementById('addTeacherModal')).hide();
                        loadTeachers();
                    } else {
                        const error = await updateResponse.json();
                        Swal.fire('خطأ', error.error || 'حدث خطأ أثناء تحديث الأستاذ', 'error');
                    }
                } catch (err) {
                    console.error('Error:', err);
                    Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
                }
            };
            
            // Show the modal
            const teacherModal = new bootstrap.Modal(document.getElementById('addTeacherModal'));
            teacherModal.show();
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء جلب بيانات الأستاذ', 'error');
        }
    };

    window.deleteTeacher = async function(teacherId) {
        try {
            const { isConfirmed } = await Swal.fire({
                title: 'هل أنت متأكد؟',
                text: 'سيتم حذف الأستاذ وكل بياناته المرتبطة',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، احذف',
                cancelButtonText: 'إلغاء'
            });
            
            if (isConfirmed) {
                const response = await fetch(`/api/teachers/${teacherId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                if (response.status === 401) {
                    logout();
                    return;
                }
                
                if (response.ok) {
                    Swal.fire('نجاح', 'تم حذف الأستاذ بنجاح', 'success');
                    loadTeachers();
                } else {
                    const error = await response.json();
                    Swal.fire('خطأ', error.error, 'error');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء حذف الأستاذ', 'error');
        }
    };

    window.editClass = async function(classId) {
        try {
            const response = await fetch(`/api/classes/${classId}`, {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const classObj = await response.json();
            
            // Fill the form with class data
            document.getElementById('className').value = classObj.name;
            document.getElementById('classSubject').value = classObj.subject || '';
            document.getElementById('classAcademicYear').value = classObj.academicYear || '';
            document.getElementById('classDescription').value = classObj.description || '';
            document.getElementById('classPrice').value = classObj.price;
            document.getElementById('classTeacherSelect').value = classObj.teacher?._id || '';
            
            // Clear existing schedules
            const schedulesContainer = document.getElementById('classSchedules');
            schedulesContainer.innerHTML = '';
            scheduleCounter = 0;
            
            // Add schedules
            if (classObj.schedule && classObj.schedule.length > 0) {
                classObj.schedule.forEach((schedule, index) => {
                    scheduleCounter++;
                    const scheduleItem = document.createElement('div');
                    scheduleItem.className = 'schedule-item';
                    scheduleItem.innerHTML = `
                        <div class="schedule-item-header">
                            <h6>الحصة ${scheduleCounter}</h6>
                            <button type="button" class="btn btn-sm btn-danger" onclick="removeSchedule(this)">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="classDay${scheduleCounter}" class="form-label">اليوم</label>
                                <select class="form-select" id="classDay${scheduleCounter}">
                                    <option value="السبت" ${schedule.day === 'السبت' ? 'selected' : ''}>السبت</option>
                                    <option value="الأحد" ${schedule.day === 'الأحد' ? 'selected' : ''}>الأحد</option>
                                    <option value="الإثنين" ${schedule.day === 'الإثنين' ? 'selected' : ''}>الإثنين</option>
                                    <option value="الثلاثاء" ${schedule.day === 'الثلاثاء' ? 'selected' : ''}>الثلاثاء</option>
                                    <option value="الأربعاء" ${schedule.day === 'الأربعاء' ? 'selected' : ''}>الأربعاء</option>
                                    <option value="الخميس" ${schedule.day === 'الخميس' ? 'selected' : ''}>الخميس</option>
                                    <option value="الجمعة" ${schedule.day === 'الجمعة' ? 'selected' : ''}>الجمعة</option>
                                </select>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="classTime${scheduleCounter}" class="form-label">الوقت</label>
                                <input type="time" class="form-control" id="classTime${scheduleCounter}" value="${schedule.time}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="classClassroom${scheduleCounter}" class="form-label">القاعة</label>
                                <select class="form-select" id="classClassroom${scheduleCounter}"></select>
                            </div>
                        </div>
                    `;
                    schedulesContainer.appendChild(scheduleItem);
                });
                
                // Load classrooms for each schedule
                await loadClassroomsForClassModal();
                
                // Set the classroom values after the selects are populated
                classObj.schedule.forEach((schedule, index) => {
                    const classroomSelect = document.getElementById(`classClassroom${index + 1}`);
                    if (classroomSelect) {
                        classroomSelect.value = schedule.classroom;
                    }
                });
            } else {
                // Add one empty schedule if none exist
                scheduleCounter++;
                const scheduleItem = document.createElement('div');
                scheduleItem.className = 'schedule-item';
                scheduleItem.innerHTML = `
                    <div class="schedule-item-header">
                        <h6>الحصة 1</h6>
                        <button type="button" class="btn btn-sm btn-danger" onclick="removeSchedule(this)">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                    <div class="row">
                        <div class="col-md-4 mb-3">
                            <label for="classDay1" class="form-label">اليوم</label>
                            <select class="form-select" id="classDay1">
                                <option value="السبت">السبت</option>
                                <option value="الأحد">الأحد</option>
                                <option value="الإثنين">الإثنين</option>
                                <option value="الثلاثاء">الثلاثاء</option>
                                <option value="الأربعاء">الأربعاء</option>
                                <option value="الخميس">الخميس</option>
                                <option value="الجمعة">الجمعة</option>
                            </select>
                        </div>
                        <div class="col-md-4 mb-3">
                            <label for="classTime1" class="form-label">الوقت</label>
                            <input type="time" class="form-control" id="classTime1">
                        </div>
                        <div class="col-md-4 mb-3">
                            <label for="classClassroom1" class="form-label">القاعة</label>
                            <select class="form-select" id="classClassroom1"></select>
                        </div>
                    </div>
                `;
                schedulesContainer.appendChild(scheduleItem);
                
                // Load classrooms for the new schedule
                await loadClassroomsForClassModal();
            }
            
            // Change the save button to update
            const saveBtn = document.getElementById('saveClassBtn');
            saveBtn.innerHTML = '<i class="bi bi-save me-1"></i>تحديث الحصة';
            saveBtn.onclick = async function() {
                // Collect schedule data
                const schedules = [];
                const scheduleItems = document.querySelectorAll('.schedule-item');
                
                scheduleItems.forEach(item => {
                    const day = item.querySelector('select').value;
                    const time = item.querySelector('input[type="time"]').value;
                    const classroom = item.querySelectorAll('select')[1].value;
                    
                    if (day && time && classroom) {
                        schedules.push({
                            day,
                            time,
                            classroom
                        });
                    }
                });
                
                if (schedules.length === 0) {
                    Swal.fire('خطأ', 'يجب إضافة جدول حصص واحد على الأقل', 'error');
                    return;
                }
                
                const classData = {
                    name: document.getElementById('className').value,
                    subject: document.getElementById('classSubject').value,
                    academicYear: document.getElementById('classAcademicYear').value,
                    description: document.getElementById('classDescription').value,
                    schedule: schedules,
                    price: document.getElementById('classPrice').value,
                    teacher: document.getElementById('classTeacherSelect').value
                };
                
                try {
                    const updateResponse = await fetch(`/api/classes/${classId}`, {
                        method: 'PUT',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(classData)
                    });
                    
                    if (updateResponse.status === 401) {
                        logout();
                        return;
                    }
                    
                    if (updateResponse.ok) {
                        Swal.fire('نجاح', 'تم تحديث الحصة بنجاح', 'success');
                        bootstrap.Modal.getInstance(document.getElementById('addClassModal')).hide();
                        loadClasses();
                        loadClassesForPayments();
                    } else {
                        const error = await updateResponse.json();
                        Swal.fire('خطأ', error.error || 'حدث خطأ أثناء تحديث الحصة', 'error');
                    }
                } catch (err) {
                    console.error('Error:', err);
                    Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
                }
            };
            
            // Show the modal
            const classModal = new bootstrap.Modal(document.getElementById('addClassModal'));
            classModal.show();
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء جلب بيانات الحصة', 'error');
        }
    };

    window.deleteClass = async function(classId) {
        try {
            const { isConfirmed } = await Swal.fire({
                title: 'هل أنت متأكد؟',
                text: 'سيتم حذف الحصة وكل البيانات المرتبطة بها',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، احذف',
                cancelButtonText: 'إلغاء'
            });
            
            if (isConfirmed) {
                const response = await fetch(`/api/classes/${classId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                if (response.status === 401) {
                    logout();
                    return;
                }
                
                if (response.ok) {
                    Swal.fire('نجاح', 'تم حذف الحصة بنجاح', 'success');
                    loadClasses();
                    loadClassesForPayments();
                } else {
                    const error = await response.json();
                    Swal.fire('خطأ', error.error, 'error');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء حذف الحصة', 'error');
        }
    };

    window.editClassroom = async function(classroomId) {
        try {
            const response = await fetch(`/api/classrooms/${classroomId}`, {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const classroom = await response.json();
            
            // Fill the form with classroom data
            document.getElementById('classroomName').value = classroom.name;
            document.getElementById('classroomCapacity').value = classroom.capacity || '';
            document.getElementById('classroomLocation').value = classroom.location || '';
            
            // Change the save button to update
            const saveBtn = document.getElementById('saveClassroomBtn');
            saveBtn.innerHTML = '<i class="bi bi-save me-1"></i>تحديث القاعة';
            saveBtn.onclick = async function() {
                const classroomData = {
                    name: document.getElementById('classroomName').value,
                    capacity: document.getElementById('classroomCapacity').value,
                    location: document.getElementById('classroomLocation').value
                };
                
                try {
                    const updateResponse = await fetch(`/api/classrooms/${classroomId}`, {
                        method: 'PUT',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(classroomData)
                    });
                    
                    if (updateResponse.status === 401) {
                        logout();
                        return;
                    }
                    
                    if (updateResponse.ok) {
                        Swal.fire('نجاح', 'تم تحديث القاعة بنجاح', 'success');
                        bootstrap.Modal.getInstance(document.getElementById('addClassroomModal')).hide();
                        loadClassrooms();
                    } else {
                        const error = await updateResponse.json();
                        Swal.fire('خطأ', error.error || 'حدث خطأ أثناء تحديث القاعة', 'error');
                    }
                } catch (err) {
                    console.error('Error:', err);
                    Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
                }
            };
            
            // Show the modal
            const classroomModal = new bootstrap.Modal(document.getElementById('addClassroomModal'));
            classroomModal.show();
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء جلب بيانات القاعة', 'error');
        }
    };

    window.deleteClassroom = async function(classroomId) {
        try {
            const { isConfirmed } = await Swal.fire({
                title: 'هل أنت متأكد؟',
                text: 'سيتم حذف القاعة وكل البيانات المرتبطة بها',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، احذف',
                cancelButtonText: 'إلغاء'
            });
            
            if (isConfirmed) {
                const response = await fetch(`/api/classrooms/${classroomId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                if (response.status === 401) {
                    logout();
                    return;
                }
                
                if (response.ok) {
                    Swal.fire('نجاح', 'تم حذف القاعة بنجاح', 'success');
                    loadClassrooms();
                } else {
                    const error = await response.json();
                    Swal.fire('خطأ', error.error, 'error');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء حذف القاعة', 'error');
        }
    };

    window.deleteCard = async function(cardId) {
        try {
            const { isConfirmed } = await Swal.fire({
                title: 'هل أنت متأكد؟',
                text: 'سيتم حذف البطاقة ولن يتم التعرف على الطالب عند مسحها',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، احذف',
                cancelButtonText: 'إلغاء'
            });
            
            if (isConfirmed) {
                const response = await fetch(`/api/cards/${cardId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                if (response.status === 401) {
                    logout();
                    return;
                }
                
                if (response.ok) {
                    Swal.fire('نجاح', 'تم حذف البطاقة بنجاح', 'success');
                    loadCards();
                } else {
                    const error = await response.json();
                    Swal.fire('خطأ', error.error, 'error');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء حذف البطاقة', 'error');
        }
    };

    socket.on('student-detected', async (data) => {
        // If we're in the gate interface, handle automatically
        if (document.getElementById('gate-interface').classList.contains('active')) {
            await handleGateAttendance(data.card.uid);
        } else {
            // Existing behavior for other sections
            try {
                const rfidResult = document.getElementById('rfid-result');
                const student = data.student;
                
                if (!student) {
                    rfidResult.innerHTML = `
                        <div class="alert alert-warning">
                            <h4>بطاقة غير معروفة</h4>
                            <p>UID: ${data.card?.uid || 'غير معروف'}</p>
                            <button class="btn btn-primary" onclick="showAssignCardModal('${data.card.uid}')">
                                تعيين البطاقة لطالب
                            </button>
                        </div>
                    `;
                    return;
                }

                // Show student info
                rfidResult.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <h4>${student.name}</h4>
                            <p>رقم الطالب: ${student.studentId}</p>
                            <button class="btn btn-info mt-2" onclick="showStudentDetails('${student._id}')">
                                عرض التفاصيل
                            </button>
                        </div>
                    </div>
                `;
            } catch (err) {
                console.error('Error handling student detection:', err);
            }
        }
    });



    window.showManualAttendanceModalForStudent = async function(studentId) {
    try {
    // Find ongoing live classes
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const response = await fetch(`/api/live-classes?status=ongoing&date=${today.toISOString()}`, {
    headers: getAuthHeaders()
    });

    if (response.status === 401) {
    logout();
    return;
    }

    const liveClasses = await response.json();

    if (liveClasses.length === 0) {
    Swal.fire({
    icon: 'info',
    title: 'لا توجد حصة جارية',
    text: 'لا يوجد حصص جارية حالياً لتسجيل الحضور',
    confirmButtonText: 'حسناً'
    });
    return;
    }

    // Create HTML for the modal
    const html = `
    <div class="manual-attendance-container border rounded p-4 shadow-sm bg-light">
    <h5 class="mb-3 text-primary fw-bold">
    <i class="bi bi-pencil-square me-2"></i> Manual Attendance Registration
    </h5>

    <ul class="list-unstyled mb-4">
    <li><strong>Class:</strong> ${liveClasses[0].class.name}</li>
    <li><strong>Date:</strong> ${new Date(liveClasses[0].date).toLocaleDateString('ar-EG')}</li>
    <li><strong>Student:</strong> ${document.querySelector('#rfid-result h4').textContent}</li>
    </ul>

    <div class="mb-3">
    <label for="attendanceStatus" class="form-label fw-semibold">Attendance Status:</label>
    <select id="attendanceStatus" class="form-select">
    <option value="present">Present</option>
    <option value="late">Late</option>
    <option value="absent">Absent</option>
    </select>
    </div>
    </div>
    `;

    const { value: status } = await Swal.fire({
    title: 'تسجيل الحضور يدوياً',
    html: html,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'تسجيل',
    cancelButtonText: 'إلغاء',
    preConfirm: () => {
    return document.getElementById('attendanceStatus').value;
    }
    });

    if (status) {
    // Submit attendance
    const attendanceResponse = await fetch(`/api/live-classes/${liveClasses[0]._id}/attendance`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
    },
    body: JSON.stringify({
        studentId: studentId,
        status: status,
        method: 'manual'
    })
    });

    if (attendanceResponse.ok) {
    Swal.fire({
        icon: 'success',
        title: 'تم التسجيل بنجاح',
        text: 'تم تسجيل حضور الطالب بنجاح',
        confirmButtonText: 'حسناً'
    });
    } else {
    throw new Error('فشل في تسجيل الحضور');
    }
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire({
    icon: 'error',
    title: 'خطأ',
    text: 'حدث خطأ أثناء محاولة تسجيل الحضور',
    confirmButtonText: 'حسناً'
    });
    }
    };



    socket.on('unknown-card', (data) => {
        const rfidResult = document.getElementById('rfid-result');
        rfidResult.innerHTML = `
            <div class="alert alert-warning text-center">
                <h4>بطاقة غير معروفة</h4>
                <p>UID: ${data.uid}</p>
                <button class="btn btn-primary" onclick="showAssignCardModal('${data.uid}')">
                    تعيين البطاقة لطالب
                </button>
            </div>
        `;
    });


    socket.on('card-error', (data) => {
        const rfidResult = document.getElementById('rfid-result');
        rfidResult.innerHTML = `
            <div class="alert alert-danger text-center">
                <h4>حدث خطأ</h4>
                <p>${data.error}</p>
            </div>
        `;
    });

    // Check authentication on page load
    document.addEventListener('DOMContentLoaded', checkAuth);


    // Live Classes Functions
    async function loadLiveClasses(status = null, date = null) {
    try {
    let url = '/api/live-classes';
    const params = [];

    if (status) params.push(`status=${status}`);
    if (date) params.push(`date=${date}`);

    if (params.length > 0) {
    url += `?${params.join('&')}`;
    }

    const response = await fetch(url, {
    headers: getAuthHeaders()
    });

    if (response.status === 401) {
    logout();
    return;
    }

    const liveClasses = await response.json();

    const tableBody = document.getElementById('liveClassesTable');
    tableBody.innerHTML = '';

    liveClasses.forEach((liveClass, index) => {
    // Add null checks
    const className = liveClass.class?.name || 'غير معين';
    const teacherName = liveClass.teacher?.name || 'غير معين';

    const row = document.createElement('tr');
    row.innerHTML = `
    <td>${index + 1}</td>
    <td>${className}</td>
    <td>${new Date(liveClass.date).toLocaleDateString('ar-EG')}</td>
    <td>${liveClass.startTime} ${liveClass.endTime ? `- ${liveClass.endTime}` : ''}</td>
    <td>${teacherName}</td>
    <td>
    <span class="badge ${getStatusBadgeClass(liveClass.status)}">
    ${getStatusText(liveClass.status)}
    </span>
    </td>
    <td>
    <div class="btn-group">
    <button class="btn btn-sm btn-outline-primary" onclick="showLiveClassDetails('${liveClass._id}')">
    <i class="bi bi-eye"></i>
    </button>
    <button class="btn btn-sm btn-outline-blue" onclick="printAttendanceSheet('${liveClass._id}')">
    <i class="bi bi-printer"></i>
    </button>

    ${liveClass.status === 'scheduled' ? `
    <button class="btn btn-sm btn-success" onclick="startLiveClass('${liveClass._id}')">
    <i class="bi bi-play"></i> بدء
    </button>
    ` : ''}
    ${liveClass.status === 'ongoing' ? `
    <button class="btn btn-sm btn-warning" onclick="showManualAttendanceModal('${liveClass._id}')">
    <i class="bi bi-person-plus"></i> حضور
    </button>
    <button class="btn btn-sm btn-danger" onclick="endLiveClass('${liveClass._id}')">
    <i class="bi bi-stop"></i> إنهاء
    </button>
    ` : ''}
    </div>
    </td>
    `;
    tableBody.appendChild(row);
    });
    } catch (err) {
    console.error('Error loading live classes:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء تحميل الحصص الحية', 'error');
    }
    }

    function getStatusBadgeClass(status) {
    switch (status) {
    case 'scheduled': return 'bg-secondary';
    case 'ongoing': return 'bg-primary';
    case 'completed': return 'bg-success';
    case 'cancelled': return 'bg-danger';
    default: return 'bg-secondary';
    }
    }

    function getStatusText(status) {
    switch (status) {
    case 'scheduled': return 'مجدولة';
    case 'ongoing': return 'جارية';
    case 'completed': return 'منتهية';
    case 'cancelled': return 'ملغاة';
    default: return status;
    }
    }

    async function showLiveClassDetails(liveClassId) {
    try {
    const response = await fetch(`/api/live-classes/${liveClassId}`, {
    headers: getAuthHeaders()
    });

    if (response.status === 401) {
    logout();
    return;
    }

    const liveClass = await response.json();

    // Create HTML for the modal
    const html = `
    <div class="row">
    <div class="col-md-6">
        <h5>معلومات الحصة</h5>
        <p><strong>الحصة:</strong> ${liveClass.class.name}</p>
        <p><strong>التاريخ:</strong> ${new Date(liveClass.date).toLocaleDateString('ar-EG')}</p>
        <p><strong>الوقت:</strong> ${liveClass.startTime} ${liveClass.endTime ? `- ${liveClass.endTime}` : ''}</p>
        <p><strong>الأستاذ:</strong> ${liveClass.teacher.name}</p>
        <p><strong>الحالة:</strong> <span class="badge ${getStatusBadgeClass(liveClass.status)}">${getStatusText(liveClass.status)}</span></p>
    </div>
    <div class="col-md-6">
        <h5>الحضور</h5>
        <div class="table-responsive">
        <table class="table table-sm">
            <thead>
            <tr>
                <th>الطالب</th>
                <th>الحضور</th>
            </tr>
            </thead>
            <tbody>
            ${liveClass.attendance.map(att => `
                <tr>
                <td>${att.student.name}</td>
                <td>
                    <span class="badge ${att.status === 'present' ? 'bg-success' : att.status === 'late' ? 'bg-warning' : 'bg-danger'}">
                    ${att.status === 'present' ? 'حاضر' : att.status === 'late' ? 'متأخر' : 'غائب'}
                    </span>
                </td>
                </tr>
            `).join('')}
            </tbody>
        </table>
        </div>
    </div>
    </div>
    `;

    Swal.fire({
    title: 'تفاصيل الحصة',
    html: html,
    width: '800px',
    showConfirmButton: false,
    showCloseButton: true
    });
    } catch (err) {
    console.error('Error:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء جلب تفاصيل الحصة', 'error');
    }
    }

    async function startLiveClass(liveClassId) {
        try {
            const response = await fetch(`/api/live-classes/${liveClassId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: 'ongoing' })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start class');
            }

            Swal.fire('نجاح', 'تم بدء الحصة بنجاح', 'success');
            loadLiveClasses();
        } catch (err) {
            console.error('Error starting live class:', err);
            Swal.fire('خطأ', err.message || 'حدث خطأ أثناء بدء الحصة', 'error');
        }
    }

    async function endLiveClass(liveClassId) {
        try {
            const now = new Date();
            const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                            now.getMinutes().toString().padStart(2, '0');

            const response = await fetch(`/api/live-classes/${liveClassId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ 
                    status: 'completed',
                    endTime: currentTime
                })
            });

            if (response.ok) {
                // تسجيل الغائبين تلقائياً عند انتهاء الحصة
                await autoMarkAbsentOnClassEnd(liveClassId);
                
                Swal.fire('نجاح', 'تم إنهاء الحصة وتسجيل الغائبين تلقائياً', 'success');
                loadLiveClasses();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'فشل في إنهاء الحصة');
            }
        } catch (err) {
            console.error('Error ending live class:', err);
            Swal.fire('خطأ', err.message || 'حدث خطأ أثناء إنهاء الحصة', 'error');
        }
    }
    // خدمة الخلفية للتحقق من انتهاء الحصص
    function startAttendanceBackgroundService() {
        setInterval(async () => {
            try {
                // التحقق من الحصص المنتهية
                const response = await fetch('/api/live-classes?status=ongoing', {
                    headers: getAuthHeaders()
                });
                
                if (response.ok) {
                    const ongoingClasses = await response.json();
                    
                    for (const liveClass of ongoingClasses) {
                        if (liveClass.endTime && checkIfClassEnded(liveClass.endTime)) {
                            // الحصة انتهت - تسجيل الغائبين
                            await autoMarkAbsentOnClassEnd(liveClass._id);
                            
                            // تحديث حالة الحصة إلى منتهية
                            await fetch(`/api/live-classes/${liveClass._id}`, {
                                method: 'PUT',
                                headers: getAuthHeaders(),
                                body: JSON.stringify({ 
                                    status: 'completed',
                                    autoEnded: true
                                })
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('Error in background service:', err);
            }
        }, 60000); // التحقق كل دقيقة
    }

    document.addEventListener('DOMContentLoaded', function() {
        // التأكد من تحميل البيانات عند فتح قسم الطلاب
        const studentsLink = document.getElementById('students-link');
        if (studentsLink) {
            studentsLink.addEventListener('click', function() {
                // تحميل بيانات الطلاب عند النقر على القسم
                loadStudents();
            });
        }
    });

    // بدء الخدمة عند تحميل التطبيق
    document.addEventListener('DOMContentLoaded', function() {
        const classSearchInput = document.getElementById('classSearchInput');
        if (classSearchInput) {
            // البحث أثناء الكتابة (بعد تأخير 300 مللي ثانية)
            let searchTimeout;
            classSearchInput.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchClasses();
                }, 300);
            });
            
            // البحث عند الضغط على Enter
            classSearchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchClasses();
                }
            });
        }
    });



    async function cancelLiveClass(liveClassId) {
    try {
    const { isConfirmed } = await Swal.fire({
    title: 'هل أنت متأكد؟',
    text: 'سيتم إلغاء هذه الحصة',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'نعم، ألغِ الحصة',
    cancelButtonText: 'إلغاء'
    });

    if (isConfirmed) {
    const response = await fetch(`/api/live-classes/${liveClassId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status: 'cancelled' })
    });

    if (response.status === 401) {
    logout();
    return;
    }

    if (response.ok) {
    Swal.fire('نجاح', 'تم إلغاء الحصة بنجاح', 'success');
    loadLiveClasses();
    } else {
    const error = await response.json();
    Swal.fire('خطأ', error.error, 'error');
    }
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء إلغاء الحصة', 'error');
    }
    }

    async function showLiveClassReport(classId) {
    try {
    const { value: dates } = await Swal.fire({
    title: 'تقرير الحضور',
    html: `
    <div class="row">
        <div class="col-md-6 mb-3">
        <label for="fromDate" class="form-label">من تاريخ</label>
        <input type="date" id="fromDate" class="form-control" required>
        </div>
        <div class="col-md-6 mb-3">
        <label for="toDate" class="form-label">إلى تاريخ</label>
        <input type="date" id="toDate" class="form-control" required>
        </div>
    </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'عرض التقرير',
    cancelButtonText: 'إلغاء',
    preConfirm: () => {
    return {
        fromDate: document.getElementById('fromDate').value,
        toDate: document.getElementById('toDate').value
    };
    }
    });

    if (dates) {
    const response = await fetch(`/api/live-classes/${classId}/report?fromDate=${dates.fromDate}&toDate=${dates.toDate}`, {
    headers: getAuthHeaders()
    });

    if (response.status === 401) {
    logout();
    return;
    }

    const report = await response.json();

    // Create HTML for the report
    const html = `
    <div class="report-container">
        <h5>تقرير الحضور للحصة: ${report.class}</h5>
        <p>عدد الحصص في الفترة: ${report.totalClasses}</p>
        
        <div class="table-responsive mt-4">
        <table class="table table-striped">
            <thead>
            <tr>
                <th>الطالب</th>
                <th>حضور</th>
                <th>غياب</th>
                <th>تأخير</th>
                <th>النسبة</th>
            </tr>
            </thead>
            <tbody>
            ${Object.values(report.attendance).map(att => `
                <tr>
                <td>${att.student.name}</td>
                <td>${att.present}</td>
                <td>${att.absent}</td>
                <td>${att.late}</td>
                <td>
                    ${report.totalClasses > 0 ? 
                    Math.round((att.present / report.totalClasses) * 100) : 0}%
                </td>
                </tr>
            `).join('')}
            </tbody>
        </table>
        </div>
    </div>
    `;

    Swal.fire({
    title: 'تقرير الحضور',
    html: html,
    width: '900px',
    showConfirmButton: false,
    showCloseButton: true
    });
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء جلب التقرير', 'error');
    }
    }
    async function filterLiveClasses() {
    const status = document.getElementById('liveClassStatusFilter').value;
    const date = document.getElementById('liveClassDateFilter').value;

    await loadLiveClasses(status, date);
    }
    async function loadDataForLiveClassModal() {
    try {
    // Load classes
    const classesResponse = await fetch('/api/classes', {
    headers: getAuthHeaders()
    });
    const classes = await classesResponse.json();

    const classSelect = document.getElementById('liveClassClassSelect');
    classSelect.innerHTML = '<option value="" selected disabled>اختر حصة</option>';
    classes.forEach(cls => {
    const option = document.createElement('option');
    option.value = cls._id;
    option.textContent = `${cls.name} (${cls.subject})`;
    classSelect.appendChild(option);
    });

    // Load teachers
    const teachersResponse = await fetch('/api/teachers', {
    headers: getAuthHeaders()
    });
    const teachers = await teachersResponse.json();

    const teacherSelect = document.getElementById('liveClassTeacherSelect');
    teacherSelect.innerHTML = '<option value="" selected disabled>اختر أستاذ</option>';
    teachers.forEach(teacher => {
    const option = document.createElement('option');
    option.value = teacher._id;
    option.textContent = teacher.name;
    teacherSelect.appendChild(option);
    });

    // Load classrooms
    const classroomsResponse = await fetch('/api/classrooms', {
    headers: getAuthHeaders()
    });
    const classrooms = await classroomsResponse.json();

    const classroomSelect = document.getElementById('liveClassClassroomSelect');
    classroomSelect.innerHTML = '<option value="" selected disabled>اختر قاعة</option>';
    classrooms.forEach(classroom => {
    const option = document.createElement('option');
    option.value = classroom._id;
    option.textContent = `${classroom.name} (${classroom.location || 'غير محدد'})`;
    classroomSelect.appendChild(option);
    });

    // Set default date to today
    document.getElementById('liveClassDate').value = new Date().toISOString().split('T')[0];

    // Set default time to current time + 30 minutes
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    document.getElementById('liveClassStartTime').value = `${hours}:${minutes}`;
    } catch (err) {
    console.error('Error loading data for live class modal:', err);
    }
    }
    document.getElementById('saveLiveClassBtn').addEventListener('click', async () => {
    const liveClassData = {
    class: document.getElementById('liveClassClassSelect').value,
    date: document.getElementById('liveClassDate').value,
    startTime: document.getElementById('liveClassStartTime').value,
    teacher: document.getElementById('liveClassTeacherSelect').value,
    classroom: document.getElementById('liveClassClassroomSelect').value,
    notes: document.getElementById('liveClassNotes').value,
    status: 'scheduled'
    };
    if (!liveClassData.class || !liveClassData.teacher || !liveClassData.classroom) {
    Swal.fire('خطأ', 'يجب اختيار الحصة والأستاذ والقاعة', 'error');
    return;
    }

    try {
    const response = await fetch('/api/live-classes', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(liveClassData)
    });

    if (response.status === 401) {
    logout();
    return;
    }

    if (response.ok) {
    Swal.fire('نجاح', 'تم إضافة الحصة بنجاح', 'success');
    document.getElementById('addLiveClassForm').reset();
    bootstrap.Modal.getInstance(document.getElementById('addLiveClassModal')).hide();
    loadLiveClasses();
    } else {
    const error = await response.json();
    Swal.fire('خطأ', error.error || 'حدث خطأ أثناء إضافة الحصة', 'error');
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
    }
    });
    // Manual attendance functions
    window.showManualAttendanceModal = async function(liveClassId) {
    try {
    // Load the live class data
    const response = await fetch(`/api/live-classes/${liveClassId}`, {
    headers: getAuthHeaders()
    });

    if (response.status === 401) {
    logout();
    return;
    }

    const liveClass = await response.json();

    // Load enrolled students
    const classResponse = await fetch(`/api/classes/${liveClass.class._id}`, {
    headers: getAuthHeaders()
    });
    const classObj = await classResponse.json();

    // Create HTML for the modal
    const html = `
    <div class="manual-attendance-container border rounded p-4 shadow-sm bg-light">
    <h5 class="mb-3 text-primary fw-bold">
        <i class="bi bi-pencil-square me-2"></i> تسجيل الحضور يدوياً
    </h5>
    <p class="mb-2"><strong>الحصة:</strong> ${liveClass.class.name}</p>
    <p class="mb-3"><strong>التاريخ:</strong> ${new Date(liveClass.date).toLocaleDateString('ar-EG')}</p>

    <div class="mb-3">
        <label for="attendanceStudentSelect" class="form-label fw-semibold">اختر الطالب:</label>
        <select id="attendanceStudentSelect" class="form-select">
            ${classObj.students.map(student => `
                <option value="${student._id}">${student.name} (${student.studentId})</option>
            `).join('')}
        </select>
    </div>

    <div class="mb-3">
        <label for="attendanceStatus" class="form-label fw-semibold">حالة الحضور:</label>
        <select id="attendanceStatus" class="form-select">
            <option value="present">حاضر</option>
            <option value="late">متأخر</option>
            <option value="absent">غائب</option>
        </select>
    </div>
    </div>
    `;      
    const { value: formValues } = await Swal.fire({
    title: 'تسجيل الحضور يدوياً',
    html: html,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'تسجيل',
    cancelButtonText: 'إلغاء',
    preConfirm: () => {
    return {
        studentId: document.getElementById('attendanceStudentSelect').value,
        status: document.getElementById('attendanceStatus').value
    };
    }
    });

    if (formValues) {
    // Submit attendance
    const attendanceResponse = await fetch(`/api/live-classes/${liveClassId}/attendance`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
    },
    body: JSON.stringify(formValues)
    });

    if (attendanceResponse.ok) {
    Swal.fire({
        icon: 'success',
        title: 'تم التسجيل بنجاح',
        text: 'تم تسجيل حضور الطالب بنجاح',
        confirmButtonText: 'حسناً'
    });

    // Refresh the live classes view
    loadLiveClasses();
    } else {
    throw new Error('فشل في تسجيل الحضور');
    }
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire({
    icon: 'error',
    title: 'خطأ',
    text: 'حدث خطأ أثناء محاولة تسجيل الحضور',
    confirmButtonText: 'حسناً'
    });
    }
    };

    // RFID attendance handler
    async function handleRFIDAttendance(uid) {
    try {
    // Find the current ongoing live class
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const response = await fetch(`/api/live-classes?status=ongoing&date=${today.toISOString()}`, {
    headers: getAuthHeaders()
    });

    if (response.status === 401) {
    logout();
    return;
    }

    const liveClasses = await response.json();

    if (liveClasses.length === 0) {
    Swal.fire({
    icon: 'info',
    title: 'لا توجد حصة جارية',
    text: 'لا يوجد حصص جارية حالياً لتسجيل الحضور',
    confirmButtonText: 'حسناً'
    });
    return;
    }

    // For simplicity, we'll use the first ongoing class
    const liveClass = liveClasses[0];

    // Submit attendance via RFID
    const attendanceResponse = await fetch(`/api/live-classes/${liveClass._id}/attendance`, {
    method: 'POST',
    headers: {
    'Content-Type': 'application/json',
    ...getAuthHeaders()
    },
    body: JSON.stringify({
    studentId: uid,
    status: 'present',
    method: 'rfid'
    })
    });

    if (attendanceResponse.ok) {
    const result = await attendanceResponse.json();

    Swal.fire({
    icon: 'success',
    title: 'تم تسجيل الحضور',
    html: `تم تسجيل حضور الطالب <strong>${result.student.name}</strong> في حصة <strong>${liveClass.class.name}</strong>`,
    confirmButtonText: 'حسناً'
    });
    } else {
    const error = await attendanceResponse.json();
    throw new Error(error.error || 'فشل في تسجيل الحضور');
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire({
    icon: 'error',
    title: 'خطأ',
    text: err.message || 'حدث خطأ أثناء محاولة تسجيل الحضور',
    confirmButtonText: 'حسناً'
    });
    }
    }

    // تبديل الوضع المظلم
    const themeSwitcher = document.createElement('button');
    themeSwitcher.className = 'theme-switcher';
    themeSwitcher.innerHTML = '<i class="bi bi-moon-fill"></i>';
    document.body.appendChild(themeSwitcher);

    themeSwitcher.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    themeSwitcher.innerHTML = '<i class="bi bi-moon-fill"></i>';
    } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeSwitcher.innerHTML = '<i class="bi bi-sun-fill"></i>';
    }
    });
    // For main app footer
    document.getElementById('app-current-year').textContent = new Date().getFullYear();
    // After successful login, update header user info
    function updateHeaderUserInfo() {
    const user = getCurrentUser(); // Your function to get current user
    document.getElementById('header-user-name').textContent = user.name;
    document.getElementById('header-user-role').textContent = user.role;

    // Also update the sidebar user info if needed
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-role').textContent = user.role;
    }

    // Theme toggle functionality
    document.getElementById('theme-toggle').addEventListener('click', function() {
    document.body.setAttribute('data-theme', 
    document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    this.innerHTML = document.body.getAttribute('data-theme') === 'dark' ? 
    '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
    });
    // Fixed searchStudents function
    async function searchStudents() {
        const searchTerm = document.getElementById('studentSearchInput').value.trim().toLowerCase();
        
        try {
            const response = await fetch('/api/students', {
                headers: getAuthHeaders()
            });

            if (response.status === 401) {
                logout();
                return;
            }

            const students = await response.json();

            // Filter students based on search term
            const filteredStudents = students.filter(student => {
                // If search term is empty, show all students
                if (!searchTerm) return true;
                
                // Check if search term matches any student property
                return (
                    (student.name && student.name.toLowerCase().includes(searchTerm)) ||
                    (student.studentId && student.studentId.toLowerCase().includes(searchTerm)) ||
                    (student.parentName && student.parentName.toLowerCase().includes(searchTerm)) ||
                    (student.academicYear && getAcademicYearName(student.academicYear).toLowerCase().includes(searchTerm))
                );
            });

            // Update the table with filtered results
            const tableBody = document.getElementById('studentsTable');
            tableBody.innerHTML = '';

            if (filteredStudents.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-4 text-muted">لا توجد نتائج مطابقة للبحث</td>
                    </tr>
                `;
                return;
            }

            filteredStudents.forEach((student, index) => {
                const row = document.createElement('tr');
                row.dataset.studentId = student._id;

                // إضافة صنف تحذيري للطلاب الذين لم يدفعوا حقوق التسجيل
                if (!student.hasPaidRegistration) {
                    row.classList.add('table-warning');
                    row.title = 'لم يدفع حقوق التسجيل';
                } else {
                    row.classList.add('table-success');
                }

                row.style.cursor = 'pointer';
                row.addEventListener('click', () => {
                    showStudentModal(student);
                });
                
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${student.name}</td>
                    <td>${student.studentId}</td>
                    <td>${student.parentName || '-'}</td>
                    <td>${getAcademicYearName(student.academicYear) || '-'}</td>
                    <td>${student.classes?.length || 0}</td>
                    <td>
                        ${!student.hasPaidRegistration ? 
                            '<span class="badge bg-warning">لم يدفع التسجيل</span>' : 
                            '<span class="badge bg-success">مسدد</span>'
                        }
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary btn-action" onclick="showStudentDetails('${student._id}', event)">
                            <i class="bi bi-eye"></i> تفاصيل
                        </button>
                        ${!student.hasPaidRegistration ? 
                            `<button class="btn btn-sm btn-success btn-action ms-1" onclick="payRegistrationFee('${student._id}')">
                                <i class="bi bi-cash"></i> دفع التسجيل
                            </button>` : 
                            ''
                        }
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
        } catch (err) {
            console.error('Error searching students:', err);
        }
    }

    async function searchPayments() {
    const searchTerm = document.getElementById('paymentSearchInput').value.trim().toLowerCase();
    try {
    let url = '/api/payments';
    const studentId = document.getElementById('paymentStudentSelect').value;
    const classId = document.getElementById('paymentClassSelect').value;
    const month = document.getElementById('paymentMonthSelect').value;

    const params = [];
    if (studentId) params.push(`student=${studentId}`);
    if (classId) params.push(`class=${classId}`);
    if (month) params.push(`month=${month}`);

    if (params.length > 0) {
        url += `?${params.join('&')}`;
    }

    const response = await fetch(url, {
        headers: getAuthHeaders()
    });

    if (response.status === 401) {
        logout();
        return;
    }

    let payments = await response.json();

    // Filter payments based on search term
    const filteredPayments = payments.filter(payment => {
        // If search term is empty, show all payments
        if (!searchTerm) return true;
        
        // Check if search term matches any payment property
        return (
            (payment.student?.name && payment.student.name.toLowerCase().includes(searchTerm)) ||
            (payment.student?.studentId && payment.student.studentId.toLowerCase().includes(searchTerm)) ||
            (payment.class?.name && payment.class.name.toLowerCase().includes(searchTerm)) ||
            (payment.month && payment.month.toLowerCase().includes(searchTerm)) ||
            (payment.amount && payment.amount.toString().includes(searchTerm)) ||
            (payment.status && payment.status.toLowerCase().includes(searchTerm))
        );
    });

    // Update the table with filtered results
    const tableBody = document.getElementById('paymentsTable');
    tableBody.innerHTML = '';

    if (filteredPayments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-muted">لا توجد نتائج مطابقة للبحث</td>
            </tr>
        `;
        return;
    }

    filteredPayments.forEach((payment, index) => {
        const row = document.createElement('tr');
        row.classList.add(`payment-${payment.status}`);
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${payment.student?.name || 'غير معروف'} (${payment.student?.studentId || 'غير معروف'})</td>
            <td>${payment.class?.name || 'غير معروف'}</td>
            <td>${payment.month}</td>
            <td>${payment.amount} د.ك</td>
            <td>
                <span class="badge ${payment.status === 'paid' ? 'bg-success' : 
                                payment.status === 'pending' ? 'bg-warning' : 'bg-danger'}">
                    ${payment.status === 'paid' ? 'مسدد' : 
                    payment.status === 'pending' ? 'قيد الانتظار' : 'متأخر'}
                </span>
            </td>
            <td>${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('ar-EG') : '-'}</td>
            <td>
                <button class="btn btn-sm ${payment.status !== 'paid' ? 'btn-success' : 'btn-secondary'} btn-action" 
                    onclick="showPaymentModal('${payment._id}')" 
                    ${payment.status === 'paid' ? 'disabled' : ''}>
                    <i class="bi bi-cash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    } catch (err) {
    console.error('Error searching payments:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء البحث', 'error');
    }
    }

    // Keep only one version of showPaymentModal (the more complete one)
    window.showPaymentModal = async function(paymentId) {
    try {
    const paymentResponse = await fetch(`/api/payments/${paymentId}`, {
        headers: getAuthHeaders()
    });

    if (paymentResponse.status === 401) {
        logout();
        return;
    }

    const payment = await paymentResponse.json();

    const { value: formValues } = await Swal.fire({
        title: 'تسديد الدفعة',
        html: `
            <div class="payment-modal-container p-3">
                <div class="mb-3">
                    <label class="form-label">الطالب:</label>
                    <input type="text" class="form-control" value="${payment.student?.name || 'غير معروف'}" readonly>
                </div>
                <div class="mb-3">
                    <label class="form-label">الحصة:</label>
                    <input type="text" class="form-control" value="${payment.class?.name || 'غير معروف'}" readonly>
                </div>
                <div class="mb-3">
                    <label class="form-label">الشهر:</label>
                    <input type="text" class="form-control" value="${payment.month || 'غير محدد'}" readonly>
                </div>
                <div class="mb-3">
                    <label class="form-label">المبلغ:</label>
                    <input type="text" class="form-control" value="${payment.amount || 0} د.ك" readonly>
                </div>
                <div class="mb-3">
                    <label class="form-label">تاريخ الدفع:</label>
                    <input type="date" id="payment-date" class="form-control" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">طريقة الدفع:</label>
                    <select id="payment-method" class="form-select" required>
                        <option value="cash">نقدي</option>
                        <option value="bank">حوالة بنكية</option>
                        <option value="online">دفع إلكتروني</option>
                    </select>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'تأكيد الدفع',
        cancelButtonText: 'إلغاء',
        preConfirm: () => {
            return {
                paymentDate: document.getElementById('payment-date').value,
                paymentMethod: document.getElementById('payment-method').value
            };
        }
    });

    if (formValues) {
        // Set default payment date to today if not provided
        if (!formValues.paymentDate) {
            formValues.paymentDate = new Date().toISOString().split('T')[0];
        }
        
        const response = await fetch(`/api/payments/${paymentId}/pay`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(formValues)
        });
        
        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'تم التسديد بنجاح',
                text: 'تم تسجيل الدفعة بنجاح',
                confirmButtonText: 'حسناً'
            });
            
            // Refresh the students view
            if (payment.class?._id) {
                showClassStudents(payment.class._id);
            }
        } else {
            throw new Error('فشل في تسجيل الدفعة');
        }
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire({
        icon: 'error',
        title: 'خطأ',
        text: 'حدث خطأ أثناء محاولة تسجيل الدفعة',
        confirmButtonText: 'حسناً'
    });
    }
    };

    // Keep only one version of unenrollStudent
    window.unenrollStudent = async function(classId, studentId) {
    try {
    const { isConfirmed } = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: 'سيتم إزالة الطالب من الحصة وحذف مدفوعاته',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، إزالة',
        cancelButtonText: 'إلغاء'
    });

    if (isConfirmed) {
        const response = await fetch(`/api/classes/${classId}/unenroll/${studentId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (response.ok) {
            Swal.fire('نجاح', 'تم إزالة الطالب من الحصة بنجاح', 'success');
            showClassStudents(classId);
            loadClasses();
            loadStudents();
        } else {
            const error = await response.json();
            Swal.fire('خطأ', error.error, 'error');
        }
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء إزالة الطالب', 'error');
    }
    };

    async function searchCards() {
    const searchTerm = document.getElementById('cardSearchInput').value.trim().toLowerCase();
    const tableBody = document.getElementById('cardsTable');
    tableBody.innerHTML = `
    <tr>
        <td colspan="5" class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">جاري التحميل...</span>
            </div>
        </td>
    </tr>
    `;
    try {
    const response = await fetch('/api/cards', {
        headers: getAuthHeaders()
    });

    if (response.status === 401) {
        logout();
        return;
    }

    const cards = await response.json();

    // Filter cards based on search term
    const filteredCards = cards.filter(card => {
        // If search term is empty, show all cards
        if (!searchTerm) return true;
        
        // Check if search term matches any card or student property
        return (
            (card.uid && card.uid.toLowerCase().includes(searchTerm)) ||
            (card.student?.name && card.student.name.toLowerCase().includes(searchTerm)) ||
            (card.student?.studentId && card.student.studentId.toLowerCase().includes(searchTerm)) ||
            (card.issueDate && new Date(card.issueDate).toLocaleDateString('ar-EG').includes(searchTerm))
        );
    });

    // Update the table with filtered results
    const tableBody = document.getElementById('cardsTable');
    tableBody.innerHTML = '';

    if (filteredCards.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-muted">لا توجد نتائج مطابقة للبحث</td>
            </tr>
        `;
        return;
    }

    filteredCards.forEach((card, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${card.uid}</td>
            <td>${card.student?.name || 'غير معين'} (${card.student?.studentId || 'غير معين'})</td>
            <td>${card.issueDate ? new Date(card.issueDate).toLocaleDateString('ar-EG') : 'غير معروف'}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger btn-action" onclick="deleteCard('${card._id}')">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    } catch (err) {
    console.error('Error searching cards:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء البحث في البطاقات', 'error');
    }
    }




    // Navigation between sections - Fixed version
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Remove active from all links
        document.querySelectorAll('.nav-link').forEach(navLink => {
            navLink.classList.remove('active');
        });
        
        // Activate current link
        this.classList.add('active');
        
        // Show requested section
        const sectionId = this.getAttribute('data-section');
        const sectionElement = document.getElementById(sectionId);
        if (sectionElement) {
            sectionElement.classList.add('active');
        }
        
        // Load data when needed
        if (sectionId === 'students') loadStudents();
        else if (sectionId === 'teachers') loadTeachers();
        else if (sectionId === 'classes') loadClasses();
        else if (sectionId === 'classrooms') loadClassrooms();
        else if (sectionId === 'payments') {
            loadStudentsForPayments();
            loadPayments();
        }
        else if (sectionId === 'cards') {
            loadStudentsForCards();
            loadCards();
        }
        else if (sectionId === 'registration-requests') {
            loadRegistrationRequests();
        }
        else if (sectionId === 'student-accounts') {
            loadStudentAccounts();
        }
        else if (sectionId === 'live-classes') {
            loadLiveClasses();
        }
        else if (sectionId === 'gate-interface') {
            initGateInterface();
        }
        });
    });





    async function loadRegistrationRequests() {
    try {
    const status = document.getElementById('requestStatusFilter').value;

    const response = await fetch(`/api/registration-requests?status=${status}`, {
    headers: getAuthHeaders()
    });

    if (response.status === 401) {
    logout();
    return;
    }

    const students = await response.json();

    const tableBody = document.getElementById('registrationRequestsTable');
    tableBody.innerHTML = '';

    if (students.length === 0) {
    tableBody.innerHTML = `
        <tr>
            <td colspan="9" class="text-center py-4 text-muted">لا توجد طلبات متاحة</td>
        </tr>
    `;
    return;
    }

    students.forEach((student, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${index + 1}</td>
        <td>${student.name}</td>
        <td>${student.parentName || '-'}</td>
        <td>${student.parentPhone || '-'}</td>
        <td>${student.parentEmail || '-'}</td>
        <td>${getAcademicYearName(student.academicYear) || '-'}</td>
        <td>${new Date(student.registrationDate).toLocaleDateString('ar-EG')}</td>
        <td>
            <span class="badge ${student.status === 'active' ? 'bg-success' : 
                            student.status === 'pending' ? 'bg-warning' : 'bg-danger'}">
                ${student.status === 'active' ? 'مقبول' : 
                student.status === 'pending' ? 'قيد الانتظار' : 'مرفوض'}
            </span>
        </td>
        <td>
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary" onclick="viewRegistrationDetails('${student._id}')">
                    <i class="bi bi-eye"></i>
                </button>
                ${student.status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="approveRegistration('${student._id}')">
                        <i class="bi bi-check-lg"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="rejectRegistration('${student._id}')">
                        <i class="bi bi-x-lg"></i>
                    </button>
                ` : ''}
            </div>
        </td>
    `;
    tableBody.appendChild(row);
    });
    } catch (err) {
    console.error('Error loading registration requests:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء تحميل طلبات التسجيل', 'error');
    }
    }



    // View registration details
    async function viewRegistrationDetails(studentId) {
    try {
    const response = await fetch(`/api/students/${studentId}`, {
    headers: getAuthHeaders()
    });

    const student = await response.json();

    const html = `
    <div class="registration-details">
        <div class="row mb-4">
            <div class="col-md-6">
                <h5>المعلومات الأساسية</h5>
                <p><strong>اسم الطالب:</strong> ${student.name}</p>
                <p><strong>تاريخ الميلاد:</strong> ${student.birthDate ? new Date(student.birthDate).toLocaleDateString('ar-EG') : 'غير محدد'}</p>
                <p><strong>السنة الدراسية:</strong> ${getAcademicYearName(student.academicYear) || 'غير محدد'}</p>
            </div>
            <div class="col-md-6">
                <h5>معلومات ولي الأمر</h5>
                <p><strong>اسم ولي الأمر:</strong> ${student.parentName || 'غير محدد'}</p>
                <p><strong>هاتف ولي الأمر:</strong> ${student.parentPhone || 'غير محدد'}</p>
                <p><strong>بريد ولي الأمر:</strong> ${student.parentEmail || 'غير محدد'}</p>
            </div>
        </div>
        
        ${student.registrationData ? `
            <div class="row mb-4">
                <div class="col-md-6">
                    <h5>معلومات إضافية</h5>
                    <p><strong>العنوان:</strong> ${student.registrationData.address || 'غير محدد'}</p>
                    <p><strong>المدرسة السابقة:</strong> ${student.registrationData.previousSchool || 'غير محدد'}</p>
                    <p><strong>معلومات صحية:</strong> ${student.registrationData.healthInfo || 'لا توجد'}</p>
                </div>
                <div class="col-md-6">
                    <h5>الوثائق المرفقة</h5>
                    ${student.registrationData.documents && student.registrationData.documents.length > 0 ? 
                        student.registrationData.documents.map(doc => `
                            <p>
                                <a href="${doc.url}" target="_blank" class="text-decoration-none">
                                    ${doc.name} 
                                    ${doc.verified ? '<span class="badge bg-success">تم التحقق</span>' : '<span class="badge bg-warning">لم يتم التحقق</span>'}
                                </a>
                            </p>
                        `).join('') : 
                        '<p>لا توجد وثائق مرفقة</p>'
                    }
                </div>
            </div>
        ` : ''}
    </div>
    `;

    Swal.fire({
    title: 'تفاصيل طلب التسجيل',
    html: html,
    width: '900px',
    showConfirmButton: false,
    showCloseButton: true
    });
    } catch (err) {
    console.error('Error:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء جلب تفاصيل الطلب', 'error');
    }
    }



    // Approve registration
    async function approveRegistration(studentId) {
        try {
            const { value: formValues } = await Swal.fire({
                title: 'تأكيد قبول الطلب',
                html: `
                    <p>هل أنت متأكد من قبول طلب التسجيل هذا؟</p>
                    <div class="mb-3">
                        <label for="officialStudentId" class="form-label">الرقم الجامعي:</label>
                        <input type="text" class="form-control" id="officialStudentId" placeholder="سيتم إنشاؤه تلقائياً إذا ترك فارغاً">
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="printReceipt" checked>
                        <label class="form-check-label" for="printReceipt">
                            طباعة وصل التسجيل تلقائياً
                        </label>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'نعم، قبول الطلب وطباعة الوصل',
                cancelButtonText: 'إلغاء',
                preConfirm: () => {
                    return {
                        studentId: document.getElementById('officialStudentId').value,
                        printReceipt: document.getElementById('printReceipt').checked
                    };
                }
            });

            if (formValues) {
                const response = await fetch(`/api/admin/approve-student/${studentId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        status: 'active',
                        studentId: formValues.studentId || undefined
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    
                    if (formValues.printReceipt) {
                        // البحث عن بيانات الطالب الكاملة
                        const studentResponse = await fetch(`/api/students/${studentId}`, {
                            headers: getAuthHeaders()
                        });
                        
                        if (studentResponse.ok) {
                            const studentData = await studentResponse.json();
                            await printRegistrationReceipt(studentData, 600);
                        }
                    }
                    
                    Swal.fire('نجاح', 'تم قبول طلب التسجيل بنجاح' + (formValues.printReceipt ? ' وتمت الطباعة' : ''), 'success');
                    await printRegistrationReceipt(fetchStudentDataById(studentId), 700);

                    loadRegistrationRequests();
                    loadStudents();
                } else {
                    const error = await response.json();
                    Swal.fire('خطأ', error.error || 'حدث خطأ أثناء قبول الطلب', 'error');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء محاولة قبول الطلب', 'error');
        }
    }
    async function rejectRegistration(studentId) {
    try {
    const { value: reason } = await Swal.fire({
    title: 'سبب الرفض',
    input: 'textarea',
    inputLabel: 'الرجاء إدخال سبب رفض طلب التسجيل',
    inputPlaceholder: 'أدخل السبب هنا...',
    showCancelButton: true,
    confirmButtonText: 'تأكيد الرفض',
    cancelButtonText: 'إلغاء'
    });

    if (reason) {
    const response = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
            status: 'rejected',
            rejectionReason: reason
        })
    });

    if (response.ok) {
        Swal.fire('نجاح', 'تم رفض طلب التسجيل بنجاح', 'success');
        loadRegistrationRequests();
    } else {
        const error = await response.json();
        Swal.fire('خطأ', error.error || 'حدث خطأ أثناء رفض الطلب', 'error');
    }
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء محاولة رفض الطلب', 'error');
    }
    }

    // Load student accounts
    // Load student accounts

    // Create student account

    // Load students for dropdown
    async function loadStudentsForAccountCreation() {
    try {
    const response = await fetch('/api/students?hasAccount=false', {
    headers: getAuthHeaders()
    });

    if (response.status === 401) {
    logout();
    return;
    }

    const students = await response.json();
    const select = document.getElementById('accountStudentSelect');
    select.innerHTML = '<option value="" selected disabled>اختر طالب...</option>';

    students.forEach(student => {
    const option = document.createElement('option');
    option.value = student._id;
    option.textContent = `${student.name} (${student.studentId || 'لا يوجد رقم'})`;
    select.appendChild(option);
    });
    } catch (err) {
    console.error('Error loading students:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء تحميل قائمة الطلاب', 'error');
    }
    }

    // Initialize when modal is shown
    document.getElementById('addStudentAccountModal').addEventListener('show.bs.modal', function() {
    loadStudentsForAccountCreation();

    // Generate suggested username
    document.getElementById('accountStudentSelect').addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
    if (selectedOption.value) {
    const studentId = selectedOption.textContent.match(/\(([^)]+)\)/)?.[1] || '';
    document.getElementById('accountUsername').value = studentId || '';
    }
    });
    });

    // Set up form submission
    document.getElementById('addStudentAccountForm').addEventListener('submit', function(e) {
    e.preventDefault();
    createStudentAccount();
    });

    // Initialize when section is shown
    document.getElementById('student-accounts-link').addEventListener('click', function() {
    loadStudentAccounts();
    });
    // Add event listener for save button
    document.getElementById('saveStudentAccountBtn').addEventListener('click', async () => {
    const password = document.getElementById('accountPassword').value;
    const confirmPassword = document.getElementById('accountConfirmPassword').value;

    if (password !== confirmPassword) {
    Swal.fire('خطأ', 'كلمة المرور وتأكيدها غير متطابقين', 'error');
    return;
    }

    const accountData = {
    studentId: document.getElementById('accountStudentSelect').value,
    username: document.getElementById('accountUsername').value,
    password: password,
    email: document.getElementById('accountEmail').value
    };

    try {
    const response = await fetch('/api/student-accounts', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(accountData)
    });

    if (response.ok) {
    Swal.fire('نجاح', 'تم إنشاء حساب الطالب بنجاح', 'success');
    bootstrap.Modal.getInstance(document.getElementById('addStudentAccountModal')).hide();
    loadStudentAccounts();
    } else {
    const error = await response.json();
    Swal.fire('خطأ', error.error || 'حدث خطأ أثناء إنشاء الحساب', 'error');
    }
    } catch (err) {
    console.error('Error:', err);
    Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
    }
    });

    // Load students for account creation dropdown


    // Initialize when student accounts section is shown
    document.getElementById('student-accounts-link').addEventListener('click', function() {
    loadStudentAccounts();
    loadStudentsForAccountCreation();
    });

    // Update the student account creation function
    window.createStudentAccount = async function(studentId) {
    try {
    // First get student data
    const studentResponse = await fetch(`/api/students/${studentId}`, {
    headers: getAuthHeaders()
    });

    if (studentResponse.status === 401) {
    logout();
    return;
    }

    const student = await studentResponse.json();

    // Generate a username and password
    const username = student.studentId || `stu_${Date.now().toString().slice(-6)}`;
    const password = generateRandomPassword(); // You'll need to implement this function

    const accountData = {
    username: username,
    password: password,
    role: 'student',
    fullName: student.name,
    phone: student.parentPhone,
    email: student.parentEmail,
    studentId: student.studentId
    };

    const response = await fetch('/api/student/create-account', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(accountData)
    });

    if (response.ok) {
    const result = await response.json();

    // Show success message with credentials
    Swal.fire({
        title: 'تم إنشاء الحساب بنجاح',
        html: `
            <p>تم إنشاء حساب الطالب بنجاح</p>
            <div class="alert alert-info mt-3">
                <p><strong>اسم المستخدم:</strong> ${result.username}</p>
                <p><strong>كلمة المرور:</strong> ${password}</p>
            </div>
            <p class="text-muted mt-2">يرجى تدوين هذه المعلومات وإعطائها للطالب</p>
        `,
        confirmButtonText: 'تم',
        width: '600px'
    });

    // Refresh student accounts list
    loadStudentAccounts();
    } else {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create account');
    }
    } catch (err) {
    console.error('Error creating student account:', err);
    Swal.fire({
    icon: 'error',
    title: 'خطأ',
    text: err.message || 'حدث خطأ أثناء إنشاء الحساب',
    confirmButtonText: 'حسناً'
    });
    }
    };

    // Helper function to generate random password
    function generateRandomPassword(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
    }
    // Student Accounts Functions
    // Load student accounts
    // Load student accounts
    // Load student accounts
    // Load student accounts
    // Load student accounts
    // Load student accounts



    // Render accounts table
    function renderStudentAccountsTable(accounts) {
        const tableBody = document.getElementById('studentAccountsTable');
        tableBody.innerHTML = '';

        if (accounts.length === 0) {
        tableBody.innerHTML = `
            <tr>
            <td colspan="8" class="text-center py-4 text-muted">لا توجد حسابات متاحة</td>
            </tr>
        `;
        return;
        }

        accounts.forEach((account, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${account.username}</td>
            <td>${account.fullName || '-'}</td>
            <td>${account.studentId || '-'}</td>
            <td>${account.email || '-'}</td>
            <td>
            <span class="badge ${account.active ? 'bg-success' : 'bg-secondary'}">
                ${account.active ? 'نشط' : 'غير نشط'}
            </span>
            </td>
            <td>${new Date(account.createdAt).toLocaleDateString('ar-EG')}</td>
            <td>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-danger" onclick="deleteStudentAccount('${account._id}')">
                <i class="bi bi-trash"></i>
                </button>
                <button class="btn btn-outline-warning" onclick="showResetPasswordModal('${account._id}')">
                <i class="bi bi-key"></i>
                </button>
                <button class="btn btn-outline-secondary" onclick="toggleAccountStatus('${account._id}', ${account.active})">
                <i class="bi ${account.active ? 'bi-pause' : 'bi-play'}"></i>
                </button>
            </div>
            </td>
        `;
        tableBody.appendChild(row);
        });
    }
    // Show create account modal
    async function showCreateAccountModal(studentId = null) {
        try {
        // Load students without accounts
        const response = await fetch('/api/students?hasAccount=false', {
            headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
            logout();
            return;
        }

        const students = await response.json();
        const studentSelect = document.getElementById('accountStudentSelect');
        
        studentSelect.innerHTML = '<option value="" selected disabled>اختر طالب...</option>';
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student._id;
            option.textContent = `${student.name} (${student.studentId || 'بدون رقم'})`;
            if (studentId && student._id === studentId) option.selected = true;
            studentSelect.appendChild(option);
        });

        // If studentId provided, auto-fill username
        if (studentId) {
            const student = students.find(s => s._id === studentId);
            if (student) {
            document.getElementById('accountUsername').value = student.studentId || '';
            document.getElementById('accountEmail').value = student.parentEmail || '';
            }
        }

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('addStudentAccountModal'));
        modal.show();
        } catch (err) {
        console.error('Error:', err);
        Swal.fire('خطأ', 'حدث خطأ أثناء تحضير النموذج', 'error');
        }
    }

    // Create student account
    async function createStudentAccount() {
        const form = document.getElementById('addStudentAccountForm');
        const formData = new FormData(form);

        const accountData = {
            studentId: formData.get('accountStudentSelect'),
            username: formData.get('accountUsername').trim(),
            password: formData.get('accountPassword'),
            email: formData.get('accountEmail').trim()
        };

        // Validation
        if (!accountData.studentId) {
            Swal.fire('خطأ', 'يجب اختيار طالب', 'error');
            return;
        }

        if (!accountData.username) {
            Swal.fire('خطأ', 'يجب إدخال اسم المستخدم', 'error');
            return;
        }

        if (accountData.password !== formData.get('accountConfirmPassword')) {
            Swal.fire('خطأ', 'كلمة المرور وتأكيدها غير متطابقين', 'error');
            return;
        }

        try {
            const response = await fetch('/api/student-accounts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(accountData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'حدث خطأ أثناء إنشاء الحساب');
            }

            const data = await response.json();
            Swal.fire('نجاح', 'تم إنشاء الحساب بنجاح', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addStudentAccountModal')).hide();
            loadStudentAccounts();
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', err.message, 'error');
        }
    }
    async function showResetPasswordModal(accountId) {
        const { value: newPassword } = await Swal.fire({
        title: 'إعادة تعيين كلمة المرور',
        html: `
            <input type="password" id="newPassword" class="swal2-input" placeholder="كلمة المرور الجديدة">
            <input type="password" id="confirmPassword" class="swal2-input" placeholder="تأكيد كلمة المرور">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'حفظ',
        cancelButtonText: 'إلغاء',
        preConfirm: () => {
            const password = document.getElementById('newPassword').value;
            const confirm = document.getElementById('confirmPassword').value;
            
            if (!password || password.length < 6) {
            Swal.showValidationMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return false;
            }
            
            if (password !== confirm) {
            Swal.showValidationMessage('كلمة المرور وتأكيدها غير متطابقين');
            return false;
            }
            
            return { password };
        }
        });

        if (newPassword) {
        try {
            const response = await fetch(`/api/student-accounts/${accountId}/reset-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(newPassword)
            });

            if (response.ok) {
            Swal.fire('نجاح', 'تم تحديث كلمة المرور بنجاح', 'success');
            } else {
            const error = await response.json();
            throw new Error(error.error || 'حدث خطأ أثناء تحديث كلمة المرور');
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', err.message, 'error');
        }
        }
    }
    async function deleteStudentAccount(accountId) {
        try {
        const { isConfirmed } = await Swal.fire({
            title: 'هل أنت متأكد؟',
            text: 'سيتم حذف الحساب ولن يتمكن الطالب من تسجيل الدخول',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'نعم، احذف',
            cancelButtonText: 'إلغاء'
        });

        if (isConfirmed) {
            const response = await fetch(`/api/student-accounts/${accountId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
            });

            if (response.ok) {
            Swal.fire('نجاح', 'تم حذف الحساب بنجاح', 'success');
            loadStudentAccounts();
            } else {
            const error = await response.json();
            throw new Error(error.error || 'حدث خطأ أثناء الحذف');
            }
        }
        } catch (err) {
        console.error('Error:', err);
        Swal.fire('خطأ', err.message, 'error');
        }
    }

    // Show reset password modal
    async function showResetPasswordModal(accountId) {
        const { value: newPassword } = await Swal.fire({
        title: 'إعادة تعيين كلمة المرور',
        html: `
            <input type="password" id="newPassword" class="swal2-input" placeholder="كلمة المرور الجديدة">
            <input type="password" id="confirmPassword" class="swal2-input" placeholder="تأكيد كلمة المرور">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'حفظ',
        cancelButtonText: 'إلغاء',
        preConfirm: () => {
            const password = document.getElementById('newPassword').value;
            const confirm = document.getElementById('confirmPassword').value;
            
            if (!password || password.length < 6) {
            Swal.showValidationMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return false;
            }
            
            if (password !== confirm) {
            Swal.showValidationMessage('كلمة المرور وتأكيدها غير متطابقين');
            return false;
            }
            
            return { password };
        }
        });

        if (newPassword) {
        try {
            const response = await fetch(`/api/student-accounts/${accountId}/reset-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(newPassword)
            });

            if (response.ok) {
            Swal.fire('نجاح', 'تم تحديث كلمة المرور بنجاح', 'success');
            } else {
            const error = await response.json();
            throw new Error(error.error || 'حدث خطأ أثناء تحديث كلمة المرور');
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', err.message, 'error');
        }
        }
    }

    // Toggle account status
    async function toggleAccountStatus(accountId, currentStatus) {
        try {
        const response = await fetch(`/api/student-accounts/${accountId}/toggle-status`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            Swal.fire('نجاح', data.message, 'success');
            loadStudentAccounts();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'حدث خطأ أثناء تغيير حالة الحساب');
        }
        } catch (err) {
        console.error('Error:', err);
        Swal.fire('خطأ', err.message, 'error');
        }
    }
        


    // Load students for dropdown (only those without accounts)
    async function loadStudentsForAccountCreation() {
        try {
            const response = await fetch('/api/students?hasAccount=false', {
                headers: getAuthHeaders()
            });

            if (response.status === 401) {
                logout();
                return;
            }

            const students = await response.json();
            const select = document.getElementById('accountStudentSelect');
            select.innerHTML = '<option value="" selected disabled>اختر طالب...</option>';

            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student._id;
                option.textContent = `${student.name} (${student.studentId || 'لا يوجد رقم'})`;
                select.appendChild(option);
            });
        } catch (err) {
            console.error('Error loading students:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل قائمة الطلاب', 'error');
        }
    }

    // Initialize when modal is shown
    document.getElementById('addStudentAccountModal').addEventListener('show.bs.modal', function() {
        loadStudentsForAccountCreation();

        // Generate suggested username based on student ID
        document.getElementById('accountStudentSelect').addEventListener('change', async function() {
            const studentId = this.value;
            if (studentId) {
                try {
                    const response = await fetch(`/api/students/${studentId}`, {
                        headers: getAuthHeaders()
                    });
                    
                    if (response.ok) {
                        const student = await response.json();
                        document.getElementById('accountUsername').value = student.studentId || '';
                        document.getElementById('accountEmail').value = student.parentEmail || '';
                    }
                } catch (err) {
                    console.error('Error fetching student:', err);
                }
            }
        });
    });

    // Set up form submission
    document.getElementById('addStudentAccountForm').addEventListener('submit', function(e) {
        e.preventDefault();
        createStudentAccount();
    });

    // Function to load student accounts table
    async function loadStudentAccounts() {
        try {
            const status = document.getElementById('accountStatusFilter').value;
            const searchTerm = document.getElementById('accountSearchInput').value.trim();
            
            let url = '/api/student-accounts';
            const params = [];
            
            if (status) params.push(`status=${status}`);
            if (searchTerm) params.push(`search=${encodeURIComponent(searchTerm)}`);
            
            if (params.length) url += `?${params.join('&')}`;

            const response = await fetch(url, {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const accounts = await response.json();
            renderStudentAccountsTable(accounts);
        } catch (err) {
            console.error('Error loading student accounts:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل حسابات الطلاب', 'error');
        }
    }

    function renderStudentAccountsTable(accounts) {
        const tableBody = document.getElementById('studentAccountsTable');
        tableBody.innerHTML = '';

        if (!accounts || accounts.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-muted">لا توجد حسابات متاحة</td>
                </tr>
            `;
            return;
        }

        accounts.forEach((account, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${account.username}</td>
                <td>${account.fullName || '-'}</td>
                <td>${account.studentId || '-'}</td>
                <td>${account.email || '-'}</td>
                <td>
                    <span class="badge ${account.active ? 'bg-success' : 'bg-secondary'}">
                        ${account.active ? 'نشط' : 'غير نشط'}
                    </span>
                </td>
                <td>${new Date(account.createdAt).toLocaleDateString('ar-EG')}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteStudentAccount('${account._id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-warning" onclick="showResetPasswordModal('${account._id}')">
                            <i class="bi bi-key"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="toggleAccountStatus('${account._id}', ${account.active})">
                            <i class="bi ${account.active ? 'bi-pause' : 'bi-play'}"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
    function renderStudentAccountsTable(accounts) {
        const tableBody = document.getElementById('studentAccountsTable');
        tableBody.innerHTML = '';

        if (accounts.length === 0) {
        tableBody.innerHTML = `
            <tr>
            <td colspan="7" class="text-center py-4 text-muted">لا توجد حسابات متاحة</td>
            </tr>
        `;
        return;
        }

        accounts.forEach((account, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${account.username}</td>
            <td>${account.fullName || '-'}</td>
            <td>${account.studentId || '-'}</td>
            <td>${account.email || '-'}</td>
            <td>
            <span class="badge ${account.active ? 'bg-success' : 'bg-secondary'}">
                ${account.active ? 'نشط' : 'غير نشط'}
            </span>
            </td>
            <td>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteStudentAccount('${account._id}')">
                <i class="bi bi-trash"></i>
            </button>
            <button class="btn btn-sm btn-outline-warning" onclick="resetStudentPassword('${account._id}')">
                <i class="bi bi-key"></i>
            </button>
            </td>
        `;
        tableBody.appendChild(row);
        });
    }

    // Function to delete a student account
    // Delete student account
    // Delete student account
    window.deleteStudentAccount = async function(accountId) {
        try {
            const { isConfirmed } = await Swal.fire({
                title: 'هل أنت متأكد؟',
                text: 'سيتم حذف الحساب ولن يتمكن الطالب من تسجيل الدخول',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، احذف',
                cancelButtonText: 'إلغاء'
            });

            if (isConfirmed) {
                const response = await fetch(`/api/student-accounts/${accountId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });

                if (response.ok) {
                    Swal.fire('نجاح', 'تم حذف الحساب بنجاح', 'success');
                    loadStudentAccounts();
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'حدث خطأ أثناء الحذف');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', err.message, 'error');
        }
    };

    // Show reset password modal
    window.showResetPasswordModal = async function(accountId) {
        const { value: newPassword } = await Swal.fire({
            title: 'إعادة تعيين كلمة المرور',
            html: `
                <input type="password" id="newPassword" class="swal2-input" placeholder="كلمة المرور الجديدة">
                <input type="password" id="confirmPassword" class="swal2-input" placeholder="تأكيد كلمة المرور">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'حفظ',
            cancelButtonText: 'إلغاء',
            preConfirm: () => {
                const password = document.getElementById('newPassword').value;
                const confirm = document.getElementById('confirmPassword').value;
                
                if (!password || password.length < 6) {
                    Swal.showValidationMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                    return false;
                }
                
                if (password !== confirm) {
                    Swal.showValidationMessage('كلمة المرور وتأكيدها غير متطابقين');
                    return false;
                }
                
                return { password };
            }
        });

        if (newPassword) {
            try {
                const response = await fetch(`/api/student-accounts/${accountId}/reset-password`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify(newPassword)
                });

                if (response.ok) {
                    Swal.fire('نجاح', 'تم تحديث كلمة المرور بنجاح', 'success');
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'حدث خطأ أثناء تحديث كلمة المرور');
                }
            } catch (err) {
                console.error('Error:', err);
                Swal.fire('خطأ', err.message, 'error');
            }
        }
    };

    // Toggle account status
    window.toggleAccountStatus = async function(accountId, currentStatus) {
        try {
            const response = await fetch(`/api/student-accounts/${accountId}/toggle-status`, {
                method: 'PUT',
                headers: getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                Swal.fire('نجاح', data.message, 'success');
                loadStudentAccounts();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'حدث خطأ أثناء تغيير حالة الحساب');
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', err.message, 'error');
        }
    };

    // Function to reset student password
    window.resetStudentPassword = async function(accountId) {
        try {
            const { value: newPassword } = await Swal.fire({
                title: 'إعادة تعيين كلمة المرور',
                input: 'text',
                inputLabel: 'كلمة المرور الجديدة',
                inputPlaceholder: 'أدخل كلمة المرور الجديدة',
                showCancelButton: true,
                confirmButtonText: 'حفظ',
                cancelButtonText: 'إلغاء',
                inputValidator: (value) => {
                    if (!value) {
                        return 'يجب إدخال كلمة مرور جديدة';
                    }
                }
            });

            if (newPassword) {
                const response = await fetch(`/api/student-accounts/${accountId}/reset-password`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({ password: newPassword })
                });

                if (response.ok) {
                    Swal.fire('نجاح', 'تم تحديث كلمة المرور بنجاح', 'success');
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'حدث خطأ أثناء تحديث كلمة المرور');
                }
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', err.message, 'error');
        }
    };

    // Initialize when student accounts section is shown
    document.getElementById('student-accounts-link').addEventListener('click', function() {
        loadStudentAccounts();
    });

    // Search functionality for student accounts
    document.getElementById('accountSearchInput').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            loadStudentAccounts();
        }
    });

    // Filter functionality for student accounts
    document.getElementById('accountStatusFilter').addEventListener('change', function() {
        loadStudentAccounts();
    });

    // Helper function to show create account modal for a specific student
    // Show create account modal
    window.showCreateAccountModal = async function(studentId = null) {
        try {
            // Load students without accounts
            const response = await fetch('/api/students?hasAccount=false', {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }

            const students = await response.json();
            const studentSelect = document.getElementById('accountStudentSelect');
            
            studentSelect.innerHTML = '<option value="" selected disabled>اختر طالب...</option>';
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student._id;
                option.textContent = `${student.name} (${student.studentId || 'بدون رقم'})`;
                if (studentId && student._id === studentId) option.selected = true;
                studentSelect.appendChild(option);
            });

            // If studentId provided, auto-fill username
            if (studentId) {
                const student = students.find(s => s._id === studentId);
                if (student) {
                    document.getElementById('accountUsername').value = student.studentId || '';
                    document.getElementById('accountEmail').value = student.parentEmail || '';
                }
            }

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('addStudentAccountModal'));
            modal.show();
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحضير النموذج', 'error');
        }
    };

    // Create student account
    window.createStudentAccount = async function() {
        const form = document.getElementById('addStudentAccountForm');
        const formData = new FormData(form);

        const accountData = {
            studentId: formData.get('accountStudentSelect'),
            username: formData.get('accountUsername').trim(),
            password: formData.get('accountPassword'),
            email: formData.get('accountEmail').trim()
        };

        // Validation
        if (!accountData.studentId) {
            Swal.fire('خطأ', 'يجب اختيار طالب', 'error');
            return;
        }

        if (!accountData.username) {
            Swal.fire('خطأ', 'يجب إدخال اسم المستخدم', 'error');
            return;
        }

        if (accountData.password !== formData.get('accountConfirmPassword')) {
            Swal.fire('خطأ', 'كلمة المرور وتأكيدها غير متطابقين', 'error');
            return;
        }

        try {
            const response = await fetch('/api/student-accounts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(accountData)
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire({
                    title: 'نجاح',
                    html: `
                        <p>تم إنشاء حساب الطالب بنجاح</p>
                        <div class="alert alert-info mt-3">
                            <p><strong>اسم المستخدم:</strong> ${data.account.username}</p>
                            <p><strong>الطالب:</strong> ${data.account.studentName}</p>
                            <p><strong>الرقم الجامعي:</strong> ${data.account.studentId}</p>
                        </div>
                    `,
                    icon: 'success',
                    confirmButtonText: 'تم',
                    width: '600px'
                });

                form.reset();
                bootstrap.Modal.getInstance(document.getElementById('addStudentAccountModal')).hide();
                loadStudentAccounts();
            } else {
                throw new Error(data.error || 'حدث خطأ أثناء إنشاء الحساب');
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', err.message, 'error');
        }
    };




    // Add this in your initialization code

    function initStudentAccountsSection() {
        // Load accounts on section show
        document.getElementById('student-accounts-link').addEventListener('click', loadStudentAccounts);
    }

    document.getElementById('addStudentAccountForm').addEventListener('submit', function(e) {
        e.preventDefault();
        createStudentAccount();
    });


    function saveStudentAccount() {
    const studentId = document.getElementById('accountStudentSelect').value;
    const username = document.getElementById('accountUsername').value.trim();
    const password = document.getElementById('accountPassword').value;
    const confirmPassword = document.getElementById('accountConfirmPassword').value;
    const email = document.getElementById('accountEmail').value.trim();



    // Validation
    if (!studentId) {
    Swal.fire('خطأ', 'يجب اختيار طالب', 'error');
    return;
    }

    if (!username) {
    Swal.fire('خطأ', 'يجب إدخال اسم المستخدم', 'error');
    return;
    }

    // Add more validation as needed

    // Prepare data
    const accountData = {
    studentId: studentId,
    username: username,
    password: password,
    email: email
    };

    // Send request
    // In saveStudentAccount() function
    fetch('/api/student-accounts', {
    method: 'POST',  // Changed from PUT to POST
    headers: {
    'Content-Type': 'application/json',
    ...getAuthHeaders()
    },
    body: JSON.stringify(accountData)
    })
    .then(response => {
    if (response.ok) {
    Swal.fire('نجاح', 'تم حفظ الحساب بنجاح', 'success');
    } else {
    response.json().then(error => {
    throw new Error(error.message || 'حدث خطأ أثناء حفظ الحساب');
    });
    }
    })
    .catch(err => {
    console.error('Error saving account:', err);
    Swal.fire('خطأ', err.message || 'حدث خطأ أثناء حفظ الحساب', 'error');
    });
    }


    // Global variable to store the connected device
    let rfidDevice = null;

    // Function to request USB device access
    async function connectRFIDReader() {
    try {
        // Filter for STid devices (you'll need the correct vendor/product IDs)
        const device = await navigator.usb.requestDevice({
        filters: [
            { vendorId: 0x0483 }, // STMicroelectronics vendor ID
            { vendorId: 0x0403 }  // FTDI (common for USB-to-serial)
        ]
        });
        
        
        // Open the device
        await device.open();
        if (device.configuration === null) {
        await device.selectConfiguration(1);
        }
        
        // Claim the interface
        await device.claimInterface(0);
        
        rfidDevice = device;
        Swal.fire('Success', 'RFID reader connected successfully', 'success');
        
        // Start listening for RFID tags
        startRFIDListening();
        
    } catch (error) {
        console.error('Error connecting to RFID reader:', error);
        Swal.fire('Error', 'Failed to connect to RFID reader: ' + error.message, 'error');
    }
    }

    // Function to start listening for RFID tags
    async function startRFIDListening() {
    if (!rfidDevice) return;

    try {
        // STid readers typically use a simple serial protocol
        // You'll need to send the correct initialization commands
        await rfidDevice.transferOut(1, new TextEncoder().encode('\x02\x30\x31\x03')); // Example command
        
        // Continuously read data
        while (rfidDevice.opened) {
        const result = await rfidDevice.transferIn(1, 64);
        if (result.data && result.data.byteLength > 0) {
            const decoder = new TextDecoder();
            const data = decoder.decode(result.data);
            
            // Process the RFID data (this will vary by reader model)
            const uid = extractUIDFromData(data);
            if (uid) {
            handleDetectedRFID(uid);
            }
        }
        }
    } catch (error) {
        console.error('RFID reading error:', error);
        if (rfidDevice) {
        await disconnectRFIDReader();
        }
    }
    }

    // Function to extract UID from reader data
    function extractUIDFromData(data) {
    // STid readers typically send data in format [STX][DATA][ETX][LRC]
    // Example: "\x0212345678\x03\x2A"
    const match = data.match(/\x02(.+?)\x03/);
    return match ? match[1] : null;
    }

    // Function to disconnect the reader
    async function disconnectRFIDReader() {
    if (rfidDevice) {
        try {
        await rfidDevice.releaseInterface(0);
        await rfidDevice.close();
        rfidDevice = null;
        } catch (error) {
        console.error('Error disconnecting:', error);
        }
    }
    }

    // Modify your existing RFID handling
    function handleDetectedRFID(uid) {
        // Clear any previous results
        const rfidResult = document.getElementById('rfid-result');
        
        // Show the detected UID
        rfidResult.innerHTML = `
            <div class="alert alert-info">
                <h4>Card Detected</h4>
                <p>UID: ${uid}</p>
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">جاري المعالجة...</span>
                    </div>
                </div>
            </div>
        `;
        
        // Process the RFID and display student info
        setTimeout(() => {
            displayStudentInfo(uid);
        }, 1000);
    }
    const style = document.createElement('style');
    style.textContent = `
        .payment-status {
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-weight: bold;
        }
        
        .payment-paid {
            background-color: #d4edda;
            color: #155724;
        }
        
        .payment-pending {
            background-color: #fff3cd;
            color: #856404;
        }
        
        .student-photo {
            width: 80px;
            height: 80px;
            object-fit: cover;
            border: 3px solid #3498db;
        }
        
        .classes-list {
            max-height: 100px;
            overflow-y: auto;
        }
    `;
    document.head.appendChild(style);

    document.getElementById('connectRFIDBtn').addEventListener('click', function() {
        const rfidStatus = document.getElementById('rfidStatus');
        rfidStatus.textContent = 'Connecting...';
        rfidStatus.className = 'badge bg-warning';
        
        // Simulate connection
        setTimeout(() => {
        rfidStatus.textContent = 'Connected';
        rfidStatus.className = 'badge bg-success connected';
        document.getElementById('connectRFIDBtn').disabled = true;
        document.getElementById('disconnectRFIDBtn').disabled = false;
        
        // Simulate card scan
        simulateCardScan();
        }, 2000);
    });


    document.getElementById('disconnectRFIDBtn').addEventListener('click', function() {
        const rfidStatus = document.getElementById('rfidStatus');
        rfidStatus.textContent = 'Disconnected';
        rfidStatus.className = 'badge bg-danger disconnected';
        document.getElementById('connectRFIDBtn').disabled = false;
        document.getElementById('disconnectRFIDBtn').disabled = true;
        document.getElementById('rfid-result').innerHTML = '<p class="text-muted">قم بتمرير بطاقة الطالب لعرض المعلومات</p>';
    });
    function showAllClasses() {
        document.getElementById('classSearchInput').value = '';
        loadClasses();
        document.getElementById('showAllClassesBtn').style.display = 'none';
    }

    async function searchClasses() {
        const searchTerm = document.getElementById('classSearchInput').value.trim().toLowerCase();
        const showAllBtn = document.getElementById('showAllClassesBtn');
        
        if (searchTerm) {
            showAllBtn.style.display = 'block';
        } else {
            showAllBtn.style.display = 'none';
        }
        
        try {
            const response = await fetch('/api/classes', {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            const classes = await response.json();
            
            // تصفية الحصص بناءً على مصطلح البحث
            const filteredClasses = classes.filter(cls => {
                // إذا كان مصطلح البحث فارغاً، اعرض جميع الحصص
                if (!searchTerm) return true;
                
                // التحقق إذا كان مصطلح البحث يطابق أي خاصية من خصائص الحصة
                return (
                    (cls.name && cls.name.toLowerCase().includes(searchTerm)) ||
                    (cls.subject && cls.subject.toLowerCase().includes(searchTerm)) ||
                    (cls.academicYear && getAcademicYearName(cls.academicYear).toLowerCase().includes(searchTerm)) ||
                    (cls.teacher?.name && cls.teacher.name.toLowerCase().includes(searchTerm)) ||
                    (cls.description && cls.description.toLowerCase().includes(searchTerm))
                );
            });
            
            // تحديث الجدول بالنتائج المصفاة
            updateClassesTable(filteredClasses);
            
        } catch (err) {
            console.error('Error searching classes:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء البحث', 'error');
        }
    }


    // دالة لتحميل وعرض الغيابات الشهرية
    async function loadMonthlyAttendance(classId, month = null) {
        try {
            // إظهار تحميل
            Swal.fire({
                title: 'جاري التحميل',
                html: 'جاري تحميل بيانات الغيابات الشهرية...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            let url = `/api/classes/${classId}/monthly-attendance`;
            if (month) {
                url += `?month=${month}`;
            }

            const response = await fetch(url, {
                headers: getAuthHeaders()
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error('فشل في جلب بيانات الغيابات');
            }

            const data = await response.json();
            
            // إغلاق نافذة التحميل
            Swal.close();
            
            // عرض البيانات في واجهة المستخدم
            displayMonthlyAttendance(data);
            
        } catch (error) {
            console.error('Error loading monthly attendance:', error);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: error.message || 'حدث خطأ أثناء تحميل بيانات الغيابات',
                confirmButtonText: 'حسناً'
            });
        }
    }

    // دالة لعرض بيانات الغيابات الشهرية
    function displayMonthlyAttendance(data) {
        const html = `
            <div class="monthly-attendance-container">
                <div class="card shadow-sm mb-4">
                    <div class="card-header bg-primary text-white">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="mb-1">تقرير الغيابات الشهرية</h5>
                                <p class="mb-0">${data.class.name} - ${data.class.subject}</p>
                                <p class="mb-0">شهر: ${data.class.month}</p>
                            </div>
                            <div class="text-end">
                                <small>إجمالي الحصص: ${data.period.totalClasses}</small><br>
                                <small>عدد الطلاب: ${data.summary.totalStudents}</small>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row mb-4">
                            <div class="col-md-3">
                                <div class="card bg-light">
                                    <div class="card-body text-center">
                                        <h6>متوسط الحضور</h6>
                                        <h3 class="text-primary">${data.summary.averageAttendance}%</h3>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-9">
                                <div class="month-selector">
                                    <label for="attendanceMonth" class="form-label">اختر شهر آخر:</label>
                                    <input type="month" id="attendanceMonth" class="form-control" 
                                        onchange="changeAttendanceMonth('${data.class._id}', this.value)">
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table class="table table-striped table-hover">
                                <thead class="table-dark">
                                    <tr>
                                        <th>#</th>
                                        <th>اسم الطالب</th>
                                        <th>رقم الطالب</th>
                                        <th>الصف</th>
                                        <th>الحضور</th>
                                        <th>الغياب</th>
                                        <th>التأخير</th>
                                        <th>نسبة الحضور</th>
                                        <th>الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.students.map((student, index) => `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td>${student.student.name}</td>
                                            <td>${student.student.studentId}</td>
                                            <td>${getAcademicYearName(student.student.academicYear)}</td>
                                            <td>
                                                <span class="badge bg-success">${student.statistics.present}</span>
                                            </td>
                                            <td>
                                                <span class="badge bg-danger">${student.statistics.absent}</span>
                                            </td>
                                            <td>
                                                <span class="badge bg-warning">${student.statistics.late}</span>
                                            </td>
                                            <td>
                                                <div class="progress" style="height: 20px;">
                                                    <div class="progress-bar ${student.statistics.attendanceRate >= 80 ? 'bg-success' : 
                                                        student.statistics.attendanceRate >= 60 ? 'bg-warning' : 'bg-danger'}" 
                                                        role="progressbar" 
                                                        style="width: ${student.statistics.attendanceRate}%">
                                                        ${student.statistics.attendanceRate}%
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <button class="btn btn-sm btn-outline-info" 
                                                    onclick="showStudentAttendanceDetails('${student.student._id}', '${data.class._id}', '${data.class.month}')">
                                                    <i class="bi bi-list-check"></i> التفاصيل
                                                </button>
                                                ${student.statistics.absent > 0 ? `
                                                    <button class="btn btn-sm btn-outline-warning mt-1" 
                                                        onclick="contactParent('${student.student._id}')">
                                                        <i class="bi bi-telephone"></i> إشعار ولي الأمر
                                                    </button>
                                                ` : ''}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div class="mt-4">
                            <button class="btn btn-success" onclick="exportAttendanceToExcel('${data.class._id}', '${data.class.month}')">
                                <i class="bi bi-file-earmark-excel"></i> تصدير إلى Excel
                            </button>
                            <button class="btn btn-primary ms-2" onclick="printAttendanceReport('${data.class._id}', '${data.class.month}')">
                                <i class="bi bi-printer"></i> طباعة التقرير
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // عرض البيانات في نافذة
        Swal.fire({
            title: `تقرير الغيابات - ${data.class.name}`,
            html: html,
            width: '1300px',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: {
                popup: 'attendance-report-popup'
            }
        });
    }

    // دالة لتغيير الشهر المعروض
    async function changeAttendanceMonth(classId, month) {
        await loadMonthlyAttendance(classId, month);
    }

    // دالة لعرض تفاصيل حضور طالب معين
    async function showStudentAttendanceDetails(studentId, classId, month) {
        try {
            const response = await fetch(`/api/students/${studentId}/attendance?class=${classId}&month=${month}`, {
                headers: getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                displayStudentAttendanceDetails(data);
            }
        } catch (error) {
            console.error('Error loading student attendance details:', error);
        }
    }

    // دالة لعرض تفاصيل حضور الطالب
    function displayStudentAttendanceDetails(data) {
        const html = `
            <div class="student-attendance-details">
                <h5>تفاصيل حضور الطالب: ${data.student.name}</h5>
                <p>الفترة: ${data.period}</p>
                
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>التاريخ</th>
                                <th>اليوم</th>
                                <th>الحصة</th>
                                <th>الحالة</th>
                                <th>ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.attendanceRecords.map(record => `
                                <tr>
                                    <td>${new Date(record.date).toLocaleDateString('ar-EG')}</td>
                                    <td>${new Date(record.date).toLocaleDateString('ar-EG', { weekday: 'long' })}</td>
                                    <td>${record.classTime}</td>
                                    <td>
                                        <span class="badge ${record.status === 'present' ? 'bg-success' : 
                                            record.status === 'absent' ? 'bg-danger' : 'bg-warning'}">
                                            ${record.status === 'present' ? 'حاضر' : 
                                            record.status === 'absent' ? 'غائب' : 'متأخر'}
                                        </span>
                                    </td>
                                    <td>${record.notes || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        Swal.fire({
            title: 'تفاصيل الحضور',
            html: html,
            width: '800px',
            confirmButtonText: 'إغلاق'
        });
    }

    // دالة لإشعار ولي الأمر
    function contactParent(studentId) {
        Swal.fire({
            title: 'إشعار ولي الأمر',
            html: `
                <div class="parent-contact-form">
                    <p>سيتم إرسال إشعار لولي الأمر يتضمن تفاصيل غياب الطالب</p>
                    <div class="mb-3">
                        <label for="messageType" class="form-label">نوع الرسالة:</label>
                        <select id="messageType" class="form-select">
                            <option value="warning">تنبيه بالغياب</option>
                            <option value="info">معلومات عن الحضور</option>
                            <option value="meeting">طلب مقابلة</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="customMessage" class="form-label">رسالة مخصصة (اختياري):</label>
                        <textarea id="customMessage" class="form-control" rows="3" 
                            placeholder="يمكنك إضافة رسالة مخصصة هنا..."></textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'إرسال الإشعار',
            cancelButtonText: 'إلغاء',
            preConfirm: () => {
                return {
                    messageType: document.getElementById('messageType').value,
                    customMessage: document.getElementById('customMessage').value
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // هنا يمكنك إضافة كود إرسال الإشعار
                Swal.fire('تم الإرسال', 'تم إرسال الإشعار لولي الأمر بنجاح', 'success');
            }
        });
    }

    // دالة لتصدير البيانات إلى Excel
    async function exportAttendanceToExcel(classId, month) {
        try {
            const response = await fetch(`/api/classes/${classId}/monthly-attendance/export?month=${month}`, {
                headers: getAuthHeaders()
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `غيابات_${classId}_${month}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            Swal.fire('خطأ', 'فشل في تصدير البيانات', 'error');
        }
    }

    // دالة لطباعة التقرير
    function printAttendanceReport(classId, month) {
        const printWindow = window.open('', '_blank');
        // هنا يمكنك إضافة كود لإنشاء صفحة طباعة مخصصة
        printWindow.document.write('<h1>تقرير الغيابات الشهرية</h1>');
        printWindow.print();
    }

    // إضافة زر لعرض الغيابات الشهرية في واجهة إدارة الحصص
    function addMonthlyAttendanceButton() {
        // البحث عن أزرار إدارة الحصص وإضافة زر جديد
        const classActionButtons = document.querySelectorAll('.btn-action');
        
        classActionButtons.forEach(button => {
            if (button.innerHTML.includes('bi-people')) {
                // إنشاء زر جديد للغيابات الشهرية
                const attendanceButton = document.createElement('button');
                attendanceButton.className = 'btn btn-sm btn-outline-warning btn-action ms-1';
                attendanceButton.innerHTML = '<i class="bi bi-calendar-check"></i>';
                attendanceButton.title = 'الغيابات الشهرية';
                attendanceButton.onclick = function() {
                    const classId = this.closest('tr').dataset.classId;
                    loadMonthlyAttendance(classId);
                };
                
                button.parentNode.appendChild(attendanceButton);
            }
        });
    }

    // استدعاء الدالة عند تحميل الصفحة
    document.addEventListener('DOMContentLoaded', function() {
        addMonthlyAttendanceButton();
    });


    // دالة لإضافة زر الغيابات الشهرية في جدول الحصص
    function addAttendanceButtonsToClassesTable() {
        const classesTable = document.getElementById('classesTable');
        if (!classesTable) return;

        const rows = classesTable.getElementsByTagName('tr');
        
        for (let i = 1; i < rows.length; i++) { // تخطي الصف الأول (العناوين)
            const cells = rows[i].getElementsByTagName('td');
            if (cells.length < 7) continue;

            // البحث عن عمود الإجراءات (آخر عمود)
            const actionsCell = cells[cells.length - 1];
            
            // التحقق من عدم وجود الزر مسبقاً
            if (!actionsCell.querySelector('.btn-attendance')) {
                // إنشاء زر الغيابات
                const attendanceBtn = document.createElement('button');
                attendanceBtn.className = 'btn btn-sm btn-outline-warning btn-attendance ms-1';
                attendanceBtn.innerHTML = '<i class="bi bi-calendar-x"></i> غيابات الحصة';
                attendanceBtn.title = 'عرض غيابات الحصة';
                
                // الحصول على معرف الحصة من الصف
                const classId = rows[i].dataset.classId;
                if (classId) {
                    attendanceBtn.onclick = () => showClassAttendance(classId);
                }
                
                actionsCell.appendChild(attendanceBtn);
            }
        }
    }

    // دالة لعرض غيابات الحصة
    async function showClassAttendance(classId) {
        try {
            // إظهار تحميل
            Swal.fire({
                title: 'جاري التحميل',
                html: 'جاري تحميل بيانات غيابات الحصة...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const response = await fetch(`/api/live-classes/class/${classId}/attendance`, {
                headers: getAuthHeaders()
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'فشل في جلب البيانات' }));
                throw new Error(errorData.error || 'فشل في جلب بيانات الغيابات');
            }

            const data = await response.json();
            Swal.close();
            
            displayClassAttendance(data);
            
        } catch (error) {
            console.error('Error loading class attendance:', error);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: error.message || 'حدث خطأ أثناء تحميل بيانات الغيابات',
                confirmButtonText: 'حسناً'
            });
        }
    }
    // دالة لعرض بيانات غيابات الحصة
    function displayClassAttendance(data) {
        const html = `
            <div class="class-attendance-container">
                <div class="card shadow-sm">
                    <div class="card-header bg-warning text-dark">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="mb-1">تقرير غيابات الحصة</h5>
                                <p class="mb-0">${data.class.name} - ${data.class.subject}</p>
                                <p class="mb-0">الفترة: ${data.period}</p>
                            </div>
                            <div class="text-end">
                                <small>إجمالي الحصص: ${data.summary.totalClasses}</small><br>
                                <small>عدد الطلاب: ${data.summary.totalStudents}</small>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        ${data.liveClasses.length === 0 ? `
                            <div class="alert alert-info text-center">
                                <i class="bi bi-info-circle"></i> لا توجد حصص مسجلة لهذه الفترة
                            </div>
                        ` : `
                            <div class="table-responsive">
                                <table class="table table-bordered table-striped">
                                    <thead class="table-dark">
                                        <tr>
                                            <th rowspan="2">اسم الطالب</th>
                                            <th rowspan="2">رقم الطالب</th>
                                            ${data.liveClasses.map(lc => `
                                                <th colspan="3" class="text-center">
                                                    ${new Date(lc.date).toLocaleDateString('ar-EG')}
                                                    <br>
                                                    <small>${lc.startTime}</small>
                                                </th>
                                            `).join('')}
                                            <th rowspan="2">الإجمالي</th>
                                        </tr>
                                        <tr>
                                            ${data.liveClasses.map(() => `
                                                <th class="text-center bg-success text-white">حاضر</th>
                                                <th class="text-center bg-danger text-white">غائب</th>
                                                <th class="text-center bg-warning text-white">متأخر</th>
                                            `).join('')}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${data.students.map(student => `
                                            <tr>
                                                <td>${student.name}</td>
                                                <td>${student.studentId}</td>
                                                ${data.liveClasses.map(lc => {
                                                    const attendance = lc.attendance.find(a => a.student._id === student._id);
                                                    return `
                                                        <td class="text-center ${attendance?.status === 'present' ? 'bg-success text-white' : ''}">
                                                            ${attendance?.status === 'present' ? '✓' : ''}
                                                        </td>
                                                        <td class="text-center ${attendance?.status === 'absent' ? 'bg-danger text-white' : ''}">
                                                            ${attendance?.status === 'absent' ? '✗' : ''}
                                                        </td>
                                                        <td class="text-center ${attendance?.status === 'late' ? 'bg-warning text-white' : ''}">
                                                            ${attendance?.status === 'late' ? '⌚' : ''}
                                                        </td>
                                                    `;
                                                }).join('')}
                                                <td class="text-center fw-bold">
                                                    ${student.statistics.present} حاضر<br>
                                                    ${student.statistics.absent} غائب<br>
                                                    ${student.statistics.late} متأخر
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>

                            <div class="mt-3">
                                <button class="btn btn-success" onclick="exportClassAttendance('${data.class._id}')">
                                    <i class="bi bi-file-earmark-excel"></i> تصدير إلى Excel
                                </button>
                                <button class="btn btn-primary ms-2" onclick="printClassAttendance('${data.class._id}')">
                                    <i class="bi bi-printer"></i> طباعة التقرير
                                </button>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        Swal.fire({
            title: `غيابات الحصة - ${data.class.name}`,
            html: html,
            width: '1400px',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: {
                popup: 'class-attendance-popup'
            }
        });
    }

    // دالة لتصدير بيانات الغيابات
    async function exportClassAttendance(classId) {
        try {
            const response = await fetch(`/api/live-classes/class/${classId}/attendance/export`, {
                headers: getAuthHeaders()
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `غيابات_الحصة_${classId}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error exporting attendance:', error);
            Swal.fire('خطأ', 'فشل في تصدير البيانات', 'error');
        }
    }

    // دالة للطباعة
    function printClassAttendance(classId) {
        window.print();
    }

    // استدعاء الدالة عند تحميل الصفحة وتحديث الجدول
    document.addEventListener('DOMContentLoaded', function() {
        addAttendanceButtonsToClassesTable();
    });

    // إعادة إضافة الأزرار عند تحديث الجدول

    function updateClassesTable(classes) {
        const tableBody = document.getElementById('classesTable');
        if (!tableBody) {
            return;
        }
        
        tableBody.innerHTML = '';
        
        if (classes.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-muted">لا توجد نتائج مطابقة للبحث</td>
                </tr>
            `;
            return;
        }
        
        classes.forEach((cls, index) => {
            const row = document.createElement('tr');
            row.dataset.classId = cls._id; // إضافة dataset للوصول إلى classId
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${cls.name}</td>
                <td>${cls.subject || '-'}</td>
                <td>${getAcademicYearName(cls.academicYear) || 'غير محدد'}</td>
                <td>${cls.teacher?.name || 'غير معين'}</td>
                <td>${cls.students?.length || 0}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary btn-action" onclick="editClass('${cls._id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-action" onclick="deleteClass('${cls._id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success btn-action" onclick="showClassStudents('${cls._id}')">
                        <i class="bi bi-people"></i>
                    </button>
    <button class="btn btn-sm btn-gradient btn-action position-relative" onclick="showClassAttendance('${cls._id}')">
    <i class="bi bi-calendar-check"></i> غيابات
    <span class="badge bg-danger text-white position-absolute top-0 start-50 translate-middle-x new-badge">
        جديد
    </span>
    </button>

    <style>
    .btn-gradient {
        background: linear-gradient(45deg, #ff9800, #ffc107);
        color: #fff;
        border: none;
        box-shadow: 0 0 8px rgba(255, 152, 0, 0.6);
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn-gradient:hover {
        transform: scale(1.05);
        box-shadow: 0 0 12px rgba(255, 152, 0, 0.8);
    }

    .new-badge {
        z-index: 1050;
        font-size: 0.7rem;
        padding: 2px 6px;
    }
    </style>

                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // تحديث العدادات مع التحقق من وجود العناصر
        const classesCountElem = document.getElementById('classesCount');
        const lNumElem = document.getElementById('lNum');
        
        if (classesCountElem) classesCountElem.textContent = classes.length;
        if (lNumElem) lNumElem.textContent = classes.length;
    }


    async function printRegistrationReceipt(studentData, amount = 600) {
        return new Promise((resolve) => {
            // استخدام setTimeout لتجنب حظر الواجهة
            setTimeout(() => {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
                
                const doc = iframe.contentWindow.document;
                
                doc.open();
                doc.write(`
                    <!DOCTYPE html>
                    <html lang="ar" dir="rtl">
                    <head>
                        <meta charset="UTF-8">
                        <title>إيصال تسجيل طالب</title>
                        <style>
                            body { font-family: Arial; margin: 0; padding: 10px; }
                            .receipt-header { text-align: center; margin-bottom: 10px; }
                            .receipt-title { font-size: 18px; font-weight: bold; }
                            .detail-row { display: flex; justify-content: space-between; margin: 5px 0; }
                            .amount { font-size: 20px; font-weight: bold; text-align: center; margin: 10px 0; }
                            @media print { body { width: 80mm; margin: 0; padding: 5px; } }
                        </style>
                    </head>
                    <body>
                        <div class="receipt-header">
                            <div class="receipt-title">إيصال تسجيل طالب</div>
                            <div>القناديل سكول</div>
                        </div>
                        
                        <div class="detail-row">
                            <span>اسم الطالب:</span>
                            <span>${studentData.name}</span>
                        </div>
                        <div class="detail-row">
                            <span>رقم الطالب:</span>
                            <span>${studentData.studentId}</span>
                        </div>
                        <div class="detail-row">
                            <span>المبلغ:</span>
                            <span>${amount} د.ج</span>
                        </div>
                        
                        <div class="amount">${amount} دينار جزائري</div>
                        
                        <script>
                            window.onload = function() {
                                setTimeout(() => {
                                    window.print();
                                    setTimeout(() => {
                                        window.close();
                                    }, 100);
                                }, 100);
                            };
                        </script>
                    </body>
                    </html>
                `);
                doc.close();
                
                // حل سريع دون انتظار الطباعة الكاملة
                setTimeout(() => {
                    document.body.removeChild(iframe);
                    resolve();
                }, 1000);
            }, 100);
        });
    }


    function simulateCardScan() {
        setInterval(() => {
        if (Math.random() > 0.7) { // 30% chance to detect a card
            const cardUid = Math.random().toString(36).substring(2, 10).toUpperCase();
            document.getElementById('rfid-result').innerHTML = `
            <div class="alert alert-success">
                <h5>تم اكتشاف بطاقة!</h5>
                <p>رقم البطاقة: <strong>${cardUid}</strong></p>
                <button class="btn btn-sm btn-primary mt-2">عرض معلومات الطالب</button>
            </div>
            `;
        }
        }, 3000);
    }

    // دالة محدثة لتحديث العدادات
    async function updateDashboardCounters() {
        try {
            // التحقق من وجود العناصر قبل الوصول إليها
            const studentsCountElem = document.getElementById('studentsCount');
            const teachersCountElem = document.getElementById('teachersCount');
            const classesCountElem = document.getElementById('classesCount');
            const paymentsCountElem = document.getElementById('paymentsCount');

            // إذا لم توجد العناصر، توقف عن التنفيذ
            if (!studentsCountElem || !teachersCountElem || !classesCountElem || !paymentsCountElem) {
                return;
            }

            // جلب البيانات
            const [studentsRes, teachersRes, classesRes, paymentsRes] = await Promise.all([
                fetch('/api/students/count').catch(err => ({ ok: false })),
                fetch('/api/teachers/count').catch(err => ({ ok: false })),
                fetch('/api/classes/count').catch(err => ({ ok: false })),
                fetch('/api/payments/count').catch(err => ({ ok: false }))
            ]);

            // تحديث العدادات مع التحقق من صحة الاستجابة
            if (studentsRes.ok) {
                const data = await studentsRes.json();
                studentsCountElem.textContent = data.count || 0;
            }

            if (teachersRes.ok) {
                const data = await teachersRes.json();
                teachersCountElem.textContent = data.count || 0;
            }

            if (classesRes.ok) {
                const data = await classesRes.json();
                classesCountElem.textContent = data.count || 0;
            }

            if (paymentsRes.ok) {
                const data = await paymentsRes.json();
                paymentsCountElem.textContent = data.count || 0;
            }

        } catch (error) {
            console.error('Error updating dashboard counters:', error);
        }
    }

    function loadStudentsTable() {
        // يمكنك تنفيذ هذه الدالة أو استبدالها بـ loadStudents()
        loadStudents();
    }


    function loadSectionData(sectionId) {
        // In a real app, this would fetch data from the server
        
        switch(sectionId) {
        case 'dashboard':
            updateDashboardCounters();
            break;
        case 'students':
            loadStudents();        
            break;
        case 'teachers':
            loadTeachersTable();
            break;
        case 'classes':
            loadClassesTable();
            break;
        case 'classrooms':
            loadClassroomsTable();
            break;
        case 'payments':
            loadPaymentsTable();
            break;
        case 'cards':
            loadCardsTable();        
            break;
        case 'student-accounts':
            loadStudentAccountsTable();
            break;
        case 'registration-requests':
            loadRegistrationRequestsTable();
            break;
        case 'live-classes':
            loadLiveClassesTable();
            break;
        }
    }
    async function assignCard() {
        const studentId = document.getElementById('cardStudentSelect').value;
        const cardUid = document.getElementById('cardUid').value;
        
        if (!studentId || !cardUid) {
            Swal.fire('خطأ', 'يجب اختيار طالب ومسح البطاقة', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/cards', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    uid: cardUid,
                    student: studentId
                })
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            if (response.ok) {
                Swal.fire('نجاح', 'تم تعيين البطاقة للطالب بنجاح', 'success');
                document.getElementById('cardUid').value = '';
                document.getElementById('cardStudentSelect').value = '';
                loadCards();
            } else {
                const error = await response.json();
                Swal.fire('خطأ', error.error || 'حدث خطأ أثناء تعيين البطاقة', 'error');
            }
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error');
        }
    }
    socket.on('unknown-card', (data) => {
        const rfidResult = document.getElementById('rfid-result');
        rfidResult.innerHTML = `
            <div class="alert alert-warning text-center">
                <h4>بطاقة غير معروفة</h4>
                <p>UID: ${data.uid}</p>
                <button class="btn btn-primary" onclick="showAssignCardModal('${data.uid}')">
                    تعيين البطاقة لطالب
                </button>
            </div>
        `;
    });

    socket.on('student-detected', (data) => {
        const rfidResult = document.getElementById('rfid-result');
        rfidResult.innerHTML = `
            <div class="alert alert-success text-center">
                <h4>تم التعرف على الطالب</h4>
                <p>${data.student.name} (${data.student.studentId})</p>
                <p>البطاقة: ${data.card.uid}</p>
            </div>
        `;
    });
    window.showAssignCardModal = function(uid) {
        // First try to switch to cards section
        document.getElementById('cards-link').click();
        
        // Wait a bit for the section to load
        setTimeout(() => {
            document.getElementById('cardUid').value = uid;
            document.getElementById('cardStudentSelect').focus();
            
            // Also populate in gate interface if available
            const manualInput = document.getElementById('manualRFIDInput');
            if (manualInput) {
                manualInput.value = uid;
            }
            
            Swal.fire({
                title: 'تم مسح البطاقة',
                text: `رقم البطاقة: ${uid}`,
                icon: 'success',
                timer: 2000
            });
        }, 500);
    };
    async function updateDashboardStats() {
        try {
        // جلب الإيرادات (مدفوعات الطلاب + رسوم التسجيل)
        const paymentsResponse = await fetch(`${API_BASE}/payments?status=paid`, {
            headers: {
            'Authorization': `Bearer ${authToken}`
            }
        });
        
        // جلب رسوم التسجيل المدفوعة
        const schoolFeesResponse = await fetch(`${API_BASE}/accounting/school-fees?status=paid`, {
            headers: {
            'Authorization': `Bearer ${authToken}`
            }
        });
        
        // جلب المصروفات
        const expensesResponse = await fetch(`${API_BASE}/accounting/expenses?status=paid`, {
            headers: {
            'Authorization': `Bearer ${authToken}`
            }
        });
        
        let totalIncome = 0;
        let totalExpenses = 0;
        
        if (paymentsResponse.ok) {
            const payments = await paymentsResponse.json();
            totalIncome = payments.reduce((sum, payment) => sum + payment.amount, 0);
        }
        
        if (schoolFeesResponse.ok) {
            const schoolFees = await schoolFeesResponse.json();
            totalIncome += schoolFees.reduce((sum, fee) => sum + fee.amount, 0);
        }
        
        if (expensesResponse.ok) {
            const expenses = await expensesResponse.json();
            totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        }
        
        const netProfit = totalIncome - totalExpenses;
        
        // تحديث واجهة المستخدم
        document.getElementById('totalIncome').textContent = `${totalIncome.toLocaleString()} د.ج`;
        document.getElementById('totalExpenses').textContent = `${totalExpenses.toLocaleString()} د.ج`;
        document.getElementById('netProfit').textContent = `${netProfit.toLocaleString()} د.ج`;
        
        // جلب عدد المدفوعات المعلقة
        const pendingResponse = await fetch(`${API_BASE}/payments?status=pending`, {
            headers: {
            'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (pendingResponse.ok) {
            const pendingPayments = await pendingResponse.json();
            document.getElementById('pendingPayments').textContent = pendingPayments.length || 0;
        }
        
        } catch (error) {
        console.error('Error updating dashboard stats:', error);
        }
    }
    function setupRFIDInputHandling() {
        // Handle manual RFID input in gate interface
        const manualInput = document.getElementById('manualRFIDInput');
        if (manualInput) {
            manualInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const uid = this.value.trim();
                    if (uid) {
                        processRFIDInput(uid);
                        this.value = ''; // Clear input after processing
                    }
                }
            });
        }

        // Handle card scanner input (main dashboard input)
        const cardInput = document.getElementById('cardInput');
        if (cardInput) {
            cardInput.addEventListener('input', function(e) {
                // Auto-process when a complete card number is entered
                const uid = this.value.trim();
                if (uid.length >= 8) { // Adjust based on your card format
                    setTimeout(() => {
                        processRFIDInput(uid);
                        this.value = ''; // Clear input after processing
                    }, 100);
                }
            });
        }

        // Handle card assignment input
        const cardUidInput = document.getElementById('cardUid');
        if (cardUidInput) {
            cardUidInput.addEventListener('input', function(e) {
                const uid = this.value.trim();
                if (uid.length >= 8) {
                    // Just populate the field, don't process automatically
                }
            });
        }

        // Global keyboard listener for RFID simulation
        document.addEventListener('keydown', function(event) {
            // If we're on the login page, don't capture RFID input
            const loginSection = document.getElementById('login-section');
            if (loginSection && loginSection.style.display !== 'none') {
                return;
            }
            
            const currentTime = Date.now();
            const key = event.key;
            
            // Reset buffer if too much time has passed since last key
            if (currentTime - lastKeyTime > 100) {
                rfidInputBuffer = '';
            }
            
            lastKeyTime = currentTime;
            
            // If Enter is pressed, process the RFID input
            if (key === 'Enter') {
                event.preventDefault();
                
                if (rfidInputBuffer.length > 0) {
                    processRFIDInput(rfidInputBuffer);
                    rfidInputBuffer = '';
                }
            } 
            // If it's a number, add to buffer
            else if (key >= '0' && key <= '9') {
                rfidInputBuffer += key;
                
                // Update ALL card input fields
                const inputs = [
                    document.getElementById('cardInput'),
                    document.getElementById('manualRFIDInput'),
                    document.getElementById('cardUid')
                ];
                
                inputs.forEach(input => {
                    if (input) {
                        input.value = rfidInputBuffer;
                    }
                });
            }
        });
    }

    async function handleRFIDScan(uid) {
        try {
            
            // Show loading state
            const rfidResult = document.getElementById('rfid-result') || 
                            document.getElementById('gate-rfid-result');
            
            if (rfidResult) {
                rfidResult.innerHTML = `
                    <div class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">جاري المعالجة...</span>
                        </div>
                        <p>جاري التعرف على البطاقة: ${uid}</p>
                    </div>
                `;
            }

            // Check if this is a known card
            const response = await fetch(`/api/cards/uid/${uid}`, {
                headers: getAuthHeaders()
            });


            if (response.status === 404) {
                // Unknown card
                if (rfidResult) {
                    rfidResult.innerHTML = `
                        <div class="alert alert-warning text-center">
                            <h4>بطاقة غير معروفة</h4>
                            <p>رقم البطاقة: ${uid}</p>
                            <button class="btn btn-primary mt-2" onclick="showAssignCardModal('${uid}')">
                                تعيين البطاقة لطالب
                            </button>
                        </div>
                    `;
                }
                return;
            }

            if (response.status === 401) {
                logout();
                return;
            }

            const cardData = await response.json();
            
            if (cardData.student) {
                // Show student info
                if (rfidResult) {
                    rfidResult.innerHTML = `
                        <div class="alert alert-success text-center">
                            <h4>تم التعرف على الطالب</h4>
                            <p>${cardData.student.name} (${cardData.student.studentId})</p>
                            <p>رقم البطاقة: ${uid}</p>
                            <div class="mt-3">
                                <button class="btn btn-info me-2" onclick="showStudentDetails('${cardData.student._id}')">
                                    <i class="bi bi-person-circle me-1"></i>عرض المعلومات
                                </button>
                                <button class="btn btn-success" onclick="handleGateAttendance('${uid}')">
                                    <i class="bi bi-check-circle me-1"></i>تسجيل الحضور
                                </button>
                            </div>
                        </div>
                    `;
                }
                
                // Auto-process attendance if we're in gate mode
                const gateInterface = document.getElementById('gate-interface');
                if (gateInterface && gateInterface.classList.contains('active')) {
                    setTimeout(() => handleGateAttendance(uid), 1500);
                }
            }
        } catch (err) {
            console.error('Error processing RFID:', err);
            const rfidResult = document.getElementById('rfid-result') || 
                            document.getElementById('gate-rfid-result');
            if (rfidResult) {
                rfidResult.innerHTML = `
                    <div class="alert alert-danger text-center">
                        <h4>خطأ في المعالجة</h4>
                        <p>حدث خطأ أثناء معالجة البطاقة</p>
                        <p><small>${err.message}</small></p>
                    </div>
                `;
            }
        }
    }
    // Add this function to debug card issues
    async function debugCard(uid) {
        try {
            
            // Check if card exists
            const cardResponse = await fetch(`/api/cards/uid/${uid}`, {
                headers: getAuthHeaders()
            });
            
            
            if (cardResponse.ok) {
                const cardData = await cardResponse.json();
                
                if (cardData.student) {
                    // Check student details
                    const studentResponse = await fetch(`/api/students/${cardData.student._id}`, {
                        headers: getAuthHeaders()
                    });
                    
                    if (studentResponse.ok) {
                        const student = await studentResponse.json();
                    }
                }
            }
        } catch (err) {
            console.error('Debug error:', err);
        }
    }

    // Call this when you need to debug a specific card
    // debugCard('0016130604');

    // Function to handle manual RFID input
    async function handleManualRFIDScan(uid) {
        try {
            // Show loading state
            const rfidResult = document.getElementById('rfid-result');
            rfidResult.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">جاري المعالجة...</span>
                    </div>
                    <p>جاري التعرف على البطاقة: ${uid}</p>
                </div>
            `;

            // Check if this is a known card
            const response = await fetch(`/api/cards/uid/${uid}`, {
                headers: getAuthHeaders()
            });

            if (response.status === 404) {
                // Unknown card
                rfidResult.innerHTML = `
                    <div class="alert alert-warning text-center">
                        <h4>بطاقة غير معروفة</h4>
                        <p>UID: ${uid}</p>
                        <button class="btn btn-primary" onclick="showAssignCardModal('${uid}')">
                            تعيين البطاقة لطالب
                        </button>
                    </div>
                `;
                return;
            }

            if (response.status === 401) {
                logout();
                return;
            }

            const cardData = await response.json();
            
            if (cardData.student) {
                // Show student info
                rfidResult.innerHTML = `
                    <div class="alert alert-success text-center">
                        <h4>تم التعرف على الطالب</h4>
                        <p>${cardData.student.name} (${cardData.student.studentId})</p>
                        <p>البطاقة: ${uid}</p>
                        <div class="mt-3">
                            <button class="btn btn-info me-2" onclick="showStudentDetails('${cardData.student._id}')">
                                <i class="bi bi-person-circle me-1"></i>عرض المعلومات
                            </button>
                            <button class="btn btn-success" onclick="handleGateAttendance('${uid}')">
                                <i class="bi bi-check-circle me-1"></i>تسجيل الحضور
                            </button>
                        </div>
                    </div>
                `;
                
                // Auto-process attendance if we're in gate mode
                if (document.getElementById('gate-interface').classList.contains('active')) {
                    setTimeout(() => handleGateAttendance(uid), 1500);
                }
            }
        } catch (err) {
            console.error('Error processing RFID:', err);
            const rfidResult = document.getElementById('rfid-result');
            rfidResult.innerHTML = `
                <div class="alert alert-danger text-center">
                    <h4>خطأ في المعالجة</h4>
                    <p>حدث خطأ أثناء معالجة البطاقة</p>
                </div>
            `;
        }
    }

    // Function to handle attend
    // 
    // ance at gate




    // دالة للتحقق إذا كان الطالب متأخراً
    function checkIfLate(classStartTime, maxDelayMinutes = 30) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes(); // الوقت الحالي بالدقائق
        
        // تحويل وقت بداية الحصة إلى دقائق
        const [startHours, startMinutes] = classStartTime.split(':').map(Number);
        const classStartMinutes = startHours * 60 + startMinutes;
        
        // حساب وقت التأخير المسموح
        const allowedLateTime = classStartMinutes + maxDelayMinutes;
        
        return currentTime > allowedLateTime;
    }

    // دالة للتحقق إذا انتهت الحصة
    function checkIfClassEnded(classEndTime) {
        if (!classEndTime) return false;
        
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const [endHours, endMinutes] = classEndTime.split(':').map(Number);
        const classEndMinutes = endHours * 60 + endMinutes;
        
        return currentTime > classEndMinutes;
    }


    async function handleGateAttendance(uid) {
        try {
            // الحصول على معلومات البطاقة
            const cardResponse = await fetch(`/api/cards/uid/${uid}`, {
                headers: getAuthHeaders()
            });
    
            if (cardResponse.status === 404) {
                throw new Error('البطاقة غير معروفة');
            }
    
            if (cardResponse.status === 401) {
                logout();
                return;
            }
    
            const cardData = await cardResponse.json();
            
            if (!cardData.student) {
                throw new Error('البطاقة غير مرتبطة بأي طالب');
            }
    
            // البحث عن جميع الحصص الجارية
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            const classesResponse = await fetch(`/api/live-classes?status=ongoing&date=${today.toISOString()}`, {
                headers: getAuthHeaders()
            });
    
            if (classesResponse.status === 401) {
                logout();
                return;
            }
    
            const liveClasses = await classesResponse.json();
            
            if (liveClasses.length === 0) {
                await handleNoOngoingClasses(cardData.student._id);
                return;
            }
    
            // البحث عن الحصة التي يكون الطالب مسجلاً فيها
            let targetClass = null;
            
            for (const liveClass of liveClasses) {
                // التحقق مما إذا كان الطالب مسجلاً في هذه الحصة
                const classResponse = await fetch(`/api/classes/${liveClass.class._id}`, {
                    headers: getAuthHeaders()
                });
                
                if (classResponse.ok) {
                    const classData = await classResponse.json();
                    const isEnrolled = classData.students.some(student => 
                        student._id === cardData.student._id || student === cardData.student._id
                    );
                    
                    if (isEnrolled) {
                        targetClass = liveClass;
                        break;
                    }
                }
            }
    
            if (!targetClass) {
                // الطالب غير مسجل في أي حصة جارية
                showGateResult('not_enrolled', {
                    student: cardData.student,
                    availableClasses: liveClasses.map(cls => cls.class.name)
                });
                return;
            }
    
            // تحديد حالة الحضور (حاضر/متأخر)
            let attendanceStatus = 'present';
            if (checkIfLate(targetClass.startTime, 30)) {
                attendanceStatus = 'late';
            }
    
            // تسجيل الحضور
            const attendanceResponse = await fetch(`/api/live-classes/${targetClass._id}/attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    studentId: cardData.student._id,
                    status: attendanceStatus,
                    method: 'gate',
                    late: attendanceStatus === 'late'
                })
            });
    
            const responseData = await attendanceResponse.json();
    
            if (attendanceResponse.ok) {
                // عرض رسالة النجاح
                const statusMessage = attendanceStatus === 'late' ? 
                    'تم تسجيل الحضور (متأخر)' : 'تم تسجيل الحضور بنجاح';
                
                const statusClass = attendanceStatus === 'late' ? 'warning' : 'success';
                
                const rfidResult = document.getElementById('gateRfidResult') || 
                                document.getElementById('rfid-result');
                
                if (rfidResult) {
                    rfidResult.innerHTML = `
                        <div class="alert alert-${statusClass} text-center">
                            <h4>${statusMessage}</h4>
                            <p>الطالب: ${cardData.student.name}</p>
                            <p>الحصة: ${targetClass.class.name}</p>
                            <p>الحالة: ${attendanceStatus === 'late' ? 'متأخر' : 'حاضر'}</p>
                            <p>الوقت: ${new Date().toLocaleTimeString('ar-EG')}</p>
                        </div>
                    `;
                }
                
                // تحديث الإحصائيات
                loadGateStatistics();
                
                // إضافة إلى السجلات الحديثة
                addToRecentScans('student', {
                    student: cardData.student,
                    class: targetClass.class,
                    status: attendanceStatus,
                    timestamp: new Date().toISOString()
                });
                
            } else {
                throw new Error(responseData.error || responseData.message || 'فشل في تسجيل الحضور');
            }
            
        } catch (err) {
            console.error('Error handling gate attendance:', err);
            
            const rfidResult = document.getElementById('gateRfidResult') || 
                            document.getElementById('rfid-result');
            
            if (rfidResult) {
                rfidResult.innerHTML = `
                    <div class="alert alert-danger text-center">
                        <h4>خطأ في تسجيل الحضور</h4>
                        <p>${err.message || 'حدث خطأ غير متوقع'}</p>
                    </div>
                `;
            }
        }
    }
    // دالة لتسجيل الغائبين تلقائياً عند انتهاء الحصة
    async function autoMarkAbsentOnClassEnd(liveClassId) {
        try {
            const response = await fetch(`/api/live-classes/${liveClassId}/auto-mark-absent`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                
                // إشعار المدير/الأستاذ
                if (result.absentCount > 0) {
                    notifyAbsentStudents(result.absentCount, result.className);
                }
            }
        } catch (err) {
            console.error('Error in auto-marking absent:', err);
        }
    }

    // دالة للإشعار بالغائبين
    function notifyAbsentStudents(absentCount, className) {
        // يمكن تطوير هذه الدالة لإرسال إشعارات عبر البريد أو الرسائل
        
        // عرض إشعار للمستخدم
        if (absentCount > 0) {
            Swal.fire({
                icon: 'info',
                title: 'تسجيل الغائبين',
                html: `تم تسجيل <b>${absentCount}</b> طالب كغائبين في حصة <b>${className}</b> تلقائياً`,
                timer: 5000,
                showConfirmButton: false
            });
        }
    }


    // Function to show student details
    async function showStudentDetails(studentId, event = null) {
        if (event) event.stopPropagation();

        try {
            // جلب بيانات الطالب
            const studentResponse = await fetch(`/api/students/${studentId}`, {
                headers: getAuthHeaders()
            });

            if (studentResponse.status === 401) {
                logout();
                return;
            }

            const student = await studentResponse.json();

            // جلب جميع الحصص
            const classesResponse = await fetch('/api/classes', {
                headers: getAuthHeaders()
            });
            const allClasses = await classesResponse.json();

            // جلب جميع المدفوعات للطالب
            const paymentsResponse = await fetch(`/api/payments?student=${studentId}`, {
                headers: getAuthHeaders()
            });
            let payments = [];
            if (paymentsResponse.ok) {
                payments = await paymentsResponse.json();
            }

            // تجميع المدفوعات حسب الحصة
            const paymentsByClass = {};
            payments.forEach(payment => {
                if (!paymentsByClass[payment.class._id]) {
                    paymentsByClass[payment.class._id] = {
                        class: payment.class,
                        payments: []
                    };
                }
                paymentsByClass[payment.class._id].payments.push(payment);
            });

            // إنشاء HTML لعرض الحصص والمدفوعات مع خيارات التحديد
            let classesHtml = '';
            Object.values(paymentsByClass).forEach(({ class: cls, payments }) => {
                classesHtml += `
                    <div class="card mb-3">
                        <div class="card-header bg-light d-flex justify-content-between align-items-center">
                            <strong>${cls.name}</strong> (${cls.subject}) - ${getAcademicYearName(cls.academicYear)}
                            <div>
                                <input type="checkbox" class="form-check-input select-all-class" 
                                    data-class-id="${cls._id}" onchange="toggleSelectAllPayments('${cls._id}', this.checked)">
                                <label class="form-check-label ms-1">تحديد الكل</label>
                            </div>
                        </div>
                        <div class="card-body p-2">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>تحديد</th>
                                        <th>الشهر</th>
                                        <th>المبلغ</th>
                                        <th>الحالة</th>
                                        <th>تاريخ الدفع</th>
                                        <th>إجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${payments.map(payment => `
                                        <tr>
                                            <td>
                                                ${payment.status !== 'paid' ? `
                                                    <input type="checkbox" class="multi-pay-checkbox form-check-input" 
                                                        data-payment='${JSON.stringify(payment)}'
                                                        data-class-id="${cls._id}" 
                                                        onchange="updateSelectAllState('${cls._id}')">
                                                ` : ''}
                                            </td>
                                            <td>${payment.month}</td>
                                            <td>${payment.amount} د.ج</td>
                                            <td>
                                                <span class="badge ${payment.status === 'paid' ? 'bg-success' : 'bg-warning'}">
                                                    ${payment.status === 'paid' ? 'مسدد' : 'قيد الانتظار'}
                                                </span>
                                            </td>
                                            <td>${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('ar-EG') : '-'}</td>
                                            <td>
                        ${payment.status === 'paid' ? `
                        <button class="btn btn-sm btn-info btn-action" onclick="reprintPaymentReceipt('${payment._id}')">
                            <i class="bi bi-printer"></i>
                        </button>
                            <button class="btn btn-sm btn-outline-danger btn-action" onclick="deletePayment('${payment._id}')">
            <i class="bi bi-trash"></i>
        </button>

            <button class="btn btn-sm btn-warning btn-action" onclick="cancelPayment('${payment._id}')" title="إلغاء الدفع">
        <i class="bi bi-x-circle"></i>
    </button>


        

                        ` : ''}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            });

            // زر دفع وطباعة المحدد
            const multiPayBtn = `
                <div class="mt-3 text-center">
                    <button class="btn btn-primary" onclick="payAndPrintSelectedPayments('${studentId}')">
                        <i class="bi bi-cash-coin me-2"></i> دفع وطباعة المحدد
                    </button>
                </div>
            `;

            // عرض النتائج في modal
            Swal.fire({
                title: `تفاصيل الطالب: ${student.name}`,
                html: `
                    <div>
                        <div class="mb-3">
                            <strong>الاسم:</strong> ${student.name}<br>
                            <strong>رقم الطالب:</strong> ${student.studentId}<br>
                            <strong>ولي الأمر:</strong> ${student.parentName || '-'}<br>
                            <strong>هاتف ولي الأمر:</strong> ${student.parentPhone || '-'}<br>
                            <strong>السنة الدراسية:</strong> ${getAcademicYearName(student.academicYear) || '-'}
                        </div>
                        <h5>الحصص والمدفوعات</h5>
                        ${classesHtml}
                        ${multiPayBtn}
                    </div>
                `,
                width: '900px',
                showConfirmButton: false,
                showCloseButton: true
            });

        } catch (err) {
            console.error('Error loading student details:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل تفاصيل الطالب', 'error');
        }
    }

    // دالة لتحديد/إلغاء تحديد جميع مدفوعات حصة معينة
    function toggleSelectAllPayments(classId, isChecked) {
        const checkboxes = document.querySelectorAll(`.multi-pay-checkbox[data-class-id="${classId}"]`);
        checkboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
        });
    }

    // دالة لتحديث حالة زر "تحديد الكل"
    function updateSelectAllState(classId) {
        const checkboxes = document.querySelectorAll(`.multi-pay-checkbox[data-class-id="${classId}"]`);
        const selectAllCheckbox = document.querySelector(`.select-all-class[data-class-id="${classId}"]`);
        
        const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
        const someChecked = Array.from(checkboxes).some(checkbox => checkbox.checked);
        
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;
    }

    // دفع دفعة واحدة
    // تعديل دالة دفع الدفعة الواحدة لاستخدام المبلغ المحدث
    window.paySinglePayment = async function(paymentId) {
        try {
            // أولاً، الحصول على أحدث بيانات الدفعة
            const paymentResponse = await fetch(`/api/payments/${paymentId}`, {
                headers: getAuthHeaders()
            });
            
            if (!paymentResponse.ok) {
                throw new Error('فشل في جلب بيانات الدفعة');
            }
            
            const payment = await paymentResponse.json();
            
            // استخدام المبلغ الحالي للدفعة
            const response = await fetch(`/api/payments/${paymentId}/pay`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ 
                    paymentDate: new Date().toISOString().split('T')[0], 
                    paymentMethod: 'cash',
                    amount: payment.amount // استخدام المبلغ المحدث
                })
            });
            
            if (response.ok) {
                const updatedPayment = await response.json();
                await printPaymentReceiptToThermalPrinter(updatedPayment);
                Swal.fire('نجاح', 'تم دفع الدفعة وطباعتها', 'success');
                // إعادة تحميل التفاصيل
                showStudentDetails(updatedPayment.student._id);
            } else {
                throw new Error('فشل في دفع الدفعة');
            }
        } catch (err) {
            Swal.fire('خطأ', err.message, 'error');
        }
    };
    // دفع وطباعة دفعات متعددة
    // دفع وطباعة دفعات متعددة
    async function payAndPrintSelectedPayments() {
        try {
            // الحصول على جميع المدفوعات المحددة
            const selectedCheckboxes = document.querySelectorAll('.multi-pay-checkbox:checked');
            
            if (selectedCheckboxes.length === 0) {
                Swal.fire('تحذير', 'يرجى اختيار دفعة واحدة على الأقل', 'warning');
                return;
            }
            
            // استخراج بيانات المدفوعات
            const selectedPayments = Array.from(selectedCheckboxes).map(checkbox => {
                return JSON.parse(checkbox.dataset.payment);
            });
            
            // دفع كل دفعة مع المبلغ المحدث
            for (const payment of selectedPayments) {
                // الحصول على أحدث بيانات الدفعة من الخادم
                const paymentResponse = await fetch(`/api/payments/${payment._id}`, {
                    headers: getAuthHeaders()
                });
                
                if (paymentResponse.ok) {
                    const latestPayment = await paymentResponse.json();
                    
                    // دفع الدفعة بالمبلغ المحدث
                    await fetch(`/api/payments/${payment._id}/pay`, {
                        method: 'PUT',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({
                            paymentDate: new Date().toISOString().split('T')[0],
                            paymentMethod: 'cash',
                            amount: latestPayment.amount
                        })
                    });
                }
            }        
            // Get payment details for printing
            const response = await fetch('/api/payments/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ paymentIds: selectedPayments })
            });
            
            if (!response.ok) {
                throw new Error('فشل في تحميل تفاصيل الدفعات');
            }
            
            const payments = await response.json();
            
            // Generate receipts
            const receipts = payments.map(payment => {
                return {
                    studentName: payment.student?.name || 'غير معروف',
                    className: payment.class?.name || 'غير معروف',
                    month: payment.month,
                    amount: payment.amount,
                    invoiceNumber: payment.invoiceNumber,
                    paymentDate: payment.paymentDate
                };
            });
            
            // Print receipts
            await printMultiPaymentReceipt({
                studentName: receipts[0].studentName,
                studentId: payments[0].student?.studentId || 'غير معروف',
                payments: receipts,
                paymentMethod: 'cash',
                schoolContact: "الهاتف: 0559581957 | البريد: info@redox.com"
            });
            
            // Show success message
            Swal.fire({
                icon: 'success',
                title: 'تمت العملية بنجاح',
                html: `تم دفع وطباعة ${selectedPayments.length} دفعة بنجاح`,
                confirmButtonText: 'حسناً'
            });
            
            // Refresh student details
            if (payments.length > 0 && payments[0].student) {
                showStudentDetails(payments[0].student._id);
            }
            
        } catch (error) {
            console.error('Error paying and printing payments:', error);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: 'حدث خطأ أثناء معالجة الدفعات: ' + error.message,
                confirmButtonText: 'حسناً'
            });
        }
    }


    // Add error handling and retry logic
    async function printWithRetry(printFunction, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
        try {
            return await printFunction();
        } catch (error) {
            console.error(`Print attempt ${i + 1} failed:`, error);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        }
    }

    // Create a unified RFID service
    const rfidService = {
        buffer: '',
        lastKeyTime: Date.now(),
        
        processInput: function(key) {
        const currentTime = Date.now();
        
        // Reset buffer if too much time has passed
        if (currentTime - this.lastKeyTime > 100) {
            this.buffer = '';
        }
        
        this.lastKeyTime = currentTime;
        
        if (key === 'Enter') {
            this.processRFID(this.buffer);
            this.buffer = '';
        } else if (key >= '0' && key <= '9') {
            this.buffer += key;
        }
        },
        
        processRFID: async function(uid) {
        // Unified RFID processing logic
        }
    };
    // Add payment validation
    function validatePayment(paymentData) {
        const errors = [];
        
        if (!paymentData.amount || paymentData.amount <= 0) {
        errors.push('المبلغ غير صالح');
        }
        
        if (!paymentData.studentId) {
        errors.push('يجب تحديد طالب');
        }
        
        if (!paymentData.month) {
        errors.push('يجب تحديد شهر');
        }
        
        return errors;
    }
    // Add session timeout
    let inactivityTimer;

    function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        if (currentUser) {
        Swal.fire({
            title: 'انتهت الجلسة',
            text: 'تم تسجيل الخروج بسبب عدم النشاط',
            icon: 'warning'
        }).then(() => {
            logout();
        });
        }
    }, 30 * 60 * 1000); // 30 minutes
    }

    // Reset timer on user activity
    document.addEventListener('mousemove', resetInactivityTimer);
    document.addEventListener('keypress', resetInactivityTimer);
    // Use document fragments for large table updates
    function renderLargeTable(data, renderRow) {
        const fragment = document.createDocumentFragment();
        
        data.forEach((item, index) => {
        const row = renderRow(item, index);
        fragment.appendChild(row);
        });
        
        tableBody.innerHTML = '';
        tableBody.appendChild(fragment);
    }
    // Create error handling utility
    const errorHandler = {
        showError: function(message, error) {
        console.error(message, error);
        
        // Don't show technical errors to users in production
        const userMessage = process.env.NODE_ENV === 'production' 
            ? 'حدث خطأ، يرجى المحاولة مرة أخرى' 
            : `${message}: ${error.message}`;
        
        Swal.fire('خطأ', userMessage, 'error');
        },
        
        handleApiError: function(response) {
        if (response.status === 401) {
            logout();
            return true;
        }
        return false;
        }
    };

    // Generic modal form handler
    async function handleFormSubmit(formId, endpoint, method = 'POST', successMessage) {
        const form = document.getElementById(formId);
        const formData = new FormData(form);
        
        try {
        const response = await fetch(endpoint, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(Object.fromEntries(formData))
        });
        
        if (response.ok) {
            Swal.fire('نجاح', successMessage, 'success');
            form.reset();
            return true;
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
        } catch (error) {
        errorHandler.showError('حدث خطأ', error);
        return false;
        }
    }

    function drawMultiPaymentReceipt(paymentsData) {
        const canvas = document.createElement("canvas");
        
        // Calculate dynamic height based on number of payments
        const baseHeight = 600;
        const tableHeight = paymentsData.payments.length * 40;
        const qrCodeHeight = 120;
        canvas.width = 580;
        canvas.height = baseHeight + tableHeight + qrCodeHeight + 50;
        
        const ctx = canvas.getContext("2d");
        
        // Background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // School logo
        const logoImg = new Image();
        logoImg.onload = function() {
            // Draw logo at top
            ctx.drawImage(logoImg, canvas.width - 100, 10, 80, 80);
            drawReceiptContent(); // Call the rest of content after image loads
        };
        logoImg.onerror = function() {
            // If image fails to load, continue without it
            drawReceiptContent();
        };
        logoImg.src = 'assets/9anadil.jpg';
        
        function drawReceiptContent() {
            // Main title with larger font
            ctx.fillStyle = "#000000";
            ctx.textAlign = "center";
            ctx.font = "bold 32px Arial";
            ctx.fillText("القناديل الدهبية سكول", canvas.width / 2, 50);
            
            ctx.font = "bold 24px Arial";
            ctx.fillText("إيصال دفع متعدد الحصص", canvas.width / 2, 90);
            
            // Decorative line
            ctx.beginPath();
            ctx.moveTo(20, 110);
            ctx.lineTo(canvas.width - 20, 110);
            ctx.stroke();
            
            // Student information
            ctx.textAlign = "right";
            ctx.font = "bold 20px Arial";
            let yPosition = 150;
            
            ctx.fillText(`الطالب: ${paymentsData.studentName}`, canvas.width - 20, yPosition);
            yPosition += 30;
            
            ctx.fillText(`رقم الطالب: ${paymentsData.studentId}`, canvas.width - 20, yPosition);
            yPosition += 40;
            
            // Payments section title
            ctx.font = "bold 22px Arial";
            ctx.fillText("تفاصيل الحصص المدفوعة", canvas.width - 20, yPosition);
            yPosition += 30;
            
            // Payments table
            const tableTop = yPosition;
            const columnWidths = [200, 150, 150]; // Column widths: Class name, Month, Amount
            
            // Table header with background
            ctx.fillStyle = "#f8f9fa";
            ctx.fillRect(20, tableTop, canvas.width - 40, 40);
            
            ctx.fillStyle = "#000000";
            ctx.font = "bold 18px Arial";
            ctx.textAlign = "center";
            ctx.fillText("اسم الحصة", 20 + columnWidths[0]/2, tableTop + 25);
            ctx.fillText("الشهر", 20 + columnWidths[0] + columnWidths[1]/2, tableTop + 25);
            ctx.fillText("المبلغ", 20 + columnWidths[0] + columnWidths[1] + columnWidths[2]/2, tableTop + 25);
            
            // Line under header
            ctx.beginPath();
            ctx.moveTo(20, tableTop + 40);
            ctx.lineTo(canvas.width - 20, tableTop + 40);
            ctx.stroke();
            
            // Table content
            ctx.textAlign = "right";
            ctx.font = "16px Arial";
            let totalAmount = 0;
            
            paymentsData.payments.forEach((payment, index) => {
                const rowY = tableTop + 40 + (index * 30);
                
                // Alternate row colors
                if (index % 2 === 0) {
                    ctx.fillStyle = "#f8f9fa";
                    ctx.fillRect(20, rowY, canvas.width - 40, 30);
                }
                
                ctx.fillStyle = "#000000";
                // Class name and subject
                ctx.fillText(`${payment.className} (${payment.subject})`, 20 + columnWidths[0] - 10, rowY + 20);
                
                // Month
                ctx.textAlign = "center";
                ctx.fillText(payment.month || 'غير محدد', 20 + columnWidths[0] + columnWidths[1]/2, rowY + 20);
                
                // Amount
                ctx.fillText(`${payment.amount} د.ج`, 20 + columnWidths[0] + columnWidths[1] + columnWidths[2] - 10, rowY + 20);
                ctx.textAlign = "right";
                
                totalAmount += payment.amount;
            });
            
            yPosition = tableTop + 40 + (paymentsData.payments.length * 30) + 20;
            
            // Line before total
            ctx.beginPath();
            ctx.moveTo(20, yPosition - 10);
            ctx.lineTo(canvas.width - 20, yPosition - 10);
            ctx.stroke();
            
            // Space between table and total
            yPosition += 40;
            
            // Total amount
            ctx.font = "bold 22px Arial";
            ctx.fillText(`المبلغ الإجمالي: ${totalAmount} د.ج`, canvas.width - 20, yPosition);
            yPosition += 30;
            
            // Payment method and date
            ctx.font = "20px Arial";
            ctx.fillText(`طريقة الدفع: ${getPaymentMethodName(paymentsData.paymentMethod)}`, canvas.width - 20, yPosition);
            yPosition += 25;
            ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('en-GB')}`, canvas.width - 20, yPosition);
            yPosition += 40;
            
            // QR Code - larger size
            const qrImg = new Image();
            qrImg.onload = function() {
                const qrSize = 100;
                const qrX = (canvas.width - qrSize) / 2;
                ctx.drawImage(qrImg, qrX, yPosition, qrSize, qrSize);
                yPosition += qrSize + 20;
                
                // Footer with larger font
                ctx.textAlign = "center";
                ctx.font = "bold 22px Arial";
                ctx.fillText("شكراً لثقتكم بنا", canvas.width / 2, yPosition);
                yPosition += 30;
                
                ctx.font = "20px Arial";
                ctx.fillText(paymentsData.schoolContact, canvas.width / 2, yPosition);
            };
            qrImg.onerror = function() {
                // If QR image fails to load, print text alternative
                ctx.textAlign = "center";
                ctx.font = "bold 22px Arial";
                ctx.fillText("شكراً لثقتكم بنا", canvas.width / 2, yPosition);
                yPosition += 30;
                
                ctx.font = "20px Arial";
                ctx.fillText(paymentsData.schoolContact, canvas.width / 2, yPosition);
            };
            qrImg.src = 'assets/redox-qr.svg';
        }
        
        return canvas;
    }



    function getPaymentMethodName(method) {
        const methods = {
            'cash': 'نقدي',
            'bank': 'حوالة بنكية',
            'online': 'دفع إلكتروني',
            'card': 'بطاقة ائتمان'
        };
        
        return methods[method] || method;
    }

    async function printMultiPaymentReceipt(paymentsData) {
        if (!writer) {
            const connected = await connectToThermalPrinter();
            if (!connected) return false;
        }
        
        try {
            // Draw multi-payment receipt
            const canvas = drawMultiPaymentReceipt(paymentsData);
            
            // Wait for images to load
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Convert canvas to ESC/POS format
            const rasterData = canvasToEscPos(canvas);
            
            // Send to printer
            await writer.write(rasterData);
            
            // Add cut command
            await writer.write(new Uint8Array([0x1D, 0x56, 0x01]));
            
            return true;
        } catch (err) {
            console.error('Error printing multi-payment receipt:', err);
            throw err;
        }
    }





    // طباعة إيصال متعدد الحصص
    async function printMultiClassReceipt(student, payments) {
        if (!writer) {
            const connected = await connectToThermalPrinter();
            if (!connected) return false;
        }
        
        try {
            const canvas = drawMultiClassReceipt(student, payments);
            const rasterData = canvasToEscPos(canvas);
            await writer.write(rasterData);
            
            return true;
        } catch (err) {
            console.error('Error printing multi-class receipt:', err);
            throw err;
        }
    }

    function drawMultiClassReceipt(student, payments) {
        const canvas = document.createElement("canvas");
        canvas.width = 580;
        canvas.height = 300 + (payments.length * 40); // ارتفاع ديناميكي حسب عدد الحصص
        
        const ctx = canvas.getContext("2d");
        
        // الخلفية
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // العنوان
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.font = "bold 28px Arial";
        ctx.fillText("إيصال دفع متعدد الحصص", canvas.width / 2, 50);
        
        // معلومات الطالب
        ctx.textAlign = "right";
        ctx.font = "18px Arial";
        let yPosition = 100;
        
        ctx.fillText(`الطالب: ${student.name}`, canvas.width - 20, yPosition);
        yPosition += 30;
        ctx.fillText(`رقم الطالب: ${student.studentId}`, canvas.width - 20, yPosition);
        yPosition += 40;
        
        // تفاصيل المدفوعات
        ctx.font = "bold 20px Arial";
        ctx.fillText("تفاصيل المدفوعات", canvas.width - 20, yPosition);
        yPosition += 30;
        
        ctx.font = "16px Arial";
        let totalAmount = 0;
        
        payments.forEach(payment => {
            ctx.fillText(`${payment.class.name} - ${payment.month}: ${payment.amount} د.ج`, canvas.width - 20, yPosition);
            yPosition += 25;
            totalAmount += payment.amount;
        });
        
        yPosition += 20;
        
        // المجموع
        ctx.font = "bold 18px Arial";
        ctx.fillText(`المبلغ الإجمالي: ${totalAmount} د.ج`, canvas.width - 20, yPosition);
        yPosition += 30;ا
        
        // طريقة الدفع وتاريخه
        ctx.font = "16px Arial";
        ctx.fillText(`طريقة الدفع: ${getPaymentMethodName(payments[0].paymentMethod)}`, canvas.width - 20, yPosition);
        yPosition += 25;
        ctx.fillText(`تاريخ الطباعة: ${new Date().toLocaleDateString('en-GB')}`, canvas.width - 20, yPosition);
        yPosition += 40;
        
        // تذييل
        ctx.textAlign = "center";
        ctx.fillText("شكراً لثقتكم بنا", canvas.width / 2, yPosition);
        
        return canvas;
    }

    // Create gate interface section
    function createGateInterface() {
        // Check if gate interface already exists
        if (document.getElementById('gate-interface')) return;
        
        // Create gate interface section
        const gateSection = document.createElement('div');
        gateSection.id = 'gate-interface';
        gateSection.className = 'content-section';
        gateSection.innerHTML = `
            <div class="card shadow-sm">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0"><i class="bi bi-door-open me-2"></i>واجهة المدخل</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="manualRFIDInput" class="form-label">مسح البطاقة يدوياً:</label>
                                <input type="text" class="form-control" id="manualRFIDInput" 
                                    placeholder="أدخل رقم البطاقة أو امسحها" autocomplete="off">
                                <div class="form-text">يمكنك إدخال رقم البطاقة يدوياً أو استخدام قارئ البطاقات</div>
                            </div>
                            
                            <div class="current-class-info p-3 bg-light rounded mb-3">
                                <h6>الحصة الجارية حالياً:</h6>
                                <div id="current-class-details">جاري التحميل...</div>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="gate-status p-3 rounded text-center">
                                <h6>حالة المدخل:</h6>
                                <div id="gate-status" class="status-active">
                                    <i class="bi bi-check-circle-fill text-success"></i>
                                    <span>نشط</span>
                                </div>
                            </div>
                            
                            <div class="recent-scans mt-4">
                                <h6>آخر عمليات المسح:</h6>
                                <div id="recent-scans-list" class="list-group"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row mt-4">
                        <div class="col-12">
                            <div id="gate-rfid-result">
                                <p class="text-muted text-center">سيظهر هنا نتيجة مسح البطاقة</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add to content sections
        document.querySelector('.main-content').appendChild(gateSection);
        
        // Add to navigation
        const navList = document.querySelector('.nav-pills');
        const gateNavItem = document.createElement('li');
        gateNavItem.className = 'nav-item';
        gateNavItem.innerHTML = `
            <a class="nav-link" href="#" data-section="gate-interface" id="gate-interface-link">
                <i class="bi bi-door-open me-2"></i>واجهة المدخل
            </a>
        `;
        navList.appendChild(gateNavItem);
        
        // Set up event listeners for the new navigation item
        gateNavItem.querySelector('a').addEventListener('click', function(e) {
            e.preventDefault();
            
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            // Remove active from all links
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            
            // Activate current link
            this.classList.add('active');
            
            // Show requested section
            document.getElementById('gate-interface').classList.add('active');
            
            // Load current class info
            loadCurrentClassInfo();
        });
        
        // Set up RFID input handling
        setupRFIDInputHandling();
    }

    // Load current class information for gate interface
    async function loadCurrentClassInfo() {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            const response = await fetch(`/api/live-classes?status=ongoing&date=${today.toISOString()}`, {
                headers: getAuthHeaders()
            });

            if (response.status === 401) {
                logout();
                return;
            }

            const liveClasses = await response.json();
            const classDetails = document.getElementById('current-class-details');
            
            if (liveClasses.length > 0) {
                const liveClass = liveClasses[0];
                classDetails.innerHTML = `
                    <p><strong>${liveClass.class.name}</strong> (${liveClass.class.subject})</p>
                    <p>الأستاذ: ${liveClass.teacher.name}</p>
                    <p>الوقت: ${liveClass.startTime}</p>
                `;
            } else {
                classDetails.innerHTML = '<p class="text-muted">لا توجد حصص جارية حالياً</p>';
            }
        } catch (err) {
            console.error('Error loading current class info:', err);
            document.getElementById('current-class-details').innerHTML = 
                '<p class="text-danger">حدث خطأ أثناء تحميل معلومات الحصة</p>';
        }
    }











    async function displayStudentInfo(cardUid) {
        try {
            // جلب بيانات البطاقة والطالب
            const cardResponse = await fetch(`/api/cards/uid/${cardUid}`, {
                headers: getAuthHeaders()
            });

            if (cardResponse.status === 404) {
                // بطاقة غير معروفة
                showUnknownCardUI(cardUid);
                return;
            }

            if (cardResponse.status === 401) {
                logout();
                return;
            }

            const cardData = await cardResponse.json();
            
            if (cardData.student) {
                // جلب معلومات الطالب الكاملة
                const studentResponse = await fetch(`/api/students/${cardData.student._id}`, {
                    headers: getAuthHeaders()
                });
                
                if (studentResponse.ok) {
                    const student = await studentResponse.json();
                    
                    // عرض نافذة التفاصيل المتكاملة
                    showStudentDetailModal(student, cardUid);
                }
            }
        } catch (err) {
            console.error('Error processing RFID:', err);
            showErrorUI('حدث خطأ أثناء معالجة البطاقة');
        }
    }

    function showStudentDetailModal(student, cardUid) {
        // إنشاء محتوى النافذة
        const modalContent = `
            <div class="student-detail-modal">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title">معلومات الطالب - ${student.name}</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-md-4 text-center">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=3498db&color=fff" 
                                class="student-avatar rounded-circle mb-3" alt="صورة الطالب">
                            <h4>${student.name}</h4>
                            <p class="text-muted">${student.studentId}</p>
                            <div class="d-grid gap-2">
                                <button class="btn btn-success" onclick="handleQuickPayment('${student._id}')">
                                    <i class="bi bi-cash-coin me-1"></i> دفع حصة
                                </button>
                                <button class="btn btn-info" onclick="enrollInClass('${student._id}')">
                                    <i class="bi bi-book me-1"></i> التسجيل في حصة
                                </button>
                            </div>
                        </div>
                        <div class="col-md-8">
                            <div class="card">
                                <div class="card-header">
                                    <h6>المعلومات الشخصية</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <p><strong>ولي الأمر:</strong> ${student.parentName || 'غير محدد'}</p>
                                            <p><strong>هاتف ولي الأمر:</strong> ${student.parentPhone || 'غير محدد'}</p>
                                        </div>
                                        <div class="col-md-6">
                                            <p><strong>الصف الدراسي:</strong> ${getAcademicYearName(student.academicYear) || 'غير محدد'}</p>
                                            <p><strong>تاريخ التسجيل:</strong> ${new Date(student.registrationDate).toLocaleDateString('ar-EG')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="card mt-3">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <h6 class="mb-0">الحصص المسجلة</h6>
                                    <button class="btn btn-sm btn-outline-primary" onclick="showAllClasses('${student._id}')">
                                        عرض الكل
                                    </button>
                                </div>
                                <div class="card-body">
                                    ${renderStudentClasses(student.classes)}
                                </div>
                            </div>

                            <div class="card mt-3">
                                <div class="card-header">
                                    <h6 class="mb-0">آخر المدفوعات</h6>
                                </div>
                                <div class="card-body">
                                    ${renderRecentPayments(student._id)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إغلاق</button>
                    <button type="button" class="btn btn-primary" onclick="showFullStudentDetails('${student._id}')">
                        عرض التفاصيل الكاملة
                    </button>
                </div>
            </div>
        `;

        // إنشاء وعرض المودال
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = `
            <div class="modal fade" id="studentDetailModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    ${modalContent}
                </div>
            </div>
        `;

        document.body.appendChild(modalContainer);
        
        // عرض المودال
        const modal = new bootstrap.Modal(document.getElementById('studentDetailModal'));
        modal.show();
        
        // تنظيف المودال بعد إغلاقه
        document.getElementById('studentDetailModal').addEventListener('hidden.bs.modal', function () {
            document.body.removeChild(modalContainer);
        });
    }
    function renderStudentClasses(classes) {
        if (!classes || classes.length === 0) {
            return '<p class="text-muted text-center">لا توجد حصص مسجلة</p>';
        }

        // عرض أول 3 حصص فقط
        const displayedClasses = classes.slice(0, 3);
        let html = '';

        displayedClasses.forEach(cls => {
            html += `
                <div class="class-item mb-2 p-2 border rounded">
                    <div class="d-flex justify-content-between">
                        <strong>${cls.name}</strong>
                        <span class="badge bg-info">${cls.subject}</span>
                    </div>
                    <small class="text-muted">${getAcademicYearName(cls.academicYear)}</small>
                </div>
            `;
        });

        if (classes.length > 3) {
            html += `<p class="text-center mt-2"><small>+${classes.length - 3} حصص أخرى</small></p>`;
        }

        return html;
    }

    async function handleQuickPayment(studentId) {
        try {
            // جلب الحصص المتاحة للطالب
            const classesResponse = await fetch(`/api/students/${studentId}/classes`, {
                headers: getAuthHeaders()
            });

            if (classesResponse.ok) {
                const classes = await classesResponse.json();
                
                // إنشاء قائمة الحصص للاختيار
                const options = classes.map(cls => 
                    `<option value="${cls._id}">${cls.name} - ${cls.price} د.ج</option>`
                ).join('');

                const { value: formValues } = await Swal.fire({
                    title: 'دفع حصة',
                    html: `
                        <select id="paymentClass" class="form-select mb-3">
                            <option value="">اختر الحصة</option>
                            ${options}
                        </select>
                        <select id="paymentMonth" class="form-select mb-3">
                            <option value="">اختر الشهر</option>
                            ${generateMonthOptions()}
                        </select>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="printReceipt" checked>
                            <label class="form-check-label" for="printReceipt">
                                طباعة الإيصال
                            </label>
                        </div>
                    `,
                    focusConfirm: false,
                    showCancelButton: true,
                    confirmButtonText: 'دفع',
                    cancelButtonText: 'إلغاء',
                    preConfirm: () => {
                        return {
                            classId: document.getElementById('paymentClass').value,
                            month: document.getElementById('paymentMonth').value,
                            printReceipt: document.getElementById('printReceipt').checked
                        };
                    }
                });

                if (formValues) {
                    // إجراء عملية الدفع
                    const paymentResponse = await fetch('/api/payments', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAuthHeaders()
                        },
                        body: JSON.stringify({
                            student: studentId,
                            class: formValues.classId,
                            month: formValues.month,
                            amount: await getClassPrice(formValues.classId),
                            paymentMethod: 'cash',
                            paymentDate: new Date().toISOString().split('T')[0]
                        })
                    });

                    if (paymentResponse.ok) {
                        const payment = await paymentResponse.json();
                        
                        // طباعة الإيصال إذا طلب المستخدم
                        if (formValues.printReceipt) {
                            await printPaymentReceipt(payment);
                        }

                        Swal.fire('نجاح', 'تم دفع الحصة بنجاح', 'success');
                    } else {
                        throw new Error('فشل في عملية الدفع');
                    }
                }
            }
        } catch (err) {
            console.error('Error processing quick payment:', err);
            Swal.fire('خطأ', err.message || 'حدث خطأ أثناء عملية الدفع', 'error');
        }
    }
    async function enrollInClass(studentId) {
        try {
            // جلب الحصص المتاحة
            const classesResponse = await fetch('/api/classes/available', {
                headers: getAuthHeaders()
            });

            if (classesResponse.ok) {
                const classes = await classesResponse.json();
                
                const { value: classId } = await Swal.fire({
                    title: 'التسجيل في حصة',
                    input: 'select',
                    inputOptions: classes.reduce((options, cls) => {
                        options[cls._id] = `${cls.name} (${cls.subject}) - ${cls.price} د.ج`;
                        return options;
                    }, {}),
                    inputPlaceholder: 'اختر الحصة',
                    showCancelButton: true,
                    confirmButtonText: 'تسجيل',
                    cancelButtonText: 'إلغاء'
                });

                if (classId) {
                    // تسجيل الطالب في الحصة
                    const enrollResponse = await fetch(`/api/classes/${classId}/enroll/${studentId}`, {
                        method: 'POST',
                        headers: getAuthHeaders()
                    });

                    if (enrollResponse.ok) {
                        Swal.fire('نجاح', 'تم تسجيل الطالب في الحصة بنجاح', 'success');
                    } else {
                        throw new Error('فشل في التسجيل');
                    }
                }
            }
        } catch (err) {
            console.error('Error enrolling student:', err);
            Swal.fire('خطأ', err.message || 'حدث خطأ أثناء التسجيل', 'error');
        }
    }
    async function getClassPrice(classId) {
        const response = await fetch(`/api/classes/${classId}`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const classData = await response.json();
            return classData.price;
        }
        
        return 0;
    }

    function generateMonthOptions() {
        const months = [
            'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
        ];
        
        const currentYear = new Date().getFullYear();
        let options = '';
        
        for (let i = 0; i < 12; i++) {
            const monthIndex = (new Date().getMonth() + i) % 12;
            const year = currentYear + Math.floor((new Date().getMonth() + i) / 12);
            const value = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
            const text = `${months[monthIndex]} ${year}`;
            
            options += `<option value="${value}">${text}</option>`;
        }
        
        return options;
    }


    // دالة لمعالجة مسح البطاقة
    document.getElementById('cardInput').addEventListener('input', function(e) {
        const cardId = e.target.value.trim();
        if (cardId.length > 5) {
            fetchStudentData(cardId);
        }
    });

    async function fetchStudentDataById(studentId) {
        try {
            const response = await fetch(`/api/students/${studentId}`);
            if (!response.ok) {
                throw new Error('خطاء في جلب البيانات');
            }
            const data = await response.json();
            displayStudentData(data);
        } catch (error) {
            showError(error.message);
        }
    }

    // دالة لجلب بيانات الطالب من API
    async function fetchStudentData(cardId) {
        try {
            // إظهار مؤشر التحميل
            document.getElementById('studentInfo').style.display = 'none';
            document.getElementById('errorMessage').style.display = 'none';
            
            const response = await fetch(`/api/cards/${cardId}`);
            if (!response.ok) {
                throw new Error('خطأ في جلب البيانات');
            }
            
            const data = await response.json();
            displayStudentData(data);
        } catch (error) {
            showError(error.message);
        }
    }

    // دالة لعرض بيانات الطالب
    function displayStudentData(data) {
        const { student, classes, payments } = data;
        
        // تحديث الصورة
        document.getElementById('studentAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=3498db&color=fff`;
        
        // تحديث المعلومات الأساسية
        document.getElementById('studentName').textContent = student.name;
        document.getElementById('studentIdDisplay').textContent = student.studentId;
        document.getElementById('parentName').textContent = student.parentName;
        document.getElementById('parentPhone').textContent = student.parentPhone;
        document.getElementById('birthDate').textContent = formatDate(student.birthDate);
        document.getElementById('academicYear').textContent = getAcademicYearName(student.academicYear);
        
        // تحديث حالة الطالب
        const statusBadge = document.getElementById('studentStatus');
        statusBadge.textContent = student.status === 'active' ? 'نشط' : 'غير نشط';
        statusBadge.className = `badge bg-${student.status === 'active' ? 'success' : 'danger'}`;
        
        // تحديث المعلومات المالية
        updatePaymentInfo(payments);
        
        // تحديث قائمة الحصص
        updateClassesList(classes);
        
        // إظهار معلومات الطالب
        document.getElementById('studentInfo').style.display = 'block';
    }

    // دالة لتحديث المعلومات المالية
    function updatePaymentInfo(payments) {
        const paidPayments = payments.filter(p => p.status === 'paid');
        const pendingPayments = payments.filter(p => p.status === 'pending');
        
        const totalPaid = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const totalDue = pendingPayments.reduce((sum, payment) => sum + payment.amount, 0);
        
        document.getElementById('totalPaid').textContent = `${totalPaid} د.ك`;
        document.getElementById('totalDue').textContent = `${totalDue} د.ك`;
        
        // تحديث حالة الدفع
        const paymentStatus = document.getElementById('paymentStatus');
        if (paidPayments.length > 0 && pendingPayments.length === 0) {
            paymentStatus.textContent = 'مسدد بالكامل';
            paymentStatus.className = 'payment-status payment-paid';
        } else if (pendingPayments.length > 0) {
            paymentStatus.textContent = `لديه ${pendingPayments.length} دفعات معلقة`;
            paymentStatus.className = 'payment-status payment-pending';
        } else {
            paymentStatus.textContent = 'لا توجد مدفوعات';
            paymentStatus.className = 'payment-status';
        }
        
        // تحديث تاريخ آخر دفعة
        const lastPayment = paidPayments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0];
        document.getElementById('lastPaymentDate').textContent = lastPayment 
            ? formatDate(lastPayment.paymentDate) 
            : '-';
    }

    // دالة لتحديث قائمة الحصص
    function updateClassesList(classes) {
        const classesList = document.getElementById('classesList');
        classesList.innerHTML = '';
        
        if (classes.length === 0) {
            classesList.innerHTML = '<p class="text-muted">لا توجد حصص مسجلة</p>';
            return;
        }
        
        classes.forEach(cls => {
            const classItem = document.createElement('div');
            classItem.className = 'class-item';
            
            const scheduleText = cls.schedule.map(s => `${s.day} الساعة ${s.time}`).join('، ');
            
            classItem.innerHTML = `
                <h6>${cls.name} (${cls.subject})</h6>
                <p class="mb-1"><small>الجدول: ${scheduleText}</small></p>
                <p class="mb-0"><small>السعر: ${cls.price} د.ك شهرياً</small></p>
            `;
            
            classesList.appendChild(classItem);
        });
    }

    // دالة لعرض الأخطاء
    function showError(message) {
        const errorElement = document.getElementById('errorMessage');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        document.getElementById('studentInfo').style.display = 'none';
    }

    // دالة مساعدة لتنسيق التاريخ
    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-EG');
    }
    function markAttendance() {
        const cardId = document.getElementById('cardInput').value;
        if (!cardId) {
            showError('يرجى مسح البطاقة أولاً');
            return;
        }
        
        // هنا يمكنك إضافة كود لتسجيل الحضور
        Swal.fire({
            title: 'تسجيل الحضور',
            text: 'تم تسجيل حضور الطالب بنجاح',
            icon: 'success',
            confirmButtonText: 'موافق'
        });
    }

    // دالة للطباعة
    function printStudentInfo() {
        const printContent = document.getElementById('studentInfo').innerHTML;
        const originalContent = document.body.innerHTML;
        
        document.body.innerHTML = printContent;
        window.print();
        document.body.innerHTML = originalContent;
        location.reload();
    }

    function simulateCardReader(cardId) {
        document.getElementById('cardInput').value = cardId;
        const event = new Event('input', { bubbles: true });
        document.getElementById('cardInput').dispatchEvent(event);
    }

    // للمسح التلقائي (إذا كان القارئ يضيف أحرفاً خاصة في البداية أو النهاية)
    document.getElementById('cardInput').addEventListener('input', function(e) {
        // تنظيف المدخلات من الأحرف غير المرغوب فيها (مثل أحرف البداية والنهاية من القارئ)
        let cleanValue = e.target.value.replace(/[^0-9a-zA-Z]/g, '');
        
        // إذا كانت القيمة نظيفة وتحتوي على رقم بطاقة صالح
        if (cleanValue.length >= 6 && cleanValue !== e.target.value) {
            e.target.value = cleanValue;
            fetchStudentData(cleanValue);
        }
    });
    // دالة مساعدة للحصول على اسم السنة الدراسية


    function toggleRFIDScanner() {
        const scanner = document.getElementById('global-rfid-scanner');
        const btn = document.getElementById('rfid-scanner-btn');
        
        if (scanner.style.display === 'none') {
            scanner.style.display = 'block';
            btn.innerHTML = '<i class="bi bi-x"></i>';
            btn.classList.add('btn-danger');
            btn.classList.remove('btn-primary');
            document.getElementById('globalCardInput').focus();
        } else {
            scanner.style.display = 'none';
            btn.innerHTML = '<i class="bi bi-credit-card"></i>';
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-primary');
        }
    }
    // تهيئة قارئ البطاقات العام


    // معالجة مدخلات البطاقة من القارئ العام// تهيئة قارئ البطاقات العام
    function initGlobalRFIDScanner() {
        const globalCardInput = document.getElementById('globalCardInput');
        
        if (globalCardInput) {
            let cardInputBuffer = '';
            let lastKeyTime = Date.now();
            
            // معالجة الإدخال اليدوي والمسح التلقائي
            globalCardInput.addEventListener('input', function(e) {
                const cardId = e.target.value.trim();
                if (cardId.length >= 6) {
                    const normalizedCardId = normalizeCardNumber(cardId);
                    processGlobalRFIDInput(normalizedCardId);
                }
            });
            
            // معالجة الضغط على Enter للإدخال اليدوي
            globalCardInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const cardId = e.target.value.trim();
                    if (cardId) {
                        const normalizedCardId = normalizeCardNumber(cardId);
                        processGlobalRFIDInput(normalizedCardId);
                        e.target.value = ''; // مسح الحقل بعد المعالجة
                    }
                }
            });
            
            // محاكاة قارئ البطاقات (الاستماع للإدخال السريع)
            document.addEventListener('keydown', function(event) {
                // تجاهل إذا كان المستخدم يكتب في حقل آخر
                if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                    return;
                }
                
                const currentTime = Date.now();
                const key = event.key;
                
                // إعادة تعيين المخزن المؤقت إذا مر وقت طويل منذ آخر ضغطة
                if (currentTime - lastKeyTime > 100) {
                    cardInputBuffer = '';
                }
                
                lastKeyTime = currentTime;
                
                // إذا تم الضغط على Enter، معالجة البطاقة
                if (key === 'Enter') {
                    event.preventDefault();
                    
                    if (cardInputBuffer.length > 0) {
                        const normalizedCardId = normalizeCardNumber(cardInputBuffer);
                        processGlobalRFIDInput(normalizedCardId);
                        cardInputBuffer = '';
                        
                        // تحديث واجهة المستخدم
                        globalCardInput.value = normalizedCardId;
                        setTimeout(() => {
                            globalCardInput.value = '';
                        }, 1000);
                    }
                } 
                // إذا كان رقم، إضافته للمخزن المؤقت
                else if (key >= '0' && key <= '9') {
                    cardInputBuffer += key;
                    globalCardInput.value = cardInputBuffer;
                }
            });
        }
        
        // إظهار زر البطاقة العائم دائماً
        document.getElementById('rfid-scanner-btn').style.display = 'block';

    }
    // معالجة خاصة لقسم إدارة البطاقات (للقارئ الجديد)
    function setupCardsManagementRFID() {
        const cardUidInput = document.getElementById('cardUid');
        
        if (cardUidInput) {
            let cardsBuffer = '';
            let cardsLastKeyTime = Date.now();
            
            // استمع للإدخال المباشر في قسم البطاقات
            document.addEventListener('keydown', function(event) {
                // فقط في قسم البطاقات
                if (!document.getElementById('cards').classList.contains('active')) {
                    return;
                }
                
                const currentTime = Date.now();
                const key = event.key;
                
                // إعادة تعيين المخزن المؤقت إذا مر وقت طويل
                if (currentTime - cardsLastKeyTime > 100) {
                    cardsBuffer = '';
                }
                
                cardsLastKeyTime = currentTime;
                
                // إذا تم الضغط على Enter، معالجة البطاقة
                if (key === 'Enter') {
                    event.preventDefault();
                    
                    if (cardsBuffer.length > 0) {
                        // في قسم البطاقات، نريد الرقم بالكامل (التنسيق الجديد)
                        cardUidInput.value = cardsBuffer;
                        cardsBuffer = '';
                        
                        // يمكنك أيضاً معالجته تلقائياً إذا أردت
                        // processCardsManagementRFID(cardsBuffer);
                    }
                } 
                // إذا كان رقم، إضافته للمخزن المؤقت
                else if (key >= '0' && key <= '9') {
                    cardsBuffer += key;
                }
            });
        }
    }
    // معالجة مدخلات البطاقة من القارئ العام
    async function processGlobalRFIDInput(cardUid) {
        try {
            const rfidResult = document.getElementById('global-rfid-result');
            const readerType = detectReaderType(cardUid);
            
            // عرض حالة التحميل مع معلومات عن نوع القارئ
            rfidResult.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">جاري المعالجة...</span>
                    </div>
                    <p>جاري التعرف على البطاقة: ${cardUid}</p>
                    <small class="">نوع القارئ: ${readerType === 'new_reader' ? 'الجديد' : 'القديم'}</small>
                </div>
            `;

            // تحديث حالة RFID
            const rfidStatus = document.getElementById('rfidStatus');
            rfidStatus.className = 'badge bg-success';
            rfidStatus.textContent = 'متصل';

            // البحث عن البطاقة في النظام باستخدام الرقم المعياري
            const response = await fetch(`/api/cards/uid/${cardUid}`, {
                headers: getAuthHeaders()
            });

            if (response.status === 404) {
                // بطاقة غير معروفة
                rfidResult.innerHTML = `
                    <div class="alert alert-warning">
                        <h6>بطاقة غير معروفة</h6>
                        <p>رقم البطاقة: ${cardUid}</p>
                        <p><small>التنسيق: ${readerType === 'new_reader' ? 'جديد' : 'قديم'}</small></p>
                        <button class="btn btn-sm btn-primary" onclick="showAssignCardModal('${cardUid}')">
                            تعيين البطاقة لطالب
                        </button>
                    </div>
                `;
                return;
            }

            if (response.status === 401) {
                logout();
                return;
            }

            const cardData = await response.json();
            
            if (cardData.student) {
                // عرض معلومات الطالب
                const studentResponse = await fetch(`/api/students/${cardData.student._id}`, {
                    headers: getAuthHeaders()
                });
                
                if (studentResponse.ok) {
                    const student = await studentResponse.json();
                    
                    rfidResult.innerHTML = `
                        <div class="student-info">
                            <h6>${student.name}</h6>
                            <p class="mb-1">رقم الطالب: ${student.studentId}</p>
                            <p class="mb-1">الصف: ${getAcademicYearName(student.academicYear) || 'غير محدد'}</p>
                            <p class="mb-1"><small>تم المسح بـ: ${readerType === 'new_reader' ? 'القارئ الجديد' : 'القارئ القديم'}</small></p>
                            <div class="mt-2">
                                <button class="btn btn-sm btn-info me-1" onclick="showStudentDetails('${student._id}')">
                                    <i class="bi bi-person"></i>
                                </button>
                                <button class="btn btn-sm btn-success" onclick="handleGlobalAttendance('${cardUid}')">
                                    <i class="bi bi-check-circle"></i> حضور
                                </button>
                            </div>
                        </div>
                    `;
                }
            }
        } catch (err) {
            console.error('Error processing RFID:', err);
            const rfidResult = document.getElementById('global-rfid-result');
            rfidResult.innerHTML = `
                <div class="alert alert-danger">
                    <h6>خطأ في المعالجة</h6>
                    <p>حدث خطأ أثناء معالجة البطاقة</p>
                </div>
            `;
        }
    }

    // معالجة الحضور من الواجهة العامة
    async function handleGlobalAttendance(cardUid) {
        try {
            // الحصول على معلومات البطاقة أولاً
            const cardResponse = await fetch(`/api/cards/uid/${cardUid}`, {
                headers: getAuthHeaders()
            });
    
            if (cardResponse.status !== 200) {
                throw new Error('البطاقة غير معروفة');
            }
    
            const cardData = await cardResponse.json();
            
            if (!cardData.student) {
                throw new Error('البطاقة غير مرتبطة بأي طالب');
            }
    
            // البحث عن جميع الحصص الجارية
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            const classesResponse = await fetch(`/api/live-classes?status=ongoing&date=${today.toISOString()}`, {
                headers: getAuthHeaders()
            });
    
            if (classesResponse.status === 401) {
                logout();
                return;
            }
    
            const liveClasses = await classesResponse.json();
            
            if (liveClasses.length === 0) {
                await handleNoOngoingClasses(cardData.student._id);
                return;
            }
    
            // البحث عن الحصة التي يكون الطالب مسجلاً فيها
            let targetClass = null;
            
            for (const liveClass of liveClasses) {
                const classResponse = await fetch(`/api/classes/${liveClass.class._id}`, {
                    headers: getAuthHeaders()
                });
                
                if (classResponse.ok) {
                    const classData = await classResponse.json();
                    const isEnrolled = classData.students.some(student => 
                        student._id === cardData.student._id || student === cardData.student._id
                    );
                    
                    if (isEnrolled) {
                        targetClass = liveClass;
                        break;
                    }
                }
            }
    
            if (!targetClass) {
                // عرض رسالة أن الطالب غير مسجل في أي حصة جارية
                const rfidResult = document.getElementById('global-rfid-result');
                rfidResult.innerHTML = `
                    <div class="alert alert-warning">
                        <h6>الطالب غير مسجل</h6>
                        <p>${cardData.student.name} غير مسجل في أي حصة جارية حالياً</p>
                        <button class="btn btn-sm btn-primary mt-2" onclick="showEnrollStudentModal('${cardData.student._id}')">
                            التسجيل في حصة
                        </button>
                    </div>
                `;
                return;
            }
    
            // تسجيل الحضور
            const attendanceResponse = await fetch(`/api/live-classes/${targetClass._id}/attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    studentId: cardData.student._id,
                    status: 'present',
                    method: 'rfid'
                })
            });
    
            if (attendanceResponse.ok) {
                const result = await attendanceResponse.json();
                
                // عرض رسالة النجاح
                const rfidResult = document.getElementById('global-rfid-result');
                rfidResult.innerHTML = `
                    <div class="alert alert-success">
                        <h6>تم تسجيل الحضور</h6>
                        <p>الطالب: ${cardData.student.name}</p>
                        <p>الحصة: ${targetClass.class.name}</p>
                        <p>الوقت: ${new Date().toLocaleTimeString('ar-EG')}</p>
                    </div>
                `;
                
                // إعادة تعيين حقل الإدخال بعد 3 ثوان
                setTimeout(() => {
                    document.getElementById('globalCardInput').value = '';
                }, 3000);
                
            } else {
                const error = await attendanceResponse.json();
                throw new Error(error.error || 'فشل في تسجيل الحضور');
            }
            
        } catch (err) {
            console.error('Error handling attendance:', err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: err.message || 'حدث خطأ أثناء تسجيل الحضور',
                confirmButtonText: 'حسناً'
            });
        }
    }

    // التعامل مع حالة عدم وجود حصص جارية
    async function handleNoOngoingClasses(studentId) {
        // عرض خيار للحصص المجدولة اليوم
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/live-classes?date=${today}`, {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const classes = await response.json();
            
            if (classes.length > 0) {
                const { value: classId } = await Swal.fire({
                    title: 'لا توجد حصص جارية',
                    text: 'اختر حصة لتسجيل الحضور فيها:',
                    input: 'select',
                    inputOptions: classes.reduce((options, cls) => {
                        options[cls._id] = `${cls.class.name} (${cls.startTime})`;
                        return options;
                    }, {}),
                    showCancelButton: true,
                    confirmButtonText: 'تسجيل الحضور',
                    cancelButtonText: 'إلغاء'
                });

                if (classId) {
                    // تسجيل الحضور في الحصة المحددة
                    const attendanceResponse = await fetch(`/api/live-classes/${classId}/attendance`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAuthHeaders()
                        },
                        body: JSON.stringify({
                            studentId: studentId,
                            status: 'present',
                            method: 'manual'
                        })
                    });

                    if (attendanceResponse.ok) {
                        Swal.fire('نجاح', 'تم تسجيل الحضور بنجاح', 'success');
                    } else {
                        throw new Error('فشل في تسجيل الحضور');
                    }
                }
            } else {
                Swal.fire({
                    icon: 'info',
                    title: 'لا توجد حصص',
                    text: 'لا توجد حصص مجدولة اليوم',
                    confirmButtonText: 'حسناً',
                    timer: 3000,
                    showCancelButton: false
                }).then(result => {
                    if (result.isConfirmed || result.dismiss === Swal.DismissReason.timer) {
                        return;
                    }
                });
            }
        }
    }
    // دالة لتحويل التنسيق القديم إلى الجديد والعكس
    function normalizeCardNumber(cardNumber) {
        if (!cardNumber) return '';
        
        // إزالة أي أحرف غير رقمية
        const cleanNumber = cardNumber.replace(/\D/g, '');
        
        // إذا كان الرقم يحتوي على أصفار متكررة (التنسيق الجديد)
        if (cleanNumber.match(/^0{6,}/)) {
            // هذا هو التنسيق الجديد: 000000000555333222888777000999
            // نريد استخراج الأرقام الفعلية (إزالة الأصفار الزائدة)
            return cleanNumber.replace(/^0+/, '');
        }
        
        // إذا كان الرقم قصيراً (التنسيق القديم)
        if (cleanNumber.length <= 12) {
            // هذا هو التنسيق القديم: 0005328709
            return cleanNumber;
        }
        
        // إذا لم يتطابق مع أي من التنسيقين، نعيد الرقم كما هو
        return cleanNumber;
    }

    // دالة للكشف عن نوع القارئ بناءً على التنسيق
    function detectReaderType(cardNumber) {
        const cleanNumber = cardNumber.replace(/\D/g, '');
        
        if (cleanNumber.match(/^0{6,}/)) {
            return 'new_reader'; // القارئ الجديد
        } else if (cleanNumber.length <= 12) {
            return 'old_reader'; // القارئ القديم
        } else {
            return 'unknown'; // نوع غير معروف
        }
    }









    // تهيئة واجهة المدخل
    function initGateInterface() {
        // تحديث الوقت الحالي
        updateCurrentTime();
        setInterval(updateCurrentTime, 1000);
        
        // تهيئة حقل إدخال البطاقة
        const gateCardInput = document.getElementById('gateCardInput');
        if (gateCardInput) {
            setupGateCardInput(gateCardInput);
        }
        
        // تحميل معلومات الحصة الجارية
        loadCurrentClassInfo();
        
        // تحميل الإحصائيات
        loadGateStatistics();
        
        // تحميل السجلات الحديثة
        loadRecentScans();
    }

    // تحديث الوقت الحالي
    function updateCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ar-EG');
        const dateString = now.toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.innerHTML = `<i class="bi bi-clock"></i> ${timeString}`;
        }
    }

    // تهيئة حقل إدخال البطاقة للبوابة
    function setupGateCardInput(inputElement) {
        let gateBuffer = '';
        let gateLastKeyTime = Date.now();
        
        // معالجة الإدخال التلقائي
        inputElement.addEventListener('input', function(e) {
            const cardId = e.target.value.trim();
            if (cardId.length >= 6) {
                processGateCard(cardId);
            }
        });
        
        // معالجة الضغط على Enter
        inputElement.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const cardId = e.target.value.trim();
                if (cardId) {
                    processGateCard(cardId);
                    e.target.value = '';
                }
            }
        });
        
        // الاستماع للإدخال المباشر من القارئ
        document.addEventListener('keydown', function(event) {
            // فقط في واجهة المدخل
            if (!document.getElementById('gate-interface').classList.contains('active')) {
                return;
            }
            
            // تجاهل إذا كان المستخدم يكتب في حقل آخر
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }
            
            const currentTime = Date.now();
            const key = event.key;
            
            // إعادة تعيين المخزن المؤقت إذا مر وقت طويل
            if (currentTime - gateLastKeyTime > 100) {
                gateBuffer = '';
            }
            
            gateLastKeyTime = currentTime;
            
            // إذا تم الضغط على Enter، معالجة البطاقة
            if (key === 'Enter') {
                event.preventDefault();
                
                if (gateBuffer.length > 0) {
                    const normalizedCardId = normalizeCardNumber(gateBuffer);
                    processGateCard(normalizedCardId);
                    gateBuffer = '';
                    inputElement.value = '';
                }
            } 
            // إذا كان رقم، إضافته للمخزن المؤقت
            else if (key >= '0' && key <= '9') {
                gateBuffer += key;
                inputElement.value = gateBuffer;
                
                // تحديث حالة الماسح
                updateScannerStatus('جاري المسح...');
            }
        });
    }

    // معالجة بطاقة البوابة
    async function processGateCard(cardUid) {
        try {
            // عرض حالة التحميل
            updateScannerStatus('جاري التعرف على البطاقة...');
            showGateSpinner(true);
            
            const normalizedCardId = normalizeCardNumber(cardUid);
            const readerType = detectReaderType(cardUid);
            
            // البحث عن البطاقة في النظام
            const response = await fetch(`/api/cards/uid/${normalizedCardId}`, {
                headers: getAuthHeaders()
            });

            if (response.status === 404) {
                // بطاقة غير معروفة
                showGateResult('unknown', {
                    cardNumber: normalizedCardId,
                    readerType: readerType
                });
                return;
            }

            if (response.status === 401) {
                logout();
                return;
            }

            const cardData = await response.json();
            
            if (cardData.student) {
                // الحصول على معلومات الطالب
                const studentResponse = await fetch(`/api/students/${cardData.student._id}`, {
                    headers: getAuthHeaders()
                });
                
                if (studentResponse.ok) {
                    const student = await studentResponse.json();
                    
                    // عرض معلومات الطالب
                    showGateResult('student', {
                        student: student,
                        cardNumber: normalizedCardId,
                        readerType: readerType
                    });
                    
                    // محاولة تسجيل الحضور تلقائياً
                    setTimeout(async () => {
                        try {
                            // التحقق أولاً إذا كان الحضور مسجلاً مسبقاً
                            const today = new Date().toISOString().split('T')[0];
                            const attendanceCheck = await fetch(`/api/attendance/check?student=${cardData.student._id}&date=${today}`, {
                                headers: getAuthHeaders()
                            });
                            
                            if (attendanceCheck.ok) {
                                const checkData = await attendanceCheck.json();
                                if (checkData.exists) {
                                    // الحضور مسجل مسبقاً
                                    showGateResult('already_registered', {
                                        student: student,
                                        class: checkData.class,
                                        timestamp: checkData.timestamp
                                    });
                                    return;
                                }
                            }
                            
                            // إذا لم يكن مسجلاً، تابع مع handleGateAttendance
                            await handleGateAttendance(normalizedCardId);
                        } catch (err) {
                            console.error('Error in attendance pre-check:', err);
                            await handleGateAttendance(normalizedCardId);
                        }
                    }, 1000);
                }
            }
        } catch (err) {
            console.error('Error processing gate card:', err);
            showGateResult('error', {
                error: err.message
            });
        } finally {
            showGateSpinner(false);
            updateScannerStatus('جاهز للمسح');
        }
    }

    // عرض نتيجة المسح في البوابة
    function showGateResult(type, data) {
        const resultElement = document.getElementById('gateRfidResult');
        
        switch (type) {
            case 'student':
                resultElement.innerHTML = `
                    <div class="scan-success p-3">
                        <div class="text-center">
                            <i class="bi bi-check-circle-fill text-success" style="font-size: 2rem;"></i>
                            <h5 class="mt-2">تم التعرف على الطالب</h5>
                        </div>
                        <div class="student-details mt-3">
                            <p><strong>الاسم:</strong> ${data.student.name}</p>
                            <p><strong>رقم الطالب:</strong> ${data.student.studentId}</p>
                            <p><strong>الصف:</strong> ${getAcademicYearName(data.student.academicYear) || 'غير محدد'}</p>
                            <p><strong>نوع القارئ:</strong> ${data.readerType === 'new_reader' ? 'جديد' : 'قديم'}</p>
                        </div>
                        <div class="text-center mt-3">
                            <div class="spinner-border spinner-border-sm text-primary" role="status">
                                <span class="visually-hidden">جاري تسجيل الحضور...</span>
                            </div>
                            <span class="ms-2">جاري تسجيل الحضور...</span>
                        </div>
                    </div>
                `;
                break;
                
            case 'unknown':
                resultElement.innerHTML = `
                    <div class="alert alert-warning">
                        <div class="text-center">
                            <i class="bi bi-exclamation-triangle-fill" style="font-size: 2rem;"></i>
                            <h5 class="mt-2">بطاقة غير معروفة</h5>
                        </div>
                        <p class="text-center">رقم البطاقة: ${data.cardNumber}</p>
                        <div class="text-center">
                            <button class="btn btn-sm btn-primary" onclick="showAssignCardModal('${data.cardNumber}')">
                                <i class="bi bi-link"></i> ربط البطاقة
                            </button>
                        </div>
                    </div>
                `;
                break;
                
            case 'error':
                resultElement.innerHTML = `
                    <div class="alert alert-danger">
                        <div class="text-center">
                            <i class="bi bi-x-circle-fill" style="font-size: 2rem;"></i>
                            <h5 class="mt-2">خطأ في المعالجة</h5>
                        </div>
                        <p class="text-center">${data.error || 'حدث خطأ غير متوقع'}</p>
                    </div>
                `;
                break;
                case 'already_registered':
                    resultElement.innerHTML = `
                        <div class="alert alert-info">
                            <div class="text-center">
                                <i class="bi bi-info-circle-fill" style="font-size: 2rem;"></i>
                                <h5 class="mt-2">الحضور مسجل مسبقاً</h5>
                            </div>
                            <div class="student-details mt-3">
                                <p><strong>الطالب:</strong> ${data.student.name}</p>
                                <p><strong>الحصة:</strong> ${data.class.name}</p>
                                <p><strong>وقت التسجيل:</strong> ${new Date(data.timestamp).toLocaleTimeString('ar-EG')}</p>
                            </div>
                            <div class="text-center mt-3">
                                <button class="btn btn-sm btn-outline-secondary" onclick="clearGateResults()">
                                    <i class="bi bi-x-circle"></i> مسح النتيجة
                                </button>
                            </div>
                        </div>
                    `;
                    break;

                    // في دالة showGateResult، أضف حالة المتأخرين
    case 'student':
        const statusBadge = data.status === 'late' ? 
            '<span class="badge bg-warning">متأخر</span>' : 
            '<span class="badge bg-success">حاضر</span>';
        
        resultElement.innerHTML = `
            <div class="scan-success p-3">
                <div class="text-center">
                    <i class="bi bi-check-circle-fill text-${data.status === 'late' ? 'warning' : 'success'}" 
                    style="font-size: 2rem;"></i>
                    <h5 class="mt-2">${data.status === 'late' ? 'تم التسجيل (متأخر)' : 'تم التسجيل'}</h5>
                </div>
                <div class="student-details mt-3">
                    <p><strong>الاسم:</strong> ${data.student.name} ${statusBadge}</p>
                    <p><strong>رقم الطالب:</strong> ${data.student.studentId}</p>
                    <p><strong>الصف:</strong> ${getAcademicYearName(data.student.academicYear) || 'غير محدد'}</p>
                    <p><strong>الوقت:</strong> ${new Date().toLocaleTimeString('ar-EG')}</p>
                </div>
            </div>
        `;
        break;
        }
        
        // إضافة إلى السجلات الحديثة
        addToRecentScans(type, data);
    }

    // تحديث حالة الماسح
    function updateScannerStatus(status) {
        const statusElement = document.getElementById('gateScannerStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    // عرض/إخفاء spinner الماسح
    function showGateSpinner(show) {
        const spinner = document.getElementById('gateSpinner');
        if (spinner) {
            spinner.style.display = show ? 'inline-block' : 'none';
        }
    }

    // تحميل إحصائيات البوابة
    async function loadGateStatistics() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`/api/attendance/statistics?date=${today}`, {
                headers: getAuthHeaders()
            });
            
            if (response.ok) {
                const stats = await response.json();
                updateGateStatistics(stats);
            }
        } catch (err) {
            console.error('Error loading gate statistics:', err);
        }
    }

    // تحديث إحصائيات البوابة
    function updateGateStatistics(stats) {
        document.getElementById('todayScans').textContent = stats.totalScans || 0;
        document.getElementById('presentCount').textContent = stats.present || 0;
        document.getElementById('absentCount').textContent = stats.absent || 0;
        document.getElementById('lateCount').textContent = stats.late || 0;
    }

    // إدارة السجلات الحديثة
    function addToRecentScans(type, data) {
        const scans = JSON.parse(localStorage.getItem('gateRecentScans') || '[]');
        
        // إضافة المسح الجديد
        scans.unshift({
            type: type,
            data: data,
            timestamp: new Date().toISOString()
        });
        
        // الاحتفاظ فقط بآخر 10 مسحات
        if (scans.length > 10) {
            scans.pop();
        }
        
        localStorage.setItem('gateRecentScans', JSON.stringify(scans));
        updateRecentScansList();
    }

    // تحديث قائمة السجلات الحديثة
    function updateRecentScansList() {
        const scans = JSON.parse(localStorage.getItem('gateRecentScans') || '[]');
        const listElement = document.getElementById('recentScansList');
        
        if (listElement) {
            listElement.innerHTML = '';
            
            scans.forEach((scan, index) => {
                const item = document.createElement('div');
                item.className = 'list-group-item';
                
                if (scan.type === 'student') {
                    item.innerHTML = `
                        <div class="d-flex justify-content-between">
                            <div>
                                <strong>${scan.data.student.name}</strong>
                                <br>
                                <small>${scan.data.student.studentId}</small>
                            </div>
                            <div class="text-end">
                                <span class="badge bg-success">حضور</span>
                                <br>
                                <small>${new Date(scan.timestamp).toLocaleTimeString('ar-EG')}</small>
                            </div>
                        </div>
                    `;
                } else {
                    item.innerHTML = `
                        <div class="d-flex justify-content-between">
                            <div>
                                <strong>بطاقة غير معروفة</strong>
                                <br>
                                <small>${scan.data.cardNumber}</small>
                            </div>
                            <div class="text-end">
                                <span class="badge bg-warning">غير معروف</span>
                                <br>
                                <small>${new Date(scan.timestamp).toLocaleTimeString('ar-EG')}</small>
                            </div>
                        </div>
                    `;
                }
                
                listElement.appendChild(item);
            });
        }
    }

    // عرض/إخفاء السجلات الحديثة
    function showRecentScans() {
        const section = document.getElementById('recentScansSection');
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
        updateRecentScansList();
    }

    // مسح النتائج
    function clearGateResults() {
        document.getElementById('gateRfidResult').innerHTML = `
            <div class="gate-placeholder">
                <i class="bi bi-credit-card-2-front " style="font-size: 3rem;"></i>
                <p class=" mt-2">سيظهر هنا معلومات الطالب بعد مسح البطاقة</p>
            </div>
        `;
    }

    // تسجيل الحضور يدوياً
    function manualAttendance() {
        Swal.fire({
            title: 'التسجيل اليدوي',
            html: `
                <input type="text" id="manualStudentId" class="swal2-input" placeholder="رقم الطالب">
                <select id="manualStatus" class="swal2-input">
                    <option value="present">حاضر</option>
                    <option value="late">متأخر</option>
                    <option value="absent">غائب</option>
                </select>
            `,
            showCancelButton: true,
            confirmButtonText: 'تسجيل',
            cancelButtonText: 'إلغاء',
            preConfirm: () => {
                return {
                    studentId: document.getElementById('manualStudentId').value,
                    status: document.getElementById('manualStatus').value
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // تنفيذ التسجيل اليدوي هنا
            }
        });
    }

    async function debugAttendance(studentId, classId) {
        try {
            
            // التحقق من الحضور الحالي
            const response = await fetch(`/api/attendance/check?student=${studentId}&class=${classId}&date=${new Date().toISOString().split('T')[0]}`, {
                headers: getAuthHeaders()
            });
            
            if (response.ok) {
                const attendanceData = await response.json();
                
                if (attendanceData.exists) {
                    return true;
                }
            }
            return false;
        } catch (err) {
            console.error('Debug error:', err);
            return false;
        }
    }





    /**
    * Generates and opens a professional-looking attendance sheet in a new window for printing.
    * This version includes a dynamic school logo, a correctly placed QR code, an attendance summary,
    * and is styled to handle a large number of students efficiently.
    *
    * @param {string} liveClassId The ID of the live class to fetch data for.
    */
    async function printAttendanceSheet(liveClassId) {
        try {
            // Fetch the class data from the API
            const response = await fetch(`/api/live-classes/${liveClassId}`, {
                headers: getAuthHeaders() // Assuming this function returns necessary auth headers
            });

            if (!response.ok) {
                throw new Error('فشل في تحميل بيانات الحصة. الرجاء المحاولة مرة أخرى.');
            }

            const liveClass = await response.json();
            const attendanceData = liveClass.attendance || [];

            // --- Attendance Summary Calculation ---
            const totalStudents = attendanceData.length;
            const presentCount = attendanceData.filter(att => att.status === 'present').length;
            const absentCount = attendanceData.filter(att => att.status === 'absent').length;
            const lateCount = attendanceData.filter(att => att.status === 'late').length;


            // Create the print window
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                Swal.fire('خطأ', 'فشل في فتح نافذة الطباعة. الرجاء السماح بالنوافذ المنبثقة.', 'error');
                return;
            }

            // SVG QR Code (as provided in the original code)
            const qrCodeSvg = `<image src="assets/redox-qr.svg" alt="QR Code">`;

            // Function to get status display with icons
            const getStatusDisplay = (status) => {
                const icons = {
                    present: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
                    absent: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
                    late: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
                };
                switch (status) {
                    case 'present': return `<span class="status-icon status-present">${icons.present} حاضر</span>`;
                    case 'absent': return `<span class="status-icon status-absent">${icons.absent} غائب</span>`;
                    case 'late': return `<span class="status-icon status-late">${icons.late} متأخر</span>`;
                    default: return `<span>غير مسجل</span>`;
                }
            };

            // Generate the HTML content for the attendance sheet
            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>كشف حضور وغياب - ${liveClass.class.name}</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
                    <style>
                        :root {
                            --primary-color: #0d6efd;
                            --border-color: #dee2e6;
                            --header-bg: #f8f9fa;
                            --present-color: #198754;
                            --absent-color: #dc3545;
                            --late-color: #fd7e14;
                        }
                        body {
                            font-family: 'Cairo', 'Arial', sans-serif;
                            margin: 0;
                            background-color: #f4f4f4;
                            -webkit-print-color-adjust: exact;
                            color-adjust: exact;
                        }
                        .page {
                            background: white;
                            width: 210mm;
                            min-height: 297mm;
                            margin: 10px auto;
                            padding: 10mm;
                            box-shadow: 0 0 10px rgba(0,0,0,0.1);
                            box-sizing: border-box;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            border-bottom: 3px solid var(--primary-color);
                            padding-bottom: 10px;
                            margin-bottom: 15px;
                        }
                        .header-left {
                            display: flex;
                            align-items: center;
                            gap: 15px;
                        }
                        .school-logo {
                            width: 60px;
                            height: 60px;
                        }
                        .school-info .school-name {
                            font-size: 22px;
                            font-weight: 700;
                            color: #000;
                        }
                        .school-info .document-title {
                            font-size: 18px;
                            color: #555;
                            margin-top: 2px;
                        }
                        .qr-code-container {
                            border: 1px solid var(--border-color);
                            padding: 2px;
                            border-radius: 4px;
                        }
                        .class-info-grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 10px 20px;
                            background-color: var(--header-bg);
                            padding: 12px;
                            border-radius: 6px;
                            margin-bottom: 15px;
                            border: 1px solid var(--border-color);
                            font-size: 14px;
                        }
                        .summary-grid {
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            gap: 10px;
                            margin-bottom: 15px;
                            text-align: center;
                        }
                        .summary-box {
                            background-color: #f8f9fa;
                            border: 1px solid var(--border-color);
                            border-radius: 6px;
                            padding: 8px;
                        }
                        .summary-box .value { font-size: 18px; font-weight: 700; display: block; }
                        .summary-box .label { font-size: 12px; color: #6c757d; }
                        .summary-box.present .value { color: var(--present-color); }
                        .summary-box.absent .value { color: var(--absent-color); }
                        .summary-box.late .value { color: var(--late-color); }
                        .summary-box.total .value { color: var(--primary-color); }
                        
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 10px; /* Reduced for more rows */
                        }
                        th, td {
                            border: 1px solid var(--border-color);
                            padding: 4px; /* Reduced for more rows */
                            text-align: center;
                            vertical-align: middle;
                        }
                        thead {
                            background-color: #343a40;
                            color: white;
                            font-size: 11px;
                            font-weight: 600;
                        }
                        tbody tr:nth-child(even) {
                            background-color: var(--header-bg);
                        }
                        .status-icon {
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 4px;
                            font-weight: 600;
                        }
                        .status-icon svg { width: 12px; height: 12px; }
                        .status-present { color: var(--present-color); }
                        .status-absent { color: var(--absent-color); }
                        .status-late { color: var(--late-color); }

                        .signatures {
                            margin-top: 40px;
                            display: flex;
                            justify-content: space-around;
                        }
                        .signature-block {
                            text-align: center;
                            font-size: 14px;
                        }
                        .signature-line {
                            width: 200px;
                            border-bottom: 1px solid #000;
                            margin-top: 40px;
                        }
                        .footer {
                            margin-top: 20px;
                            text-align: center;
                            font-size: 10px;
                            color: #777;
                            border-top: 1px solid var(--border-color);
                            padding-top: 8px;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        }
                        .footer .redox-logo { height: 20px; }

                        .print-controls { text-align: center; margin: 20px 0; }
                        .print-button {
                            padding: 10px 20px;
                            font-size: 16px; border: none; border-radius: 5px; cursor: pointer;
                            color: white; margin: 0 5px; font-family: 'Cairo', sans-serif;
                        }
                        .print-btn { background-color: #198754; }
                        .close-btn { background-color: #6c757d; }

                        @media print {
                            body { background-color: white; margin: 0; }
                            .page { box-shadow: none; margin: 0; padding: 8mm; width: 100%; min-height: 0; }
                            .print-controls { display: none; }
                            thead { display: table-header-group; }
                            tbody tr { page-break-inside: avoid; }
                            .signatures { page-break-before: auto; }
                            .footer { position: fixed; bottom: 8px; width: calc(100% - 16mm); }
                        }
                    </style>
                </head>
                <body>
                    <div class="page">
                        <div class="header">
                            <div class="header-left">
                                <img src="assets/9anadil.jpg" alt="شعار المدرسة" class="school-logo">
                                <div class="school-info">
                                    <div class="school-name">${liveClass.class.school?.name || 'القناديل سكول'}</div>
                                    <div class="document-title">كشف الحضور والغياب</div>
                                </div>
                            </div>
                            <div class="qr-code-container">
                                ${qrCodeSvg}
                            </div>
                        </div>

                        <div class="class-info-grid">
                            <div><strong>الحصة الدراسية:</strong> ${liveClass.class.name}</div>
                            <div><strong>الأستاذ:</strong> ${liveClass.teacher.name}</div>
                            <div><strong>المادة:</strong> ${liveClass.subject || 'غير محدد'}</div>
                            <div><strong>التاريخ:</strong> ${new Date(liveClass.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                        </div>

                        <div class="summary-grid">
                            <div class="summary-box total"><span class="value">${totalStudents}</span><span class="label">إجمالي الطلاب</span></div>
                            <div class="summary-box present"><span class="value">${presentCount}</span><span class="label">حاضر</span></div>
                            <div class="summary-box absent"><span class="value">${absentCount}</span><span class="label">غائب</span></div>
                            <div class="summary-box late"><span class="value">${lateCount}</span><span class="label">متأخر</span></div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 5%;">#</th>
                                    <th style="width: 15%;">رقم الطالب</th>
                                    <th>اسم الطالب</th>
                                    <th style="width: 15%;">الحالة</th>
                                    <th style="width: 20%;">التوقيع</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${attendanceData.length > 0 ?
                                    attendanceData.map((att, index) => `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td>${att.student.studentId}</td>
                                            <td style="text-align: right; padding-right: 10px;">${att.student.name}</td>
                                            <td>${getStatusDisplay(att.status)}</td>
                                            <td></td>
                                        </tr>
                                    `).join('') :
                                    '<tr><td colspan="5">لا توجد بيانات حضور مسجلة لهذه الحصة.</td></tr>'
                                }
                            </tbody>
                        </table>
                        
                        <div class="signatures">
                            <div class="signature-block">
                                <div>توقيع الأستاذ</div>
                                <div class="signature-line"></div>
                            </div>
                            <div class="signature-block">
                                <div>ختم وتوقيع الإدارة</div>
                                <div class="signature-line"></div>
                            </div>
                        </div>

                        <div class="footer">
                            <span>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</span>
                            <span><img src="assets/redox-icon.png" alt="Redox System" class="redox-logo"></span>
                        </div>
                    </div>

                    <div class="print-controls">
                        <button onclick="window.print()" class="print-button print-btn">طباعة الكشف</button>
                        <button onclick="window.close()" class="print-button close-btn">إغلاق النافذة</button>
                    </div>
                </body>
                </html>
            `);

            printWindow.document.close();

        } catch (err) {
            console.error('Error printing attendance sheet:', err);
            Swal.fire('خطأ', err.message || 'حدث خطأ أثناء تحضير وثيقة الغياب.', 'error');
        }
    } 



    // Initialize accounting section
    function initAccountingSection() {
        loadAccountingData();
        setupAccountingEventListeners();
        startAccountingAutoRefresh();
        
        // تعيين التاريخ الافتراضي لنماذج الإضافة
        document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    }

    // إضافة مستمع حدث لقسم المحاسبة
    document.getElementById('accounting-link').addEventListener('click', function() {
        initAccountingSection();
    });


    // Load accounting data
    async function loadAccountingData() {
        try {
            // حساب الدخل اليومي أولاً
            await calculateDailyIncome();
            
            // تحميل آخر المعاملات
            const transactionsResponse = await fetch('/api/accounting/transactions?limit=1000', {
                headers: getAuthHeaders()
            });
            
            if (transactionsResponse.ok) {
                const transactions = await transactionsResponse.json();
                renderTransactionsTable(transactions);
            }
            
        } catch (err) {
            console.error('Error loading accounting data:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل بيانات المحاسبة', 'error');
        }
    }


    // Update balance UI
    function updateBalanceUI(balanceData) {
        const totalBudgetEl = document.getElementById('totalBudget');
        const totalIncomeEl = document.getElementById('totalIncome');
        const totalExpensesEl = document.getElementById('totalExpenses');
        const remainingBalanceEl = document.getElementById('remainingBalance');
        
        if (totalBudgetEl) totalBudgetEl.textContent = `${balanceData.balance || 0} د.ج`;
        if (totalIncomeEl) totalIncomeEl.textContent = `${balanceData.income || 0} د.ج`;
        if (totalExpensesEl) totalExpensesEl.textContent = `${balanceData.expenses || 0} د.ج`;
        if (remainingBalanceEl) remainingBalanceEl.textContent = `${balanceData.balance || 0} د.ج`;
    }

    function updateTodayStatsUI(stats) {
        const todayIncomeEl = document.getElementById('todayIncome');
        const todayExpensesEl = document.getElementById('todayExpenses');
        const todayProfitEl = document.getElementById('todayProfit');
        
        if (todayIncomeEl) todayIncomeEl.textContent = `${stats.income || 0} د.ج`;
        if (todayExpensesEl) todayExpensesEl.textContent = `${stats.expenses || 0} د.ج`;
        if (todayProfitEl) todayProfitEl.textContent = `${(stats.income || 0) - (stats.expenses || 0)} د.ج`;
    }

    // Render transactions table
    function renderTransactionsTable(transactions) {
        const tableBody = document.getElementById('transactionsTable');
        tableBody.innerHTML = '';
        
        if (transactions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-muted">لا توجد معاملات مسجلة</td>
                </tr>
            `;
            return;
        }
        
        transactions.forEach((transaction, index) => {
            const row = document.createElement('tr');
            
            const typeBadge = transaction.type === 'income' ? 
                '<span class="badge bg-success">إيراد</span>' : 
                '<span class="badge bg-danger">مصروف</span>';
            
            row.innerHTML = `
                <td>${new Date(transaction.date).toLocaleDateString('ar-EG')}</td>
                <td>${typeBadge}</td>
                <td>${transaction.description || 'لا يوجد وصف'}</td>
                <td>${transaction.amount} د.ج</td>
                <td>${transaction.category || 'عام'}</td>
                <td>${transaction.recordedBy?.username || 'نظام'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-info" onclick="viewTransactionDetails('${transaction._id}')">
                        <i class="bi bi-eye"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }


    function startAccountingAutoRefresh() {
        setInterval(() => {
            if (document.getElementById('accounting').classList.contains('active')) {
                calculateDailyIncome();
            }
        }, 60000); // تحديث كل دقيقة
    }

    // Load recipients for expense form
    async function loadRecipientsForExpenses() {
        try {
        // Load teachers
        const teachersResponse = await fetch('/api/teachers', {
            headers: getAuthHeaders()
        });
        
        // Load employees
        const employeesResponse = await fetch('/api/employees', {
            headers: getAuthHeaders()
        });
        
        if (teachersResponse.ok && employeesResponse.ok) {
            const teachers = await teachersResponse.json();
            const employees = await employeesResponse.json();
            
            const recipientSelect = document.getElementById('expenseRecipient');
            recipientSelect.innerHTML = '<option value="">اختر المستلم</option>';
            
            // Add teachers
            teachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = `teacher_${teacher._id}`;
            option.textContent = `${teacher.name} (معلم)`;
            option.dataset.type = 'teacher';
            recipientSelect.appendChild(option);
            });
            
            // Add employees
            employees.forEach(employee => {
            const option = document.createElement('option');
            option.value = `staff_${employee._id}`;
            option.textContent = `${employee.fullName} (موظف)`;
            option.dataset.type = 'staff';
            recipientSelect.appendChild(option);
            });
            
            // Add other option
            const otherOption = document.createElement('option');
            otherOption.value = 'other';
            otherOption.textContent = 'أخرى';
            otherOption.dataset.type = 'other';
            recipientSelect.appendChild(otherOption);
        }
        } catch (err) {
        console.error('Error loading recipients:', err);
        }
    }

    // Setup accounting event listeners
    function setupAccountingEventListeners() {
        // Save budget button
        document.getElementById('saveBudgetBtn').addEventListener('click', addBudget);
        
        // Save expense button
        document.getElementById('saveExpenseBtn').addEventListener('click', addExpense);
        
        // Update recipient options when type changes
        document.getElementById('expenseRecipientType').addEventListener('change', function() {
        updateRecipientOptions(this.value);
        });
        
        // Update recipient type when expense type changes
        document.getElementById('expenseType').addEventListener('change', function() {
        if (this.value === 'teacher_payment') {
            document.getElementById('expenseRecipientType').value = 'teacher';
        } else if (this.value === 'staff_salary') {
            document.getElementById('expenseRecipientType').value = 'staff';
        } else {
            document.getElementById('expenseRecipientType').value = 'other';
        }
        updateRecipientOptions(document.getElementById('expenseRecipientType').value);
        });
        
        // Initialize recipient options
        updateRecipientOptions('teacher');
    }

    // Update recipient options based on type
    function updateRecipientOptions(recipientType) {
        const recipientSelect = document.getElementById('expenseRecipient');
        const options = recipientSelect.options;
        
        for (let i = 0; i < options.length; i++) {
        const option = options[i];
        if (option.value === "" || option.value === "other") continue;
        
        if (option.dataset.type === recipientType) {
            option.style.display = '';
        } else {
            option.style.display = 'none';
        }
        }
        
        // Select the first visible option
        for (let i = 0; i < options.length; i++) {
        if (options[i].style.display !== 'none' && options[i].value !== "") {
            recipientSelect.value = options[i].value;
            break;
        }
        }
    }

    // Add budget
    async function addBudget() {
        const budgetData = {
        type: document.getElementById('budgetType').value,
        amount: parseFloat(document.getElementById('budgetAmount').value),
        description: document.getElementById('budgetDescription').value
        };
        
        try {
        const response = await fetch('/api/accounting/budget', {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
            },
            body: JSON.stringify(budgetData)
        });
        
        if (response.ok) {
            Swal.fire('نجاح', 'تم إضافة الميزانية بنجاح', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addBudgetModal')).hide();
            document.getElementById('addBudgetForm').reset();
            loadAccountingData();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'حدث خطأ أثناء إضافة الميزانية');
        }
        } catch (err) {
        console.error('Error adding budget:', err);
        Swal.fire('خطأ', err.message, 'error');
        }
    }

    // Add expense
    async function addExpense() {
        const recipientValue = document.getElementById('expenseRecipient').value;
        const [recipientType, recipientId] = recipientValue.includes('_') ? 
        recipientValue.split('_') : [recipientValue, null];
        
        const expenseData = {
        description: document.getElementById('expenseDescription').value,
        amount: parseFloat(document.getElementById('expenseAmount').value),
        category: document.getElementById('expenseCategory').value,
        type: document.getElementById('expenseType').value,
        recipient: {
            type: recipientType,
            id: recipientId,
            name: document.getElementById('expenseRecipient').options[document.getElementById('expenseRecipient').selectedIndex].text
        },
        paymentMethod: document.getElementById('expensePaymentMethod').value,
        date: document.getElementById('expenseDate').value
        };
        
        try {
        const response = await fetch('/api/accounting/expenses', {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
            },
            body: JSON.stringify(expenseData)
        });
        
        if (response.ok) {
            Swal.fire('نجاح', 'تم تسجيل المصروف بنجاح', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addExpenseModal')).hide();
            document.getElementById('addExpenseForm').reset();
            loadAccountingData();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'حدث خطأ أثناء تسجيل المصروف');
        }
        } catch (err) {
        console.error('Error adding expense:', err);
        Swal.fire('خطأ', err.message, 'error');
        }
    }

    // View transaction details
    async function viewTransactionDetails(transactionId) {
        try {
        const response = await fetch(`/api/accounting/transactions/${transactionId}`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const transaction = await response.json();
            
            Swal.fire({
            title: 'تفاصيل المعاملة',
            html: `
                <div class="text-start">
                <p><strong>النوع:</strong> ${transaction.type === 'income' ? 'إيراد' : 'مصروف'}</p>
                <p><strong>المبلغ:</strong> ${transaction.amount} د.ج</p>
                <p><strong>الوصف:</strong> ${transaction.description || 'لا يوجد'}</p>
                <p><strong>الفئة:</strong> ${transaction.category || 'عام'}</p>
                <p><strong>التاريخ:</strong> ${new Date(transaction.date).toLocaleDateString('ar-EG')}</p>
                <p><strong>مسجل بواسطة:</strong> ${transaction.recordedBy?.username || 'نظام'}</p>
                </div>
            `,
            icon: 'info',
            confirmButtonText: 'حسناً'
            });
        }
        } catch (err) {
        console.error('Error viewing transaction details:', err);
        }
    }

    // Generate financial report
    async function generateFinancialReport() {
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        
        if (!startDate || !endDate) {
        Swal.fire('خطأ', 'يرجى تحديد تاريخ البداية والنهاية', 'error');
        return;
        }
        
        try {
        const response = await fetch(`/api/accounting/reports/financial?startDate=${startDate}&endDate=${endDate}`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const report = await response.json();
            displayFinancialReport(report);
        } else {
            throw new Error('فشل في إنشاء التقرير');
        }
        } catch (err) {
        console.error('Error generating financial report:', err);
        Swal.fire('خطأ', err.message, 'error');
        }
    }

    // Display financial report
    function displayFinancialReport(report) {
        const reportResults = document.getElementById('reportResults');
        
        const html = `
        <div class="card">
            <div class="card-header">
            <h6 class="mb-0">التقرير المالي للفترة من ${report.period.startDate} إلى ${report.period.endDate}</h6>
            </div>
            <div class="card-body">
            <div class="row mb-4">
                <div class="col-md-4">
                <div class="card bg-success text-white text-center">
                    <div class="card-body">
                    <h6 class="card-title">إجمالي الإيرادات</h6>
                    <h4>${report.revenue.total || 0} د.ج</h4>
                    </div>
                </div>
                </div>
                <div class="col-md-4">
                <div class="card bg-danger text-white text-center">
                    <div class="card-body">
                    <h6 class="card-title">إجمالي المصروفات</h6>
                    <h4>${report.expenses.total || 0} د.ج</h4>
                    </div>
                </div>
                </div>
                <div class="col-md-4">
                <div class="card bg-info text-white text-center">
                    <div class="card-body">
                    <h6 class="card-title">صافي الربح</h6>
                    <h4>${(report.revenue.total || 0) - (report.expenses.total || 0)} د.ج</h4>
                    </div>
                </div>
                </div>
            </div>
            
            <h6>تفصيل المصروفات حسب الفئة:</h6>
            <ul class="list-group">
                ${Object.entries(report.expensesByCategory || {}).map(([category, amount]) => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    ${category}
                    <span class="badge bg-danger rounded-pill">${amount} د.ج</span>
                </li>
                `).join('')}
            </ul>
            </div>
        </div>
        `;
        
        reportResults.innerHTML = html;
    }

    // Add event listener for accounting section
    document.getElementById('accounting-link').addEventListener('click', function() {
        initAccountingSection();
    });


    // دالة لعرض modal التسجيل في حصص متعددة
    async function showMultiEnrollModal(studentId) {
        try {
            // حفظ معرف الطالب في متغير عام
            window.currentStudentId = studentId;
            
            // جلب بيانات الطالب
            const studentResponse = await fetch(`/api/students/${studentId}`, {
                headers: getAuthHeaders()
            });
            
            if (studentResponse.status === 401) {
                logout();
                return;
            }
            
            const student = await studentResponse.json();
            
            // جلب جميع الحصص
            const classesResponse = await fetch('/api/classes', {
                headers: getAuthHeaders()
            });
            
            const allClasses = await classesResponse.json();

            // تصفية الحصص المتاحة
            const availableClasses = allClasses.filter(cls => {
                const isEnrolled = student.classes?.some(studentClass => 
                    studentClass._id === cls._id || studentClass === cls._id
                );
                
                if (isEnrolled) return false;
                
                if (!cls.academicYear || cls.academicYear === 'NS' || cls.academicYear === 'غير محدد') {
                    return true;
                }
                
                return cls.academicYear === student.academicYear;
            });

            // تعبئة قائمة الحصص
            const classesChecklist = document.getElementById('classesChecklist');
            classesChecklist.innerHTML = '';

            if (availableClasses.length === 0) {
                classesChecklist.innerHTML = `
                    <div class="alert alert-warning text-center">
                        لا توجد حصص متاحة للتسجيل
                    </div>
                `;
                document.getElementById('confirmMultiEnroll').disabled = true;
            } else {
                availableClasses.forEach((cls, index) => {
                    const classItem = document.createElement('div');
                    classItem.className = 'form-check mb-2';
                    classItem.innerHTML = `
                        <input class="form-check-input class-checkbox" type="checkbox" 
                            value="${cls._id}" id="class-${cls._id}">
                        <label class="form-check-label w-100" for="class-${cls._id}">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>${cls.name}</strong> - ${cls.subject} 
                                    <span class="text-muted">(${getAcademicYearName(cls.academicYear) || 'جميع المستويات'})</span>
                                </div>
                                <span class="badge bg-info">${cls.price} د.ج</span>
                            </div>
                            ${cls.schedule && cls.schedule.length > 0 ? `
                                <div class="schedule-info mt-1">
                                    <small class="text-muted">
                                        ${cls.schedule.map(s => `${s.day} ${s.time}`).join('، ')}
                                    </small>
                                </div>
                            ` : ''}
                        </label>
                    `;
                    classesChecklist.appendChild(classItem);
                });

                // تحديث عدد الحصص المختارة
                updateSelectedClassesCount();
                
                // إضافة event listener للcheckboxes
                const checkboxes = classesChecklist.querySelectorAll('.class-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', updateSelectedClassesCount);
                });
            }

            // تحديث عنوان الـ modal
            const modalTitle = document.querySelector('#multiEnrollModal .modal-title');
            if (modalTitle) {
                modalTitle.textContent = `تسجيل الطالب ${student.name} في حصص متعددة`;
            }

            // تهيئة أحداث الزر قبل فتح الـ modal
            initializeMultiEnrollEvents();
            
            // فتح الـ modal
            const multiEnrollModal = new bootstrap.Modal(document.getElementById('multiEnrollModal'));
            multiEnrollModal.show();
            
        } catch (error) {
            console.error('Error showing multi-enroll modal:', error);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل البيانات', 'error');
        }
    }





    // دالة تحديث عدد الحصص المختارة
    function updateSelectedClassesCount() {
        const selectedCount = document.querySelectorAll('.class-checkbox:checked').length;
        const countElement = document.getElementById('selectedClassesCount');
        const confirmBtn = document.getElementById('confirmMultiEnroll');
        
        if (countElement) {
            countElement.textContent = selectedCount;
        }
        
        if (confirmBtn) {
            confirmBtn.disabled = selectedCount === 0;
            confirmBtn.textContent = selectedCount > 0 ? 
                `تأكيد التسجيل في ${selectedCount} حصة` : 
                'تأكيد التسجيل';
        }
    }


    // دالة تأكيد التسجيل في الحصص المتعددة
    async function confirmMultiEnrollment() {
        
        const selectedCheckboxes = document.querySelectorAll('.class-checkbox:checked');
        const selectedClasses = Array.from(selectedCheckboxes).map(checkbox => checkbox.value);
        
        if (selectedClasses.length === 0) {
            Swal.fire('تحذير', 'يرجى اختيار حصة واحدة على الأقل', 'warning');
            return;
        }
        
        // التأكد من وجود معرف الطالب
        if (!window.currentStudentId) {
            Swal.fire('خطأ', 'لم يتم تحديد طالب', 'error');
            return;
        }
        
        try {
            // إظهار مؤشر التحميل
            Swal.fire({
                title: 'جاري التسجيل',
                html: `جاري تسجيل الطالب في ${selectedClasses.length} حصة...`,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // تنفيذ عمليات التسجيل
            const enrollmentPromises = selectedClasses.map(async (classId) => {
                try {
                    const response = await fetch(`/api/classes/${classId}/enroll/${window.currentStudentId}`, {
                        method: 'POST',
                        headers: getAuthHeaders()
                    });
                    
                    if (response.ok) {
                        return {
                            classId: classId,
                            status: 'success',
                            data: await response.json()
                        };
                    } else {
                        const errorData = await response.json();
                        return {
                            classId: classId,
                            status: 'error',
                            error: errorData.error || 'فشل في التسجيل'
                        };
                    }
                } catch (error) {
                    return {
                        classId: classId,
                        status: 'error',
                        error: error.message
                    };
                }
            });

            const enrollmentResults = await Promise.all(enrollmentPromises);
            
            // تحليل النتائج
            const successfulEnrollments = enrollmentResults.filter(result => result.status === 'success');
            const failedEnrollments = enrollmentResults.filter(result => result.status === 'error');
            
            // إغلاق نافذة التحميل
            Swal.close();
            
            // عرض النتائج
            if (failedEnrollments.length === 0) {
                Swal.fire({
                    icon: 'success',
                    title: 'تم التسجيل بنجاح',
                    html: `تم تسجيل الطالب في ${successfulEnrollments.length} حصة بنجاح`,
                    confirmButtonText: 'حسناً'
                }).then(() => {
                    // إغلاق الـ modal بعد النجاح
                    const multiEnrollModal = bootstrap.Modal.getInstance(document.getElementById('multiEnrollModal'));
                    if (multiEnrollModal) {
                        multiEnrollModal.hide();
                    }
                    
                    // تحديث البيانات
                    refreshDataAfterEnrollment();
                });
            } else {
                let errorMessage = `تم التسجيل في ${successfulEnrollments.length} حصة بنجاح<br>`;
                errorMessage += `فشل التسجيل في ${failedEnrollments.length} حصة`;
                
                if (failedEnrollments.length > 0) {
                    errorMessage += '<br><br><strong>تفاصيل الأخطاء:</strong><br>';
                    failedEnrollments.forEach((error, index) => {
                        errorMessage += `${index + 1}. ${error.error}<br>`;
                    });
                }
                
                Swal.fire({
                    icon: 'warning',
                    title: 'نتائج التسجيل',
                    html: errorMessage,
                    confirmButtonText: 'حسناً'
                }).then(() => {
                    // إذا كان هناك نجاحات جزئية، أغلق الـ modal وحدث البيانات
                    if (successfulEnrollments.length > 0) {
                        const multiEnrollModal = bootstrap.Modal.getInstance(document.getElementById('multiEnrollModal'));
                        if (multiEnrollModal) {
                            multiEnrollModal.hide();
                        }
                        refreshDataAfterEnrollment();
                    }
                });
            }
            
        } catch (error) {
            console.error('Error in multi-enrollment:', error);
            Swal.fire('خطأ', 'حدث خطأ أثناء عملية التسجيل', 'error');
        }
    }

    function refreshDataAfterEnrollment() {
        // تحديث modal الطالب إذا كان مفتوحاً
        if (typeof showStudentDetails === 'function' && window.currentStudentId) {
            setTimeout(() => {
                showStudentDetails(window.currentStudentId);
            }, 1000);
        }
        
        // تحديث قائمة الطلاب
        if (typeof loadStudents === 'function') {
            setTimeout(() => {
                loadStudents();
            }, 500);
        }
    }



    async function getClassName(classId) {
        try {
            const response = await fetch(`/api/classes/${classId}`, {
                headers: getAuthHeaders()
            });
            
            if (response.ok) {
                const classData = await response.json();
                return classData.name;
            }
            return 'حصة غير معروفة';
        } catch (error) {
            return 'حصة غير معروفة';
        }
    }



    // إضافة event listener لزر التأكيد
    document.getElementById('confirmMultiEnroll').addEventListener('click', confirmMultiEnrollment);

    document.addEventListener('DOMContentLoaded', function() {
        // تأكد من وجود الزر في الـ DOM أولاً
        const modalMultiEnrollBtn = document.getElementById('modalMultiEnrollBtn');
        if (modalMultiEnrollBtn) {
            modalMultiEnrollBtn.addEventListener('click', function() {
                // الحصول على معرف الطالب من الزر أو من متغير عام
                if (window.currentStudentId) {
                    showMultiEnrollModal(window.currentStudentId);
                }
            });
        }

        // مستحدث حدث لزر تأكيد التسجيل في multiEnrollModal
        const confirmMultiEnrollBtn = document.getElementById('confirmMultiEnroll');
        if (confirmMultiEnrollBtn) {
            confirmMultiEnrollBtn.addEventListener('click', confirmMultiEnrollment);
        }
    });

    document.addEventListener('DOMContentLoaded', function() {
        initializeMultiEnrollEvents();
    });

    // إعادة تهيئة الأحداث عند فتح modal التسجيل المتعدد
    document.getElementById('multiEnrollModal').addEventListener('show.bs.modal', function() {
        initializeMultiEnrollEvents();
    });
    function initializeMultiEnrollEvents() {
        // إزالة أي مستمعات أحداث موجودة مسبقاً
        const confirmBtn = document.getElementById('confirmMultiEnroll');
        if (confirmBtn) {
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        }
        
        // إضافة مستمع الحدث الجديد
        document.getElementById('confirmMultiEnroll').addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            confirmMultiEnrollment();
        });
    }



    // دالة لحساب المدخول اليومي
    async function calculateDailyIncome() {
        try {
            // الحصول على تاريخ اليوم
            const today = new Date().toISOString().split('T')[0];
            
            // جلب جميع مدفوعات الحصص ليوم واحد
            const paymentsResponse = await fetch('/api/payments', {
                headers: getAuthHeaders()
            });
            
            // جلب جميع مصاريف التسجيل ليوم واحد
            const registrationFeesResponse = await fetch('/api/accounting/transactions?type=income&category=registration', {
                headers: getAuthHeaders()
            });

            if (!paymentsResponse.ok || !registrationFeesResponse.ok) {
                throw new Error('فشل في جلب بيانات المعاملات');
            }

            const allPayments = await paymentsResponse.json();
            const registrationFees = await registrationFeesResponse.json();

            // تصفية مدفوعات الحصص ليوم واحد فقط (اليوم)
            const todayPayments = allPayments.filter(payment => {
                const paymentDate = new Date(payment.paymentDate).toISOString().split('T')[0];
                return paymentDate === today && payment.status === 'paid';
            });

            // تصفية مصاريف التسجيل ليوم واحد فقط (اليوم)
            const todayRegistrationFees = registrationFees.filter(fee => {
                const feeDate = new Date(fee.date).toISOString().split('T')[0];
                return feeDate === today;
            });

            // إزالة التكرارات من مدفوعات الحصص بناءً على invoiceNumber
            const uniquePayments = todayPayments.filter((payment, index, self) =>
                index === self.findIndex(p => p.invoiceNumber === payment.invoiceNumber)
            );

            // حساب إجمالي الدخل من مدفوعات الحصص
            const paymentsIncome = uniquePayments.reduce((total, payment) => total + payment.amount, 0);
            
            // حساب إجمالي الدخل من مصاريف التسجيل
            const registrationIncome = todayRegistrationFees.reduce((total, fee) => total + fee.amount, 0);

            // إجمالي الدخل اليومي
            const dailyIncome = paymentsIncome + registrationIncome;

            // إجمالي عدد المعاملات
            const totalTransactions = uniquePayments.length + todayRegistrationFees.length;

            // تحديث واجهة المستخدم
            updateDailyIncomeUI(dailyIncome, totalTransactions, today);
            
            // إرجاع البيانات المفصلة للإستخدام في أجزاء أخرى من النظام
            return {
                income: dailyIncome,
                count: totalTransactions,
                payments: {
                    count: uniquePayments.length,
                    amount: paymentsIncome,
                    transactions: uniquePayments
                },
                registration: {
                    count: todayRegistrationFees.length,
                    amount: registrationIncome,
                    transactions: todayRegistrationFees
                }
            };
            
        } catch (err) {
            console.error('Error calculating daily income:', err);
            showError('حدث خطأ في حساب المدخول اليومي');
            return { 
                income: 0, 
                count: 0, 
                payments: { count: 0, amount: 0, transactions: [] },
                registration: { count: 0, amount: 0, transactions: [] }
            };
        }
    }


    // دالة لتحديث واجهة المستخدم
    function updateDailyIncomeUI(income, count, date) {
        // تحديث العناصر الرئيسية في واجهة المستخدم
        const incomeElements = [
            'dailyIncome',
            'todayIncome',
            'daily-income-amount'
        ];
        
        incomeElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = `${income} د.ج`;
            }
        });
        
        // تحديث عدد المعاملات
        const countElements = [
            'dailyTransactionsCount',
            'todayTransactionsCount'
        ];
        
        countElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = count;
            }
        });
        
        // تحديث التاريخ
        const dateElements = [
            'dailyIncomeDate',
            'todayIncomeDate'
        ];
        
        const formattedDate = new Date().toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        dateElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = formattedDate;
            }
        });

        // عرض تفاصيل إضافية إذا كانت متاحة
        displayIncomeBreakdown(income, count);
    }


    // دالة لعرض المعاملات اليومية في جدول
    function displayTodayTransactions(transactionsData) {
        const tableBody = document.getElementById('todayTransactionsTable');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        const allTransactions = [
            ...transactionsData.payments.transactions.map(t => ({ ...t, type: 'payment' })),
            ...transactionsData.registration.transactions.map(t => ({ ...t, type: 'registration' }))
        ];

        if (allTransactions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-muted">
                        لا توجد معاملات مالية ليوم ${new Date().toLocaleDateString('ar-EG')}
                    </td>
                </tr>
            `;
            return;
        }
        
        // ترتيب المعاملات حسب الوقت (الأحدث أولاً)
        allTransactions.sort((a, b) => new Date(b.date || b.paymentDate) - new Date(a.date || a.paymentDate));
        
        allTransactions.forEach((transaction, index) => {
            const row = document.createElement('tr');
            
            const typeBadge = transaction.type === 'payment' ? 
                '<span class="badge bg-primary">دفعة حصة</span>' : 
                '<span class="badge bg-success">مصاريف تسجيل</span>';
            
            const description = transaction.type === 'payment' ? 
                `${transaction.student?.name || 'غير معروف'} - ${transaction.class?.name || 'غير معروف'}` :
                transaction.description;
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${description}</td>
                <td>${transaction.amount} د.ج</td>
                <td>${typeBadge}</td>
                <td>${transaction.type === 'payment' ? getPaymentMethodName(transaction.paymentMethod) : 'نقدي'}</td>
                <td>${new Date(transaction.date || transaction.paymentDate).toLocaleDateString('ar-EG')}</td>
                <td>
                    <span class="badge bg-secondary">${transaction.reference || transaction.invoiceNumber || 'N/A'}</span>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // دالة لتحديث الداشبورد بالمدخول اليومي
    async function updateDashboardWithDailyIncome() {
        const todayData = await calculateDailyIncome();
        
        // تحديث بطاقة المدخول اليومي في الداشبورد
        document.getElementById('dailyIncomeCard').innerHTML = `
            <div class="card bg-success text-white">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="card-title">المدخول اليومي</h6>
                            <h3 class="mb-0">${todayData.income} د.ج</h3>
                            <small>${todayData.count} معاملة</small>
                        </div>
                        <div class="text-end">
                            <i class="bi bi-currency-exchange display-4 opacity-50"></i>
                            <div class="mt-2">
                                <small>${new Date().toLocaleDateString('ar-EG')}</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // عرض المعاملات اليومية
        displayTodayTransactions(todayData.transactions);
    }
    function displayIncomeBreakdown(totalIncome, totalCount) {
        const breakdownElement = document.getElementById('incomeBreakdown');
        if (!breakdownElement) return;

        // في تطبيق حقيقي، يمكنك جلب البيانات المفصلة من calculateDailyIncome()
        breakdownElement.innerHTML = `
            <div class="row mt-3">
                <div class="col-md-6">
                    <div class="card bg-light">
                        <div class="card-body">
                            <h6 class="card-title">تفصيل الدخل اليومي</h6>
                            <p class="mb-1">إجمالي الدخل: <strong>${totalIncome} د.ج</strong></p>
                            <p class="mb-1">عدد المعاملات: <strong>${totalCount}</strong></p>
                            <small class="text-muted">يشمل مدفوعات الحصص ومصاريف التسجيل</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }


    // تهيئة حساب المدخول اليومي عند تحميل الصفحة
    document.addEventListener('DOMContentLoaded', function() {
        calculateDailyIncome();
        
        // تحديث المدخول اليومي كل 5 دقائق
        setInterval(calculateDailyIncome, 5 * 60 * 1000);
        
        // تحديث عند فتح قسم المحاسبة
        document.getElementById('accounting-link').addEventListener('click', function() {
            calculateDailyIncome();
        });
    });

    // تحديث المدخول اليومي عند تسجيل دفعة جديدة
    socket.on('payment-received', function(data) {
        calculateDailyIncome();
    });

    async function recordRegistrationTransaction(studentId, studentName, amount) {
        try {
            const transactionData = {
                type: 'income',
                amount: amount,
                description: `رسوم تسجيل الطالب: ${studentName}`,
                category: 'registration',
                date: new Date().toISOString(),
                reference: `REG-${studentId}-${Date.now()}`,
                studentId: studentId
            };

            const response = await fetch('/api/accounting/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(transactionData)
            });

            if (response.ok) {
                // تحديث الدخل اليومي فوراً بعد تسجيل المعاملة
                calculateDailyIncome();
            } else {
                console.error('Failed to record registration transaction');
            }
        } catch (err) {
            console.error('Error recording registration transaction:', err);
        }
    }

    async function apiCallWithTimeout(url, options = {}, timeout = 10000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    }


    window.showStudentDetails = async function(studentId, event = null) {
        if (event) event.stopPropagation();
    
        try {
            // جلب بيانات الطالب
            const studentResponse = await fetch(`/api/students/${studentId}`, {
                headers: getAuthHeaders()
            });
    
            if (studentResponse.status === 401) {
                logout();
                return;
            }
    
            const student = await studentResponse.json();
    
            // جلب جميع الحصص
            const classesResponse = await fetch('/api/classes', {
                headers: getAuthHeaders()
            });
            const allClasses = await classesResponse.json();
    
            // جلب جميع المدفوعات للطالب
            const paymentsResponse = await fetch(`/api/payments?student=${studentId}`, {
                headers: getAuthHeaders()
            });
            let payments = [];
            if (paymentsResponse.ok) {
                payments = await paymentsResponse.json();
            }
    
            // تجميع المدفوعات حسب الحصة
            const paymentsByClass = {};
            payments.forEach(payment => {
                if (!paymentsByClass[payment.class._id]) {
                    paymentsByClass[payment.class._id] = {
                        class: payment.class,
                        payments: []
                    };
                }
                paymentsByClass[payment.class._id].payments.push(payment);
            });
    
            // إنشاء HTML لعرض الحصص والمدفوعات مع خيارات التحديد
            let classesHtml = '';
            Object.values(paymentsByClass).forEach(({ class: cls, payments }) => {
                classesHtml += `
                    <div class="card mb-3">
                        <div class="card-header bg-light d-flex justify-content-between align-items-center">
                            <strong>${cls.name}</strong> (${cls.subject}) - ${getAcademicYearName(cls.academicYear)}
                        </div>
                        <div class="card-body p-2">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>الشهر</th>
                                        <th>المبلغ</th>
                                        <th>الحالة</th>
                                        <th>تاريخ الدفع</th>
                                        <th>إجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${payments.map(payment => `
                                        <tr>
                                            <td>${payment.month}</td>
                                            <td>${payment.amount} د.ج</td>
                                            <td>
                                                <span class="badge ${payment.status === 'paid' ? 'bg-success' : 'bg-warning'}">
                                                    ${payment.status === 'paid' ? 'مسدد' : 'قيد الانتظار'}
                                                </span>
                                            </td>
                                            <td>${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('ar-EG') : '-'}</td>
                                            <td>
                                                ${payment.status === 'paid' ? `
                                                    <button class="btn btn-sm btn-info btn-action" onclick="reprintPaymentReceipt('${payment._id}')">
                                                        <i class="bi bi-printer"></i>
                                                    </button>
                                                    <button class="btn btn-sm btn-warning btn-action" onclick="cancelPayment('${payment._id}')" title="إلغاء الدفع">
                                                        <i class="bi bi-x-circle"></i> إلغاء
                                                    </button>
                                                ` : `
                                                    <button class="btn btn-sm btn-success" onclick="paySinglePayment('${payment._id}')">
                                                        دفع
                                                    </button>
                                                `}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            });
    
            // عرض النتائج في modal
            Swal.fire({
                title: `تفاصيل الطالب: ${student.name}`,
                html: `
                    <div>
                        <div class="mb-3">
                            <strong>الاسم:</strong> ${student.name}<br>
                            <strong>رقم الطالب:</strong> ${student.studentId}<br>
                            <strong>ولي الأمر:</strong> ${student.parentName || '-'}<br>
                            <strong>هاتف ولي الأمر:</strong> ${student.parentPhone || '-'}<br>
                            <strong>السنة الدراسية:</strong> ${getAcademicYearName(student.academicYear) || '-'}
                        </div>
                        <h5>الحصص والمدفوعات</h5>
                        ${classesHtml}
                    </div>
                `,
                width: '900px',
                showConfirmButton: false,
                showCloseButton: true
            });
    
        } catch (err) {
            console.error('Error loading student details:', err);
            Swal.fire('خطأ', 'حدث خطأ أثناء تحميل تفاصيل الطالب', 'error');
        }
    };
