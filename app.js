const fileInput = document.getElementById('fileInput');
const status = document.getElementById('status');
const fileCount = document.getElementById('fileCount');
const progress = document.getElementById('progress');
const elapsedTime = document.getElementById('elapsedTime');
const averageTime = document.getElementById('averageTime');
const fileResults = document.getElementById('fileResults');
const successCount = document.getElementById('successCount');
const originalSize = document.getElementById('originalSize');
const convertedSize = document.getElementById('convertedSize');
const sizeReduction = document.getElementById('sizeReduction');
const againButton = document.getElementById('againButton');
const decodeTime = document.getElementById('decodeTime');
const jpegTime = document.getElementById('jpegTime');
const webpTime = document.getElementById('webpTime');
const webpSize = document.getElementById('webpSize');

const TARGET_WIDTH = 1920;
const TARGET_HEIGHT = 1080;

fileInput.addEventListener('change', async () => {
  const files = Array.from(fileInput.files);

  if (!files.length) {
    return;
  }

  status.classList.remove('hidden');
  fileCount.textContent = files.length;
  progress.textContent = 'Начинаем обработку...';
  elapsedTime.textContent = '—';
  averageTime.textContent = '—';
  fileResults.replaceChildren();
  successCount.textContent = '0';
  originalSize.textContent = '—';
  convertedSize.textContent = '—';

  decodeTime.textContent = '—';
  jpegTime.textContent = '—';
  webpTime.textContent = '—';
  webpSize.textContent = '—';

  const startTime = performance.now();
  let processedCount = 0;
  let totalWebpBytes = 0;
  let totalDecodeMs = 0;
  let totalJpegMs = 0;
  let totalWebpMs = 0;
  let totalOriginalBytes = 0;
  let totalConvertedBytes = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    progress.textContent = `Обработка: ${i + 1} / ${files.length}`;

    const row = document.createElement('div');
    row.className = 'file-result';
    row.textContent = `${file.name} — обработка...`;
    fileResults.appendChild(row);

    try {
      const result = await convertImage(file);

      processedCount++;
      totalOriginalBytes += file.size;
      totalConvertedBytes += result.jpegBlob.size;
      totalWebpBytes += result.webpBlob.size;

      totalDecodeMs += result.decodeMs;
      totalJpegMs += result.jpegMs;
      totalWebpMs += result.webpMs;

      successCount.textContent = processedCount;
      originalSize.textContent = formatBytes(totalOriginalBytes);
      convertedSize.textContent = formatBytes(totalConvertedBytes);
      webpSize.textContent = formatBytes(totalWebpBytes);

      decodeTime.textContent = `${totalDecodeMs.toFixed(1)} мс`;
      jpegTime.textContent = `${totalJpegMs.toFixed(1)} мс`;
      webpTime.textContent = `${totalWebpMs.toFixed(1)} мс`;

      row.textContent =
        `${file.name} — ` +
        `декодирование: ${result.decodeMs.toFixed(1)} мс; ` +
        `JPEG: ${result.jpegMs.toFixed(1)} мс, ${formatBytes(result.jpegBlob.size)}; ` +
        `WebP: ${result.webpMs.toFixed(1)} мс, ${formatBytes(result.webpBlob.size)}`;
    } catch (error) {
      console.error(error);
      row.textContent = `${file.name} — ошибка: ${error.message}`;
    }
  }

  const totalTime = performance.now() - startTime;
  updateMemoryUsage();

  elapsedTime.textContent = `${(totalTime / 1000).toFixed(3)} сек`;
  averageTime.textContent = processedCount ? `${(totalTime / processedCount).toFixed(1)} мс / изображение` : '—';

  progress.textContent = `Завершено: ${processedCount} из ${files.length}`;
  againButton.classList.remove('hidden');
});

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} Б`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
}

async function convertImage(file) {
  // 1. Декодирование исходного изображения
  const decodeStart = performance.now();
  const image = await loadImage(file);
  const decodeMs = performance.now() - decodeStart;

  // Подготовка изображения с сохранением пропорций
  const scale = Math.min(1, TARGET_WIDTH / image.naturalWidth, TARGET_HEIGHT / image.naturalHeight);

  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);

  // 2. Кодирование в JPEG
  // Прогрев обоих кодировщиков — результаты не используем
  await canvasToBlob(canvas, 'image/webp', 0.9);
  await canvasToBlob(canvas, 'image/jpeg', 0.9);

  // Измеряем WebP
  const webpStart = performance.now();
  const webpBlob = await canvasToBlob(canvas, 'image/webp', 0.9);
  const webpMs = performance.now() - webpStart;

  // Измеряем JPEG
  const jpegStart = performance.now();
  const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
  const jpegMs = performance.now() - jpegStart;

  return {
    decodeMs,
    jpegMs,
    webpMs,
    jpegBlob,
    webpBlob,
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Не удалось создать файл ${type}`));
        }
      },
      type,
      quality,
    );
  });
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
      reject(new Error(`Не удалось загрузить ${file.name}`));
    };

    image.src = url;
  });
}

async function updateDeviceInfo() {
  const memoryUsage = document.getElementById('memoryUsage');
  const batteryLevel = document.getElementById('batteryLevel');

  // Использование памяти JavaScript (если браузер поддерживает API)
  if (performance.memory) {
    const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;
    const limitMB = performance.memory.jsHeapSizeLimit / 1024 / 1024;

    memoryUsage.textContent = `${usedMB.toFixed(1)} МБ из ${limitMB.toFixed(0)} МБ`;
  } else {
    memoryUsage.textContent = 'Недоступно';
  }

  // Уровень заряда батареи (если браузер поддерживает API)
  if ('getBattery' in navigator) {
    try {
      const battery = await navigator.getBattery();
      const level = Math.round(battery.level * 100);
      const charging = battery.charging ? 'идёт зарядка' : 'не заряжается';

      batteryLevel.textContent = `${level}% (${charging})`;
    } catch {
      batteryLevel.textContent = 'Недоступно';
    }
  } else {
    batteryLevel.textContent = 'Недоступно';
  }
}

updateDeviceInfo();

function updateMemoryUsage() {
  const memoryUsage = document.getElementById('memoryUsage');

  if (performance.memory) {
    const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;
    const limitMB = performance.memory.jsHeapSizeLimit / 1024 / 1024;

    memoryUsage.textContent = `${usedMB.toFixed(1)} МБ из ${limitMB.toFixed(0)} МБ`;
  } else {
    memoryUsage.textContent = 'Недоступно';
  }
}

againButton.addEventListener('click', () => {
  fileInput.dispatchEvent(new Event('change'));
});
