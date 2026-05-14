import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { numberToWords } from "./numberToWords";

interface ReceiptData {
  companyName: string;
  companyCnpj: string;
  companyAddress?: string;
  companyPhone?: string;
  companyLogoUrl?: string;
  clientName: string;
  clientCpfCnpj: string;
  clientAddress?: string;
  competence: string;
  amount: number;
  amountWords: string;
  dueDate: Date;
  receiptNumber?: string;
  paidDate?: Date;
  paymentMethod?: string;
}

function sanitizeText(text: string) {
  return text.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "");
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function wrapText(text: string, maxChars: number) {
  const words = sanitizeText(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function paymentMethodLabel(paymentMethod?: string) {
  switch (paymentMethod) {
    case "pix":
      return "PIX";
    case "dinheiro":
      return "Dinheiro";
    case "boleto":
      return "Boleto";
    case "cartao_credito":
      return "Cartão de crédito";
    case "cartao_debito":
      return "Cartão de débito";
    case "transferencia":
      return "Transferência";
    case "outros":
      return "Outros";
    default:
      return "Não informado";
  }
}

async function loadLogo(pdfDoc: PDFDocument, logoUrl?: string) {
  if (!logoUrl) return null;

  try {
    // Evita requisições HTTP arbitrárias no servidor durante a geração do PDF.
    // O sistema salva o logotipo como Data URL PNG/JPEG validado na API.
    const match = logoUrl.match(/^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) return null;

    const imageType = match[1].toLowerCase();
    const bytes = Uint8Array.from(Buffer.from(match[2].replace(/\s+/g, ""), "base64"));
    if (!bytes.length || bytes.length > 900 * 1024) return null;

    return imageType === "png" ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function generateReceipt(data: ReceiptData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogo(pdfDoc, data.companyLogoUrl);

  const accent = rgb(0.72, 0.08, 0.12);
  const accentSoft = rgb(0.985, 0.965, 0.967);
  const dark = rgb(0.14, 0.14, 0.17);
  const muted = rgb(0.40, 0.40, 0.45);
  const border = rgb(0.84, 0.84, 0.87);
  const white = rgb(1, 1, 1);

  const margin = 42;
  const contentWidth = width - margin * 2;
  let y = height - 42;

  const drawText = (text: string, x: number, yPos: number, size = 10, isBold = false, color = dark) => {
    page.drawText(sanitizeText(text), {
      x,
      y: yPos,
      size,
      font: isBold ? bold : regular,
      color,
    });
  };

  const drawLine = (yPos: number, x = margin, lineWidth = contentWidth, color = border, thickness = 0.8) => {
    page.drawLine({
      start: { x, y: yPos },
      end: { x: x + lineWidth, y: yPos },
      thickness,
      color,
    });
  };

  const drawBox = (topY: number, boxHeight: number, fill = white) => {
    page.drawRectangle({
      x: margin,
      y: topY - boxHeight,
      width: contentWidth,
      height: boxHeight,
      borderWidth: 1,
      borderColor: border,
      color: fill,
    });
  };

  // Cabeçalho institucional limpo, sem borda e sem fundo na área da logo.
  const headerHeight = 92;

  if (logo) {
    const maxW = 102;
    const maxH = 60;
    const scale = Math.min(maxW / logo.width, maxH / logo.height);
    const logoWidth = logo.width * scale;
    const logoHeight = logo.height * scale;

    // Alinha visualmente a parte útil da logo com o topo do bloco de dados da empresa.
    // Algumas logos possuem área transparente interna e acabam aparentando estar baixas.
    const logoTop = y - 14;

    page.drawImage(logo, {
      x: margin + (102 - logoWidth) / 2,
      y: logoTop - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });
  } else {
    drawText("ContaFácil", margin + 10, y - 52, 13, true, accent);
  }

  const companyX = margin + 134;
  drawText(data.companyName, companyX, y - 25, 13, true, dark);
  drawText(`CNPJ: ${data.companyCnpj}`, companyX, y - 43, 9.5, false, muted);
  if (data.companyPhone) drawText(`Telefone: ${data.companyPhone}`, companyX, y - 58, 9.5, false, muted);
  if (data.companyAddress) {
    wrapText(`Endereço: ${data.companyAddress}`, 65)
      .slice(0, 2)
      .forEach((line, index) => drawText(line, companyX, y - 73 - index * 12, 9.5, false, muted));
  }

  drawLine(y - headerHeight + 2, margin, contentWidth, border, 0.9);
  y -= headerHeight + 26;

  drawText("RECIBO DE HONORÁRIOS CONTÁBEIS", margin, y, 17, true, accent);
  drawText(data.receiptNumber ? `Recibo nº ${data.receiptNumber}` : "Comprovante de recebimento", width - margin - 158, y + 2, 10, true, muted);
  y -= 18;
  drawLine(y, margin, contentWidth, accent, 1.4);
  y -= 24;

  // Resumo financeiro.
  const summaryHeight = 72;
  drawBox(y, summaryHeight, accentSoft);
  drawText("Valor recebido", margin + 16, y - 18, 9.5, true, muted);
  drawText(formatCurrency(data.amount), margin + 16, y - 47, 22, true, accent);
  drawText(`Competência: ${data.competence}`, margin + 282, y - 22, 10, true, dark);
  drawText(`Vencimento: ${data.dueDate.toLocaleDateString("pt-BR")}`, margin + 282, y - 40, 10, false, muted);
  drawText(`Pagamento: ${paymentMethodLabel(data.paymentMethod)}`, margin + 282, y - 58, 10, false, muted);
  y -= summaryHeight + 24;

  // Dados do cliente.
  drawText("Dados do cliente", margin, y, 11, true, accent);
  y -= 10;
  const clientHeight = 82;
  drawBox(y + 2, clientHeight, white);
  drawText(data.clientName, margin + 16, y - 18, 11, true, dark);
  drawText(`CPF/CNPJ: ${data.clientCpfCnpj}`, margin + 16, y - 37, 10, false, muted);
  if (data.clientAddress) {
    wrapText(`Endereço: ${data.clientAddress}`, 86)
      .slice(0, 2)
      .forEach((line, index) => drawText(line, margin + 16, y - 56 - index * 13, 10, false, muted));
  }
  y -= clientHeight + 30;

  // Declaração.
  drawText("Declaração", margin, y, 11, true, accent);
  y -= 10;
  const declarationHeight = 118;
  drawBox(y + 2, declarationHeight, white);
  const declaration = `Recebemos de ${data.clientName} a importância de ${formatCurrency(data.amount)} (${data.amountWords}), referente aos honorários contábeis da competência ${data.competence}.`;
  wrapText(declaration, 92)
    .slice(0, 5)
    .forEach((line, index) => drawText(line, margin + 16, y - 20 - index * 15, 10, false, dark));
  drawText(`Forma de pagamento: ${paymentMethodLabel(data.paymentMethod)}`, margin + 16, y - 92, 10, true, accent);
  if (data.paidDate) drawText(`Data de pagamento: ${data.paidDate.toLocaleDateString("pt-BR")}`, margin + 262, y - 92, 10, true, dark);
  y -= declarationHeight + 28;

  // Informações de emissão.
  drawText("Informações do documento", margin, y, 11, true, accent);
  y -= 10;
  const infoHeight = 58;
  drawBox(y + 2, infoHeight, white);
  drawText(`Emissão: ${new Date().toLocaleDateString("pt-BR")}`, margin + 16, y - 20, 10, false, muted);
  drawText(`Situação: ${data.paidDate ? "Pago" : "Emitido"}`, margin + 204, y - 20, 10, true, accent);
  drawText(`Vencimento original: ${data.dueDate.toLocaleDateString("pt-BR")}`, margin + 334, y - 20, 10, false, muted);
  y -= infoHeight + 54;

  // Assinatura.
  page.drawLine({
    start: { x: margin + 92, y },
    end: { x: width - margin - 92, y },
    thickness: 0.8,
    color: border,
  });
  drawText("Assinatura do prestador / responsável", margin + 164, y - 18, 9.5, false, muted);

  // Rodapé discreto.
  drawLine(42, margin, contentWidth, border, 0.8);
  drawText("Documento gerado pelo ContaFácil", margin, 24, 9, false, muted);
  drawText("Recibo de honorários contábeis", width - margin - 160, 24, 9, false, muted);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export function getAmountInWords(amount: number): string {
  return numberToWords(amount);
}
