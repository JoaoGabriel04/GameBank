const { comFilaDeEmits, emitirOuEnfileirar, enfileirarSnapshot } = await import("../../lib/fila-de-emits.js");

function registro() {
  const log: string[] = [];
  const snapshot = async (id: number) => { log.push(`snapshot:${id}`); };
  const evento = (nome: string) => emitirOuEnfileirar(() => log.push(`evento:${nome}`));
  return { log, snapshot, evento };
}

describe("fila de emits (coalescência de broadcasts)", () => {
  it("fora de um escopo, nada é enfileirado", () => {
    const { log, evento } = registro();
    evento("a");
    expect(log).toEqual(["evento:a"]);
    expect(enfileirarSnapshot(1)).toBe(false);
  });

  it("snapshots consecutivos da mesma sessão viram um só, no fim do escopo", async () => {
    const { log, snapshot } = registro();
    await comFilaDeEmits(async () => {
      enfileirarSnapshot(1);
      enfileirarSnapshot(1);
      enfileirarSnapshot(1);
      expect(log).toEqual([]); // nada sai antes do fim do escopo
    }, snapshot);
    expect(log).toEqual(["snapshot:1"]);
  });

  it("um evento entre dois snapshots mantém a ordem (não coalesce através dele)", async () => {
    const { log, snapshot, evento } = registro();
    await comFilaDeEmits(async () => {
      evento("extrato");
      enfileirarSnapshot(1);
      evento("evento:mudou");
      enfileirarSnapshot(1);
      enfileirarSnapshot(1);
    }, snapshot);
    expect(log).toEqual(["evento:extrato", "snapshot:1", "evento:evento:mudou", "snapshot:1"]);
  });

  it("escopo aninhado só repassa; quem descarrega é o mais externo", async () => {
    const { log, snapshot } = registro();
    await comFilaDeEmits(async () => {
      await comFilaDeEmits(async () => { enfileirarSnapshot(2); }, snapshot);
      expect(log).toEqual([]);
      enfileirarSnapshot(2);
    }, snapshot);
    expect(log).toEqual(["snapshot:2"]);
  });

  it("descarrega mesmo quando a ação falha", async () => {
    const { log, snapshot, evento } = registro();
    await expect(comFilaDeEmits(async () => {
      enfileirarSnapshot(3);
      evento("toast");
      throw new Error("falhou no meio");
    }, snapshot)).rejects.toThrow("falhou no meio");
    expect(log).toEqual(["snapshot:3", "evento:toast"]);
  });
});
