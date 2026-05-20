'use client';

import { useState, useEffect } from 'react';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useGameStore } from '@/stores/gameStore';
import { Player, PlayerColor } from '@/types/game';
import { useToast } from '@/components/Toast';
import Modal from '../Modal';
import ColorDropdown from '../ColorDropdown';

interface MenuOptionsProps {
  playerId: number;
  playerName: string;
  show: boolean;
  onToggle: () => void;
}

export default function MenuOptions({
  playerId,
  playerName,
  show,
  onToggle,
}: MenuOptionsProps) {
  const { success: toastSuccess, error: toastError } = useToast()
  const { editPlayer, removePlayer, getAvailableColors, getPlayerById } =
    useGameStore();

  const [player, setPlayer] = useState<Player | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<PlayerColor | null>(null);
  const [availableColors, setAvailableColors] = useState<PlayerColor[]>([]);

  // Carrega o jogador do store
  useEffect(() => {
    const fetchPlayer = async () => {
      const p = await getPlayerById(playerId);
      if (p) {
        setPlayer(p);
        setEditName(p.nome);
        setEditColor(p.cor);
      }
    };
    fetchPlayer();
  }, [playerId, getPlayerById]);

  // Atualiza cores disponíveis
  useEffect(() => {
    if (player) {
      setAvailableColors(getAvailableColors(player.id));
    }
  }, [player, getAvailableColors]);

  const handleEdit = () => {
    if (!player) return;
    setEditName(player.nome);
    setEditColor(player.cor);
    setShowEditModal(true);
    onToggle();
  };

  const handleRemove = () => {
    if (
      window.confirm(
        `Tem certeza que deseja remover ${playerName}? Todas as propriedades serão liberadas.`
      )
    ) {
      removePlayer(playerId)
      .then(() => {
        toastSuccess(`${playerName} foi removido do jogo`);
      })
      .catch((error) => {
        console.error('Erro ao remover jogador: ', error);
        toastError('Erro ao remover jogador');
      });
      
    }
    onToggle();
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toastError('Nome não pode estar vazio');
      return;
    }

    if (!editColor) {
      toastError('Selecione uma cor');
      return;
    }

    await editPlayer(playerId, editName.trim(), editColor);
    setShowEditModal(false);
    toastSuccess('Jogador atualizado com sucesso!');
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={onToggle}
          className="p-1 rounded-full hover:bg-zinc-700 hover:bg-opacity-50 hover:text-zinc-100 transition-colors cursor-pointer text-zinc-300"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {show && (
          <div className="absolute right-0 top-8 z-20 w-48 bg-zinc-800 rounded-md shadow-lg border border-zinc-700 py-1">
            <button
              onClick={handleEdit}
              className="w-full flex items-center px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Editar Jogador
            </button>
            <button
              onClick={handleRemove}
              className="w-full flex items-center px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remover Jogador
            </button>
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Jogador"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Nome
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full text-zinc-100 bg-zinc-800 rounded-md border border-zinc-600 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-zinc-500"
              placeholder="Digite o nome do jogador"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Cor
            </label>
            <ColorDropdown
              value={editColor}
              onChange={setEditColor}
              availableColors={
                editColor
                  ? [...availableColors, editColor].filter(Boolean) as PlayerColor[]
                  : availableColors
              }
              placeholder="Selecione uma cor"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              onClick={() => setShowEditModal(false)}
              className="flex-1 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEdit}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors cursor-pointer"
            >
              Salvar
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}