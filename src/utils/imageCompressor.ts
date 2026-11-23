/**
 * Utilitário de compressão e sanitização de imagens para a VA Veículos.
 * Garante envio de até 10 fotos por veículo com orçamento adaptativo de bytes
 * (<= 78 KB em base64 por foto), assegurando que todas as 10 fotos caibam com folga
 * no limite de 1 MB por documento do Firestore, preservando nitidez e segurança contra XSS/SVG.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0 a 1
  mimeType?: 'image/jpeg' | 'image/webp';
  maxBase64Bytes?: number;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_INPUT_FILE_SIZE = 15 * 1024 * 1024; // 15 MB limite de segurança para evitar travamento da aba
export const DEFAULT_MAX_PHOTO_BASE64_BYTES = 78_000; // 10 fotos x 78 KB = 780 KB (< 1 MB Firestore)

let cachedWebpSupport: boolean | null = null;

function supportsWebPEncoding(): boolean {
  if (cachedWebpSupport !== null) return cachedWebpSupport;
  if (typeof document === 'undefined') {
    cachedWebpSupport = false;
    return false;
  }
  try {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 2;
    const url = c.toDataURL('image/webp', 0.8);
    cachedWebpSupport = url.startsWith('data:image/webp');
  } catch {
    cachedWebpSupport = false;
  }
  return cachedWebpSupport;
}

function encodeImageWithinBudget(
  img: HTMLImageElement,
  initialMaxWidth: number,
  initialMaxHeight: number,
  initialQuality: number,
  preferredMime: 'image/jpeg' | 'image/webp',
  maxBase64Bytes: number
): string {
  const mimeType: 'image/jpeg' | 'image/webp' =
    preferredMime === 'image/webp' && supportsWebPEncoding() ? 'image/webp' : 'image/jpeg';

  const dimensionSteps: Array<[number, number]> = [
    [initialMaxWidth, initialMaxHeight],
    [Math.min(initialMaxWidth, 800), Math.min(initialMaxHeight, 600)],
    [Math.min(initialMaxWidth, 640), Math.min(initialMaxHeight, 480)],
    [Math.min(initialMaxWidth, 512), Math.min(initialMaxHeight, 384)]
  ];

  const qualitySteps = [
    initialQuality,
    Math.min(initialQuality, 0.68),
    Math.min(initialQuality, 0.58),
    Math.min(initialQuality, 0.48),
    0.38
  ];

  let smallestResult = '';

  for (const [stepW, stepH] of dimensionSteps) {
    let { width, height } = img;
    if (width > stepW || height > stepH) {
      const ratio = Math.min(stepW / width, stepH / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Contexto gráfico indisponível para sanitização e rasterização da imagem.');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    for (const q of qualitySteps) {
      let dataUrl: string;
      try {
        dataUrl = canvas.toDataURL(mimeType, q);
      } catch {
        dataUrl = canvas.toDataURL('image/jpeg', q);
      }

      if (!smallestResult || dataUrl.length < smallestResult.length) {
        smallestResult = dataUrl;
      }

      if (dataUrl.length <= maxBase64Bytes) {
        return dataUrl;
      }
    }
  }

  return smallestResult;
}

export const compressImageFile = async (
  file: File,
  options: CompressionOptions = {}
): Promise<string> => {
  const {
    maxWidth = 960,
    maxHeight = 720,
    quality = 0.78,
    mimeType = 'image/webp',
    maxBase64Bytes = DEFAULT_MAX_PHOTO_BASE64_BYTES
  } = options;

  return new Promise((resolve, reject) => {
    // 1. Whitelist estrita de MIME types rasterizados (bloqueia image/svg+xml e outros formatos com risco de script)
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return reject(new Error('Formato de imagem não permitido. Envie apenas arquivos JPEG, PNG ou WebP.'));
    }

    // 2. Validação de tamanho máximo de arquivo de entrada
    if (file.size > MAX_INPUT_FILE_SIZE) {
      return reject(new Error('O arquivo selecionado excede o limite máximo de 15 MB.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem.'));

    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao processar dados da imagem.'));

      img.onload = () => {
        try {
          const encoded = encodeImageWithinBudget(
            img,
            maxWidth,
            maxHeight,
            quality,
            mimeType,
            maxBase64Bytes
          );
          resolve(encoded);
        } catch (err) {
          reject(err);
        }
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Recomprime uma imagem Data URL já existente para caber no orçamento de bytes estipulado,
 * preservando todas as 10 fotos sem descartar nenhuma na sincronização com o Firestore.
 */
export const recompressDataUrlToBudget = async (
  dataUrl: string,
  maxBase64Bytes: number = DEFAULT_MAX_PHOTO_BASE64_BYTES
): Promise<string> => {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length <= maxBase64Bytes) {
    return dataUrl;
  }
  if (typeof window === 'undefined' || typeof Image === 'undefined' || typeof document === 'undefined') {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      try {
        const reencoded = encodeImageWithinBudget(
          img,
          800,
          600,
          0.72,
          'image/webp',
          maxBase64Bytes
        );
        resolve(reencoded.length < dataUrl.length ? reencoded : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
};

/**
 * Processa múltiplos arquivos de imagens, limitando ao máximo estipulado (10 fotos por veículo)
 * e garantindo que o conjunto completo de 10 fotos caiba com segurança no Firestore.
 */
export const compressMultipleImages = async (
  files: FileList | File[],
  maxCount: number = 10,
  currentCount: number = 0
): Promise<string[]> => {
  const remainingSlots = Math.max(0, maxCount - currentCount);
  if (remainingSlots <= 0) return [];

  const filesToProcess = Array.from(files).slice(0, remainingSlots);
  const compressedResults: string[] = [];

  for (const file of filesToProcess) {
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 960,
        maxHeight: 720,
        quality: 0.78,
        mimeType: 'image/webp',
        maxBase64Bytes: DEFAULT_MAX_PHOTO_BASE64_BYTES
      });
      compressedResults.push(compressed);
    } catch (err) {
      console.warn('Erro ao comprimir imagem individual:', err);
    }
  }

  return compressedResults;
};
