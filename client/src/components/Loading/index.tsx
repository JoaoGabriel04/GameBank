export default function Loading({label}: { label?: string }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-800 p-6 rounded-lg shadow-xl flex flex-col items-center border border-zinc-700">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
        <p className="text-zinc-300">{label || "Carregando..."}</p>
      </div>
    </div>
  );
}
