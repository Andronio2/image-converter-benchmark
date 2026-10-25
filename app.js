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
  sizeReduction.textContent = '—';

  const startTime = performance.now();
  let processedCount = 0;
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
      const itemStart = performance.now();
      const blob = await convertImage(file);
      updateMemoryUsage();
      const itemTime = performance.now() - itemStart;

      processedCount++;
      totalOriginalBytes += file.size;
      totalConvertedBytes += blob.size;

      successCount.textContent = processedCount;
      originalSize.textContent = formatBytes(totalOriginalBytes);
      convertedSize.textContent = formatBytes(totalConvertedBytes);

      if (totalOriginalBytes > 0) {
        const reduction = (1 - totalConvertedBytes / totalOriginalBytes) * 100;

        sizeReduction.textContent = `${reduction.toFixed(1)}%`;
      }

      row.textContent =
        `${file.name} — ${formatBytes(file.size)} → ` + `${formatBytes(blob.size)} JPEG — ${itemTime.toFixed(1)} мс`;
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
  const image = await loadImage(file);

  const scale = Math.min(1, 1920 / image.naturalWidth, 1080 / image.naturalHeight);

  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Не удалось создать JPEG'));
        }
      },
      'image/jpeg',
      0.9,
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
