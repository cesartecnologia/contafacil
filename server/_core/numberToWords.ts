/**
 * Converte um número em sua representação por extenso em português brasileiro
 * Exemplo: 1234.56 -> "um mil, duzentos e trinta e quatro reais e cinquenta e seis centavos"
 */

const unidades = [
  "",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
];

const dezenas = [
  "",
  "dez",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];

const especiais = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];

const centenas = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

function converterGrupo(num: number): string {
  if (num === 0) return "";

  let resultado = "";

  const c = Math.floor(num / 100);
  const d = Math.floor((num % 100) / 10);
  const u = num % 10;

  if (c > 0) {
    if (c === 1 && d === 0 && u === 0) {
      resultado = "cem";
    } else {
      resultado = centenas[c];
    }
  }

  if (d === 1) {
    if (resultado) resultado += " e ";
    resultado += especiais[u];
  } else {
    if (d > 0) {
      if (resultado) resultado += " e ";
      resultado += dezenas[d];
    }

    if (u > 0) {
      if (resultado && d === 0 && c > 0) resultado += " e ";
      else if (resultado && d > 0) resultado += " e ";
      resultado += unidades[u];
    }
  }

  return resultado;
}

export function numberToWords(valor: number): string {
  if (valor === 0) return "zero";

  const partes = valor.toString().split(".");
  const inteira = parseInt(partes[0], 10);
  const decimal = partes[1] ? parseInt(partes[1].padEnd(2, "0").substring(0, 2), 10) : 0;

  let resultado = "";

  if (inteira === 0) {
    resultado = "zero";
  } else if (inteira < 1000) {
    resultado = converterGrupo(inteira);
  } else {
    let restante = inteira;
    let primeiro = true;

    // Bilhões
    const bilhoes = Math.floor(restante / 1000000000);
    if (bilhoes > 0) {
      resultado = converterGrupo(bilhoes) + (bilhoes > 1 ? " bilhões" : " bilhão");
      restante = restante % 1000000000;
      primeiro = false;
    }

    // Milhões
    const milhoes = Math.floor(restante / 1000000);
    if (milhoes > 0) {
      if (!primeiro) resultado += " ";
      resultado += converterGrupo(milhoes) + (milhoes > 1 ? " milhões" : " milhão");
      restante = restante % 1000000;
      primeiro = false;
    }

    // Milhares
    const milhares = Math.floor(restante / 1000);
    if (milhares > 0) {
      if (!primeiro) resultado += " ";
      resultado += converterGrupo(milhares) + " mil";
      restante = restante % 1000;
      primeiro = false;
    }

    // Unidades
    if (restante > 0) {
      if (!primeiro) resultado += " ";
      resultado += converterGrupo(restante);
    }
  }

  // Adicionar reais e centavos
  const reaisTexto = resultado.charAt(0).toUpperCase() + resultado.slice(1);
  const reaisFinal = inteira === 1 ? reaisTexto + " real" : reaisTexto + " reais";

  if (decimal > 0) {
    const centavosTexto = converterGrupo(decimal);
    const centavosFinal = decimal === 1 ? centavosTexto + " centavo" : centavosTexto + " centavos";
    return reaisFinal + " e " + centavosFinal;
  }

  return reaisFinal;
}
