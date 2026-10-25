
const fileInput = document.getElementById('fileInput');
const status = document.getElementById('status');
const fileCount = document.getElementById('fileCount');
const progress = document.getElementById('progress');
const fileResults = document.getElementById('fileResults');
const againButton = document.getElementById('againButton');

const resizeEnabled = document.getElementById('resizeEnabled');
const noResizeEnabled = document.getElementById('noResizeEnabled');

const successCount = document.getElementById('successCount');
const originalSize = document.getElementById('originalSize');

const jpegResizeSize = document.getElementById('jpegResizeSize');
const webpResizeSize = document.getElementById('webpResizeSize');
const jpegOriginalSize = document.getElementById('jpegOriginalSize');
const webpOriginalSize = document.getElementById('webpOriginalSize');

const jpegResizeReduction = document.getElementById('jpegResizeReduction');
const webpResizeReduction = document.getElementById('webpResizeReduction');
const jpegOriginalReduction = document.getElementById('jpegOriginalReduction');
const webpOriginalReduction = document.getElementById('webpOriginalReduction');

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

    const modes = [];

    if (resizeEnabled.checked) {
        modes.push('resize');
    }

    if (noResizeEnabled.checked) {
        modes.push('original');
    }

    if (!modes.length) {
        alert('Выбери хотя бы один вариант обработки.');
        return;
    }

    const order = document.querySelector(
        'input[name="conversionOrder"]:checked'
    ).value;

    isRunning = true;
    fileInput.disabled = true;
    againButton.disabled = true;
    resizeEnabled.disabled = true;
    noResizeEnabled.disabled = true;

    status.classList.remove('hidden');
    againButton.classList.add('hidden');

    fileCount.textContent = String(files.length);
    progress.textContent = 'Начинаем обработку...';
    fileResults.replaceChildren();

    resetSummary();

    let processedCount = 0;
    let totalOriginalBytes = 0;

    const totals = {
        jpegResize: null,
        webpResize: null,
        jpegOriginal: null,
        webpOriginal: null
    };

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
                const result = await convertImage(file, order, modes);

                processedCount++;
                totalOriginalBytes += file.size;

                for (const [key, item] of Object.entries(result)) {
                    totals[key] = (totals[key] ?? 0) + item.blob.size;
                }

                const lines = [
                    file.name,
                    `Исходный размер: ${formatBytes(file.size)}`
                ];

                const formatOrder = order === 'jpeg'
                    ? ['jpeg', 'webp']
                    : ['webp', 'jpeg'];

                for (const format of formatOrder) {
                    for (const mode of modes) {
                        const key = `${format}${capitalize(mode)}`;
                        const item = result[key];

                        lines.push(
                            '',
                            `${format.toUpperCase()} — ${
                                mode === 'resize'
                                    ? 'с ресайзом'
                                    : 'без ресайза'
                            }`,
                            `Разрешение: ${item.width}×${item.height}`,
                            `Загрузка и декодирование: ${formatTime(item.decodeMs)}`,
                            mode === 'resize'
                                ? `Ресайз: ${formatTime(item.resizeMs)}`
                                : 'Ресайз: не выполнялся',
                            `Конвертация: ${formatTime(item.encodeMs)}`,
                            `Общее время: ${formatTime(item.totalMs)}`,
                            `Размер: ${formatBytes(item.blob.size)}`
                        );
                    }
                }

                row.textContent = lines.join('\n');

                updateSummary({
                    processedCount,
                    totalOriginalBytes,
                    totals
                });
            } catch (error) {
                row.textContent =
                    `${file.name}\nОшибка: ${error.message}`;

                console.error(`Ошибка обработки ${file.name}:`, error);
            }
        }

        progress.textContent =
            `Завершено: ${processedCount} из ${files.length}`;
    } finally {
        isRunning = false;
        fileInput.disabled = false;
        againButton.disabled = false;
        resizeEnabled.disabled = false;
        noResizeEnabled.disabled = false;
        againButton.classList.remove('hidden');
    }
}

async function convertImage(file, order, modes) {
    const result = {};

    const formatOrder = order === 'jpeg'
        ? ['jpeg', 'webp']
        : ['webp', 'jpeg'];

    const mimeTypes = {
        jpeg: 'image/jpeg',
        webp: 'image/webp'
    };

    for (const format of formatOrder) {
        for (const mode of modes) {
            const key = `${format}${capitalize(mode)}`;

            result[key] = await processFormat(
                file,
                mimeTypes[format],
                QUALITY,
                mode === 'resize'
            );
        }
    }

    return result;
}

async function processFormat(file, type, quality, shouldResize) {
    const totalStart = performance.now();

    // Загрузка и декодирование исходного изображения
    const decodeStart = performance.now();
    const image = await loadImage(file);
    const decodeMs = performance.now() - decodeStart;

    let width = image.naturalWidth;
    let height = image.naturalHeight;

    if (shouldResize) {
        const scale = Math.min(
            1,
            TARGET_WIDTH / width,
            TARGET_HEIGHT / height
        );

        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Не удалось создать Canvas 2D-контекст');
    }

    // Рисование изображения на Canvas
    const resizeStart = performance.now();

    context.drawImage(image, 0, 0, width, height);

    const resizeMs = performance.now() - resizeStart;

    // Кодирование в JPEG или WebP
    const encodeStart = performance.now();
    const blob = await canvasToBlob(canvas, type, quality);
    const encodeMs = performance.now() - encodeStart;

    const totalMs = performance.now() - totalStart;

    canvas.width = 0;
    canvas.height = 0;

    return {
        decodeMs,
        resizeMs,
        encodeMs,
        totalMs,
        width,
        height,
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
            reject(new Error('Не удалось загрузить изображение'));
        };

        image.src = url;
    });
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error(`Не удалось создать файл ${type}`));
                return;
            }

            if (blob.type !== type) {
                reject(
                    new Error(`Браузер не создал файл в формате ${type}`)
                );
                return;
            }

            resolve(blob);
        }, type, quality);
    });
}

function resetSummary() {
    successCount.textContent = '0';
    originalSize.textContent = '—';

    jpegResizeSize.textContent = '—';
    webpResizeSize.textContent = '—';
    jpegOriginalSize.textContent = '—';
    webpOriginalSize.textContent = '—';

    jpegResizeReduction.textContent = '—';
    webpResizeReduction.textContent = '—';
    jpegOriginalReduction.textContent = '—';
    webpOriginalReduction.textContent = '—';
}

function updateSummary({
    processedCount,
    totalOriginalBytes,
    totals
}) {
    successCount.textContent = String(processedCount);
    originalSize.textContent = formatBytes(totalOriginalBytes);

    jpegResizeSize.textContent = formatTotal(totals.jpegResize);
    webpResizeSize.textContent = formatTotal(totals.webpResize);
    jpegOriginalSize.textContent = formatTotal(totals.jpegOriginal);
    webpOriginalSize.textContent = formatTotal(totals.webpOriginal);

    jpegResizeReduction.textContent = calculateReduction(
        totalOriginalBytes,
        totals.jpegResize
    );

    webpResizeReduction.textContent = calculateReduction(
        totalOriginalBytes,
        totals.webpResize
    );

    jpegOriginalReduction.textContent = calculateReduction(
        totalOriginalBytes,
        totals.jpegOriginal
    );

    webpOriginalReduction.textContent = calculateReduction(
        totalOriginalBytes,
        totals.webpOriginal
    );
}

function formatTotal(bytes) {
    return bytes === null ? '—' : formatBytes(bytes);
}

function calculateReduction(originalBytes, convertedBytes) {
    if (!originalBytes || convertedBytes === null) {
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

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
