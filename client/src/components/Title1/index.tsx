export default function Title1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-2xl font-bold font-jaro text-zinc-100">
      {children}
    </h1>
  )
}