export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[70vh] gap-4">
      {/* Círculo Giratório (Spinner) com as cores do IFNMG */}
      <div className="relative flex items-center justify-center w-16 h-16">
        <div className="absolute w-full h-full border-4 border-gray-200 rounded-full"></div>
        <div className="absolute w-full h-full border-4 border-green-700 rounded-full border-t-transparent animate-spin"></div>
      </div>

      {/* Texto com efeito de pulsação suave */}
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-lg font-bold text-gray-700 animate-pulse">
          A carregar...
        </h3>
        <p className="text-sm text-gray-500">A preparar os dados do sistema</p>
      </div>
    </div>
  );
}
