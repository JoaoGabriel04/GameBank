# Sons da abertura de baú

Arquivos que a Fase 2 do plano de animações espera em `client/public/sounds/` (mesmo fluxo dos sons atuais). Enquanto um arquivo não existir, o som correspondente fica mudo, sem erro.

Formato: mp3 mono, 96 kbps, com fade-out no fim (cerca de 12 KB por segundo). Todos carregam só quando um baú abre, nunca na primeira carga.

| Arquivo | Quando toca | Duração | Caráter |
|---|---|---|---|
| `bau-carregando.mp3` | Antecipação: o baú tremendo antes do estouro | 1,5–2 s | Grave crescente, tensão subindo; termina num corte seco |
| `bau-estouro.mp3` | O flash do estouro | 0,6–0,8 s | Impacto + brilho no ataque, cauda curta de reverberação |
| `carta-virou.mp3` | Cada item virando | 0,2–0,3 s | Papel/carta firme, sem tom |
| `raro.mp3` | Revelação de item raro | 0,5 s | Brilho curto, um acorde |
| `epico.mp3` | Revelação de item épico | 0,8 s | Brilho + "zap" de energia |
| `lendario.mp3` | Revelação de item lendário | 1,5–2 s | Coro/metais curtos, triunfal |
| `contagem-moedas.mp3` | Tique da contagem de moedas (toca repetido) | 0,08–0,12 s | Moeda pequena, agudo e limpo |

Volume e mudo seguem a configuração "Efeitos Sonoros".
