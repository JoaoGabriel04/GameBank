import { prisma } from "../lib/prisma.js";

const titulos = [
  // ── COMUNS ──
  { name: "Poupador",    description: "Guarda cada centavo",                    price: 0, icon: "sparkles", type: "title", value: '{"title":"Poupador"}',    raridade: "COMUM",    available: true, animated: false, fragmentavel: true, fragmentosTotal: 30 },
  { name: "Corretor",    description: "Conhece cada rua do tabuleiro",          price: 0, icon: "sparkles", type: "title", value: '{"title":"Corretor"}',    raridade: "COMUM",    available: true, animated: false, fragmentavel: true, fragmentosTotal: 30 },
  { name: "Inquilino",   description: "Sempre pagando aluguel dos outros",      price: 0, icon: "sparkles", type: "title", value: '{"title":"Inquilino"}',   raridade: "COMUM",    available: true, animated: false, fragmentavel: true, fragmentosTotal: 30 },
  { name: "Iniciante",   description: "Ainda aprendendo as regras",             price: 0, icon: "sparkles", type: "title", value: '{"title":"Iniciante"}',   raridade: "COMUM",    available: true, animated: false, fragmentavel: true, fragmentosTotal: 30 },
  { name: "Caminhante",  description: "Sempre andando pelo tabuleiro",          price: 0, icon: "sparkles", type: "title", value: '{"title":"Caminhante"}',  raridade: "COMUM",    available: true, animated: false, fragmentavel: true, fragmentosTotal: 30 },
  { name: "Trocador",    description: "Especialista em trocos",                 price: 0, icon: "sparkles", type: "title", value: '{"title":"Trocador"}',    raridade: "COMUM",    available: true, animated: false, fragmentavel: true, fragmentosTotal: 30 },

  // ── INCOMUNS ──
  { name: "Especulador",    description: "Aposta no que os outros ignoram",         price: 0, icon: "sparkles", type: "title", value: '{"title":"Especulador"}',    raridade: "INCOMUM",  available: true, animated: false, fragmentavel: true, fragmentosTotal: 50 },
  { name: "Empreendedor",   description: "Transforma terreno em negócio",           price: 0, icon: "sparkles", type: "title", value: '{"title":"Empreendedor"}',   raridade: "INCOMUM",  available: true, animated: false, fragmentavel: true, fragmentosTotal: 50 },
  { name: "Construtor",     description: "Casas na manga, hotéis no bolso",         price: 0, icon: "sparkles", type: "title", value: '{"title":"Construtor"}',     raridade: "INCOMUM",  available: true, animated: false, fragmentavel: true, fragmentosTotal: 50 },
  { name: "Negociador",     description: "Nenhum acordo escapa das suas mãos",      price: 0, icon: "sparkles", type: "title", value: '{"title":"Negociador"}',     raridade: "INCOMUM",  available: true, animated: false, fragmentavel: true, fragmentosTotal: 50 },
  { name: "Arrecadador",    description: "Sempre recebendo de alguém",              price: 0, icon: "sparkles", type: "title", value: '{"title":"Arrecadador"}',    raridade: "INCOMUM",  available: true, animated: false, fragmentavel: true, fragmentosTotal: 50 },
  { name: "Rentista",       description: "Vive de aluguéis alheios",               price: 0, icon: "sparkles", type: "title", value: '{"title":"Rentista"}',       raridade: "INCOMUM",  available: true, animated: false, fragmentavel: true, fragmentosTotal: 50 },

  // ── RAROS ──
  { name: "Banqueiro",           description: "O banco obedece às suas ordens",           price: 0, icon: "sparkles", type: "title", value: '{"title":"Banqueiro"}',           raridade: "RARO",     available: true, animated: false, fragmentavel: true, fragmentosTotal: 80 },
  { name: "Tycoon",              description: "Império construído tijolo a tijolo",        price: 0, icon: "sparkles", type: "title", value: '{"title":"Tycoon"}',              raridade: "RARO",     available: true, animated: false, fragmentavel: true, fragmentosTotal: 80 },
  { name: "Especulador de Elite",description: "Onde outros veem risco, vê oportunidade",  price: 0, icon: "sparkles", type: "title", value: '{"title":"Especulador de Elite"}', raridade: "RARO",     available: true, animated: false, fragmentavel: true, fragmentosTotal: 80 },
  { name: "Síndico",             description: "Dono de cada condomínio do mapa",          price: 0, icon: "sparkles", type: "title", value: '{"title":"Síndico"}',             raridade: "RARO",     available: true, animated: false, fragmentavel: true, fragmentosTotal: 80 },
  { name: "Hipotecador",         description: "Sabe quando ceder para avançar",           price: 0, icon: "sparkles", type: "title", value: '{"title":"Hipotecador"}',         raridade: "RARO",     available: true, animated: false, fragmentavel: true, fragmentosTotal: 80 },
  { name: "Magnata",             description: "Propriedades demais para contar",          price: 0, icon: "sparkles", type: "title", value: '{"title":"Magnata"}',             raridade: "RARO",     available: true, animated: false, fragmentavel: true, fragmentosTotal: 80 },

  // ── ÉPICOS ──
  { name: "Oligarca",              description: "Poder concentrado em poucas mãos",              price: 0, icon: "sparkles", type: "title", value: '{"title":"Oligarca"}',              raridade: "EPICO",    available: true, animated: true, fragmentavel: true, fragmentosTotal: 120 },
  { name: "Imperador das Finanças",description: "Seu decreto vale ouro",                         price: 0, icon: "sparkles", type: "title", value: '{"title":"Imperador das Finanças"}', raridade: "EPICO",    available: true, animated: true, fragmentavel: true, fragmentosTotal: 120 },
  { name: "Tubarão",               description: "Devora patrimônios inteiros",                   price: 0, icon: "sparkles", type: "title", value: '{"title":"Tubarão"}',               raridade: "EPICO",    available: true, animated: true, fragmentavel: true, fragmentosTotal: 120 },
  { name: "Barão do Imóvel",       description: "Senhor de todas as propriedades",               price: 0, icon: "sparkles", type: "title", value: '{"title":"Barão do Imóvel"}',       raridade: "EPICO",    available: true, animated: true, fragmentavel: true, fragmentosTotal: 120 },
  { name: "Grande Investidor",     description: "Nenhum ativo escapa ao seu radar",              price: 0, icon: "sparkles", type: "title", value: '{"title":"Grande Investidor"}',     raridade: "EPICO",    available: true, animated: true, fragmentavel: true, fragmentosTotal: 120 },
  { name: "Mestre da Hipoteca",    description: "Joga com dívidas como cartas na manga",         price: 0, icon: "sparkles", type: "title", value: '{"title":"Mestre da Hipoteca"}',    raridade: "EPICO",    available: true, animated: true, fragmentavel: true, fragmentosTotal: 120 },
  { name: "O Cobrador",            description: "Ninguém foge do seu aluguel",                   price: 0, icon: "sparkles", type: "title", value: '{"title":"O Cobrador"}',            raridade: "EPICO",    available: true, animated: true, fragmentavel: true, fragmentosTotal: 120 },
  { name: "Senhor do Tabuleiro",   description: "O mapa inteiro é território seu",               price: 0, icon: "sparkles", type: "title", value: '{"title":"Senhor do Tabuleiro"}',   raridade: "EPICO",    available: true, animated: true, fragmentavel: true, fragmentosTotal: 120 },
  { name: "Executivo Supremo",     description: "Decisões que movem mercados",                   price: 0, icon: "sparkles", type: "title", value: '{"title":"Executivo Supremo"}',     raridade: "EPICO",    available: true, animated: true, fragmentavel: true, fragmentosTotal: 120 },
  { name: "Arquiteto do Caos",     description: "Constrói impérios na desordem alheia",          price: 0, icon: "sparkles", type: "title", value: '{"title":"Arquiteto do Caos"}',     raridade: "EPICO",    available: true, animated: true, fragmentavel: true, fragmentosTotal: 120 },
  { name: "Oráculo Financeiro",    description: "Prevê falências antes que aconteçam",           price: 0, icon: "sparkles", type: "title", value: '{"title":"Oráculo Financeiro"}',    raridade: "EPICO",    available: true, animated: true, fragmentavel: true, fragmentosTotal: 120 },
  { name: "Predador do Mercado",   description: "Compra barato, vende caro, sempre",             price: 0, icon: "sparkles", type: "title", value: '{"title":"Predador do Mercado"}',   raridade: "EPICO",    available: true, animated: true, fragmentavel: true, fragmentosTotal: 120 },

  // ── LENDÁRIOS ──
  { name: "Rei do Mercado",    description: "O mercado segue seus passos",                    price: 0, icon: "sparkles", type: "title", value: '{"title":"Rei do Mercado"}',    raridade: "LENDARIO", available: true, animated: true, fragmentavel: true, fragmentosTotal: 200 },
  { name: "O Intocável",       description: "Ninguém chega perto do seu patrimônio",         price: 0, icon: "sparkles", type: "title", value: '{"title":"O Intocável"}',       raridade: "LENDARIO", available: true, animated: true, fragmentavel: true, fragmentosTotal: 200 },
  { name: "Aura",              description: "Presença que intimida qualquer adversário",     price: 0, icon: "sparkles", type: "title", value: '{"title":"Aura"}',              raridade: "LENDARIO", available: true, animated: true, fragmentavel: true, fragmentosTotal: 200 },
  { name: "Lendário",          description: "Um nome que ecoa pelo tabuleiro",               price: 0, icon: "sparkles", type: "title", value: '{"title":"Lendário"}',          raridade: "LENDARIO", available: true, animated: true, fragmentavel: true, fragmentosTotal: 200 },
  { name: "O Último Banqueiro",description: "Quando os outros faliram, ele sobreviveu",     price: 0, icon: "sparkles", type: "title", value: '{"title":"O Último Banqueiro"}', raridade: "LENDARIO", available: true, animated: true, fragmentavel: true, fragmentosTotal: 200 },
  { name: "Deus das Finanças", description: "Acima de qualquer regra do jogo",              price: 0, icon: "sparkles", type: "title", value: '{"title":"Deus das Finanças"}',  raridade: "LENDARIO", available: true, animated: true, fragmentavel: true, fragmentosTotal: 200 },
  { name: "O Eterno",          description: "Impérios caem, o seu permanece",               price: 0, icon: "sparkles", type: "title", value: '{"title":"O Eterno"}',           raridade: "LENDARIO", available: true, animated: true, fragmentavel: true, fragmentosTotal: 200 },
  { name: "Senhor Absoluto",   description: "Domínio total, sem exceção",                   price: 0, icon: "sparkles", type: "title", value: '{"title":"Senhor Absoluto"}',    raridade: "LENDARIO", available: true, animated: true, fragmentavel: true, fragmentosTotal: 200 },
  { name: "O Inquebrável",     description: "Crises não existem no seu vocabulário",        price: 0, icon: "sparkles", type: "title", value: '{"title":"O Inquebrável"}',      raridade: "LENDARIO", available: true, animated: true, fragmentavel: true, fragmentosTotal: 200 },
  { name: "Fortunato",         description: "A sorte escolheu morar do seu lado",           price: 0, icon: "sparkles", type: "title", value: '{"title":"Fortunato"}',          raridade: "LENDARIO", available: true, animated: true, fragmentavel: true, fragmentosTotal: 200 },
];

async function seedTitulos() {
  console.log("[seed-titulos] Inserindo títulos na loja...");

  const result = await prisma.shopItem.createMany({
    skipDuplicates: true,
    data: titulos,
  });

  console.log(`[seed-titulos] ${result.count} títulos inseridos (duplicatas ignoradas).`);
  console.log(`[seed-titulos] Total esperado: ${titulos.length} títulos.`);
}

seedTitulos()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-titulos] Erro fatal:", err);
    process.exit(1);
  });
