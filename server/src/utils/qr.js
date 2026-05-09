// server/src/utils/qr.js
import QRCode from "qrcode";

export async function makeQrDataUrl(text) {
  if (!text || !String(text).trim()) return null;

  return await QRCode.toDataURL(String(text), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: {
      dark: "#111111",
      light: "#FFFFFF",
    },
  });
}

export async function makeQrBuffer(text) {
  if (!text || !String(text).trim()) return null;

  return await QRCode.toBuffer(String(text), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: {
      dark: "#111111",
      light: "#FFFFFF",
    },
  });
}