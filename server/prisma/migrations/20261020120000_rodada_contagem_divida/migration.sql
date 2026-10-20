-- Falência: o contador rodadasDevendo sobe no máximo uma vez por turno
-- (antes, cada rolagem extra de um duplo contava de novo).
ALTER TABLE "session_players" ADD COLUMN "rodadaContagemDivida" INTEGER;
