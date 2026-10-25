
const fileInput = document.getElementById('fileInput');
const status = document.getElementById('status');
const fileCount = document.getElementById('fileCount');
const progress = document.getElementById('progress');
const fileResults = document.getElementById('fileResults');
const againButton = document.getElementById('againButton');

const successCount = document.getElementById('successCount');
const originalSize = document.getElementById('originalSize');
const convertedSize = document.getElementById('convertedSize');
const webpSize = document.getElementById('webpSize');
const sizeReduction = document.getElementById('sizeReduction');
const webpReduction = document.getElementById('webpReduction');

const TARGET_WIDTH = 1920;
const TARGET_HEIGHT = 1080;
const QUALITY = 0.9;

let isRunning = false;

fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files);

    if (files.length) {
        await runBenchmark(files);
    }
});

againButton.addEventListener('click', async () => {
    const files = Array.from(fileInput.files);

    if (files.length) {
        await runBenchmark(files);
    }
});

async function runBenchmark(files) {
    if (isRunning || !files.length) {
        return;
    }

    isRunning = true;
    fileInput.disabled = true;
    againButton.disabled = true;

    status.classList.remove('hidden');
    againButton.classList.add('hidden');

    fileCount.textContent = String(files.length);
    progress.textContent = 'Начинаем обработку...';
    fileResults.replaceChildren();

    resetSummary();

    let processedCount = 0;
    let totalOriginalBytes = 0;
    let totalJpegBytes = 0;
    let totalWebpBytes = 0;

    const order = document.querySelector(
        'input[name="conversionOrder"]:checked'
    ).value;

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            const row = document.createElement('div');
            row.className = 'file-result';
            row.textContent =
                `${file.name}\nОбработка ${i + 1} из ${files.length}...`;

            fileResults.appendChild(row);

            progress.textContent =
                `Обрабатывается файл ${i + 1} из ${files.length}`;

            try {
                const result = await convertImage(file, order);

                processedCount++;
                totalOriginalBytes += file.size;
                totalJpegBytes += result.jpegBlob.size;
                totalWebpBytes += result.webpBlob.size;


row.textContent =
    `${file.name}\n` +
    `Исходный размер: ${formatBytes(file.size)}\n\n` +

    `JPEG\n` +
    `Загрузка и декодирование: ${formatTime(result.jpeg.decodeMs)}\n` +
    `Ресайз: ${formatTime(result.jpeg.resizeMs)}\n` +
    `Конвертация: ${formatTime(result.jpeg.encodeMs)}\n` +
    `Общее время JPEG: ${formatTime(result.jpegTotalMs)}\n` +
    `Размер: ${formatBytes(result.jpegBlob.size)}\n\n` +

    `WebP\n` +
    `Загрузка и декодирование: ${formatTime(result.webp.decodeMs)}\n` +
    `Ресайз: ${formatTime(result.webp.resizeMs)}\n` +
    `Конвертация: ${formatTime(result.webp.encodeMs)}\n` +
    `Общее время WebP: ${formatTime(result.webpTotalMs)}\n` +
    `Размер: ${formatBytes(result.webpBlob.size)}`;

                updateSummary({
                    processedCount,
                    totalOriginalBytes,
                    totalJpegBytes,
                    totalWebpBytes
                });
            } catch (error) {
                row.textContent =
                    `${file.name}\nОшибка: ${error.message}`;

                console.error(
                    `Ошибка обработки ${file.name}:`,
                    error
                );
            }
        }

        progress.textContent =
            `Завершено: ${processedCount} из ${files.length}`;
    } finally {
        isRunning = false;
        fileInput.disabled = false;
        againButton.disabled = false;
        againButton.classList.remove('hidden');
    }
}


async function convertImage(file, order) {
    let jpegResult;
    let webpResult;

    if (order === 'jpeg') {
        jpegResult = await processFormat(
            file,
            'image/jpeg',
            QUALITY
        );

        webpResult = await processFormat(
            file,
            'image/webp',
            QUALITY
        );
    } else {
        webpResult = await processFormat(
            file,
            'image/webp',
            QUALITY
        );

        jpegResult = await processFormat(
            file,
            'image/jpeg',
            QUALITY
        );
    }

    return {
        jpeg: jpegResult,
        webp: webpResult,
        jpegBlob: jpegResult.blob,
        webpBlob: webpResult.blob,
        jpegTotalMs: jpegResult.decodeMs
            + jpegResult.resizeMs
            + jpegResult.encodeMs,
        webpTotalMs: webpResult.decodeMs
            + webpResult.resizeMs
            + webpResult.encodeMs
    };
}

async function processFormat(file, type, quality) {
    // Загрузка и декодирование исходного файла
    const decodeStart = performance.now();
    const image = await loadImage(file);
    const decodeMs = performance.now() - decodeStart;

    // Вычисление размера результата
    const scale = Math.min(
        1,
        TARGET_WIDTH / image.naturalWidth,
        TARGET_HEIGHT / image.naturalHeight
    );

    const width = Math.max(
        1,
        Math.round(image.naturalWidth * scale)
    );

    const height = Math.max(
        1,
        Math.round(image.naturalHeight * scale)
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error(
            'Не удалось создать Canvas 2D-контекст'
        );
    }

    // Ресайз
    const resizeStart = performance.now();

    context.drawImage(
        image,
        0,
        0,
        width,
        height
    );

    const resizeMs = performance.now() - resizeStart;

    // Конвертация
    const encodeStart = performance.now();

    const blob = await canvasToBlob(
        canvas,
        type,
        quality
    );

    const encodeMs = performance.now() - encodeStart;

    // Освобождение ресурсов canvas
    canvas.width = 0;
    canvas.height = 0;

    return {
        decodeMs,
        resizeMs,
        encodeMs,
        blob
    };
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(
                new Error('Не удалось загрузить изображение')
            );
        };

        image.src = url;
    });
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => {
                if (!blob) {
                    reject(
                        new Error(`Не удалось создать файл ${type}`)
                    );
                    return;
                }

                if (blob.type !== type) {
                    reject(
                        new Error(
                            `Браузер не поддерживает формат ${type}`
                        )
                    );
                    return;
                }

                resolve(blob);
            },
            type,
            quality
        );
    });
}

function resetSummary() {
    successCount.textContent = '0';
    originalSize.textContent = '—';
    convertedSize.textContent = '—';
    webpSize.textContent = '—';
    sizeReduction.textContent = '—';
    webpReduction.textContent = '—';
}

function updateSummary({
    processedCount,
    totalOriginalBytes,
    totalJpegBytes,
    totalWebpBytes
}) {
    successCount.textContent = String(processedCount);
    originalSize.textContent = formatBytes(totalOriginalBytes);
    convertedSize.textContent = formatBytes(totalJpegBytes);
    webpSize.textContent = formatBytes(totalWebpBytes);

    sizeReduction.textContent = calculateReduction(
        totalOriginalBytes,
        totalJpegBytes
    );

    webpReduction.textContent = calculateReduction(
        totalOriginalBytes,
        totalWebpBytes
    );
}

function calculateReduction(originalBytes, convertedBytes) {
    if (!originalBytes) {
        return '—';
    }

    const percentage =
        (1 - convertedBytes / originalBytes) * 100;

    return `${percentage.toFixed(1)}%`;
}

function formatTime(milliseconds) {
    return `${milliseconds.toFixed(1)} мс`;
}

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} Б`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} КБ`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}
