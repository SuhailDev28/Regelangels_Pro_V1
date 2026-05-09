// server/src/utils/certificatePdf.js
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { PDFDocument as PDFLibDocument } from "pdf-lib";

/**
 * =========================================================
 * FALLBACK CERTIFICATE (FULL DESIGN)
 * =========================================================
 */
export async function buildCertificatePdf({
  appName,
  signatory,
  participantName,
  groupName,
  level,
  total,
  title = "PARTICIPATION AWARD",
  eventName = "",
  bibNo = "",
  serialNo = "",
  note = "",
  qrText = "",
  showQr = false,
  showSerial = false,
}) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 28,
  });

  const pageW = doc.page.width;
  const pageH = doc.page.height;

  const RED = "#E11D2E";
  const TEAL = "#0E7490";
  const GOLD = "#F4B400";
  const INK = "#0B1220";
  const SOFT = "#64748B";

  const dotColors = [
    "#E11D2E",
    "#F59E0B",
    "#22C55E",
    "#06B6D4",
    "#3B82F6",
    "#A855F7",
    "#FB7185",
  ];

  doc.save();
  doc.rect(0, 0, pageW, pageH).fill("#FFFFFF");
  doc.restore();

  drawSoftFrame(doc, 16, 16, pageW - 32, pageH - 32);

  drawDotBorder(doc, {
    x: 18,
    y: 18,
    w: pageW - 36,
    h: pageH - 36,
    r: 9,
    gap: 14,
    colors: dotColors,
  });

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(SOFT)
    .text(appName || "Gymnastics Scoring", 0, 34, {
      align: "center",
    });

  drawStarsRow(doc, {
    cx: pageW / 2,
    y: 76,
    count: 5,
    size: 10,
    gap: 18,
    color: GOLD,
  });

  doc
    .font("Helvetica-Bold")
    .fontSize(52)
    .fillColor(RED)
    .text("GYMNASTICS", 0, 104, {
      align: "center",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(28)
    .fillColor(TEAL)
    .text(String(title || "PARTICIPATION AWARD").toUpperCase(), 0, 165, {
      align: "center",
    });

  doc
    .font("Helvetica")
    .fontSize(14)
    .fillColor(INK)
    .text("Presented to", 0, 220, {
      align: "center",
    });

  const nameY = 248;

  drawFitText(doc, participantName || "Participant Name", {
    x: 60,
    y: nameY,
    w: pageW - 120,
    align: "center",
    font: "Helvetica-Bold",
    maxSize: 34,
    minSize: 18,
    color: GOLD,
  });

  const lineW = Math.min(520, pageW * 0.62);
  const lineX = (pageW - lineW) / 2;

  doc
    .save()
    .moveTo(lineX, nameY + 46)
    .lineTo(lineX + lineW, nameY + 46)
    .lineWidth(1)
    .strokeColor("#111827")
    .stroke()
    .restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(INK)
    .text("FOR YOUR OUTSTANDING PERFORMANCE", 0, nameY + 62, {
      align: "center",
    });

  const metaY = nameY + 96;
  const groupLine = `Group: ${groupName || "—"}${level ? ` (${level})` : ""}`;
  const totalLine = `Total Points: ${Number(total || 0).toFixed(2)}`;

  doc.font("Helvetica").fontSize(12).fillColor(SOFT).text(groupLine, 0, metaY, {
    align: "center",
  });

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(SOFT)
    .text(totalLine, 0, metaY + 18, {
      align: "center",
    });

  if (eventName) {
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(TEAL)
      .text(eventName, 0, metaY + 38, {
        align: "center",
      });
  }

  if (bibNo) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(INK)
      .text(`BIB No: ${bibNo}`, 0, metaY + 58, {
        align: "center",
      });
  }

  if (note) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(SOFT)
      .text(String(note), pageW * 0.19, metaY + 78, {
        width: pageW * 0.62,
        align: "center",
      });
  }

  const bottomY = pageH - 112;
  const colGap = 70;
  const colW = 240;

  const leftX = pageW / 2 - colGap / 2 - colW;
  const rightX = pageW / 2 + colGap / 2;

  drawLineLabel(doc, {
    x: leftX,
    y: bottomY,
    w: colW,
    label: "Date",
    value: new Date().toLocaleDateString(),
    color: INK,
    muted: SOFT,
  });

  drawLineLabel(doc, {
    x: rightX,
    y: bottomY,
    w: colW,
    label: "Signature",
    value: signatory || "Authorized",
    color: INK,
    muted: SOFT,
  });

  if (showSerial && serialNo) {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(RED)
      .text(serialNo, 38, pageH - 42, {
        width: 280,
        align: "left",
      });
  }

  if (showQr && qrText) {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrText, {
        errorCorrectionLevel: "M",
        margin: 0,
        width: 110,
      });

      const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
      const qrBuffer = Buffer.from(qrBase64, "base64");

      const qrSize = 68;
      const qrX = pageW - 38 - qrSize;
      const qrY = pageH - 94;

      doc.image(qrBuffer, qrX, qrY, {
        width: qrSize,
        height: qrSize,
      });

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(SOFT)
        .text("Verify", qrX, qrY + qrSize + 2, {
          width: qrSize,
          align: "center",
        });
    } catch {
      // ignore
    }
  }

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(SOFT)
    .text("Rebel Angels · Gymnastics Scoring", 0, pageH - 42, {
      align: "center",
    });

  return doc;
}

/**
 * =========================================================
 * TEMPLATE OVERLAY PDF
 * Used when you upload a designed certificate template.
 * =========================================================
 */
export async function buildCertificateOverlayPdf({
  participantName,
  groupName = "",
  level = "",
  academyName = "",
  eventName = "",
  total = "",
  rank = "",
  bibNo = "",
  dateText = new Date().toLocaleDateString(),
  serialNo = "",
  qrText = "",
  showQr = false,
  showSerial = false,
  layout = {},
}) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
  });

  const pageW = doc.page.width;
  const pageH = doc.page.height;

  const L = normalizeOverlayLayout(layout, pageW, pageH);

  if (participantName && L.name.w > 0) {
    drawFitText(doc, participantName, {
      x: L.name.x,
      y: L.name.y,
      w: L.name.w,
      align: L.name.align,
      font: L.name.font || "Helvetica-Bold",
      maxSize: L.name.size,
      minSize: L.name.minSize || 12,
      color: L.name.color,
      lineGap: L.name.lineGap || 0,
      noWrap: true,
    });
  }

  if (groupName && L.group.w > 0) {
    const groupText = `Group: ${groupName}${level ? ` (${level})` : ""}`;

    doc
      .font("Helvetica")
      .fontSize(L.group.size)
      .fillColor(L.group.color)
      .text(groupText, L.group.x, L.group.y, {
        width: L.group.w,
        align: L.group.align,
      });
  }

  if (academyName && L.academy.w > 0) {
    doc
      .font("Helvetica")
      .fontSize(L.academy.size)
      .fillColor(L.academy.color)
      .text(`Academy: ${academyName}`, L.academy.x, L.academy.y, {
        width: L.academy.w,
        align: L.academy.align,
      });
  }

  if (eventName && L.event.w > 0) {
    doc
      .font("Helvetica-Bold")
      .fontSize(L.event.size)
      .fillColor(L.event.color)
      .text(eventName, L.event.x, L.event.y, {
        width: L.event.w,
        align: L.event.align,
      });
  }

  if (total !== "" && L.total.w > 0) {
    doc
      .font("Helvetica")
      .fontSize(L.total.size)
      .fillColor(L.total.color)
      .text(`Total Score: ${total}`, L.total.x, L.total.y, {
        width: L.total.w,
        align: L.total.align,
      });
  }

  if (rank !== "" && L.rank.w > 0) {
    doc
      .font("Helvetica")
      .fontSize(L.rank.size)
      .fillColor(L.rank.color)
      .text(`Rank: ${rank}`, L.rank.x, L.rank.y, {
        width: L.rank.w,
        align: L.rank.align,
      });
  }

  if (bibNo && L.bibNo.w > 0) {
    doc
      .font("Helvetica")
      .fontSize(L.bibNo.size)
      .fillColor(L.bibNo.color)
      .text(`BIB No: ${bibNo}`, L.bibNo.x, L.bibNo.y, {
        width: L.bibNo.w,
        align: L.bibNo.align,
      });
  }

  if (dateText && L.date.w > 0) {
    doc
      .font("Helvetica")
      .fontSize(L.date.size)
      .fillColor(L.date.color)
      .text(dateText || "", L.date.x, L.date.y, {
        width: L.date.w,
        align: L.date.align,
      });
  }

  if (showSerial && serialNo && L.serial.w > 0) {
    doc
      .font("Helvetica-Bold")
      .fontSize(L.serial.size)
      .fillColor(L.serial.color)
      .text(serialNo, L.serial.x, L.serial.y, {
        width: L.serial.w,
        align: L.serial.align,
      });
  }

  if (showQr && qrText && L.qr.size > 0) {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrText, {
        errorCorrectionLevel: "M",
        margin: 0,
        width: Math.round(L.qr.size),
      });

      const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
      const qrBuffer = Buffer.from(qrBase64, "base64");

      doc.image(qrBuffer, L.qr.x, L.qr.y, {
        width: L.qr.size,
        height: L.qr.size,
      });

      if (L.qr.label) {
        doc
          .font("Helvetica")
          .fontSize(L.qr.labelSize)
          .fillColor(L.qr.labelColor)
          .text(L.qr.label, L.qr.x, L.qr.y + L.qr.size + 2, {
            width: L.qr.size,
            align: "center",
          });
      }
    } catch {
      // ignore
    }
  }

  return doc;
}

/**
 * =========================================================
 * PDFKIT TO BUFFER
 * =========================================================
 */
export async function pdfkitToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.end();
  });
}

/**
 * =========================================================
 * MERGE TEMPLATE WITH OVERLAY
 * =========================================================
 */
export async function mergeTemplateWithOverlay(templateBuffer, overlayBuffer) {
  const templatePdf = await PDFLibDocument.load(templateBuffer);
  const overlayPdf = await PDFLibDocument.load(overlayBuffer);

  const [overlayPage] = await templatePdf.copyPages(overlayPdf, [0]);
  const templatePage = templatePdf.getPage(0);

  templatePage.drawPage(overlayPage);

  return Buffer.from(await templatePdf.save());
}

/**
 * =========================================================
 * DEFAULT OVERLAY LAYOUT
 * Tuned for Rebel Angels uploaded certificate template.
 *
 * A4 landscape PDFKit size is usually:
 * width  = 841.89
 * height = 595.28
 *
 * The name box is now restricted to the decorative black line area.
 * =========================================================
 */
function normalizeOverlayLayout(layout, pageW, pageH) {
  return {
    /**
     * Participant name.
     *
     * Important:
     * - x starts near the left end of the decorative line.
     * - w ends before the right end of the decorative line.
     * - short names stay centered.
     * - long names shrink and stay inside the line.
     */
    name: {
      x: 282,
      y: 220,
      w: pageW - 392,
      align: "center",
      font: "Helvetica-Bold",
      size: 31,
      minSize: 12,
      color: "#0B1220",
      lineGap: 0,
      ...(layout.name || {}),
    },

    /**
     * Hidden by default because the uploaded certificate already contains
     * the designed body text.
     */
    group: {
      x: 0,
      y: -500,
      w: 0,
      align: "center",
      size: 1,
      color: "#FFFFFF",
      ...(layout.group || {}),
    },

    academy: {
      x: 0,
      y: -500,
      w: 0,
      align: "center",
      size: 1,
      color: "#FFFFFF",
      ...(layout.academy || {}),
    },

    event: {
      x: 0,
      y: -500,
      w: 0,
      align: "center",
      size: 1,
      color: "#FFFFFF",
      ...(layout.event || {}),
    },

    total: {
      x: 0,
      y: -500,
      w: 0,
      align: "center",
      size: 1,
      color: "#FFFFFF",
      ...(layout.total || {}),
    },

    rank: {
      x: 0,
      y: -500,
      w: 0,
      align: "center",
      size: 1,
      color: "#FFFFFF",
      ...(layout.rank || {}),
    },

    bibNo: {
      x: 0,
      y: -500,
      w: 0,
      align: "center",
      size: 1,
      color: "#FFFFFF",
      ...(layout.bibNo || {}),
    },

    /**
     * Bottom-left date.
     */
    date: {
      x: 76,
      y: pageH - 54,
      w: 130,
      align: "left",
      size: 10,
      color: "#111827",
      ...(layout.date || {}),
    },

    /**
     * Bottom-left serial number.
     */
    serial: {
      x: 76,
      y: pageH - 32,
      w: 250,
      align: "left",
      size: 10,
      color: "#DC2626",
      ...(layout.serial || {}),
    },

    /**
     * Bottom-right QR.
     */
    qr: {
      x: pageW - 120,
      y: pageH - 98,
      size: 66,
      label: "Verify",
      labelSize: 8,
      labelColor: "#6B7280",
      ...(layout.qr || {}),
    },
  };
}

/* =========================
 * Helpers
 * ========================= */

function drawFitText(
  doc,
  text,
  {
    x,
    y,
    w,
    align = "center",
    font = "Helvetica-Bold",
    maxSize = 34,
    minSize = 12,
    color = "#111827",
    lineGap = 0,
    noWrap = true,
  },
) {
  const safeText = String(text || "").trim();
  if (!safeText || !w || w <= 0) return;

  let size = Number(maxSize || 34);
  const min = Number(minSize || 12);

  doc.font(font).fontSize(size);

  while (size > min && doc.widthOfString(safeText) > w) {
    size -= 1;
    doc.font(font).fontSize(size);
  }

  doc
    .font(font)
    .fontSize(size)
    .fillColor(color)
    .text(safeText, x, y, {
      width: w,
      align,
      lineGap,
      lineBreak: !noWrap ? true : false,
      ellipsis: false,
    });
}

function drawSoftFrame(doc, x, y, w, h) {
  doc.save();

  doc
    .roundedRect(x, y, w, h, 18)
    .lineWidth(1)
    .strokeColor("rgba(15,23,42,0.12)")
    .stroke();

  doc.restore();
}

function drawDotBorder(doc, { x, y, w, h, r, gap, colors }) {
  const left = x;
  const right = x + w;
  const top = y;
  const bottom = y + h;

  for (let i = 0, px = left + r; px <= right - r; i++, px += gap) {
    dot(doc, px, top + r, r, colors[i % colors.length]);
  }

  for (let i = 0, px = left + r; px <= right - r; i++, px += gap) {
    dot(doc, px, bottom - r, r, colors[(i + 2) % colors.length]);
  }

  for (let i = 0, py = top + r; py <= bottom - r; i++, py += gap) {
    dot(doc, left + r, py, r, colors[(i + 4) % colors.length]);
  }

  for (let i = 0, py = top + r; py <= bottom - r; i++, py += gap) {
    dot(doc, right - r, py, r, colors[(i + 6) % colors.length]);
  }
}

function dot(doc, x, y, r, color) {
  doc.save();
  doc.circle(x, y, r).fillColor(color).fill();
  doc.restore();
}

function drawStarsRow(doc, { cx, y, count, size, gap, color }) {
  const totalW = (count - 1) * gap;
  const startX = cx - totalW / 2;

  for (let i = 0; i < count; i++) {
    drawStar(doc, startX + i * gap, y, size, color);
  }
}

function drawStar(doc, cx, cy, r, color) {
  const pts = [];
  const spikes = 5;
  const outer = r;
  const inner = r * 0.45;

  for (let i = 0; i < spikes * 2; i++) {
    const ang = (Math.PI / spikes) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? outer : inner;

    pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
  }

  doc.save();
  doc
    .polygon(...pts)
    .fillColor(color)
    .fill();
  doc.restore();
}

function drawLineLabel(doc, { x, y, w, label, value, color, muted }) {
  doc.save();

  doc
    .moveTo(x, y)
    .lineTo(x + w, y)
    .lineWidth(1)
    .strokeColor("rgba(15,23,42,0.22)")
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(muted)
    .text(label, x, y + 8, {
      width: w,
      align: "center",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(color)
    .text(value || "", x, y + 22, {
      width: w,
      align: "center",
    });

  doc.restore();
}
